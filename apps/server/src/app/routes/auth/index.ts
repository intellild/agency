import { createSecretKey } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { importPKCS8, jwtVerify, SignJWT } from 'jose';
import { App, Octokit } from 'octokit';
import { ProxyAgent, fetch as undiciFetch } from 'undici';
import * as z from 'zod';

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
// PUBLIC_KEY is used in jwt.ts plugin for verification

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

export default async function (fastify: FastifyInstance) {
  const githubAuthCallbackSchema = z.object({
    code: z.string(),
  });

  // GitHub OAuth callback
  fastify.withTypeProvider<ZodTypeProvider>().route({
    method: 'post',
    url: '/auth/github/callback',
    schema: {
      body: githubAuthCallbackSchema,
    },
    handler: async (request, reply) => {
      const { code } = request.body as z.Infer<typeof githubAuthCallbackSchema>;

      if (!code) {
        return reply.redirect(`${FRONTEND_URL}/login?error=missing_code`);
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

        return reply.send({
          accessToken,
          refreshToken,
          githubToken: authentication.token,
          userId,
          username: githubUser.data.login,
        });
      } catch (err) {
        fastify.log.error(err);
        throw err;
      }
    },
  });

  // Refresh token endpoint
  fastify.post('/auth/refresh', async (request, reply) => {
    const { refresh_token } = request.body as { refresh_token?: string };

    if (!refresh_token) {
      return reply.status(400).send({ error: 'Refresh token required' });
    }

    try {
      // Verify refresh token
      const secretKey = createSecretKey(Buffer.from(ROOT_SECRET));

      const { payload } = await jwtVerify(refresh_token, secretKey, {
        algorithms: ['HS256'],
      });

      // Check token type
      if (payload.type !== 'refresh') {
        return reply.status(403).send({ error: 'Invalid token type' });
      }

      const userId = payload.sub;
      if (!userId) {
        return reply.status(403).send({ error: 'Invalid token' });
      }

      // Generate new tokens (token rotation)
      const newAccessToken = await generateAccessToken(userId);
      const newRefreshToken = await generateRefreshToken(userId);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch (err) {
      return reply.status(403).send({ error: 'Invalid refresh token' });
    }
  });
}
