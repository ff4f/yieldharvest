import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { mirrorNodeService } from '../services/mirrorNodeService';
import { logger } from '../utils/logger';
import { CacheService } from '../services/cacheService';

// Environment configuration
const INVOICE_TOPIC_ID = process.env.HEDERA_INVOICE_TOPIC_ID || '0.0.4567890';
const INVOICE_TOKEN_ID = process.env.HEDERA_INVOICE_TOKEN_ID || '0.0.1234567';
const OPERATOR_ACCOUNT_ID = process.env.HEDERA_OPERATOR_ACCOUNT_ID || '0.0.123456';
const MIRROR_NODE_URL = process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com';

// Request schemas
const GetNFTInfoSchema = z.object({
  tokenId: z.string().regex(/^0\.0\.\d+$/, 'Invalid token ID format'),
  serialNumber: z.string().regex(/^\d+$/, 'Invalid serial number'),
});

const GetHCSMessagesSchema = z.object({
  topicId: z.string().regex(/^0\.0\.\d+$/, 'Invalid topic ID format'),
  limit: z.number().min(1).max(100).optional().default(25),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  sequencenumber: z.string().optional(),
  timestamp: z.string().optional(),
});

const GetAccountTransactionsSchema = z.object({
  accountId: z.string().regex(/^0\.0\.\d+$/, 'Invalid account ID format'),
  limit: z.number().min(1).max(100).optional().default(25),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

const GetTransactionSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
});

const GetHashScanLinksSchema = z.object({
  transactionId: z.string().optional(),
  accountId: z.string().optional(),
  tokenId: z.string().optional(),
  topicId: z.string().optional(),
  fileId: z.string().optional(),
});

