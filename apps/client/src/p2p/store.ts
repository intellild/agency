import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { ConnectionState, P2PConfig } from './client';

// P2P configuration atom (synced with auth response)
export const p2pConfigAtom = atomWithStorage<P2PConfig | null>(
  'p2p-config',
  null,
  undefined,
  {
    getOnInit: true,
  },
);

// Connection state atom
export const p2pConnectionStateAtom = atom<ConnectionState>('idle');

// Connection error atom
export const p2pConnectionErrorAtom = atom<string | null>(null);

// Connection info atom
export interface P2PConnectionInfo {
  peerId: string | null;
  relayConnected: boolean;
  directConnected: boolean;
  serverPeerId: string | null;
}

export const p2pConnectionInfoAtom = atom<P2PConnectionInfo>({
  peerId: null,
  relayConnected: false,
  directConnected: false,
  serverPeerId: null,
});

// Whether P2P is enabled (based on browser support and config)
export const p2pEnabledAtom = atom<boolean>(false);

// Whether to auto-connect on login
export const p2pAutoConnectAtom = atomWithStorage<boolean>(
  'p2p-auto-connect',
  true,
  undefined,
  {
    getOnInit: true,
  },
);

// Reconnection state
export interface ReconnectState {
  attempts: number;
  maxAttempts: number;
  nextAttemptDelay: number;
  isReconnecting: boolean;
}

export const p2pReconnectStateAtom = atom<ReconnectState>({
  attempts: 0,
  maxAttempts: 5,
  nextAttemptDelay: 0,
  isReconnecting: false,
});

// Combined P2P status for UI
export interface P2PStatus {
  state: ConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  hasError: boolean;
  errorMessage: string | null;
  canConnect: boolean;
}

export const p2pStatusAtom = atom<P2PStatus>(get => {
  const state = get(p2pConnectionStateAtom);
  const error = get(p2pConnectionErrorAtom);
  const config = get(p2pConfigAtom);
  const enabled = get(p2pEnabledAtom);

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
    canConnect: enabled && !!config && !isConnected && !isConnecting,
  };
});
