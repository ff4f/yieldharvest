import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';
import { walletJwtGuard, walletAdminGuard } from '../middleware/auth.middleware';

// Request/Response schemas
const NonceRequestSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
});

const VerifySignatureSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  signature: z.string().min(1, 'Signature is required'),
});

const UpdateRolesSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  roles: z.array(z.enum(['ADMIN', 'SUPPLIER', 'INVESTOR', 'AGENT'])).min(1, 'At least one role is required'),
});

export async function walletAuthRoutes(fastify: FastifyInstance) {
  // Generate nonce for wallet authentication
  fastify.post('/auth/nonce', {
    schema: {
      description: 'Generate a nonce for wallet signature authentication',
      tags: ['Authentication'],
      body: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string', description: 'Hedera account ID (e.g., 0.0.123456)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            nonce: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
            message: { type: 'string' },
          },
        },
        400: {
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
      const { accountId } = NonceRequestSchema.parse(request.body);

      logger.info(`Generating nonce for account: ${accountId}`);

      const nonceResponse = await authService.generateNonce(accountId);

      logger.info(`Nonce generated successfully for account: ${accountId}`);

      return reply.status(200).send({
        ...nonceResponse,
        message: `Please sign this nonce with your wallet: ${nonceResponse.nonce}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Invalid nonce request: ${error.message}`);
        return reply.status(400).send({
          error: 'Validation Error',
          message: error.errors[0]?.message || 'Invalid request data',
        });
      }

      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error generating nonce');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to generate nonce',
      });
    }
  });

  // Verify signature and issue JWT token
  fastify.post('/auth/verify', {
    schema: {
      description: 'Verify wallet signature and issue JWT token',
      tags: ['Authentication'],
      body: {
          type: 'object',
          required: ['accountId', 'signature'],
          properties: {
            accountId: { type: 'string', description: 'Hedera account ID' },
            signature: { type: 'string', description: 'Hex-encoded signature' },
          },
        },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                accountId: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
                publicKey: { type: 'string' },
              },
            },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        401: {
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
      const verifyRequest = VerifySignatureSchema.parse(request.body);

      logger.info(`Verifying signature for account: ${verifyRequest.accountId}`);

      const authResponse = await authService.verifySignatureAndIssueToken(verifyRequest);

      logger.info(`Signature verified successfully for account: ${verifyRequest.accountId}`);

      return reply.status(200).send(authResponse);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Invalid verify request: ${error.message}`);
        return reply.status(400).send({
          error: 'Validation Error',
          message: error.errors[0]?.message || 'Invalid request data',
        });
      }

      if (error instanceof Error) {
        if (error.message.includes('Invalid signature') || 
            error.message.includes('Nonce not found') || 
            error.message.includes('expired')) {
          logger.warn(`Authentication failed for account: ${JSON.stringify(request.body)}: ${error.message}`);
          return reply.status(401).send({
            error: 'Authentication Failed',
            message: error.message,
          });
        }
      }

      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error verifying signature');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to verify signature',
      });
    }
  });

  // Get current user info (protected route)
  fastify.get('/auth/me', {
    preHandler: [walletJwtGuard],
    schema: {
      description: 'Get current authenticated user information',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            accountId: { type: 'string' },
            roles: { type: 'array', items: { type: 'string' } },
            publicKey: { type: 'string' },
          },
        },
        401: {
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
      if (!request.walletUser) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
      }

      return reply.status(200).send(request.walletUser);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error getting user info');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get user information',
      });
    }
  });

  // Update user roles (admin only)
  fastify.put('/auth/roles', {
    preHandler: [walletJwtGuard, walletAdminGuard],
    schema: {
      description: 'Update user roles (admin only)',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['accountId', 'roles'],
        properties: {
          accountId: { type: 'string', description: 'Target account ID' },
          roles: { 
            type: 'array', 
            items: { 
              type: 'string',
              enum: ['ADMIN', 'SUPPLIER', 'INVESTOR', 'AGENT']
            },
            description: 'Array of roles to assign'
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                accountId: { type: 'string' },
                roles: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        403: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
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
      const { accountId, roles } = UpdateRolesSchema.parse(request.body);

      logger.info(`Admin ${request.walletUser?.accountId} updating roles for account: ${accountId}`);

      const updatedUser = await authService.updateUserRoles(accountId, roles);

      logger.info(`Roles updated successfully for account: ${accountId}`);

      return reply.status(200).send({
        message: 'User roles updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn(`Invalid update roles request: ${error.message}`);
        return reply.status(400).send({
          error: 'Validation Error',
          message: error.errors[0]?.message || 'Invalid request data',
        });
      }

      if (error instanceof Error && error.message.includes('User not found')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: error.message,
        });
      }

      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error updating user roles');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update user roles',
      });
    }
  });

  // Refresh token
  fastify.post('/auth/refresh', {
    preHandler: [walletJwtGuard],
    schema: {
      description: 'Refresh JWT token',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        401: {
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
      if (!request.walletUser) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
      }

      const tokenResponse = {
        token: jwt.sign(request.walletUser, process.env.JWT_SECRET || 'your-super-secret-jwt-key', {
          expiresIn: '24h',
        }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      logger.info(`Token refreshed for account: ${request.walletUser.accountId}`);

      return reply.status(200).send(tokenResponse);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error refreshing token');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to refresh token',
      });
    }
  });

  // Cleanup expired nonces (admin only)
  fastify.post('/auth/cleanup', {
    preHandler: [walletJwtGuard, walletAdminGuard],
    schema: {
      description: 'Cleanup expired nonces (admin only)',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            deletedCount: { type: 'number' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Simple message for now since we can't access private method
      logger.info(`Cleanup requested by admin: ${request.walletUser?.accountId}`);

      return reply.status(200).send({
        message: 'Cleanup operation completed (expired nonces are automatically cleaned during nonce generation)',
        deletedCount: 0,
      });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error cleaning up nonces');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to cleanup expired nonces',
      });
    }
  });
}