import type { Connection } from '@libp2p/interface';
import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { atomWithQuery } from 'jotai-tanstack-query';
import type { Libp2p } from 'libp2p';
import { authAtom, serverAddressAtom } from '@/stores/auth';
import type { ConnectionState, P2PConfig } from './client';
import { createLibp2pNode, dialServer, isLibp2pSupported } from './client';

// ============================================
// Module-Level Instance Storage (non-serializable objects)
// ============================================

// Libp2p node instance
let libp2pNodeInstance: Libp2p | null = null;

// Server connection instance
let serverConnectionInstance: Connection | null = null;
let peersEventSource: EventSource | null = null;
let peersEventSourceKey: string | null = null;

// Accessor functions
export function getLibp2pNode(): Libp2p | null {
  return libp2pNodeInstance;
}

export function setLibp2pNode(node: Libp2p | null): void {
  libp2pNodeInstance = node;
}

export function getServerConnection(): Connection | null {
  return serverConnectionInstance;
}

export function setServerConnection(conn: Connection | null): void {
  serverConnectionInstance = conn;
}

// ============================================
// Configuration & Settings Atoms
// ============================================

// P2P config query atom - fetches from API using jotai-tanstack-query
export const p2pConfigQueryAtom = atomWithQuery(get => {
  const auth = get(authAtom);
  const serverAddress = get(serverAddressAtom);
  const isLoggedIn = !!auth?.accessToken;

  return {
    queryKey: ['p2p', 'config', serverAddress, auth?.userId],
    queryFn: async (): Promise<P2PConfig> => {
      const response = await fetch(`${serverAddress}/api/p2p/config`, {
        headers: {
          Authorization: `Bearer ${auth?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch P2P config');
      }

      return response.json();
    },
    enabled: isLoggedIn,
  };
});

// P2P configuration atom (reads from query atom)
export const p2pConfigAtom = atom<P2PConfig | null>(get => {
  const queryResult = get(p2pConfigQueryAtom);
  return queryResult.data ?? null;
});

export interface HostPeer {
  peerId: string;
  type: 'host';
  userId: string;
  username?: string;
  addresses: string[];
  connectedAt: string;
  updatedAt: string;
}

export const hostPeersQueryAtom = atomWithQuery(get => {
  const auth = get(authAtom);
  const serverAddress = get(serverAddressAtom);
  const isLoggedIn = !!auth?.accessToken;

  return {
    queryKey: ['p2p', 'hosts', serverAddress, auth?.userId],
    queryFn: async (): Promise<{ hosts: HostPeer[] }> => {
      const response = await fetch(`${serverAddress}/api/p2p/hosts`, {
        headers: {
          Authorization: `Bearer ${auth?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch host list');
      }

      return response.json();
    },
    enabled: isLoggedIn,
    refetchInterval: 2000,
  };
});

const hostPeersRealtimeAtom = atom<HostPeer[] | null>(null);

export const hostPeersAtom = atom<HostPeer[]>(get => {
  const realtimeHosts = get(hostPeersRealtimeAtom);
  if (realtimeHosts) {
    return realtimeHosts;
  }

  const queryResult = get(hostPeersQueryAtom);
  return queryResult.data?.hosts ?? [];
});

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
}

export const p2pStatusAtom = atom<P2PStatus>(get => {
  const config = get(p2pConfigAtom);
  const auth = get(authAtom);
  const connectionState = get(p2pConnectionStateAtom);
  const { state, error, info } = connectionState;

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
  };
});

// ============================================
// P2P Connection Action Atoms
// ============================================

// Connect P2P action atom
export const connectP2PAtom = atom(null, async (get, set): Promise<boolean> => {
  const config = get(p2pConfigAtom);
  const auth = get(authAtom);
  const serverAddress = get(serverAddressAtom);
  const existingLibp2p = getLibp2pNode();
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
  if (
    state === 'relay-connecting' ||
    state === 'relay-connected' ||
    state === 'signal-exchanging' ||
    state === 'webrtc-connecting'
  ) {
    return false;
  }

  // Clean up existing connection if any
  if (existingLibp2p) {
    try {
      await existingLibp2p.stop();
    } catch {
      // ignore
    }
    setLibp2pNode(null);
    setServerConnection(null);
  }

  // Update state to connecting
  set(p2pConnectionStateAtom, {
    ...connectionState,
    state: 'relay-connecting',
    error: null,
  });

  try {
    // Create and start libp2p node
    const libp2p = await createLibp2pNode(config);
    await libp2p.start();
    setLibp2pNode(libp2p);
    const peerId = libp2p.peerId.toString();

    const registerResponse = await fetch(`${serverAddress}/api/p2p/peers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        peerId,
        type: 'client',
        username: auth.username,
        addresses: libp2p.getMultiaddrs().map(addr => addr.toString()),
      }),
    });
    if (!registerResponse.ok) {
      throw new Error('Failed to register client peer');
    }

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
    setServerConnection(serverConnection);

    set(p2pConnectionStateAtom, prev => ({
      ...prev,
      state: 'connected',
      info: {
        ...prev.info,
        relayConnected: true,
        directConnected: false,
      },
    }));

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
      setServerConnection(null);
    };

    libp2p.addEventListener('peer:disconnect', handleDisconnect);

    set(p2pConnectionStateAtom, prev => ({
      ...prev,
      error: null,
    }));

    return true;
  } catch (error) {
    const failedLibp2p = getLibp2pNode();
    const failedPeerId = failedLibp2p?.peerId.toString();
    if (failedPeerId && auth?.accessToken) {
      await fetch(`${serverAddress}/api/p2p/peers/${failedPeerId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      }).catch(() => undefined);
    }
    if (failedLibp2p) {
      try {
        await failedLibp2p.stop();
      } catch {
        // ignore cleanup failures
      }
      setLibp2pNode(null);
      setServerConnection(null);
    }

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
  const libp2p = getLibp2pNode();
  const serverConnection = getServerConnection();
  const auth = get(authAtom);
  const serverAddress = get(serverAddressAtom);
  const peerId = libp2p?.peerId.toString();

  if (peerId && auth?.accessToken) {
    await fetch(`${serverAddress}/api/p2p/peers/${peerId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
    }).catch(() => undefined);
  }

  // Close server connection
  if (serverConnection) {
    try {
      await serverConnection.close();
    } catch {
      // ignore
    }
    setServerConnection(null);
  }

  // Stop libp2p node
  if (libp2p) {
    try {
      await libp2p.stop();
    } catch {
      // ignore
    }
    setLibp2pNode(null);
  }

  set(p2pConnectionStateAtom, prev => ({
    ...prev,
    state: 'disconnected',
    info: {
      ...prev.info,
      relayConnected: false,
      directConnected: false,
    },
  }));
});

// Reset P2P action atom
export const resetP2PAtom = atom(null, (_get, set) => {
  setLibp2pNode(null);
  setServerConnection(null);
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
    state !== 'relay-connected' &&
    state !== 'signal-exchanging' &&
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

export const hostPeersRealtimeEffect = atomEffect((get, set) => {
  const auth = get(authAtom);
  const serverAddress = get(serverAddressAtom);

  if (!auth?.accessToken) {
    peersEventSource?.close();
    peersEventSource = null;
    peersEventSourceKey = null;
    set(hostPeersRealtimeAtom, null);
    return;
  }

  const sourceKey = `${serverAddress}:${auth.accessToken}`;
  if (peersEventSource && peersEventSourceKey === sourceKey) {
    return;
  }

  peersEventSource?.close();
  peersEventSource = null;
  peersEventSourceKey = sourceKey;

  const url = new URL('/api/p2p/events', serverAddress);
  url.searchParams.set('access_token', auth.accessToken);

  peersEventSource = new EventSource(url.toString());
  peersEventSource.addEventListener('peers', event => {
    const payload = JSON.parse((event as MessageEvent).data) as {
      hosts?: HostPeer[];
    };
    set(hostPeersRealtimeAtom, payload.hosts ?? []);
  });
  peersEventSource.onerror = () => {
    peersEventSource?.close();
    peersEventSource = null;
    peersEventSourceKey = null;
    set(hostPeersRealtimeAtom, null);
  };
});
