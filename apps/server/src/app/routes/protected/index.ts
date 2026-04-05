import type { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  // Protected route example - requires authentication
  fastify.get(
    '/api/me',
    {
      preHandler: fastify.authenticate,
    },
    async request => ({
      userId: request.user?.sub,
      message: 'This is a protected endpoint',
    }),
  );

  // Protected dashboard data
  fastify.get(
    '/api/dashboard',
    {
      preHandler: fastify.authenticate,
    },
    async request => ({
      userId: request.user?.sub,
      data: 'Protected dashboard data',
    }),
  );
}
