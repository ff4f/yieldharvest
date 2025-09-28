import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireRole, UserRole } from '../middleware/auth';
import { validate, userSchemas, paramSchemas } from '../middleware/validation';
import { z } from 'zod';
import { NotFoundError } from '../middleware/errorHandler';
import { auditLogger } from '../utils/logger';

export async function userRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Get all users (admin only)
  fastify.get('/', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN])],
    schema: {
      tags: ['users'],
      summary: 'Get all users',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          role: { type: 'string', enum: Object.values(UserRole) },
          search: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  hederaAccountId: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = 1, limit = 10, role, search } = request.query as any;
    
    const where: any = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const [users, total] = await Promise.all([
      fastify.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          hederaAccountId: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      fastify.prisma.user.count({ where }),
    ]);
    
    auditLogger.logAudit({
        correlationId: request.correlationId || '',
        userId: request.user?.id || '',
        endpoint: '/users',
        method: 'GET',
        action: 'list',
        resource: 'user',
        success: true
      });
    
    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // Get user by ID
  fastify.get('/:id', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER, UserRole.INVESTOR])],
    schema: {
      tags: ['users'],
      summary: 'Get user by ID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    // Users can only access their own data unless they're admin
    if (request.user!.role !== 'admin' && request.user!.id !== id) {
      throw new NotFoundError('User');
    }
    
    const user = await fastify.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hederaAccountId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    auditLogger.logAudit({
        correlationId: request.correlationId || '',
        userId: request.user?.id || '',
        endpoint: '/users/:id',
        method: 'GET',
        action: 'read',
        resource: 'user',
        resourceId: id,
        success: true
      });
    
    return { data: user };
  });

  // Create user (admin only)
  fastify.post('/', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN]), validate(userSchemas.register)],
    schema: {
      tags: ['users'],
      summary: 'Create new user',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userData = request.body as any;
    
    const user = await fastify.prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hederaAccountId: true,
        createdAt: true,
      },
    });
    
    auditLogger.logAudit({
        correlationId: request.correlationId || '',
        userId: request.user?.id || '',
        endpoint: '/users',
        method: 'POST',
        action: 'create',
        resource: 'user',
        resourceId: user.id,
        newState: { email: user.email, role: user.role },
        success: true
      });
    
    return reply.code(201).send({ data: user });
  });

  // Update user
  fastify.put('/:id', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN]), validate(userSchemas.updateProfile)],
    schema: {
      tags: ['users'],
      summary: 'Update user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updateData = request.body as any;
    
    const existingUser = await fastify.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    
    if (!existingUser) {
      throw new NotFoundError('User');
    }
    
    const user = await fastify.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hederaAccountId: true,
        updatedAt: true,
      },
    });
    
    auditLogger.logAudit({
        correlationId: request.correlationId || '',
        userId: request.user?.id || '',
        endpoint: '/users/:id',
        method: 'PUT',
        action: 'update',
        resource: 'user',
        resourceId: id,
        previousState: existingUser,
        newState: user,
        success: true
      });
    
    return { data: user };
  });

  // Delete user (admin only)
  fastify.delete('/:id', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN])],
    schema: {
      tags: ['users'],
      summary: 'Delete user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    const existingUser = await fastify.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    
    if (!existingUser) {
      throw new NotFoundError('User');
    }
    
    await fastify.prisma.user.delete({
      where: { id },
    });
    
    auditLogger.logAudit({
        correlationId: request.correlationId || '',
        userId: request.user?.id || '',
        endpoint: '/users/:id',
        method: 'DELETE',
        action: 'delete',
        resource: 'user',
        resourceId: id,
        previousState: existingUser,
        success: true
      });
    
    return reply.code(204).send();
  });
}