import { useAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useLocalStorage, useSessionStorage } from 'react-use';

export interface Auth {
  accessToken: string;
  refreshToken: string;
  githubToken: string;
  userId: string;
  username: string;
}

export const SERVER_ADDRESS_KEY = 'server-address';
export const DEFAULT_SERVER_ADDRESS = 'http://localhost:3000';

const authAtom = atomWithStorage<Auth | null>('auth', null, undefined, {
  getOnInit: true,
});

export function useGithubClientId() {
  return useLocalStorage('github-client-id', '');
}

export function useServerAddress() {
  return useLocalStorage(SERVER_ADDRESS_KEY, DEFAULT_SERVER_ADDRESS);
}

export function useSessionState() {
  return useSessionStorage<string | undefined>('auth-state');
}

export function useAuth() {
  return useAtom(authAtom);
}
