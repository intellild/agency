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

// Create libp2p node with the given config
export async function createLibp2pNode(config: P2PConfig): Promise<Libp2p> {
  const libp2p = await createLibp2p({
    transports: [
      webRTC({
        rtcConfiguration: {
          iceServers: config.iceServers,
        },
      }),
      webSockets(),
      circuitRelayTransport(),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
  });

  return libp2p;
}

// Dial server through circuit relay
export async function dialServer(
  libp2p: Libp2p,
  config: P2PConfig,
): Promise<Connection> {
  const relayAddr =
    config.relayAddresses[0] ||
    `/dns4/localhost/tcp/9091/ws/p2p/${config.serverPeerId}`;

  const serverPeerId = config.serverPeerId;
  const relayedAddr = multiaddr(`${relayAddr}/p2p-circuit/p2p/${serverPeerId}`);

  const connection = await libp2p.dial(relayedAddr);
  return connection;
}

// Attempt direct WebRTC connection
export async function attemptWebRTCDirect(
  libp2p: Libp2p,
  serverPeerId: string,
): Promise<Connection> {
  const webrtcAddr = multiaddr(
    `/dns4/localhost/udp/9090/webrtc-direct/p2p/${serverPeerId}`,
  );

  const connection = await libp2p.dial(webrtcAddr);
  console.log('attemptWebRTCDirect', connection);
  return connection;
}
