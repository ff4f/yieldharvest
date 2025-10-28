import { FastifyInstance } from 'fastify';

export async function settlementsSimpleRoutes(fastify: FastifyInstance) {
  // Simple test route to verify settlements routes work
  fastify.get('/test', async (request, reply) => {
    return { 
      message: 'Settlements routes working', 
      timestamp: new Date().toISOString(),
      endpoint: '/api/settlements/test'
    };
  });

  // Simple snapshot route
  fastify.get('/snapshot', async (request, reply) => {
    return {
      totalFundings: 0,
      completedFundings: 0,
      activeFundings: 0,
      failedFundings: 0,
      totalInvoices: 0,
      paidInvoices: 0,
      fundedInvoices: 0,
      recentFundings: [],
      timestamp: new Date().toISOString()
    };
  });
}