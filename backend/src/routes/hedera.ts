import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole, UserRole } from '../middleware/auth';
import { validate, hederaSchemas, paramSchemas } from '../middleware/validation';
import { auditLogger } from '../utils/logger';

// Validation schemas
const createNFTCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10),
  memo: z.string().optional(),
});

const createTopicSchema = z.object({
  memo: z.string().optional(),
});

const invoiceCreationSchema = z.object({
  invoiceNumber: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().min(3).max(3),
  supplier: z.string().min(1),
  buyer: z.string().min(1),
  dueDate: z.string().datetime(),
});

export async function hederaRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Get Hedera network status
  fastify.get('/status', {
    schema: {
      tags: ['hedera'],
      summary: 'Get Hedera network status',
      response: {
        200: {
          type: 'object',
          properties: {
            network: { type: 'string' },
            connected: { type: 'boolean' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const isConnected = await fastify.hedera.isConnected();
    return {
      network: 'testnet',
      connected: isConnected,
      timestamp: new Date().toISOString(),
    };
  });

  // Create NFT collection for invoices
  fastify.post('/nft/collections', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN]), validate(hederaSchemas.createToken)],
    schema: {
      tags: ['hedera'],
      summary: 'Create NFT collection for invoices',
      body: {
        type: 'object',
        required: ['name', 'symbol'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          symbol: { type: 'string', minLength: 1, maxLength: 10 },
          memo: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            tokenId: { type: 'string' },
            transactionId: { type: 'string' },
            hashScanUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = createNFTCollectionSchema.parse(request.body);
      const result = await fastify.hedera.createInvoiceNFTToken(
        body.name,
        body.symbol,
        body.memo
      );
      
      return reply.code(201).send({
        ...result,
        hashScanUrl: `https://hashscan.io/testnet/token/${result.tokenId}`,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(400).send({ error: 'Failed to create NFT collection' });
    }
  });

  // Create HCS topic
  fastify.post('/hcs/topics', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER]), validate(hederaSchemas.submitMessage)],
    schema: {
      tags: ['hedera'],
      summary: 'Create HCS topic for invoice events',
      body: {
        type: 'object',
        properties: {
          memo: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            topicId: { type: 'string' },
            transactionId: { type: 'string' },
            hashScanUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const body = createTopicSchema.parse(request.body);
      const result = await fastify.hedera.createTopic(body.memo);
      
      return reply.code(201).send({
        ...result,
        hashScanUrl: `https://hashscan.io/testnet/topic/${result.topicId}`,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(400).send({ error: 'Failed to create HCS topic' });
    }
  });

  // Get transaction details
  fastify.get('/transactions/:id', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER, UserRole.INVESTOR])],
    schema: {
      tags: ['hedera'],
      summary: 'Get transaction details',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const transaction = await fastify.hedera.getTransactionDetails(id);
      return { data: transaction };
    } catch (error) {
      return reply.code(404).send({ error: 'Transaction not found' });
    }
  });

  // Get topic messages
  fastify.get('/topics/:topicId/messages', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER, UserRole.INVESTOR])],
    schema: {
      tags: ['hedera'],
      summary: 'Get HCS topic messages',
      params: {
        type: 'object',
        properties: {
          topicId: { type: 'string' },
        },
        required: ['topicId'],
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
        },
      },
    },
  }, async (request, reply) => {
    const { topicId } = request.params as { topicId: string };
    const { limit = 10 } = request.query as { limit?: number };
    
    try {
      const messages = await fastify.hedera.getTopicMessages(topicId, limit);
      return { data: messages };
    } catch (error) {
      return reply.code(404).send({ error: 'Topic messages not found' });
    }
  });

  // Get NFT info
  fastify.get('/nft/:tokenId/:serialNumber', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER, UserRole.INVESTOR])],
    schema: {
      tags: ['hedera'],
      summary: 'Get NFT information',
      params: {
        type: 'object',
        properties: {
          tokenId: { type: 'string' },
          serialNumber: { type: 'string' },
        },
        required: ['tokenId', 'serialNumber'],
      },
    },
  }, async (request, reply) => {
    const { tokenId, serialNumber } = request.params as { tokenId: string; serialNumber: string };
    
    try {
      const nftInfo = await fastify.hedera.getNFTInfo(tokenId, serialNumber);
      return { data: nftInfo };
    } catch (error) {
      return reply.code(404).send({ error: 'NFT not found' });
    }
  });

  // Get file contents
  fastify.get('/files/:fileId', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER, UserRole.INVESTOR])],
    schema: {
      tags: ['hedera'],
      summary: 'Get HFS file information',
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string' },
        },
        required: ['fileId'],
      },
    },
  }, async (request, reply) => {
    const { fileId } = request.params as { fileId: string };
    
    try {
      const fileInfo = await fastify.hedera.getFileContents(fileId);
      return { data: fileInfo };
    } catch (error) {
      return reply.code(404).send({ error: 'File not found' });
    }
  });
}