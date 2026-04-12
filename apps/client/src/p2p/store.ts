import type { Connection } from '@libp2p/interface';
import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import type { Libp2p } from 'libp2p';
import { authAtom } from '@/stores/auth';
import type { ConnectionState, P2PConfig } from './client';
import {
  attemptWebRTCDirect,
  createLibp2pNode,
  dialServer,
  isLibp2pSupported,
} from './client';

// ============================================
// Configuration & Settings Atoms
// ============================================

// P2P configuration atom (derived from auth)
export const p2pConfigAtom = atom<P2PConfig | null>(
  get => get(authAtom)?.p2p ?? null,
);

// ============================================
// P2P Instance Atoms (non-serializable objects)
// ============================================

// Libp2p node instance
export const libp2pNodeAtom = atom<Libp2p | null>(null);

// Server connection
export const serverConnectionAtom = atom<Connection | null>(null);

// ============================================
// Connection State Atom (merged)
// ============================================

export interface P2PConnectionInfo {
  peerId: string | null;
  relayConnected: boolean;
  directConnected: boolean;
  serverPeerId: string | null;
}

export interface P2PConnectionState {
  // Connection status
  state: ConnectionState;
  error: string | null;

  // Connection info
  info: P2PConnectionInfo;

  // Reconnection state
  reconnect: {
    attempts: number;
    maxAttempts: number;
    nextAttemptDelay: number;
    isReconnecting: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  };
}

const initialConnectionState: P2PConnectionState = {
  state: 'idle',
  error: null,
  info: {
    peerId: null,
    relayConnected: false,
    directConnected: false,
    serverPeerId: null,
  },
  reconnect: {
    attempts: 0,
    maxAttempts: 5,
    nextAttemptDelay: 0,
    isReconnecting: false,
    timer: null,
  },
};

// Merged connection state atom
export const p2pConnectionStateAtom = atom<P2PConnectionState>(
  initialConnectionState,
);

// ============================================
// Derived Status Atom
// ============================================

export interface P2PStatus {
  state: ConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
  errorMessage: string | null;
  canConnect: boolean;
  info: P2PConnectionInfo;
  reconnect: P2PConnectionState['reconnect'];
}

export const p2pStatusAtom = atom<P2PStatus>(get => {
  const config = get(p2pConfigAtom);
  const auth = get(authAtom);
  const connectionState = get(p2pConnectionStateAtom);
  const { state, error, info, reconnect } = connectionState;

  const isConnected = state === 'connected';
  const isConnecting =
    state === 'relay-connecting' ||
    state === 'relay-connected' ||
    state === 'signal-exchanging' ||
    state === 'webrtc-connecting';
  const hasError = state === 'error';

  return {
    state,
    isConnected,
    isConnecting,
    hasError,
    errorMessage: error,
    canConnect:
      !!config && !!auth?.accessToken && !isConnected && !isConnecting,
    info,
    reconnect,
  };
});

// ============================================
// P2P Connection Action Atoms
// ============================================

// Constants for reconnection
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 1000;

// Connect P2P action atom
export const connectP2PAtom = atom(null, async (get, set): Promise<boolean> => {
  const config = get(p2pConfigAtom);
  const auth = get(authAtom);
  const existingLibp2p = get(libp2pNodeAtom);
  const connectionState = get(p2pConnectionStateAtom);
  const { state } = connectionState;

  // Validate prerequisites
  if (!config || !auth?.accessToken) {
    set(p2pConnectionStateAtom, {
      ...connectionState,
      state: 'error',
      error: 'P2P not initialized with config and token',
    });
    return false;
  }

  if (!isLibp2pSupported()) {
    set(p2pConnectionStateAtom, {
      ...connectionState,
      state: 'error',
      error: 'Browser does not support required P2P features',
    });
    return false;
  }

  // Already connected
  if (state === 'connected') {
    return true;
  }

  // Connection in progress
  if (state === 'relay-connecting' || state === 'webrtc-connecting') {
    return false;
  }

  // Clear any existing reconnect timer
  if (connectionState.reconnect.timer) {
    clearTimeout(connectionState.reconnect.timer);
  }

  // Clean up existing connection if any
  if (existingLibp2p) {
    try {
      await existingLibp2p.stop();
    } catch {
      // ignore
    }
    set(libp2pNodeAtom, null);
    set(serverConnectionAtom, null);
  }

  // Update state to connecting
  set(p2pConnectionStateAtom, {
    ...connectionState,
    state: 'relay-connecting',
    error: null,
    reconnect: {
      ...connectionState.reconnect,
      timer: null,
    },
  });

  try {
    // Create and start libp2p node
    const libp2p = await createLibp2pNode(config);
    await libp2p.start();
    set(libp2pNodeAtom, libp2p);

    // Update state
    set(p2pConnectionStateAtom, prev => ({
      ...prev,
      state: 'signal-exchanging',
      info: {
        peerId: libp2p.peerId?.toString() ?? null,
        relayConnected: false,
        directConnected: false,
        serverPeerId: config.serverPeerId,
      },
    }));

    // Dial server through relay
    const serverConnection = await dialServer(libp2p, config);
    set(serverConnectionAtom, serverConnection);

    // Attempt WebRTC direct connection
    set(p2pConnectionStateAtom, prev => ({
      ...prev,
      state: 'webrtc-connecting',
    }));

    try {
      const directConnection = await attemptWebRTCDirect(
        libp2p,
        config.serverPeerId,
      );
      // Close relay connection if direct succeeds
      await serverConnection.close();
      set(serverConnectionAtom, directConnection);
      set(p2pConnectionStateAtom, prev => ({
        ...prev,
        state: 'connected',
        info: {
          ...prev.info,
          relayConnected: false,
          directConnected: true,
        },
        reconnect: {
          ...prev.reconnect,
          attempts: 0,
          nextAttemptDelay: 0,
          isReconnecting: false,
        },
      }));
    } catch (webrtcErr) {
      // Keep relay connection as fallback
      console.log('Direct WebRTC failed, using relay:', webrtcErr);
      set(p2pConnectionStateAtom, prev => ({
        ...prev,
        state: 'connected',
        info: {
          ...prev.info,
          relayConnected: true,
          directConnected: false,
        },
        reconnect: {
          ...prev.reconnect,
          attempts: 0,
          nextAttemptDelay: 0,
          isReconnecting: false,
        },
      }));
    }

    // Setup connection event handlers
    const handleDisconnect = () => {
      set(p2pConnectionStateAtom, prev => ({
        ...prev,
        state: 'disconnected',
        info: {
          ...prev.info,
          relayConnected: false,
          directConnected: false,
        },
      }));
      set(serverConnectionAtom, null);
    };

    libp2p.addEventListener('peer:disconnect', handleDisconnect);

    set(p2pConnectionStateAtom, prev => ({
      ...prev,
      error: null,
    }));

    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    set(p2pConnectionStateAtom, prev => ({
      ...prev,
      state: 'error',
      error: errorMsg,
    }));
    return false;
  }
});

