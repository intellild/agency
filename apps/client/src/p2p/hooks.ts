import { useAtom, useAtomValue } from 'jotai';
import { useCallback, useEffect } from 'react';
import { store } from '@/stores/root';

import {
  connectP2PAtom,
  disconnectP2PAtom,
  p2pConfigAtom,
  p2pConnectionEffect,
  p2pConnectionStateAtom,
  p2pReconnectEffect,
  p2pStatusAtom,
  resetP2PAtom,
} from './store';

// Main P2P hook
export function useP2P() {
  const status = useAtomValue(p2pStatusAtom);
  const config = useAtomValue(p2pConfigAtom);

  // Subscribe to atom effects
  useAtom(p2pConnectionEffect);
  useAtom(p2pReconnectEffect);

  // Manual connect
  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('P2P config not available');
    }

    return store.set(connectP2PAtom);
  }, [config]);

  // Disconnect
  const disconnect = useCallback(async () => {
    store.set(disconnectP2PAtom);
  }, []);

  // Reset and cleanup
  const reset = useCallback(() => {
    store.set(resetP2PAtom);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Note: We don't disconnect on unmount to allow persistent connections
      // across component lifecycles. The disconnectP2PAtom should be called
      // explicitly when logout happens.
    };
  }, []);

  return {
    // State
    ...status,
    config,

    // Actions
    connect,
    disconnect,
    reset,
  };
}

// Hook to get connection state for UI
export function useP2PConnectionState() {
  return useAtomValue(p2pConnectionStateAtom);
}

// Hook to check if P2P is ready to use
export function useP2PReady() {
  const status = useAtomValue(p2pStatusAtom);
  return status.isConnected;
}
