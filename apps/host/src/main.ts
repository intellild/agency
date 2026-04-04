import 'webrtc-polyfill/node';

import Peer from 'peerjs';

// Configuration
const SERVER_HOST = process.env.SERVER_HOST ?? 'localhost';
const SERVER_PORT = process.env.SERVER_PORT
  ? Number(process.env.SERVER_PORT)
  : 3000;
const HOST_NAME =
  process.env.HOST_NAME ?? `Host-${Math.random().toString(36).slice(2, 8)}`;

// Generate a unique peer ID for this host
const PEER_ID = `host-${HOST_NAME.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36).slice(-4)}`;

console.log(`[Host] Starting host: ${HOST_NAME}`);
console.log(`[Host] Peer ID: ${PEER_ID}`);
console.log(`[Host] Connecting to server: ${SERVER_HOST}:${SERVER_PORT}`);

// Create PeerJS connection
const peer = new Peer(PEER_ID, {
  host: SERVER_HOST,
  port: SERVER_PORT,
  path: '/peerjs',
  secure: false,
  debug: 2,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  },
});

// Store connected clients
const connectedClients = new Map<string, Peer.DataConnection>();

// Handle peer open event
peer.on('open', id => {
  console.log(`[Host] ✅ Connected to signaling server with ID: ${id}`);
  console.log(`[Host] Waiting for clients to connect...`);

  // The metadata is automatically handled by the server's middleware
  // when the peer connects via the PeerJS protocol
});

// Handle incoming connections from clients
peer.on('connection', conn => {
  console.log(`[Host] 📥 Incoming connection from: ${conn.peer}`);

  // Store the connection
  connectedClients.set(conn.peer, conn);

  // Handle connection open
  conn.on('open', () => {
    console.log(`[Host] ✅ Connection established with: ${conn.peer}`);

    // Send welcome message
    conn.send({
      type: 'welcome',
      from: PEER_ID,
      hostName: HOST_NAME,
      message: `Welcome! Connected to host: ${HOST_NAME}`,
    });
  });

  // Handle incoming data
  conn.on('data', data => {
    console.log(`[Host] 📨 Received from ${conn.peer}:`, data);

    // Echo back with host info
    conn.send({
      type: 'echo',
      from: PEER_ID,
      hostName: HOST_NAME,
      received: data,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle connection close
  conn.on('close', () => {
    console.log(`[Host] ❌ Connection closed with: ${conn.peer}`);
    connectedClients.delete(conn.peer);
  });

  // Handle errors
  conn.on('error', err => {
    console.error(`[Host] ⚠️ Connection error with ${conn.peer}:`, err);
  });
});

// Handle peer errors
peer.on('error', err => {
  console.error('[Host] ⚠️ Peer error:', err);

  // Handle specific error types
  switch (err.type) {
    case 'network':
      console.error('[Host] Network error - check server connectivity');
      break;
    case 'server-error':
      console.error('[Host] Server error - signaling server may be down');
      break;
    case 'unavailable-id':
      console.error('[Host] Peer ID already in use');
      break;
    default:
      console.error('[Host] Unknown error:', err);
  }
});

// Handle peer disconnection
peer.on('disconnected', () => {
  console.log('[Host] ⚠️ Disconnected from signaling server');
  console.log('[Host] Attempting to reconnect...');

  // Try to reconnect
  peer.reconnect();
});

// Handle peer close
peer.on('close', () => {
  console.log('[Host] ❌ Connection to signaling server closed');
  console.log('[Host] Exiting...');
  process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Host] Shutting down...');

  // Close all client connections
  for (const [peerId, conn] of connectedClients) {
    console.log(`[Host] Closing connection with: ${peerId}`);
    conn.close();
  }

  // Destroy peer connection
  peer.destroy();
  console.log('[Host] Goodbye!');
  process.exit(0);
});

// Log connection stats periodically
setInterval(() => {
  const clientCount = connectedClients.size;
  if (clientCount > 0) {
    console.log(`[Host] 📊 Connected clients: ${clientCount}`);
  }
}, 30000); // Every 30 seconds

console.log('[Host] Press Ctrl+C to exit');
