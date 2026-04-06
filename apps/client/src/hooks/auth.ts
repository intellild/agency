import { useAtom } from 'jotai';
import { useLocalStorage, useSessionStorage } from 'react-use';
import { authAtom, serverAddressAtom } from '@/stores/auth';

export function useGithubClientId() {
  return useLocalStorage('github-client-id', '');
}

export function useServerAddress() {
  return useAtom(serverAddressAtom);
}

export function useSessionState() {
  return useSessionStorage<string | undefined>('auth-state');
}

export function useAuth() {
  return useAtom(authAtom);
}
