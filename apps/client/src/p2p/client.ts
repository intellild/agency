import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import type { Connection } from '@libp2p/interface';
import { noise } from '@libp2p/noise';
import { webRTC } from '@libp2p/webrtc';
import { webSockets } from '@libp2p/websockets';
import { multiaddr } from '@multiformats/multiaddr';
import type { Libp2p } from 'libp2p';
import { createLibp2p } from 'libp2p';

export interface P2PConfig {
  serverPeerId: string;
  relayAddresses: string[];
  iceServers: RTCIceServer[];
}

export type ConnectionState =
  | 'idle'
  | 'relay-connecting'
  | 'relay-connected'
  | 'signal-exchanging'
  | 'webrtc-connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface P2PConnection {
  libp2p: Libp2p;
  serverConnection: Connection | null;
  state: ConnectionState;
  error: string | null;
}

// Check if browser supports WebRTC
export function isWebRTCSupported(): boolean {
  if (typeof window === 'undefined') return false;

  return !!(
    window.RTCPeerConnection &&
    window.RTCSessionDescription &&
    window.RTCIceCandidate
  );
}

// Check if required libp2p features are available
export function isLibp2pSupported(): boolean {
  if (typeof window === 'undefined') return false;

  // Check for WebAssembly support (required by some crypto operations)
  const hasWasm = (() => {
    try {
      if (
        typeof WebAssembly === 'object' &&
        typeof WebAssembly.instantiate === 'function'
      ) {
        const module = new WebAssembly.Module(
          Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00),
        );
        if (module instanceof WebAssembly.Module) {
          return (
            new WebAssembly.Instance(module) instanceof WebAssembly.Instance
          );
        }
      }
    } catch {
      // ignore
    }
    return false;
  })();

  return isWebRTCSupported() && hasWasm;
}

// P2P client class
export class P2PClient {
  private libp2p: Libp2p | null = null;
  private config: P2PConfig | null = null;
  private accessToken: string | null = null;
  private serverConnection: Connection | null = null;
  private state: ConnectionState = 'idle';
  private stateListeners: ((state: ConnectionState, error?: string) => void)[] =
    [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly reconnectBaseDelay = 1000;

  constructor() {
    this.setState('idle');
  }

  // Initialize with config and token
  initialize(config: P2PConfig, accessToken: string): void {
    this.config = config;
    this.accessToken = accessToken;
  }

  // Get current state
  getState(): ConnectionState {
    return this.state;
  }

  // Check if connected
  isConnected(): boolean {
    return this.state === 'connected' && this.serverConnection !== null;
  }

  // Subscribe to state changes
  onStateChange(
    listener: (state: ConnectionState, error?: string) => void,
  ): () => void {
    this.stateListeners.push(listener);
    return () => {
      const index = this.stateListeners.indexOf(listener);
      if (index > -1) {
        this.stateListeners.splice(index, 1);
      }
    };
  }

  // Set state and notify listeners
  private setState(state: ConnectionState, error?: string): void {
    this.state = state;
    this.stateListeners.forEach(listener => listener(state, error));
  }

  // Connect to server via Circuit Relay and WebRTC
  async connect(): Promise<boolean> {
    if (!this.config || !this.accessToken) {
      this.setState('error', 'P2P not initialized with config and token');
      return false;
    }

    if (!isLibp2pSupported()) {
      this.setState('error', 'Browser does not support required P2P features');
      return false;
    }

    // Already connected
    if (this.state === 'connected') {
      return true;
    }

    // Connecting in progress
    if (
      this.state === 'relay-connecting' ||
      this.state === 'webrtc-connecting'
    ) {
      return false;
    }

    try {
      this.setState('relay-connecting');

      // Create libp2p node
      this.libp2p = await createLibp2p({
        transports: [
          webRTC({
            rtcConfiguration: {
              iceServers: this.config.iceServers,
            },
          }),
          webSockets(),
          circuitRelayTransport(),
        ],
        connectionEncrypters: [noise()],
        streamMuxers: [yamux()],
      });

      // Start the node
      await this.libp2p.start();

      // Connect via Circuit Relay first
      const relayAddr =
        this.config.relayAddresses[0] ||
        `/dns4/localhost/tcp/9091/ws/p2p/${this.config.serverPeerId}`;

      const relayMultiaddr = multiaddr(relayAddr);

      this.setState('relay-connected');
      this.setState('signal-exchanging');

      // Dial the server through relay
      const serverPeerId = this.config.serverPeerId;
      const relayedAddr = multiaddr(
        `${relayAddr}/p2p-circuit/p2p/${serverPeerId}`,
      );

      this.serverConnection = await this.libp2p.dial(relayedAddr);

      // Check if we can establish direct WebRTC connection
      this.setState('webrtc-connecting');

      // Attempt direct WebRTC connection
      const webrtcAddr = multiaddr(
        `/dns4/localhost/udp/9090/webrtc-direct/p2p/${serverPeerId}`,
      );

      try {
        const directConnection = await this.libp2p.dial(webrtcAddr);

        // Close relay connection if direct WebRTC succeeds
        if (this.serverConnection) {
          await this.serverConnection.close();
        }
        this.serverConnection = directConnection;
      } catch (webrtcErr) {
        // Keep relay connection as fallback
        console.log('Direct WebRTC failed, using relay:', webrtcErr);
      }

      // Setup connection event handlers
      this.setupConnectionHandlers();

      this.reconnectAttempts = 0;
      this.setState('connected');
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.setState('error', errorMsg);

      // Schedule reconnect
      this.scheduleReconnect();
      return false;
    }
  }

  // Setup connection event handlers
  private setupConnectionHandlers(): void {
    if (!this.libp2p) return;

    this.libp2p.addEventListener('peer:disconnect', () => {
      this.setState('disconnected');
      this.serverConnection = null;
      this.scheduleReconnect();
    });
  }

  // Schedule reconnection with exponential backoff
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('error', 'Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectBaseDelay * 2 ** this.reconnectAttempts;
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Disconnect and cleanup
  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.serverConnection) {
      try {
        await this.serverConnection.close();
      } catch {
        // ignore
      }
      this.serverConnection = null;
    }

    if (this.libp2p) {
      await this.libp2p.stop();
      this.libp2p = null;
    }

    this.setState('disconnected');
  }

  // Send data to server (placeholder for future protocol implementation)
  async send(data: Uint8Array): Promise<void> {
    if (!this.serverConnection || !this.isConnected()) {
      throw new Error('Not connected to server');
    }

    // Protocol implementation will be added here
    // For now, this is a placeholder
    console.log('Send data:', data);
  }

  // Get connection info
  getConnectionInfo(): {
    peerId: string | null;
    relayConnected: boolean;
    directConnected: boolean;
  } {
    return {
      peerId: this.libp2p?.peerId?.toString() ?? null,
      relayConnected:
        this.state === 'relay-connected' || this.state === 'signal-exchanging',
      directConnected: this.state === 'connected',
    };
  }
}

// Singleton instance
let p2pClient: P2PClient | null = null;

export function getP2PClient(): P2PClient {
  if (!p2pClient) {
    p2pClient = new P2PClient();
  }
  return p2pClient;
}

export function resetP2PClient(): void {
  if (p2pClient) {
    p2pClient.disconnect().catch(console.error);
    p2pClient = null;
  }
}
