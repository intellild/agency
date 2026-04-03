import { atom, useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export interface ServerConfig {
  address: string;
  publicKey: string;
}

const STORAGE_KEY = 'agency-server-config';

// 使用 localStorage 持久化的 atom
export const serverConfigAtom = atomWithStorage<ServerConfig | null>(
  STORAGE_KEY,
  null,
  undefined,
  { getOnInit: true },
);

// 检查是否已配置
export const isConfiguredAtom = atom((get) => {
  const config = get(serverConfigAtom);
  return config !== null && config.address && config.publicKey;
});

// Hook for easy usage
export function useServerConfig() {
  return useAtom(serverConfigAtom);
}

export function useIsConfigured() {
  return useAtom(isConfiguredAtom);
}
