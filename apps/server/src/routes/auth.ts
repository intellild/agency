import { createSecretKey } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Router } from 'express';
import { importPKCS8, jwtVerify, SignJWT } from 'jose';
import { App, Octokit } from 'octokit';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { getICEServers, getP2PNodeInfo } from '../p2p/index.js';

// Configuration from environment variables
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const ROOT_SECRET = process.env.ROOT_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

const myFetch: typeof undiciFetch = (url, options) => {
  return undiciFetch(url, {
    ...options,
    dispatcher: process.env.HTTPS_PROXY
      ? new ProxyAgent({
          uri: process.env.HTTPS_PROXY,
          keepAliveTimeout: 10,
          keepAliveMaxTimeout: 10,
        })
      : undefined,
  });
};

// Load RSA keys
function loadPrivateKey(): string {
  const env = process.env.ENV ?? 'development';
  const keyPath = path.join(__dirname, '../keys', env, 'private.pem');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf-8');
  }
  return process.env.JWT_PRIVATE_KEY || '';
}

const PRIVATE_KEY = loadPrivateKey();

// Generate JWT access token (RS256, 30 days)
async function generateAccessToken(userId: string): Promise<string> {
  const privateKey = await importPKCS8(PRIVATE_KEY, 'RS256');

  return new SignJWT({
    sub: userId,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(privateKey);
}

// Generate refresh token (symmetric encryption with root secret)
async function generateRefreshToken(userId: string): Promise<string> {
  const secretKey = createSecretKey(Buffer.from(ROOT_SECRET));

  return new SignJWT({
    sub: userId,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(secretKey);
}

Octokit.defaults({
  request: {
    fetch: myFetch,
  },
});
const app = new App({
  appId: GITHUB_CLIENT_ID,
  privateKey: GITHUB_CLIENT_SECRET,
  oauth: {
    clientId: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
  },
  request: {
    fetch: myFetch,
  },
});

const router: Router = Router();

// GitHub OAuth callback
router.post('/github/callback', async (req, res) => {
  const { code } = req.body as { code?: string };

  if (!code) {
    res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
    return;
  }

  try {
    // Exchange code for GitHub access token
    const { authentication } = await app.oauth.createToken({
      code,
    });

    const octokit = new Octokit({
      auth: authentication.token,
    });

    const githubUser = await octokit.rest.users.getAuthenticated();
    const userId = githubUser.data.id.toString();

    // Generate JWT tokens
    const accessToken = await generateAccessToken(userId);
    const refreshToken = await generateRefreshToken(userId);

    // Get P2P configuration if available
    const p2pInfo = getP2PNodeInfo();
    const p2pConfig = p2pInfo
      ? {
          serverPeerId: p2pInfo.peerId,
          relayAddresses: p2pInfo.relayAddresses,
          iceServers: getICEServers(),
        }
      : null;

    res.json({
      accessToken,
      refreshToken,
      githubToken: authentication.token,
      userId,
      username: githubUser.data.login,
      p2p: p2pConfig,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body as { refresh_token?: string };

  if (!refresh_token) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  try {
    // Verify refresh token
    const secretKey = createSecretKey(Buffer.from(ROOT_SECRET));

    const { payload } = await jwtVerify(refresh_token, secretKey, {
      algorithms: ['HS256'],
    });

    // Check token type
    if (payload.type !== 'refresh') {
      res.status(403).json({ error: 'Invalid token type' });
      return;
    }

    const userId = payload.sub;
    if (!userId) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }

    // Generate new tokens (token rotation)
    const newAccessToken = await generateAccessToken(userId);
    const newRefreshToken = await generateRefreshToken(userId);

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
    });
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
});

export default router;