export default async function mirrorRoutes(fastify: FastifyInstance) {
  // Get NFT information
  fastify.get('/nft/:tokenId/:serialNumber', {
    schema: {
      params: {
        type: 'object',
        properties: {
          tokenId: { type: 'string', pattern: '^0\\.0\\.\\d+$' },
          serialNumber: { type: 'string', pattern: '^\\d+$' },
        },
        required: ['tokenId', 'serialNumber'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: ['object', 'null'],
              properties: {
                token_id: { type: 'string' },
                serial_number: { type: 'number' },
                account_id: { type: 'string' },
                created_timestamp: { type: 'string' },
                modified_timestamp: { type: 'string' },
                metadata: { type: 'string' },
                spender: { type: 'string' },
              },
            },
            hashScanLinks: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { tokenId: string; serialNumber: string } }>, reply: FastifyReply) => {
    try {
      const { tokenId, serialNumber } = request.params;
      
      const nftInfo = await mirrorNodeService.getNFTInfo(tokenId, serialNumber);
      const hashScanLinks = mirrorNodeService.generateHashScanLinks({
        tokenId,
        accountId: nftInfo?.account_id,
      });

      return reply.send({
        success: true,
        data: nftInfo,
        hashScanLinks,
      });
    } catch (error) {
      logger.error('Error getting NFT info:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get NFT information',
      });
    }
  });

  // Get all NFTs for a token
  fastify.get('/nfts/:tokenId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          tokenId: { type: 'string', pattern: '^0\\.0\\.\\d+$' }
        },
        required: ['tokenId']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 25 }
        }
      }
    },
  }, async (request: FastifyRequest<{ 
    Params: { tokenId: string };
    Querystring: { limit?: number };
  }>, reply: FastifyReply) => {
    try {
      const { tokenId } = request.params;
      const { limit = 25 } = request.query;
      
      const nfts = await mirrorNodeService.getNFTsByToken(tokenId, limit);
      const hashScanLinks = mirrorNodeService.generateHashScanLinks({ tokenId });

      return reply.send({
        success: true,
        data: nfts,
        count: nfts.length,
        hashScanLinks,
      });
    } catch (error) {
      logger.error('Error getting NFTs:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get NFTs',
      });
    }
  });

  // Get HCS messages from a topic
  fastify.get('/hcs/:topicId/messages', {
    schema: {
      params: {
        type: 'object',
        properties: {
          topicId: { type: 'string', pattern: '^0\\.0\\.\\d+$' }
        },
        required: ['topicId']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100 },
          order: { type: 'string', enum: ['asc', 'desc'] },
          sequencenumber: { type: 'string' },
          timestamp: { type: 'string' }
        }
      }
    },
  }, async (request: FastifyRequest<{ 
    Params: { topicId: string };
    Querystring: { 
      limit?: number; 
      order?: 'asc' | 'desc'; 
      sequencenumber?: string; 
      timestamp?: string; 
    };
  }>, reply: FastifyReply) => {
    try {
      const { topicId } = request.params;
      const filters = {
        limit: request.query.limit,
        order: request.query.order,
        sequencenumber: request.query.sequencenumber,
        timestamp: request.query.timestamp,
      };
      
      const messages = await mirrorNodeService.getHCSMessages(topicId, filters);
      const parsedInvoiceMessages = mirrorNodeService.parseInvoiceMessages(messages);
      const hashScanLinks = mirrorNodeService.generateHashScanLinks({ topicId });

      return reply.send({
        success: true,
        data: {
          messages,
          parsedInvoiceMessages,
        },
        count: messages.length,
        hashScanLinks,
      });
    } catch (error) {
      logger.error('Error getting HCS messages:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get HCS messages',
      });
    }
  });

  // Get account information
  fastify.get('/account/:accountId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$'
          }
        },
        required: ['accountId']
      }
    },
  }, async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
    try {
      const { accountId } = request.params;
      
      const accountInfo = await mirrorNodeService.getAccountInfo(accountId);
      const hashScanLinks = mirrorNodeService.generateHashScanLinks({ accountId });

      return reply.send({
        success: true,
        data: accountInfo,
        hashScanLinks,
      });
    } catch (error) {
      logger.error('Error getting account info:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get account information',
      });
    }
  });

  // Get account transactions
  fastify.get('/account/:accountId/transactions', {
    schema: {
      params: {
        type: 'object',
        properties: {
          accountId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$'
          }
        },
        required: ['accountId']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 100
          },
          order: {
            type: 'string',
            enum: ['asc', 'desc']
          }
        }
      }
    },
  }, async (request: FastifyRequest<{ 
    Params: { accountId: string };
    Querystring: { limit?: number; order?: 'asc' | 'desc' };
  }>, reply: FastifyReply) => {
    try {
      const { accountId } = request.params;
      const { limit = 25, order = 'desc' } = request.query;
      
      const transactions = await mirrorNodeService.getAccountTransactions(accountId, limit, order);
      const hashScanLinks = mirrorNodeService.generateHashScanLinks({ accountId });

      return reply.send({
        success: true,
        data: transactions,
        count: transactions.length,
        hashScanLinks,
      });
    } catch (error) {
      logger.error('Error getting account transactions:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get account transactions',
      });
    }
  });

  // Get transaction by ID
  fastify.get('/transaction/:transactionId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          transactionId: {
            type: 'string',
            minLength: 1
          }
        },
        required: ['transactionId']
      }
    },
  }, async (request: FastifyRequest<{ Params: { transactionId: string } }>, reply: FastifyReply) => {
    try {
      const { transactionId } = request.params;
      
      const transaction = await mirrorNodeService.getTransaction(transactionId);
      const hashScanLinks = mirrorNodeService.generateHashScanLinks({ transactionId });

      return reply.send({
        success: true,
        data: transaction,
        hashScanLinks,
      });
    } catch (error) {
      logger.error('Error getting transaction:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get transaction',
      });
    }
  });

  // Get HFS file information
  fastify.get('/file/:fileId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          fileId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$'
          }
        },
        required: ['fileId']
      }
    },
  }, async (request: FastifyRequest<{ Params: { fileId: string } }>, reply: FastifyReply) => {
    try {
      const { fileId } = request.params;
      
      // Get file info from Hedera service (which calls Mirror Node)
      const fileInfo = await mirrorNodeService.getFileInfo(fileId);
      const hashScanLinks = mirrorNodeService.generateHashScanLinks({ fileId });

      return reply.send({
        success: true,
        data: fileInfo,
        hashScanLinks,
      });
    } catch (error) {
      logger.error('Error getting file info:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get file information',
      });
    }
  });

  // Get network statistics
  fastify.get('/network/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const networkStats = await mirrorNodeService.getNetworkStats();

      return reply.send({
        success: true,
        data: networkStats,
      });
    } catch (error) {
      logger.error('Error getting network stats:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get network statistics',
      });
    }
  });

  // Get comprehensive dashboard metrics
  fastify.get('/dashboard/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await mirrorNodeService.getDashboardMetrics(
        INVOICE_TOPIC_ID,
        INVOICE_TOKEN_ID,
        OPERATOR_ACCOUNT_ID
      );

      return reply.send({
        success: true,
        data: metrics,
        hashScanLinks: mirrorNodeService.generateHashScanLinks({
          topicId: INVOICE_TOPIC_ID,
          tokenId: INVOICE_TOKEN_ID,
          accountId: OPERATOR_ACCOUNT_ID,
        }),
      });
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get dashboard metrics',
      });
    }
  });

  // Generate HashScan links
  fastify.post('/hashscan-links', {
    schema: {
      body: {
        type: 'object',
        properties: {
          transactionId: { type: 'string' },
          accountId: { type: 'string' },
          tokenId: { type: 'string' },
          topicId: { type: 'string' },
          fileId: { type: 'string' }
        }
      }
    },
  }, async (request: FastifyRequest<{ Body: { transactionId?: string; accountId?: string; tokenId?: string; topicId?: string; fileId?: string } }>, reply: FastifyReply) => {
    try {
      const links = mirrorNodeService.generateHashScanLinks(request.body);

      return reply.send({
        success: true,
        data: links,
      });
    } catch (error) {
      logger.error('Error generating HashScan links:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate HashScan links',
      });
    }
  });

  // Cache management endpoints
  fastify.get('/cache/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = CacheService.getCacheStats();
      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting cache stats:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get cache statistics',
      });
    }
  });

  fastify.delete('/cache', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      CacheService.clearAllCaches();
      return reply.send({
        success: true,
        message: 'All caches cleared',
      });
    } catch (error) {
      logger.error('Error clearing caches:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to clear caches',
      });
    }
  });

  // Health check
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const isHealthy = await mirrorNodeService.healthCheck();
      
      return reply.send({
        success: true,
        status: isHealthy ? 'healthy' : 'unhealthy',
        mirrorNodeUrl: MIRROR_NODE_URL,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Mirror Node health check failed:', error);
      return reply.status(503).send({
        success: false,
        status: 'unhealthy',
        error: 'Health check failed',
      });
    }
  });

  // Get polling service stats
  fastify.get('/polling/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = fastify.mirrorPolling.getStats();
      
      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting polling stats:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get polling stats',
      });
    }
  });

  // Force polling cycle
  fastify.post('/polling/force', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await fastify.mirrorPolling.forcePoll();
      
      return reply.send({
        success: true,
        message: 'Forced polling cycle completed',
      });
    } catch (error) {
      logger.error('Error forcing polling cycle:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to force polling cycle',
      });
    }
  });
}