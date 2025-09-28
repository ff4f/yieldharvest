import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { FastifyRequest, FastifyReply } from 'fastify';
import { auditLogger } from '../utils/logger';

// User roles enum
export enum UserRole {
  SUPPLIER = 'SUPPLIER',
  INVESTOR = 'INVESTOR',
  ADMIN = 'ADMIN',
}

// JWT payload interface
export interface JWTPayload {
  userId: string;
  accountId: string;
  role: UserRole;
  email: string;
  iat: number;
  exp: number;
}

// User interface for authentication
export interface AuthUser {
  id: string;
  accountId: string;
  role: UserRole;
  email: string;
  permissions: string[];
}

// Extend Fastify request to include user
declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
    correlationId?: string;
  }
}

// JWT configuration
const JWT_SECRET = process.env['JWT_SECRET'] || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env['REFRESH_TOKEN_EXPIRES_IN'] || '7d';

// Password hashing
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

// JWT token generation
export const generateAccessToken = (user: Omit<AuthUser, 'permissions'>): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    accountId: user.accountId,
    role: user.role,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'yieldharvest',
    audience: 'yieldharvest-users',
  } as jwt.SignOptions);
};

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'yieldharvest',
      audience: 'yieldharvest-users',
    } as jwt.SignOptions
  );
};

// JWT token verification
export const verifyAccessToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'yieldharvest',
      audience: 'yieldharvest-users',
    }) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const verifyRefreshToken = (token: string): { userId: string; type: string } => {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'yieldharvest',
      audience: 'yieldharvest-users',
    }) as any;
    
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    return payload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

// Role-based permissions
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.SUPPLIER]: [
    'invoice:create',
    'invoice:read:own',
    'invoice:update:own',
    'funding:read:own',
    'profile:read:own',
    'profile:update:own',
  ],
  [UserRole.INVESTOR]: [
    'invoice:read:all',
    'funding:create',
    'funding:read:own',
    'funding:update:own',
    'profile:read:own',
    'profile:update:own',
  ],
  [UserRole.ADMIN]: [
    'invoice:*',
    'funding:*',
    'user:*',
    'profile:*',
    'system:*',
    'audit:read',
  ],
};

// Get user permissions based on role
export const getUserPermissions = (role: UserRole): string[] => {
  return ROLE_PERMISSIONS[role] || [];
};

// Check if user has specific permission
export const hasPermission = (userPermissions: string[], requiredPermission: string): boolean => {
  // Check for wildcard permissions
  const [resource, action] = requiredPermission.split(':');
  const wildcardPermission = `${resource}:*`;
  
  return userPermissions.includes(requiredPermission) || 
         userPermissions.includes(wildcardPermission) ||
         userPermissions.includes('*');
};

// Authentication middleware
export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      auditLogger.logAuth({
        action: 'authenticate',
        success: false,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || undefined,
        errorMessage: 'Missing or invalid authorization header',
      });
      
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        message: 'Please provide a valid Bearer token',
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    
    // Create user object with permissions
    const user: AuthUser = {
      id: payload.userId,
      accountId: payload.accountId,
      role: payload.role,
      email: payload.email,
      permissions: getUserPermissions(payload.role),
    };
    
    request.user = user;
    
    auditLogger.logAuth({
      userId: user.id,
      accountId: user.accountId,
      action: 'authenticate',
      success: true,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || undefined,
    });
    
  } catch (error) {
    auditLogger.logAuth({
      action: 'authenticate',
      success: false,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || undefined,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return reply.status(401).send({
      error: 'Invalid token',
      code: 'AUTH_INVALID',
      message: 'The provided token is invalid or expired',
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuthenticate = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      
      const user: AuthUser = {
        id: payload.userId,
        accountId: payload.accountId,
        role: payload.role,
        email: payload.email,
        permissions: getUserPermissions(payload.role),
      };
      
      request.user = user;
    }
  } catch (error) {
    // Silently continue without authentication for optional routes
  }
};

// Authorization middleware factory
export const authorize = (requiredPermission: string) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!hasPermission(request.user.permissions, requiredPermission)) {
      auditLogger.logSecurity({
        eventType: 'unauthorized_access',
        severity: 'medium',
        details: {
          userId: request.user.id,
          requiredPermission,
          userPermissions: request.user.permissions,
          endpoint: request.url,
        },
        ip: request.ip,
        userId: request.user.id,
      });
      
      return reply.status(403).send({
        error: 'Insufficient permissions',
        code: 'AUTH_FORBIDDEN',
        message: `Required permission: ${requiredPermission}`,
      });
    }
  };
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: UserRole[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      auditLogger.logSecurity({
        eventType: 'role_access_denied',
        severity: 'medium',
        details: {
          userId: request.user.id,
          userRole: request.user.role,
          allowedRoles,
          endpoint: request.url,
        },
        ip: request.ip,
        userId: request.user.id,
      });
      
      return reply.status(403).send({
        error: 'Insufficient role permissions',
        code: 'ROLE_FORBIDDEN',
        message: `Required roles: ${allowedRoles.join(', ')}`,
      });
    }
  };
};

// Resource ownership validation
export const requireOwnership = (resourceIdParam: string = 'id') => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Admin can access any resource
    if (request.user.role === UserRole.ADMIN) {
      return;
    }

    const resourceId = (request.params as any)[resourceIdParam];
    const userId = request.user.id;
    
    // This would typically check database ownership
    // For now, we'll implement a basic check
    // TODO: Implement proper ownership validation with database
    
    if (!resourceId) {
      return reply.status(400).send({
        error: 'Resource ID required',
        code: 'RESOURCE_ID_REQUIRED',
      });
    }
  };
};

export default {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireRole,
  requireOwnership,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashPassword,
  comparePassword,
  getUserPermissions,
  hasPermission,
  UserRole,
};