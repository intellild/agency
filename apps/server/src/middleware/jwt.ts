import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import type { RequestHandler } from 'express';
import { importSPKI, jwtVerify } from 'jose';

// Load public key for verification
function loadPublicKey(): string {
  const env = process.env.ENV ?? 'development';
  const keyPath = path.join(__dirname, '../keys', env, 'public.pem');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf-8');
  }
  return process.env.JWT_PUBLIC_KEY || '';
}

const PUBLIC_KEY = loadPublicKey();

// JWT verification middleware
export const authenticate: RequestHandler = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res
        .status(401)
        .json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token
    const publicKey = await importSPKI(PUBLIC_KEY, 'RS256');
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
    });

    // Check token type
    if (payload.type !== 'access') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    // Attach user info to request
    req.user = {
      sub: payload.sub as string,
      type: payload.type as string,
    };

    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'JWTExpired') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
};
