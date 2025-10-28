import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { 
  generateAccessToken, 
  generateRefreshToken,
  UserRole
} from '../middleware/auth';
import { auditLogger } from '../utils/logger';
import { validate } from '../middleware/validation';
import { verifySignature } from '../utils/signatureVerification';

// Validation schemas for wallet authentication
const walletLoginSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  signature: z.string().min(1, 'Signature is required'),
  nonce: z.string().min(1, 'Nonce is required'),
});

const walletValidateSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export async function walletAuthRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  
  // Wallet-based login with signature verification
  fastify.post('/login', {
    schema: {
      tags: ['wallet-auth'],
      summary: 'Login with wallet signature',
      body: {
        type: 'object',
        required: ['accountId', 'signature', 'nonce'],
        properties: {
          accountId: { type: 'string', description: 'Hedera account ID' },
          signature: { type: 'string', description: 'Signed message from wallet' },
          nonce: { type: 'string', description: 'Timestamp nonce for replay protection' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    accountId: { type: 'string' },
                    role: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string' },
                    isVerified: { type: 'boolean' }
                  }
                },
                token: { type: 'string' },
                refreshToken: { type: 'string' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: [validate(walletLoginSchema)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { accountId, signature, nonce } = request.body as z.infer<typeof walletLoginSchema>;

      // Verify nonce is recent (within 5 minutes)
      const nonceTime = parseInt(nonce);
      const currentTime = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (currentTime - nonceTime > fiveMinutes) {
        auditLogger.logSecurity({ 
          eventType: 'wallet_login_attempt', 
          severity: 'medium',
          userId: '', 
          details: { accountId, reason: 'expired_nonce' } 
        });
        return reply.code(401).send({
          error: 'EXPIRED_NONCE',
          message: 'Login nonce has expired'
        });
      }

      // Reconstruct the original message
      const message = `YieldHarvest Login\nNonce: ${nonce}\nAccount: ${accountId}`;

      // Verify signature (this would need actual implementation)
      const isValidSignature = await verifySignature(accountId, message, signature);
      
      if (!isValidSignature) {
        auditLogger.logSecurity({ 
          eventType: 'wallet_login_attempt', 
          severity: 'high',
          userId: '', 
          details: { accountId, reason: 'invalid_signature' } 
        });
        return reply.code(401).send({
          error: 'INVALID_SIGNATURE',
          message: 'Signature verification failed'
        });
      }

      // Find or create user by Hedera account ID
      let user = await fastify.prisma.user.findFirst({
        where: { accountId: accountId },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          accountId: true,
          isActive: true
        }
      });

      // If user doesn't exist, create a new one with default role
      if (!user) {
        user = await fastify.prisma.user.create({
          data: {
            accountId: accountId,
            email: `${accountId}@hedera.wallet`, // Temporary email
            name: `User ${accountId}`,
            roles: JSON.stringify([UserRole.SUPPLIER]), // Default role as JSON array
            isActive: true
          },
          select: {
            id: true,
            email: true,
            name: true,
            roles: true,
            accountId: true,
            isActive: true
          }
        });

        auditLogger.logSecurity({ 
          eventType: 'user_created', 
          severity: 'low',
          userId: user.id, 
          details: { accountId, method: 'wallet_login' } 
        });
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user.id,
        accountId: user.accountId,
        role: JSON.parse(user.roles)[0] as UserRole, // Parse roles JSON and take first role
        email: user.email
      });

      const refreshToken = generateRefreshToken(user.id);

      auditLogger.logSecurity({ 
        eventType: 'wallet_login', 
        severity: 'low',
        userId: user.id, 
        details: { accountId } 
      });

      return reply.code(200).send({
        success: true,
        message: 'Wallet login successful',
        data: {
          user: {
            id: user.id,
            accountId: user.accountId,
            role: JSON.parse(user.roles)[0], // Parse roles JSON and take first role
            name: user.name,
            email: user.email,
            isActive: user.isActive
          },
          token: accessToken,
          refreshToken
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Wallet login error');
      auditLogger.logSecurity({ 
        eventType: 'wallet_login_error', 
        severity: 'high',
        userId: '', 
        details: { error: (error as Error).message } 
      });
      return reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process wallet login'
      });
    }
  });

  // Validate token endpoint
  fastify.get('/validate', {
    schema: {
      tags: ['wallet-auth'],
      summary: 'Validate authentication token',
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string', description: 'Bearer token' }
        },
        required: ['authorization']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                accountId: { type: 'string' },
                role: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                isVerified: { type: 'boolean' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          error: 'MISSING_TOKEN',
          message: 'Authorization token required'
        });
      }

      const token = authHeader.substring(7);
      
      // Verify token using existing middleware logic
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      
      // Get user details
      const user = await fastify.prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          accountId: true,
          isActive: true
        }
      });

      if (!user) {
        return reply.code(401).send({
          error: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }

      return reply.code(200).send({
        success: true,
        user: {
          id: user.id,
          accountId: user.accountId,
          role: JSON.parse(user.roles)[0], // Parse roles JSON and take first role
          name: user.name,
          email: user.email,
          isActive: user.isActive
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Token validation error');
      return reply.code(401).send({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      });
    }
  });
}