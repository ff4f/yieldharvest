import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { milestonesService, MilestoneType, MilestoneData } from '../services/milestonesService';
import { mirrorNodeMilestonesService } from '../services/mirrorNodeMilestones';
import { logger } from '../utils/logger';
import { MilestoneUpdate } from '../services/websocketService';

// Validation schemas
const CreateMilestoneSchema = z.object({
  tokenId: z.string().min(1, 'Token ID is required'),
  serial: z.string().min(1, 'Serial number is required'),
  milestone: z.nativeEnum(MilestoneType),
  fileHash: z.string().optional(),
  agentId: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  documentUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

const GetMilestonesQuerySchema = z.object({
  tokenId: z.string().min(1),
  serial: z.string().min(1),
  useCache: z.string().transform(val => val === 'true').optional(),
  limit: z.string().transform(val => parseInt(val)).optional()
});

const GetTimelineQuerySchema = z.object({
  tokenId: z.string().min(1),
  serial: z.string().min(1),
  useCache: z.string().transform(val => val === 'true').optional(),
  limit: z.string().transform(val => parseInt(val)).optional()
});

const GetStatsQuerySchema = z.object({
  tokenId: z.string().min(1),
  serial: z.string().min(1)
});

const GetNextMilestonesQuerySchema = z.object({
  tokenId: z.string().min(1),
  serial: z.string().min(1)
});

type CreateMilestoneRequest = FastifyRequest<{
  Body: z.infer<typeof CreateMilestoneSchema>;
}>;

type GetMilestonesRequest = FastifyRequest<{
  Querystring: z.infer<typeof GetMilestonesQuerySchema>;
}>;

type GetTimelineRequest = FastifyRequest<{
  Querystring: z.infer<typeof GetTimelineQuerySchema>;
}>;

type GetStatsRequest = FastifyRequest<{
  Querystring: z.infer<typeof GetStatsQuerySchema>;
}>;

type GetNextMilestonesRequest = FastifyRequest<{
  Querystring: z.infer<typeof GetNextMilestonesQuerySchema>;
}>;

/**
 * Milestone routes for the Agent Portal
 * Handles milestone creation, retrieval, and timeline management
 */
export async function milestonesRoutes(fastify: FastifyInstance) {
  // Add validation hook
  fastify.addHook('preValidation', async (request, reply) => {
    // Add any authentication/authorization logic here
    // For now, we'll just log the request
    logger.debug('Milestone API request', {
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent']
    });
  });

  /**
   * POST /api/milestones
   * Create a new milestone event
   */
  fastify.post<{ Body: z.infer<typeof CreateMilestoneSchema> }>(
    '/',
    {
      schema: {
        description: 'Create a new milestone event',
        tags: ['milestones'],
        body: {
          type: 'object',
          required: ['tokenId', 'serial', 'milestone'],
          properties: {
            tokenId: { type: 'string', description: 'NFT Token ID' },
            serial: { type: 'string', description: 'NFT Serial Number' },
            milestone: { 
              type: 'string', 
              enum: Object.values(MilestoneType),
              description: 'Milestone type' 
            },
            fileHash: { type: 'string', description: 'Document file hash' },
            agentId: { type: 'string', description: 'Agent ID who recorded the milestone' },
            location: { type: 'string', description: 'Location where milestone occurred' },
            notes: { type: 'string', description: 'Additional notes' },
            documentUrl: { type: 'string', format: 'uri', description: 'Document URL' },
            metadata: { type: 'object', description: 'Additional metadata' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  tokenId: { type: 'string' },
                  serial: { type: 'string' },
                  milestone: { type: 'string' },
                  topicId: { type: 'string' },
                  sequenceNumber: { type: 'string' },
                  transactionId: { type: 'string' },
                  consensusTimestamp: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
              code: { type: 'string' }
            }
          }
        }
      }
    },
    async (request: CreateMilestoneRequest, reply: FastifyReply) => {
      try {
        // Validate request body
        const validatedData = CreateMilestoneSchema.parse(request.body);

        // Create milestone
        const milestone = await milestonesService.publishMilestone(validatedData);

        logger.info('Milestone created successfully', {
          tokenId: milestone.tokenId,
          serial: milestone.serial,
          milestone: milestone.milestone,
          transactionId: milestone.transactionId
        });

        // Broadcast milestone update via WebSocket
        const milestoneUpdate: MilestoneUpdate = {
          type: 'milestone_created',
          data: milestone,
          timestamp: new Date().toISOString(),
          dealId: milestone.tokenId, // Use tokenId as dealId for WebSocket routing
          invoiceId: milestone.serial // Use serial as invoiceId for WebSocket routing
        };
        
        fastify.websocket.broadcastMilestoneUpdate(milestoneUpdate);

        return reply.status(201).send({
          success: true,
          data: milestone
        });
      } catch (error: any) {
        logger.error('Failed to create milestone', { error, body: request.body });

        // Handle validation errors
        if (error.code) {
          return reply.status(400).send({
            success: false,
            error: error.message,
            code: error.code
          });
        }

        // Handle Zod validation errors
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Validation failed',
            details: error.errors
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * GET /api/milestones
   * Get milestones for a specific token
   */
  fastify.get<{ Querystring: z.infer<typeof GetMilestonesQuerySchema> }>(
    '/',
    {
      schema: {
        description: 'Get milestones for a specific token',
        tags: ['milestones'],
        querystring: {
          type: 'object',
          required: ['tokenId', 'serial'],
          properties: {
            tokenId: { type: 'string', description: 'NFT Token ID' },
            serial: { type: 'string', description: 'NFT Serial Number' },
            useCache: { type: 'string', enum: ['true', 'false'], description: 'Use cached data' },
            limit: { type: 'string', description: 'Limit number of results' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    tokenId: { type: 'string' },
                    serial: { type: 'string' },
                    milestone: { type: 'string' },
                    topicId: { type: 'string' },
                    sequenceNumber: { type: 'string' },
                    transactionId: { type: 'string' },
                    consensusTimestamp: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    async (request: GetMilestonesRequest, reply: FastifyReply) => {
      try {
        const { tokenId, serial } = GetMilestonesQuerySchema.parse(request.query);

        const milestones = await milestonesService.getMilestones(tokenId, serial);

        return reply.send({
          success: true,
          data: milestones
        });
      } catch (error: any) {
        logger.error('Failed to get milestones', { error, query: request.query });

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Invalid query parameters',
            details: error.errors
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * GET /api/milestones/timeline
   * Get milestone timeline from Mirror Node
   */
  fastify.get<{ Querystring: z.infer<typeof GetTimelineQuerySchema> }>(
    '/timeline',
    {
      schema: {
        description: 'Get milestone timeline from Mirror Node',
        tags: ['milestones'],
        querystring: {
          type: 'object',
          required: ['tokenId', 'serial'],
          properties: {
            tokenId: { type: 'string', description: 'NFT Token ID' },
            serial: { type: 'string', description: 'NFT Serial Number' },
            useCache: { type: 'string', enum: ['true', 'false'], description: 'Use cached data' },
            limit: { type: 'string', description: 'Limit number of results' }
          }
        }
      }
    },
    async (request: GetTimelineRequest, reply: FastifyReply) => {
      try {
        const { tokenId, serial, useCache, limit } = GetTimelineQuerySchema.parse(request.query);

        const timeline = await mirrorNodeMilestonesService.getMilestoneTimeline(
          tokenId,
          serial,
          { useCache, limit }
        );

        return reply.send({
          success: true,
          data: timeline
        });
      } catch (error: any) {
        logger.error('Failed to get milestone timeline', { error, query: request.query });

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Invalid query parameters',
            details: error.errors
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * GET /api/milestones/stats
   * Get milestone statistics
   */
  fastify.get<{ Querystring: z.infer<typeof GetStatsQuerySchema> }>(
    '/stats',
    {
      schema: {
        description: 'Get milestone statistics for a token',
        tags: ['milestones'],
        querystring: {
          type: 'object',
          required: ['tokenId', 'serial'],
          properties: {
            tokenId: { type: 'string', description: 'NFT Token ID' },
            serial: { type: 'string', description: 'NFT Serial Number' }
          }
        }
      }
    },
    async (request: GetStatsRequest, reply: FastifyReply) => {
      try {
        const { tokenId, serial } = GetStatsQuerySchema.parse(request.query);

        const stats = await mirrorNodeMilestonesService.getMilestoneStats(tokenId, serial);
        const progress = await milestonesService.getMilestoneProgress(tokenId, serial);

        return reply.send({
          success: true,
          data: {
            ...stats,
            progressPercentage: progress
          }
        });
      } catch (error: any) {
        logger.error('Failed to get milestone stats', { error, query: request.query });

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Invalid query parameters',
            details: error.errors
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * GET /api/milestones/next
   * Get next valid milestones for a token
   */
  fastify.get<{ Querystring: z.infer<typeof GetNextMilestonesQuerySchema> }>(
    '/next',
    {
      schema: {
        description: 'Get next valid milestones for a token',
        tags: ['milestones'],
        querystring: {
          type: 'object',
          required: ['tokenId', 'serial'],
          properties: {
            tokenId: { type: 'string', description: 'NFT Token ID' },
            serial: { type: 'string', description: 'NFT Serial Number' }
          }
        }
      }
    },
    async (request: GetNextMilestonesRequest, reply: FastifyReply) => {
      try {
        const { tokenId, serial } = GetNextMilestonesQuerySchema.parse(request.query);

        const nextMilestones = await milestonesService.getNextValidMilestones(tokenId, serial);

        return reply.send({
          success: true,
          data: {
            tokenId,
            serial,
            nextValidMilestones: nextMilestones
          }
        });
      } catch (error: any) {
        logger.error('Failed to get next milestones', { error, query: request.query });

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            success: false,
            error: 'Invalid query parameters',
            details: error.errors
          });
        }

        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * DELETE /api/milestones/cache
   * Clear milestone cache for a token
   */
  fastify.delete<{ Querystring: z.infer<typeof GetStatsQuerySchema> }>(
    '/cache',
    {
      schema: {
        description: 'Clear milestone cache for a token',
        tags: ['milestones'],
        querystring: {
          type: 'object',
          required: ['tokenId', 'serial'],
          properties: {
            tokenId: { type: 'string', description: 'NFT Token ID' },
            serial: { type: 'string', description: 'NFT Serial Number' }
          }
        }
      }
    },
    async (request: GetStatsRequest, reply: FastifyReply) => {
      try {
        const { tokenId, serial } = GetStatsQuerySchema.parse(request.query);

        await mirrorNodeMilestonesService.clearCache(tokenId, serial);

        return reply.send({
          success: true,
          message: 'Cache cleared successfully'
        });
      } catch (error: any) {
        logger.error('Failed to clear milestone cache', { error, query: request.query });

        return reply.status(500).send({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  );

  /**
   * GET /api/milestones/health
   * Health check for milestone services
   */
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Health check for milestone services',
        tags: ['milestones'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  milestonesService: { type: 'boolean' },
                  mirrorNodeService: { type: 'boolean' },
                  overall: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const milestonesHealthy = await milestonesService.healthCheck();
        const mirrorNodeHealthy = await mirrorNodeMilestonesService.healthCheck();
        const overall = milestonesHealthy && mirrorNodeHealthy;

        return reply.send({
          success: true,
          data: {
            milestonesService: milestonesHealthy,
            mirrorNodeService: mirrorNodeHealthy,
            overall
          }
        });
      } catch (error: any) {
        logger.error('Health check failed', { error });

        return reply.status(500).send({
          success: false,
          error: 'Health check failed'
        });
      }
    }
  );
}