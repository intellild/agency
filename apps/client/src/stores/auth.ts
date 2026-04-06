import { atomWithStorage } from 'jotai/utils';
import { $fetch } from 'ofetch';
import type { P2PConfig } from '@/p2p';
import { store } from './root';

export interface Auth {
  accessToken: string;
  refreshToken: string;
  githubToken: string;
  userId: string;
  username: string;
  p2p?: P2PConfig | null;
}

// Token 过期前预留的缓冲时间（5分钟）
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

export const SERVER_ADDRESS_KEY = 'server-address';
export const DEFAULT_SERVER_ADDRESS = 'http://localhost:3000';

export const serverAddressAtom = atomWithStorage(
  SERVER_ADDRESS_KEY,
  DEFAULT_SERVER_ADDRESS,
  undefined,
  {
    getOnInit: true,
  },
);

export const authAtom = atomWithStorage<Auth | null>('auth', null, undefined, {
  getOnInit: true,
});

/**
 * 解析 JWT token 获取过期时间
 * @param token JWT token
 * @returns 过期时间戳（毫秒），如果解析失败返回 null
 */
function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    if (decoded.exp) {
      return decoded.exp * 1000; // 转换为毫秒
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 检查 token 是否即将过期
 * @param token JWT token
 * @returns 如果 token 即将过期或已过期返回 true
 */
function isTokenExpiringSoon(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return false;
  return Date.now() + TOKEN_EXPIRY_BUFFER_MS >= expiry;
}

/**
 * 使用 refresh token 获取新的 access token
 * @param serverAddress 服务器地址
 * @param refreshToken 刷新令牌
 * @returns 新的认证信息
 */
async function refreshAccessToken(
  serverAddress: string,
  refreshToken: string,
): Promise<Auth> {
  const response = await fetch(`${serverAddress}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  return response.json();
}

/**
 * 获取有效的 access token
 * 如果 token 即将过期，会自动刷新
 * @returns 有效的 access token
 * @throws 如果未登录则抛出错误
 */
export async function getAccessToken(): Promise<string> {
  // 使用 jotai store 获取 auth
  const auth = store.get(authAtom);
  if (!auth?.accessToken) {
    throw new Error('Not logged in');
  }

  // 检查 token 是否即将过期
  if (isTokenExpiringSoon(auth.accessToken)) {
    const serverAddress =
      localStorage.getItem(SERVER_ADDRESS_KEY) || DEFAULT_SERVER_ADDRESS;

    const newAuth = await refreshAccessToken(serverAddress, auth.refreshToken);

    // 使用 jotai store 更新 auth
    store.set(authAtom, newAuth);

    return newAuth.accessToken;
  }

  return auth.accessToken;
}

export const $api = $fetch.create({
  async onRequest(context) {
    if (!context.options.baseURL) {
      context.options.baseURL = store.get(serverAddressAtom);
    }

    if (!context.options.headers?.get('Authorization')) {
      const headers = context.options.headers ?? new Headers();
      if (!context.options.headers) {
        context.options.headers = headers;
      }
      const token = await getAccessToken();
      headers.set('Authorization', `Bearer ${token}`);
    }
  },
});
