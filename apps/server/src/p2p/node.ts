import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import type { Connection, PeerId } from '@libp2p/interface';
import { webSockets } from '@libp2p/websockets';

import type { Libp2p, Libp2pOptions } from 'libp2p';
import { createLibp2p } from 'libp2p';
import { removePeer } from './registry.js';

// Local interface for ICE server config
interface ICEServerConfig {
  urls: string;
  username?: string;
  credential?: string;
}

// P2P configuration from environment
const P2P_WS_PORT = Number(process.env.P2P_WS_PORT ?? 9090);
const P2P_MAX_RESERVATIONS = Number(process.env.P2P_MAX_RESERVATIONS ?? 100);
const P2P_RESERVATION_TTL = Number(process.env.P2P_RESERVATION_TTL ?? 7200000); // 2 hours
export interface P2PNodeConfig {
  webrtcPort?: number;
  wsPort?: number;
  publicAddresses?: string[];
  maxReservations?: number;
  reservationTtl?: number;
}

export interface P2PNodeInfo {
  peerId: string;
  multiaddrs: string[];
}

let p2pNode: Libp2p | null = null;
let exposedPublicAddresses: string[] = [];

/**
 * Initialize the libp2p node with WebRTC and Circuit Relay
 */
export async function initP2PNode(config: P2PNodeConfig = {}): Promise<Libp2p> {
  const {
    wsPort = P2P_WS_PORT,
    publicAddresses = [],
    maxReservations = P2P_MAX_RESERVATIONS,
    reservationTtl = P2P_RESERVATION_TTL,
  } = config;
  exposedPublicAddresses = publicAddresses;

  const libp2pOptions: Libp2pOptions = {
    transports: [webSockets()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    addresses: {
      listen: [
        // WebSocket listener for browser connectivity
        `/ip4/0.0.0.0/tcp/${wsPort}/ws`,
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

  p2pNode.addEventListener('peer:connect', event => {
    const peerId = event.detail as PeerId;
    const peerIdStr = peerId.toString();
    console.info(`Peer connected: ${peerIdStr}`);
  });

  p2pNode.addEventListener('peer:disconnect', event => {
    const peerId = event.detail as PeerId;
    const peerIdStr = peerId.toString();
    console.info(`Peer disconnected: ${peerIdStr}`);
    removePeer(peerIdStr);
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
    removePeer(peerIdStr);
  });

  // Start the node
  // await p2pNode.start();
  console.info(`P2P node started with PeerId: ${p2pNode.peerId.toString()}`);
  console.log(
    'Relay listening on multiaddr(s): ',
    p2pNode.getMultiaddrs().map(ma => ma.toString()),
  );

  return p2pNode;
}

/**
 * Stop the libp2p node
 */
export async function stopP2PNode(): Promise<void> {
  if (p2pNode) {
    await p2pNode.stop();
    p2pNode = null;
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
 * Get node information for client connections
 */
export function getP2PNodeInfo(): P2PNodeInfo | null {
  if (!p2pNode) {
    return null;
  }

  const peerId = p2pNode.peerId.toString();
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.ENV === 'production';

  // Get addresses
  // const relayAddresses: string[] = [];
  // const webrtcAddresses: string[] = [];
  // const wsAddresses: string[] = [];

  // for (const addr of p2pNode.getMultiaddrs()) {
  //   const addrString = addr.toString();
  //   if (addrString.includes('/p2p-circuit')) {
  //     relayAddresses.push(addrString);
  //   } else if (addrString.includes('/webrtc')) {
  //     webrtcAddresses.push(addrString);
  //   } else if (addrString.includes('/ws')) {
  //     wsAddresses.push(addrString);
  //   }
  // }

  const localAddresses = p2pNode.getMultiaddrs().map(ma => ma.toString());
  const publicAddresses =
    isProduction && exposedPublicAddresses.length > 0
      ? exposedPublicAddresses
      : localAddresses.map(addr =>
          addr.replace('/ip4/0.0.0.0/', '/ip4/127.0.0.1/'),
        );

  return {
    peerId,
    multiaddrs: publicAddresses,
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
