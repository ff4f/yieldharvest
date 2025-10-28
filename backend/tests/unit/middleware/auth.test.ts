import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireRole, UserRole, generateAccessToken, getUserPermissions } from '../../../src/middleware/auth';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';

describe('Auth Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      ip: '127.0.0.1',
      url: '/test'
    } as any;
    
    mockReply = {
      code: jest.fn().mockReturnThis() as any,
      status: jest.fn().mockReturnThis() as any,
      send: jest.fn().mockReturnThis() as any
    };
    
    mockNext = jest.fn();
  });

  describe('authenticate', () => {
    it('should reject request without authorization header', async () => {
      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        message: 'Please provide a valid Bearer token'
      });
    });

    it('should reject request with invalid authorization format', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };
      
      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        message: 'Please provide a valid Bearer token'
      });
    });

    it('should reject request with invalid JWT token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      
      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'AUTH_INVALID',
        message: 'The provided token is invalid or expired'
      });
    });

    it('should accept valid JWT token and set user', async () => {
      const user = {
        id: 'user-123',
        accountId: '0.0.123456',
        role: UserRole.SUPPLIER,
        email: 'test@example.com'
      };
      
      const token = generateAccessToken(user);
      
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockRequest.user).toEqual({
        id: user.id,
        accountId: user.accountId,
        role: user.role,
        email: user.email,
        permissions: expect.any(Array)
      });
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should reject expired JWT token', async () => {
      // Create an expired token by manually signing with past expiration
      const payload = {
        userId: 'user-123',
        accountId: '0.0.123456',
        role: UserRole.SUPPLIER,
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
      };

      const token = jwt.sign(payload, 'test-secret-key', {
        issuer: 'yieldharvest',
        audience: 'yieldharvest-users',
      });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'AUTH_INVALID',
        message: 'The provided token is invalid or expired',
      });
    });

    it('should reject token with wrong issuer', async () => {
      const payload = {
        userId: 'user-123',
        accountId: '0.0.123456',
        role: UserRole.SUPPLIER,
        email: 'test@example.com',
      };

      const token = jwt.sign(payload, 'your-super-secret-jwt-key', {
        issuer: 'wrong-issuer',
        audience: 'yieldharvest-users',
        expiresIn: '1h',
      });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'AUTH_INVALID',
        message: 'The provided token is invalid or expired',
      });
    });

    it('should reject token with wrong audience', async () => {
      const payload = {
        userId: 'user-123',
        accountId: '0.0.123456',
        role: UserRole.SUPPLIER,
        email: 'test@example.com',
      };

      const token = jwt.sign(payload, 'your-super-secret-jwt-key', {
        issuer: 'yieldharvest',
        audience: 'wrong-audience',
        expiresIn: '1h',
      });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      await authenticate(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'AUTH_INVALID',
        message: 'The provided token is invalid or expired',
      });
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 'user-123',
        accountId: '0.0.123456',
        role: UserRole.SUPPLIER,
        email: 'test@example.com',
        permissions: getUserPermissions(UserRole.SUPPLIER)
      };
    });

    it('should allow access for correct role', async () => {
      const middleware = requireRole([UserRole.SUPPLIER]);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should deny access for incorrect role', async () => {
      const middleware = requireRole([UserRole.INVESTOR]);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Insufficient role permissions',
        code: 'ROLE_FORBIDDEN',
        message: 'Required roles: INVESTOR'
      });
    });

    it('should allow access for multiple roles', async () => {
      const middleware = requireRole([UserRole.SUPPLIER, UserRole.ADMIN]);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.status).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should deny access when user role not in allowed roles', async () => {
      const middleware = requireRole([UserRole.INVESTOR, UserRole.ADMIN]);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Insufficient role permissions',
        code: 'ROLE_FORBIDDEN',
        message: 'Required roles: INVESTOR, ADMIN'
      });
    });

    it('should handle missing user object', async () => {
      mockRequest.user = undefined;
      const middleware = requireRole([UserRole.SUPPLIER]);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    });
  });
});