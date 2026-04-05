import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { importSPKI, jwtVerify } from 'jose';

// Extend Fastify types to include user property
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub: string;
      type: string;
    };
  }
}

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

// JWT verification plugin
export default async function jwtPlugin(fastify: FastifyInstance) {
  // Decorate request with authenticate method
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get token from Authorization header
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return reply
            .status(401)
            .send({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.substring(7);

        // Verify token
        const publicKey = await importSPKI(PUBLIC_KEY, 'RS256');
        const { payload } = await jwtVerify(token, publicKey, {
          algorithms: ['RS256'],
        });

        // Check token type
        if (payload.type !== 'access') {
          return reply.status(401).send({ error: 'Invalid token type' });
        }

        // Attach user info to request
        request.user = {
          sub: payload.sub as string,
          type: payload.type as string,
        };
      } catch (err) {
        if (err instanceof Error && err.name === 'JWTExpired') {
          return reply.status(401).send({ error: 'Token expired' });
        }
        return reply.status(401).send({ error: 'Invalid token' });
      }
    },
  );
}
