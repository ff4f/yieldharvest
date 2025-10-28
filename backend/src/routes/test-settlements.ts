import { FastifyInstance } from 'fastify';

export async function testSettlementsRoutes(fastify: FastifyInstance) {
  // Simple test route without any dependencies
  fastify.get('/test', async (request, reply) => {
    return { message: 'Test route working', timestamp: new Date().toISOString() };
  });
}