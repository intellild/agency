import type { FastifyInstance } from 'fastify';
import jwtPlugin from './plugins/jwt';
// Import plugins
import sensiblePlugin from './plugins/sensible';

// Import routes
import authRoutes from './routes/auth';
import protectedRoutes from './routes/protected';
import rootRoute from './routes/root';

/* eslint-disable-next-line */
export type AppOptions = {};

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  // Register plugins
  await fastify.register(sensiblePlugin);
  await fastify.register(jwtPlugin);

  // Register routes
  await fastify.register(authRoutes);
  await fastify.register(protectedRoutes);
  await fastify.register(rootRoute);
}
