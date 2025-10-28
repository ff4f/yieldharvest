import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';

// Define our new AuthUser interface for wallet-based auth
export interface WalletAuthUser {
  accountId: string;
  roles: string[];
  publicKey?: string;
}

// Extend FastifyRequest to include wallet user
declare module 'fastify' {
  interface FastifyRequest {
    walletUser?: WalletAuthUser;
  }
}

/**
 * JWT Authentication Guard for Wallet-based Auth
 * Verifies JWT token and attaches wallet user to request
 */
export const walletJwtGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const user = authService.verifyToken(token);
      request.walletUser = user;
      
      logger.debug(`Authenticated wallet user: ${user.accountId} with roles: ${user.roles.join(', ')}`);
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Invalid JWT token');
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error in wallet JWT guard');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Authentication error',
    });
  }
};

/**
 * Role-based Authorization Guard for Wallet Auth
 * Checks if authenticated wallet user has required roles
 */
export const walletRoleGuard = (...requiredRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.walletUser) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Wallet user not authenticated',
        });
      }

      const userRoles = request.walletUser.roles;
      const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        logger.warn(`Access denied for wallet user ${request.walletUser.accountId}. Required roles: ${requiredRoles.join(', ')}, User roles: ${userRoles.join(', ')}`);
        
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Access denied. Required roles: ${requiredRoles.join(' or ')}`,
          userRoles,
          requiredRoles,
        });
      }

      logger.debug(`Access granted for wallet user ${request.walletUser.accountId} with roles: ${userRoles.join(', ')}`);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error in wallet role guard');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Authorization error',
      });
    }
  };
};

/**
 * Optional Wallet JWT Guard
 * Attaches wallet user to request if token is present, but doesn't require authentication
 */
export const optionalWalletJwtGuard = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const user = authService.verifyToken(token);
        request.walletUser = user;
        logger.debug(`Optional wallet auth: authenticated user ${user.accountId}`);
      } catch (error) {
        // Silently ignore invalid tokens for optional auth
        logger.debug('Optional wallet auth: invalid token ignored');
      }
    }
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error in optional wallet JWT guard');
    // Don't fail the request for optional auth errors
  }
};

/**
 * Wallet Admin Guard
 * Shorthand for requiring ADMIN role
 */
export const walletAdminGuard = walletRoleGuard('ADMIN');

/**
 * Wallet Supplier Guard
 * Shorthand for requiring SUPPLIER role
 */
export const walletSupplierGuard = walletRoleGuard('SUPPLIER');

/**
 * Wallet Investor Guard
 * Shorthand for requiring INVESTOR role
 */
export const walletInvestorGuard = walletRoleGuard('INVESTOR');

/**
 * Wallet Agent Guard
 * Shorthand for requiring AGENT role
 */
export const walletAgentGuard = walletRoleGuard('AGENT');

/**
 * Multi-role Guards for Wallet Auth
 */
export const walletSupplierOrAgentGuard = walletRoleGuard('SUPPLIER', 'AGENT');
export const walletInvestorOrAdminGuard = walletRoleGuard('INVESTOR', 'ADMIN');
export const walletAnyRoleGuard = walletRoleGuard('SUPPLIER', 'INVESTOR', 'AGENT', 'ADMIN');

/**
 * Resource Owner Guard for Wallet Auth
 * Checks if wallet user owns the resource or has admin privileges
 */
export const walletResourceOwnerGuard = (getResourceOwnerId: (request: FastifyRequest) => string) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.walletUser) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Wallet user not authenticated',
        });
      }

      const resourceOwnerId = getResourceOwnerId(request);
      const isOwner = request.walletUser.accountId === resourceOwnerId;
      const isAdmin = request.walletUser.roles.includes('ADMIN');

      if (!isOwner && !isAdmin) {
        logger.warn(`Access denied for wallet user ${request.walletUser.accountId}. Resource owner: ${resourceOwnerId}`);
        
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Access denied. You can only access your own resources.',
        });
      }

      logger.debug(`Resource access granted for wallet user ${request.walletUser.accountId}`);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error in wallet resource owner guard');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Authorization error',
      });
    }
  };
};