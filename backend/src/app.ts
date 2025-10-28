import Fastify, { FastifyInstance } from 'fastify';
import env from '@fastify/env';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import { envSchema } from './types/env';
import { invoiceRoutes } from './routes/invoices';
import { fundingRoutes } from './routes/fundings';
import { userRoutes } from './routes/users';
import { authRoutes } from './routes/auth';
import { walletAuthRoutes } from './routes/wallet-auth';
import { hederaRoutes } from './routes/hedera';
import { contractRoutes } from './routes/contracts';
import { milestonesRoutes } from './routes/milestones';
import { mirrorRoutes } from './routes/mirror.routes';
import { settlementsSimpleRoutes } from './routes/settlements-simple';
import documentRoutes from './routes/documents';
import { HederaService } from './services/hedera';
import { websocketService } from './services/websocketService';
import { registerSecurityMiddleware } from './middleware/security';
import { registerErrorHandlers } from './middleware/errorHandler';
import { correlationIdMiddleware } from './middleware/correlationId';
import { metricsMiddleware } from './middleware/metrics';
import { auditLogger } from './utils/logger';

export async function build(opts = {}): Promise<FastifyInstance> {
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
    ...opts,
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

  // Initialize WebSocket service
  await websocketService.initialize(fastify);

  // Decorate fastify instance
  fastify.decorate('prisma', prisma);
  fastify.decorate('hedera', hederaService);
  fastify.decorate('websocket', websocketService);

  // Register security middleware
  await registerSecurityMiddleware(fastify);

  // Register metrics middleware
  await metricsMiddleware(fastify);

  // Register error handlers
  registerErrorHandlers(fastify);

  // Add correlation ID middleware
  fastify.addHook('onRequest', correlationIdMiddleware);

  // Register multipart plugin for file uploads
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1024 * 1024, // 1MB
      fields: 20,
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5,
      headerPairs: 2000,
      parts: 1000
    },
  });

  // Register Swagger documentation
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
      securityDefinitions: {
        bearerAuth: {
          type: 'apiKey',
          name: 'Authorization',
          in: 'header',
          description: 'Enter JWT token with Bearer prefix, e.g. "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."'
        }
      },
      tags: [
        { name: 'invoices', description: 'Invoice management' },
        { name: 'fundings', description: 'Funding operations' },
        { name: 'users', description: 'User management' },
        { name: 'auth', description: 'Authentication' },
        { name: 'wallet-auth', description: 'Wallet-based authentication' },
        { name: 'hedera', description: 'Hedera blockchain operations' },
        { name: 'contracts', description: 'Smart contract escrow operations' },
        { name: 'milestones', description: 'Milestone tracking and management' },
        { name: 'settlements', description: 'Settlement data and audit trails' },
        { name: 'documents', description: 'Document storage and management via HFS' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(walletAuthRoutes, { prefix: '/api/wallet-auth' });
  await fastify.register(userRoutes, { prefix: '/api/users' });
  await fastify.register(invoiceRoutes, { prefix: '/api/invoices' });
  await fastify.register(fundingRoutes, { prefix: '/api/fundings' });
  await fastify.register(hederaRoutes, { prefix: '/api/hedera' });
  await fastify.register(contractRoutes, { prefix: '/api/contracts' });
  await fastify.register(milestonesRoutes, { prefix: '/api/milestones' });
  await fastify.register(mirrorRoutes, { prefix: '/api/mirror' });
  await fastify.register(documentRoutes, { prefix: '/api/documents' });
  
  // Debug: Log before registering settlements routes
  console.log('About to register settlements routes...');
  fastify.log.info('Registering settlements routes...');
  try {
    await fastify.register(settlementsSimpleRoutes, { prefix: '/api/settlements' });
    console.log('Settlements routes registered successfully');
    fastify.log.info('Settlements routes registered successfully');
  } catch (error) {
    console.error('Failed to register settlements routes:', error);
    fastify.log.error(`Failed to register settlements routes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
  
  // Debug: Print all registered routes
  fastify.ready(() => {
    fastify.log.info('All registered routes:');
    fastify.log.info(fastify.printRoutes());
  });

  return fastify;
}

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    hedera: HederaService;
    websocket: typeof websocketService;
    config: {
      PORT: string;
      HOST: string;
      DATABASE_URL: string;
      OPERATOR_ID: string;
      OPERATOR_KEY: string;
      HEDERA_NETWORK: string;
      MIRROR_NODE_URL: string;
    };
  }
}