import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import {
  circuitRelayServer,
  circuitRelayTransport,
} from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import type { Connection, PeerId } from '@libp2p/interface';
import { webRTC } from '@libp2p/webrtc';
import { webSockets } from '@libp2p/websockets';

import type { Libp2p, Libp2pOptions } from 'libp2p';
import { createLibp2p } from 'libp2p';
import { createConnectionGater, P2PAuth } from './auth.js';

// Local interface for ICE server config
interface ICEServerConfig {
  urls: string;
  username?: string;
  credential?: string;
}

// P2P configuration from environment
const P2P_WEBRTC_PORT = Number(process.env.P2P_WEBRTC_PORT ?? 9090);
const P2P_WS_PORT = Number(process.env.P2P_WS_PORT ?? 9091);
const P2P_PUBLIC_HOST = process.env.P2P_PUBLIC_HOST ?? 'localhost';
const P2P_MAX_RESERVATIONS = Number(process.env.P2P_MAX_RESERVATIONS ?? 100);
const P2P_RESERVATION_TTL = Number(process.env.P2P_RESERVATION_TTL ?? 7200000); // 2 hours
const P2P_MAX_CONNECTIONS_PER_USER = Number(
  process.env.P2P_MAX_CONNECTIONS_PER_USER ?? 5,
);

export interface P2PNodeConfig {
  webrtcPort?: number;
  wsPort?: number;
  publicHost?: string;
  maxReservations?: number;
  reservationTtl?: number;
  maxConnectionsPerUser?: number;
}

export interface P2PNodeInfo {
  peerId: string;
  relayAddresses: string[];
  webrtcAddresses: string[];
  wsAddresses: string[];
}

let p2pNode: Libp2p | null = null;
let p2pAuth: P2PAuth | null = null;

/**
 * Initialize the libp2p node with WebRTC and Circuit Relay
 */
export async function initP2PNode(config: P2PNodeConfig = {}): Promise<Libp2p> {
  const {
    webrtcPort = P2P_WEBRTC_PORT,
    wsPort = P2P_WS_PORT,
    publicHost = P2P_PUBLIC_HOST,
    maxReservations = P2P_MAX_RESERVATIONS,
    reservationTtl = P2P_RESERVATION_TTL,
    maxConnectionsPerUser = P2P_MAX_CONNECTIONS_PER_USER,
  } = config;

  // Initialize P2P auth handler
  p2pAuth = new P2PAuth({
    maxConnectionsPerUser,
    onAuthFailure: (peerId: string, reason: string) => {
      console.warn(`P2P auth failed for peer ${peerId}: ${reason}`);
    },
    onConnectionClosed: (peerId: string, userId: string) => {
      console.info(`P2P connection closed: peer=${peerId}, user=${userId}`);
    },
  });

  // Create connection gater for auth enforcement
  const connectionGater = createConnectionGater(p2pAuth);

  const libp2pOptions: Libp2pOptions = {
    transports: [
      circuitRelayTransport({
        // Circuit relay transport for WebRTC connectivity
      }),
      webRTC({
        // WebRTC listen options
      }),
      webSockets(),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater,
    addresses: {
      listen: [
        // WebRTC direct listener
        `/udp/${webrtcPort}/webrtc-direct`,
        // WebSocket listener for browser connectivity
        `/ip4/0.0.0.0/tcp/${wsPort}/ws`,
      ],
      announce: [
        // Public addresses for clients to connect
        `/dns4/${publicHost}/udp/${webrtcPort}/webrtc-direct`,
        `/dns4/${publicHost}/tcp/${wsPort}/ws`,
      ],
    },
    services: {
      identify: identify(),
      relay: circuitRelayServer({
        reservations: {
          maxReservations,
          reservationTtl,
          applyDefaultLimit: true,
        },
      }),
    },
  };

  p2pNode = await createLibp2p(libp2pOptions);

  // Handle incoming connections for auth
  p2pNode.addEventListener('peer:connect', event => {
    const peerId = event.detail as PeerId;
    const peerIdStr = peerId.toString();
    console.info(`Peer connected: ${peerIdStr}`);

    // Validate connection auth
    if (!p2pAuth?.isAuthorized(peerIdStr)) {
      console.warn(`Peer not yet authorized: ${peerIdStr}`);
      // Note: We can't close the connection here as we don't have the Connection object
      // The connection gater will handle this on the next upgrade
    }
  });

  p2pNode.addEventListener('peer:disconnect', event => {
    const peerId = event.detail as PeerId;
    const peerIdStr = peerId.toString();
    console.info(`Peer disconnected: ${peerIdStr}`);
    p2pAuth?.removeConnection(peerIdStr);
  });

  // Handle connection events for tracking
  p2pNode.addEventListener('connection:open', event => {
    const connection = event.detail as Connection;
    const peerIdStr = connection.remotePeer.toString();
    console.info(`Connection opened: ${peerIdStr}`);
  });

  p2pNode.addEventListener('connection:close', event => {
    const connection = event.detail as Connection;
    const peerIdStr = connection.remotePeer.toString();
    console.info(`Connection closed: ${peerIdStr}`);
    p2pAuth?.removeConnection(peerIdStr);
  });

  // Start the node
  await p2pNode.start();
  console.info(`P2P node started with PeerId: ${p2pNode.peerId.toString()}`);

  return p2pNode;
}

/**
 * Stop the libp2p node
 */
export async function stopP2PNode(): Promise<void> {
  if (p2pNode) {
    await p2pNode.stop();
    p2pNode = null;
    p2pAuth = null;
    console.info('P2P node stopped');
  }
}

/**
 * Get the current P2P node instance
 */
export function getP2PNode(): Libp2p | null {
  return p2pNode;
}

/**
 * Get P2P auth handler
 */
export function getP2PAuth(): P2PAuth | null {
  return p2pAuth;
}

/**
 * Get node information for client connections
 */
export function getP2PNodeInfo(): P2PNodeInfo | null {
  if (!p2pNode) {
    return null;
  }

  const peerId = p2pNode.peerId.toString();

  // Get addresses
  const relayAddresses: string[] = [];
  const webrtcAddresses: string[] = [];
  const wsAddresses: string[] = [];

  for (const addr of p2pNode.getMultiaddrs()) {
    const addrString = addr.toString();
    if (addrString.includes('/p2p-circuit')) {
      relayAddresses.push(addrString);
    } else if (addrString.includes('/webrtc')) {
      webrtcAddresses.push(addrString);
    } else if (addrString.includes('/ws')) {
      wsAddresses.push(addrString);
    }
  }

  return {
    peerId,
    relayAddresses,
    webrtcAddresses,
    wsAddresses,
  };
}

/**
 * Get ICE servers configuration for clients
 */
export function getICEServers(): ICEServerConfig[] {
  const iceServers: ICEServerConfig[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // Add TURN servers if configured
  if (process.env.TURN_SERVER_URL) {
    iceServers.push({
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_SERVER_USERNAME ?? '',
      credential: process.env.TURN_SERVER_CREDENTIAL ?? '',
    });
  }

  return iceServers;
}