// Disconnect P2P action atom
export const disconnectP2PAtom = atom(null, async (get, set) => {
  const libp2p = get(libp2pNodeAtom);
  const serverConnection = get(serverConnectionAtom);
  const connectionState = get(p2pConnectionStateAtom);

  // Clear reconnect timer
  if (connectionState.reconnect.timer) {
    clearTimeout(connectionState.reconnect.timer);
  }

  // Close server connection
  if (serverConnection) {
    try {
      await serverConnection.close();
    } catch {
      // ignore
    }
    set(serverConnectionAtom, null);
  }

  // Stop libp2p node
  if (libp2p) {
    try {
      await libp2p.stop();
    } catch {
      // ignore
    }
    set(libp2pNodeAtom, null);
  }

  set(p2pConnectionStateAtom, {
    ...connectionState,
    state: 'disconnected',
    reconnect: {
      ...connectionState.reconnect,
      timer: null,
      isReconnecting: false,
    },
    info: {
      ...connectionState.info,
      relayConnected: false,
      directConnected: false,
    },
  });
});

// Reset P2P action atom
export const resetP2PAtom = atom(null, (get, set) => {
  const connectionState = get(p2pConnectionStateAtom);

  // Clear reconnect timer
  if (connectionState.reconnect.timer) {
    clearTimeout(connectionState.reconnect.timer);
  }

  set(libp2pNodeAtom, null);
  set(serverConnectionAtom, null);
  set(p2pConnectionStateAtom, initialConnectionState);
});

// ============================================
// P2P Effects
// ============================================

// P2P connection effect - watches auth and config atoms
export const p2pConnectionEffect = atomEffect((get, set) => {
  const config = get(p2pConfigAtom);
  const auth = get(authAtom);
  const connectionState = get(p2pConnectionStateAtom);
  const { state } = connectionState;

  // Auto-connect when auth is present and config is valid
  if (
    config &&
    auth?.accessToken &&
    state !== 'connected' &&
    state !== 'relay-connecting' &&
    state !== 'webrtc-connecting'
  ) {
    // Trigger connection
    set(connectP2PAtom);
  }

  // Disconnect when auth becomes null (logout)
  if (!auth?.accessToken && state !== 'idle' && state !== 'disconnected') {
    set(disconnectP2PAtom);
  }
});

// Reconnection effect - watches connection state
export const p2pReconnectEffect = atomEffect((get, set) => {
  const config = get(p2pConfigAtom);
  const auth = get(authAtom);
  const connectionState = get(p2pConnectionStateAtom);
  const { state, reconnect } = connectionState;

  // Clear existing timer if any
  if (reconnect.timer) {
    clearTimeout(reconnect.timer);
    set(p2pConnectionStateAtom, {
      ...connectionState,
      reconnect: { ...reconnect, timer: null },
    });
  }

  // Only attempt reconnect on error or disconnect states
  if (
    (state === 'error' || state === 'disconnected') &&
    config &&
    auth?.accessToken
  ) {
    // Check max attempts
    if (reconnect.attempts >= MAX_RECONNECT_ATTEMPTS) {
      set(p2pConnectionStateAtom, {
        ...connectionState,
        reconnect: {
          ...reconnect,
          isReconnecting: false,
          nextAttemptDelay: 0,
        },
        error: 'Max reconnection attempts reached',
      });
      return;
    }

    // Calculate delay with exponential backoff
    const delay = RECONNECT_BASE_DELAY * 2 ** reconnect.attempts;

    set(p2pConnectionStateAtom, {
      ...connectionState,
      reconnect: {
        ...reconnect,
        nextAttemptDelay: delay,
        isReconnecting: true,
      },
    });

    // Schedule reconnection
    const timer = setTimeout(() => {
      set(p2pConnectionStateAtom, prev => ({
        ...prev,
        reconnect: {
          ...prev.reconnect,
          attempts: prev.reconnect.attempts + 1,
        },
      }));
      set(connectP2PAtom);
    }, delay);

    set(p2pConnectionStateAtom, prev => ({
      ...prev,
      reconnect: { ...prev.reconnect, timer },
    }));
  } else if (state === 'connected') {
    // Reset reconnection state on successful connection
    set(p2pConnectionStateAtom, prev => ({
      ...prev,
      reconnect: {
        ...prev.reconnect,
        attempts: 0,
        nextAttemptDelay: 0,
        isReconnecting: false,
      },
    }));
  }
});
