import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { MirrorNodeService } from '../services/mirror.service';
import { logger } from '../utils/logger';

// Zod schemas for validation
const TransactionParamsSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
});

const NFTParamsSchema = z.object({
  tokenId: z.string().min(1, 'Token ID is required'),
  serialNumber: z.string().min(1, 'Serial number is required'),
});

const TokenParamsSchema = z.object({
  tokenId: z.string().min(1, 'Token ID is required'),
});

const TopicParamsSchema = z.object({
  topicId: z.string().min(1, 'Topic ID is required'),
});

const FileParamsSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
});

const AccountParamsSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
});

const TopicMessagesQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  order: z.enum(['asc', 'desc']).optional(),
  timestamp: z.string().optional(),
  sequenceNumber: z.string().optional().transform(val => val ? parseInt(val) : undefined),
});

const AccountTransactionsQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  order: z.enum(['asc', 'desc']).optional(),
  timestamp: z.string().optional(),
  transactionType: z.string().optional(),
});

const TransactionSearchQuerySchema = z.object({
  account: z.string().optional(),
  timestamp: z.string().optional(),
  transactionType: z.string().optional(),
  result: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  order: z.enum(['asc', 'desc']).optional(),
});

const TokenNFTsQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  order: z.enum(['asc', 'desc']).optional(),
  serialNumber: z.string().optional(),
});

