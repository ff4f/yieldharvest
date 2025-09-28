import Fastify from 'fastify';
import env from '@fastify/env';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { envSchema } from './types/env';
import { invoiceRoutes } from './routes/invoices';
import { fundingRoutes } from './routes/fundings';
import { userRoutes } from './routes/users';
import { hederaRoutes } from './routes/hedera';
import { contractRoutes } from './routes/contracts';
import { HederaService } from './services/hedera';
import { HealthService } from './services/health.service';
import { registerSecurityMiddleware } from './middleware/security';
import { registerErrorHandlers } from './middleware/errorHandler';
import { correlationIdMiddleware } from './middleware/correlationId';
import { auditLogger } from './utils/logger';

const fastify = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  trustProxy: true,
  bodyLimit: 10 * 1024 * 1024, // 10MB
});

// Environment validation
await fastify.register(env, {
  schema: envSchema,
  dotenv: true,
});

// Initialize Prisma
const prisma = new PrismaClient();

// Initialize Hedera Service
const hederaService = new HederaService({
  operatorId: fastify.config.OPERATOR_ID,
  operatorKey: fastify.config.OPERATOR_KEY,
  network: fastify.config.HEDERA_NETWORK,
  mirrorNodeUrl: fastify.config.MIRROR_NODE_URL,
});

// Initialize Health Service
const healthService = new HealthService(
  prisma,
  hederaService,
  fastify.log
);

// Add to Fastify context
fastify.decorate('prisma', prisma);
fastify.decorate('hedera', hederaService);
fastify.decorate('healthService', healthService);

// Register security middleware first
await registerSecurityMiddleware(fastify);

// Register error handlers
registerErrorHandlers(fastify);

// Add correlation ID tracking
fastify.addHook('onRequest', correlationIdMiddleware);

// Register multipart for file uploads
await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,
  },
});

// Swagger documentation
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'YieldHarvest API',
      description: 'Invoice factoring platform on Hedera',
      version: '1.0.0',
    },
    host: 'localhost:3000',
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    tags: [
      { name: 'invoices', description: 'Invoice management' },
      { name: 'fundings', description: 'Funding operations' },
      { name: 'users', description: 'User management' },
      { name: 'hedera', description: 'Hedera blockchain operations' },
      { name: 'contracts', description: 'Smart contract escrow operations' },
    ],
  },
});

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false,
  },
});

// Health check endpoints
fastify.get('/health', async (request, reply) => {
  try {
    const healthResult = await fastify.healthService.performHealthCheck();
    
    // Set appropriate HTTP status based on health
    if (healthResult.status === 'unhealthy') {
      reply.status(503);
    } else if (healthResult.status === 'degraded') {
      reply.status(200); // Still operational but degraded
    }
    
    return healthResult;
  } catch (error) {
    reply.status(503);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    };
  }
});

// Simple health check for load balancers
fastify.get('/health/simple', async (request, reply) => {
  try {
    const simpleHealth = await fastify.healthService.getSimpleHealth();
    
    if (simpleHealth.status !== 'healthy') {
      reply.status(503);
    }
    
    return simpleHealth;
  } catch (error) {
    reply.status(503);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }
});

// Register routes
await fastify.register(userRoutes, { prefix: '/api/users' });
await fastify.register(invoiceRoutes, { prefix: '/api/invoices' });
await fastify.register(fundingRoutes, { prefix: '/api/fundings' });
await fastify.register(hederaRoutes, { prefix: '/api/hedera' });
await fastify.register(contractRoutes, { prefix: '/api/contracts' });

// Graceful shutdown
process.on('SIGINT', async () => {
  fastify.log.info('Received SIGINT, shutting down gracefully');
  await fastify.close();
  await prisma.$disconnect();
  await hederaService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  fastify.log.info('Received SIGTERM, shutting down gracefully');
  await fastify.close();
  await prisma.$disconnect();
  await hederaService.disconnect();
  process.exit(0);
});

// Start server
const start = async (): Promise<void> => {
  try {
    const port = Number(fastify.config.PORT) || 3000;
    const host = fastify.config.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    fastify.log.info(`🚀 YieldHarvest Backend running on http://${host}:${port}`);
    fastify.log.info(`📚 API Documentation available at http://${host}:${port}/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Type declarations for Fastify context
declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      HOST: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
      OPERATOR_ID: string;
      OPERATOR_KEY: string;
      HEDERA_NETWORK: string;
      MIRROR_NODE_URL: string;
    };
    prisma: PrismaClient;
    hedera: HederaService;
    healthService: HealthService;
  }
}