import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { 
  generateAccessToken, 
  generateRefreshToken,
  verifyRefreshToken,
  UserRole,
  authenticate
} from '../middleware/auth';
import { auditLogger } from '../utils/logger';
import { validate } from '../middleware/validation';

// Validation schemas (simplified without password since it's not in schema)
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum([UserRole.SUPPLIER, UserRole.INVESTOR]).default(UserRole.SUPPLIER),
  accountId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  accountId: z.string().optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export async function authRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  
  // Register new user (simplified - no password since not in schema)
  fastify.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'Register a new user',
      body: {
        type: 'object',
        required: ['email', 'name'],
        properties: {
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 2 },
          role: { type: 'string', enum: ['SUPPLIER', 'INVESTOR'] },
          accountId: { type: 'string' }
        }
      },
      response: {
        201: {
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
                    email: { type: 'string' },
                    name: { type: 'string' },
                    roles: { type: 'string' },
                    accountId: { type: 'string' }
                  }
                },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        409: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: [validate(registerSchema)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email, name, role, accountId } = request.body as z.infer<typeof registerSchema>;

      // Check if user already exists
      const existingUser = await fastify.prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        auditLogger.logSecurity({ 
          eventType: 'register_attempt', 
          severity: 'medium',
          userId: '', 
          details: { email, reason: 'user_exists' } 
        });
        return reply.code(409).send({
          error: 'CONFLICT',
          message: 'User with this email already exists'
        });
      }

      // Create user
      const user = await fastify.prisma.user.create({
        data: {
          email,
          name,
          roles: JSON.stringify([role]), // Store role as JSON array
          accountId: accountId || `temp-${Date.now()}`, // Generate temp ID if not provided
        },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          accountId: true,
          createdAt: true
        }
      });

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user.id,
        accountId: user.accountId,
        role: JSON.parse(user.roles)[0] as UserRole, // Parse roles JSON and take first role
        email: user.email
      });

      const refreshToken = generateRefreshToken(user.id);

      auditLogger.logSecurity({ 
        eventType: 'register', 
        severity: 'low',
        userId: user.id, 
        details: { email, role } 
      });

      return reply.code(201).send({
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Registration error');
      auditLogger.logSecurity({ 
        eventType: 'register_error', 
        severity: 'high',
        userId: '', 
        details: { error: (error as Error).message } 
      });
      return reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to register user'
      });
    }
  });

  // Login user (simplified - by email or hederaAccountId)
  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'Login user',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          accountId: { type: 'string' }
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
                    email: { type: 'string' },
                    name: { type: 'string' },
                    role: { type: 'string' },
                    accountId: { type: 'string' }
                  }
                },
                accessToken: { type: 'string' },
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
    preHandler: [validate(loginSchema)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { email, accountId } = request.body as z.infer<typeof loginSchema>;

      // Find user by email or accountId
      const user = await fastify.prisma.user.findFirst({
        where: {
          OR: [
            { email },
            ...(accountId ? [{ accountId: accountId }] : [])
          ]
        },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          accountId: true
        }
      });

      if (!user) {
        auditLogger.logSecurity({ 
          eventType: 'login_attempt', 
          severity: 'medium',
          userId: '', 
          details: { email, reason: 'user_not_found' } 
        });
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'User not found'
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
        eventType: 'login', 
        severity: 'low',
        userId: user.id, 
        details: { email } 
      });

      return reply.code(200).send({
        success: true,
        message: 'Login successful',
        data: {
          user,
          accessToken,
          refreshToken
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Login error');
      auditLogger.logSecurity({ 
        eventType: 'login_error', 
        severity: 'high',
        userId: '', 
        details: { error: (error as Error).message } 
      });
      return reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to login'
      });
    }
  });

  // Refresh token
  fastify.post('/refresh', {
    schema: {
      tags: ['auth'],
      summary: 'Refresh access token',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string' },
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
    preHandler: [validate(refreshTokenSchema)]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { refreshToken } = request.body as z.infer<typeof refreshTokenSchema>;

      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);
      
      // Find user
      const user = await fastify.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          roles: true,
          accountId: true
        }
      });

      if (!user) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Invalid refresh token'
        });
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        id: user.id,
        accountId: user.accountId,
        role: JSON.parse(user.roles)[0] as UserRole, // Parse roles JSON and take first role
        email: user.email
      });

      const newRefreshToken = generateRefreshToken(user.id);

      return reply.code(200).send({
        success: true,
        data: {
          accessToken: accessToken,
          refreshToken: newRefreshToken
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Token refresh error');
      return reply.code(401).send({
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired refresh token'
      });
    }
  });

  // Logout (invalidate token - for now just return success)
  fastify.post('/logout', {
    schema: {
      tags: ['auth'],
      summary: 'Logout user',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    },
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      
      auditLogger.logSecurity({ 
        eventType: 'logout', 
        severity: 'low',
        userId: user?.id || '', 
        details: { email: user?.email } 
      });

      return reply.code(200).send({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      fastify.log.error({ error }, 'Logout error');
      return reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to logout'
      });
    }
  });

  // Get current user profile
  fastify.get('/me', {
    schema: {
      tags: ['auth'],
      summary: 'Get current user profile',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    name: { type: 'string' },
                    roles: { type: 'string' },
                    accountId: { type: 'string' },
                    createdAt: { type: 'string' }
                  }
                }
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
    preHandler: [authenticate]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user;
      
      if (!user) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'User not authenticated'
        });
      }

      // Get full user details from database
      const fullUser = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          roles: true,
          accountId: true,
          createdAt: true
        }
      });

      if (!fullUser) {
        return reply.code(404).send({
          error: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          user: fullUser
        }
      });

    } catch (error) {
      fastify.log.error({ error }, 'Get profile error');
      return reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get user profile'
      });
    }
  });
}