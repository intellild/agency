import sensible from '@fastify/sensible';
import type { FastifyInstance } from 'fastify';

/**
 * This plugins adds some utilities to handle http errors
 *
 * @see https://github.com/fastify/fastify-sensible
 */
export default async function sensiblePlugin(fastify: FastifyInstance) {
  await fastify.register(sensible);
}
