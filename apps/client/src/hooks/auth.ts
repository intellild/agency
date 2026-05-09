import { useAtom } from 'jotai';
import { useSessionStorage } from 'react-use';
import { authAtom, serverAddressAtom } from '@/stores/auth';

export function useServerAddress() {
  return useAtom(serverAddressAtom);
}

export function useSessionState() {
  return useSessionStorage<string | undefined>('auth-state');
}

export function useAuth() {
  return useAtom(authAtom);
}
