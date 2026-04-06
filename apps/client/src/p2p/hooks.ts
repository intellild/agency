import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import { authAtom, getAccessToken } from '@/stores/auth';
import { store } from '@/stores/root';
import type { ConnectionState, P2PClient } from './client';
import { getP2PClient, isLibp2pSupported, resetP2PClient } from './client';
import {
  p2pAutoConnectAtom,
  p2pConfigAtom,
  p2pConnectionErrorAtom,
  p2pConnectionInfoAtom,
  p2pConnectionStateAtom,
  p2pEnabledAtom,
  p2pReconnectStateAtom,
  p2pStatusAtom,
} from './store';

// Main P2P hook
export function useP2P() {
  const status = useAtomValue(p2pStatusAtom);
  const config = useAtomValue(p2pConfigAtom);
  const info = useAtomValue(p2pConnectionInfoAtom);
  const reconnectState = useAtomValue(p2pReconnectStateAtom);
  const [autoConnect, setAutoConnect] = useAtom(p2pAutoConnectAtom);

  const setState = useSetAtom(p2pConnectionStateAtom);
  const setError = useSetAtom(p2pConnectionErrorAtom);
  const setInfo = useSetAtom(p2pConnectionInfoAtom);
  const setEnabled = useSetAtom(p2pEnabledAtom);

  const clientRef = useRef<P2PClient | null>(null);

  // Initialize client once
  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = getP2PClient();

      // Subscribe to state changes
      const unsubscribe = clientRef.current.onStateChange((state, error) => {
        setState(state);
        setError(error || null);

        const connectionInfo = clientRef.current?.getConnectionInfo();
        if (connectionInfo) {
          setInfo({
            peerId: connectionInfo.peerId,
            relayConnected: connectionInfo.relayConnected,
            directConnected: connectionInfo.directConnected,
            serverPeerId: config?.serverPeerId || null,
          });
        }
      });

      // Check browser support
      setEnabled(isLibp2pSupported());

      return () => {
        unsubscribe();
      };
    }
  }, [config?.serverPeerId, setState, setError, setInfo, setEnabled]);

  // Auto-connect on config change
  useEffect(() => {
    const initAndConnect = async () => {
      if (config && autoConnect && status.canConnect) {
        try {
          const token = await getAccessToken();
          if (!clientRef.current) return;

          clientRef.current.initialize(config, token);
          await clientRef.current.connect();
        } catch (err) {
          console.error('Auto-connect failed:', err);
        }
      }
    };

    initAndConnect();
  }, [config, autoConnect, status.canConnect]);

  // Manual connect
  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('P2P config not available');
    }

    const token = await getAccessToken();
    if (!clientRef.current) {
      clientRef.current = getP2PClient();
    }

    clientRef.current.initialize(config, token);
    return clientRef.current.connect();
  }, [config]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.disconnect();
    }
  }, []);

  // Reset and cleanup
  const reset = useCallback(() => {
    resetP2PClient();
    clientRef.current = null;
  }, []);

  return {
    // State
    ...status,
    info,
    config,
    reconnectState,
    autoConnect,

    // Actions
    connect,
    disconnect,
    reset,
    setAutoConnect,
  };
}

// Hook to sync P2P config from auth response
export function useP2PAuthSync() {
  const auth = useAtomValue(authAtom);
  const setConfig = useSetAtom(p2pConfigAtom);
  const setEnabled = useSetAtom(p2pEnabledAtom);

  useEffect(() => {
    // Check browser support
    const supported = isLibp2pSupported();
    setEnabled(supported);

    if (auth?.p2p && supported) {
      setConfig(auth.p2p);
    } else {
      setConfig(null);
    }
  }, [auth, setConfig, setEnabled]);
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
