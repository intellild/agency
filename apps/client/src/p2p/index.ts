// Client utilities and types
export {
  type ConnectionState,
  isLibp2pSupported,
  isWebRTCSupported,
  type P2PConfig,
  type P2PConnection,
} from './client';

// Hooks
export {
  useP2P,
  useP2PConnectionState,
  useP2PReady,
} from './hooks';

// Store atoms, accessors and types
export {
  // Action atoms
  connectP2PAtom,
  disconnectP2PAtom,
  // Instance accessors (non-serializable)
  getLibp2pNode,
  getServerConnection,
  // Types
  type P2PConnectionInfo,
  type P2PConnectionState,
  type P2PStatus,
  p2pConfigAtom,
  // Effects
  p2pConnectionEffect,
  p2pConnectionStateAtom,
  p2pStatusAtom,
  resetP2PAtom,
  setLibp2pNode,
  setServerConnection,
} from './store';