export async function mirrorRoutes(fastify: FastifyInstance) {
  const mirrorService = new MirrorNodeService({
    baseUrl: process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
  });

  // Get transaction by ID
  fastify.get<{
    Params: z.infer<typeof TransactionParamsSchema>;
  }>('/transactions/:transactionId', {
    schema: {
      description: 'Get transaction details by transaction ID',
      tags: ['Mirror Node'],
      params: {
        type: 'object',
        properties: {
          transactionId: { type: 'string', description: 'Hedera transaction ID' },
        },
        required: ['transactionId'],
      },
      response: {
        200: {
          type: 'object',
          description: 'Transaction details',
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { transactionId } = TransactionParamsSchema.parse(request.params);
      
      const transaction = await mirrorService.getTransaction(transactionId);
      
      if (!transaction) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Transaction not found',
        });
      }

      return reply.send(transaction);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId: (request.params as any)?.transactionId,
      }, 'Failed to get transaction');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve transaction',
      });
    }
  });

  // Get NFT details
  fastify.get<{
    Params: z.infer<typeof NFTParamsSchema>;
  }>('/tokens/:tokenId/nfts/:serialNumber', {
    schema: {
      description: 'Get NFT details by token ID and serial number',
      tags: ['Mirror Node'],
      params: {
        type: 'object',
        properties: {
          tokenId: { type: 'string', description: 'Hedera token ID' },
          serialNumber: { type: 'string', description: 'NFT serial number' },
        },
        required: ['tokenId', 'serialNumber'],
      },
      response: {
        200: {
          type: 'object',
          description: 'NFT details',
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tokenId, serialNumber } = NFTParamsSchema.parse(request.params);
      
      const nft = await mirrorService.getNFT(tokenId, serialNumber);
      
      if (!nft) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'NFT not found',
        });
      }

      return reply.send(nft);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenId: (request.params as any)?.tokenId,
        serialNumber: (request.params as any)?.serialNumber,
      }, 'Failed to get NFT');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve NFT',
      });
    }
  });

  // Get token NFTs
  fastify.get<{
    Params: z.infer<typeof TokenParamsSchema>;
    Querystring: z.infer<typeof TokenNFTsQuerySchema>;
  }>('/tokens/:tokenId/nfts', {
    schema: {
      description: 'Get all NFTs for a token',
      tags: ['Mirror Node'],
      params: {
        type: 'object',
        properties: {
          tokenId: { type: 'string', description: 'Hedera token ID' },
        },
        required: ['tokenId'],
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Maximum number of NFTs to return' },
          order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
          serialNumber: { type: 'string', description: 'Filter by serial number' },
        },
      },
      response: {
        200: {
          type: 'array',
          description: 'List of NFTs',
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tokenId } = TokenParamsSchema.parse(request.params);
      const query = TokenNFTsQuerySchema.parse(request.query);
      
      const nfts = await mirrorService.getTokenNFTs(tokenId, query.limit);
      
      return reply.send(nfts);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenId: (request.params as any)?.tokenId,
      }, 'Failed to get token NFTs');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve token NFTs',
      });
    }
  });

  // Get token details
  fastify.get<{
    Params: z.infer<typeof TokenParamsSchema>;
  }>('/tokens/:tokenId', {
    schema: {
      description: 'Get token details by token ID',
      tags: ['Mirror Node'],
      params: {
        type: 'object',
        properties: {
          tokenId: { type: 'string', description: 'Hedera token ID' },
        },
        required: ['tokenId'],
      },
      response: {
        200: {
          type: 'object',
          description: 'Token details',
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tokenId } = TokenParamsSchema.parse(request.params);
      
      const token = await mirrorService.getToken(tokenId);
      
      if (!token) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Token not found',
        });
      }

      return reply.send(token);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenId: (request.params as any)?.tokenId,
      }, 'Failed to get token');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve token',
      });
    }
  });

  // Get topic messages
  fastify.get<{
    Params: z.infer<typeof TopicParamsSchema>;
    Querystring: z.infer<typeof TopicMessagesQuerySchema>;
  }>('/topics/:topicId/messages', {
    schema: {
      description: 'Get messages from a topic',
      tags: ['Mirror Node'],
      params: {
        type: 'object',
        properties: {
          topicId: { type: 'string', description: 'Hedera topic ID' },
        },
        required: ['topicId'],
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Maximum number of messages to return' },
          order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
          timestamp: { type: 'string', description: 'Filter by timestamp' },
          sequenceNumber: { type: 'string', description: 'Filter by sequence number' },
        },
      },
      response: {
        200: {
          type: 'array',
          description: 'List of topic messages',
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { topicId } = TopicParamsSchema.parse(request.params);
      const query = TopicMessagesQuerySchema.parse(request.query);
      
      const messages = await mirrorService.getTopicMessages(topicId, query);
      
      return reply.send(messages);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        topicId: (request.params as any)?.topicId,
      }, 'Failed to get topic messages');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve topic messages',
      });
    }
  });

  // Get topic details
  fastify.get<{
    Params: z.infer<typeof TopicParamsSchema>;
  }>('/topics/:topicId', {
    schema: {
      description: 'Get topic details by topic ID',
      tags: ['Mirror Node'],
      params: {
        type: 'object',
        properties: {
          topicId: { type: 'string', description: 'Hedera topic ID' },
        },
        required: ['topicId'],
      },
      response: {
        200: {
          type: 'object',
          description: 'Topic details',
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { topicId } = TopicParamsSchema.parse(request.params);
      
      const topic = await mirrorService.getTopic(topicId);
      
      if (!topic) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Topic not found',
        });
      }

      return reply.send(topic);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        topicId: (request.params as any)?.topicId,
      }, 'Failed to get topic');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve topic',
      });
    }
  });

  // Get file details
  fastify.get<{
    Params: z.infer<typeof FileParamsSchema>;
  }>('/files/:fileId', {
    schema: {
      description: 'Get file details by file ID',
      tags: ['Mirror Node'],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'Hedera file ID' },
        },
        required: ['fileId'],
      },
      response: {
        200: {
          type: 'object',
          description: 'File details',
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { fileId } = FileParamsSchema.parse(request.params);
      
      const file = await mirrorService.getFile(fileId);
      
      if (!file) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      return reply.send(file);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        fileId: (request.params as any)?.fileId,
      }, 'Failed to get file');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve file',
      });
    }
  });

  // Get account transactions
  fastify.get<{
    Params: z.infer<typeof AccountParamsSchema>;
    Querystring: z.infer<typeof AccountTransactionsQuerySchema>;
  }>('/accounts/:accountId/transactions', {
    schema: {
      description: 'Get transactions for an account',
      tags: ['Mirror Node'],
      params: {
        type: 'object',
        properties: {
          accountId: { type: 'string', description: 'Hedera account ID' },
        },
        required: ['accountId'],
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Maximum number of transactions to return' },
          order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
          timestamp: { type: 'string', description: 'Filter by timestamp' },
          transactionType: { type: 'string', description: 'Filter by transaction type' },
        },
      },
      response: {
        200: {
          type: 'array',
          description: 'List of account transactions',
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId } = AccountParamsSchema.parse(request.params);
      const query = AccountTransactionsQuerySchema.parse(request.query);
      
      const transactions = await mirrorService.getAccountTransactions(accountId, query);
      
      return reply.send(transactions);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        accountId: (request.params as any)?.accountId,
      }, 'Failed to get account transactions');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve account transactions',
      });
    }
  });

  // Search transactions
  fastify.get<{
    Querystring: z.infer<typeof TransactionSearchQuerySchema>;
  }>('/transactions', {
    schema: {
      description: 'Search transactions with filters',
      tags: ['Mirror Node'],
      querystring: {
        type: 'object',
        properties: {
          account: { type: 'string', description: 'Filter by account ID' },
          timestamp: { type: 'string', description: 'Filter by timestamp' },
          transactionType: { type: 'string', description: 'Filter by transaction type' },
          result: { type: 'string', description: 'Filter by transaction result' },
          limit: { type: 'string', description: 'Maximum number of transactions to return' },
          order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort order' },
        },
      },
      response: {
        200: {
          type: 'array',
          description: 'List of transactions',
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = TransactionSearchQuerySchema.parse(request.query);
      
      const transactions = await mirrorService.searchTransactions(query);
      
      return reply.send(transactions);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        query: request.query,
      }, 'Failed to search transactions');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to search transactions',
      });
    }
  });

  // Get network status
  fastify.get('/network/status', {
    schema: {
      description: 'Get Hedera network status',
      tags: ['Mirror Node'],
      response: {
        200: {
          type: 'object',
          description: 'Network status information',
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await mirrorService.getNetworkStatus();
      
      if (!status) {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Network status unavailable',
        });
      }

      return reply.send(status);
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get network status');
      
      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve network status',
      });
    }
  });

  // Health check
  fastify.get('/health', {
    schema: {
      description: 'Check Mirror Node API health',
      tags: ['Mirror Node'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const isHealthy = await mirrorService.healthCheck();
      
      if (isHealthy) {
        return reply.send({
          status: 'healthy',
          timestamp: new Date().toISOString(),
        });
      } else {
        return reply.status(503).send({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Mirror Node health check failed');
      
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      });
    }
  });
}