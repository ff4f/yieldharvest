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
import { authRoutes } from './routes/auth';
import { hederaRoutes } from './routes/hedera';
import { contractRoutes } from './routes/contracts';
import { hfsRoutes } from './routes/hfs.routes';
import { htsRoutes } from './routes/hts.routes';
import { hcsRoutes } from './routes/hcs.routes';
import { mirrorRoutes } from './routes/mirror.routes';
import { walletRoutes } from './routes/wallet.routes';
import { walletAuthRoutes } from './routes/walletAuth';
import { testInvoiceRoutes } from './routes/test-invoices';
import testFundingRoutes from './routes/test-funding';
import { testFundingSimpleRoutes } from './routes/test-funding-simple';
import { HederaService } from './services/hedera';
import { HealthService } from './services/health.service';
import { registerSecurityMiddleware } from './middleware/security';
import { registerErrorHandlers } from './middleware/errorHandler';
import { correlationIdMiddleware } from './middleware/correlationId';
import { fileUploadValidator } from './middleware/fileUpload';
import { settlementsRoutes } from './routes/settlements';

const start = async (): Promise<void> => {
  try {
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
      testMode: process.env.HEDERA_TEST_MODE === 'true' || process.env.NODE_ENV === 'test',
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
          reply.status(200);
        } else {
          reply.status(200);
        }
        
        return healthResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: errorMessage }, 'Health check failed');
        reply.status(503);
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Health check failed',
        };
      }
    });

    // Simple health check
    fastify.get('/health/simple', async (request, reply) => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env['NODE_ENV'] || 'development',
      };
    });

    // Register API routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(userRoutes, { prefix: '/api/users' });
    await fastify.register(invoiceRoutes, { prefix: '/api/invoices' });
    await fastify.register(fundingRoutes, { prefix: '/api/fundings' });
    await fastify.register(hederaRoutes, { prefix: '/api/hedera' });
    await fastify.register(contractRoutes, { prefix: '/api/contracts' });
    await fastify.register(hfsRoutes, { prefix: '/api/hedera/hfs' });
    await fastify.register(htsRoutes, { prefix: '/api/hedera/hts' });
    await fastify.register(hcsRoutes, { prefix: '/api/hedera/hcs' });
    await fastify.register(mirrorRoutes, { prefix: '/api/hedera/mirror' });
    await fastify.register(walletRoutes, { prefix: '/api/wallet' });
    await fastify.register(walletAuthRoutes, { prefix: '/api/wallet-auth' });
    
    // Register test routes (no authentication required)
    await fastify.register(testInvoiceRoutes, { prefix: '/api' });
    await fastify.register(testFundingRoutes, { prefix: '/api' });
    await fastify.register(testFundingSimpleRoutes, { prefix: '/api' });
    
    // Register settlements routes
    console.log('Registering settlements routes in index.ts...');
    await fastify.register(settlementsRoutes, { prefix: '/api/settlements' });
    console.log('Settlements routes registered successfully in index.ts');

    // Graceful shutdown handlers
    process.on('SIGINT', async () => {
      fastify.log.info('Received SIGINT, shutting down gracefully...');
      await fastify.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      fastify.log.info('Received SIGTERM, shutting down gracefully...');
      await fastify.close();
      process.exit(0);
    });

    // Start server
    const host = fastify.config.HOST || '0.0.0.0';
    const port = parseInt(fastify.config.PORT) || 3000;
    
    await fastify.listen({ host, port });
    
    fastify.log.info(`🚀 YieldHarvest API server running on http://${host}:${port}`);
    fastify.log.info(`📚 API Documentation available at http://${host}:${port}/docs`);
    fastify.log.info(`🏥 Health check available at http://${host}:${port}/health`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

start();

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    hedera: HederaService;
    healthService: HealthService;
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