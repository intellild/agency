import { createSecretKey } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import type { AgencyConfig } from '../config.js';

export interface AuthUser {
  sub: string;
  type: string;
}

function getSecret(config: AgencyConfig) {
  return createSecretKey(Buffer.from(config.auth.jwtSecret));
}

export async function generateAccessToken(
  config: AgencyConfig,
  userId: string,
): Promise<string> {
  return new SignJWT({ sub: userId, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret(config));
}

export async function generateRefreshToken(
  config: AgencyConfig,
  userId: string,
): Promise<string> {
  return new SignJWT({ sub: userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(getSecret(config));
}

export async function verifyAccessToken(
  config: AgencyConfig,
  token: string,
): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, getSecret(config), {
    algorithms: ['HS256'],
  });

  if (payload.type !== 'access' || !payload.sub) {
    throw new Error('Invalid access token');
  }

  return {
    sub: payload.sub,
    type: String(payload.type),
  };
}

export async function verifyRefreshToken(
  config: AgencyConfig,
  token: string,
): Promise<string> {
  const { payload } = await jwtVerify(token, getSecret(config), {
    algorithms: ['HS256'],
  });

  if (payload.type !== 'refresh' || !payload.sub) {
    throw new Error('Invalid refresh token');
  }

  return payload.sub;
}
