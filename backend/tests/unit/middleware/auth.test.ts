import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, requireRole } from '../../../src/middleware/auth';
import { UserRole } from '@prisma/client';

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';

describe('Auth Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined
    };
    
    mockReply = {
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('verifyToken', () => {
    it('should reject request without authorization header', async () => {
      await verifyToken(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        code: 'AUTH_MISSING_TOKEN'
      });
    });

    it('should reject request with invalid authorization format', async () => {
      mockRequest.headers = { authorization: 'InvalidFormat' };
      
      await verifyToken(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Unauthorized',
        code: 'AUTH_MISSING_TOKEN'
      });
    });

    it('should reject request with invalid JWT token', async () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };
      
      await verifyToken(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'AUTH_INVALID'
      });
    });

    it('should accept valid JWT token and set user', async () => {
      const payload = {
        userId: 'user-123',
        accountId: '0.0.123456',
        role: 'SUPPLIER',
        email: 'test@example.com'
      };
      
      const token = jwt.sign(payload, 'test-secret-key', {
        issuer: 'yieldharvest',
        audience: 'yieldharvest-users',
        expiresIn: '1h'
      });
      
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      await verifyToken(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockRequest.user).toEqual(payload);
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should reject expired JWT token', async () => {
      const payload = {
        userId: 'user-123',
        accountId: '0.0.123456',
        role: 'SUPPLIER',
        email: 'test@example.com'
      };
      
      const token = jwt.sign(payload, 'test-secret-key', {
        issuer: 'yieldharvest',
        audience: 'yieldharvest-users',
        expiresIn: '-1h' // Expired
      });
      
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      await verifyToken(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'AUTH_INVALID'
      });
    });

    it('should reject token with wrong issuer', async () => {
      const payload = {
        userId: 'user-123',
        accountId: '0.0.123456',
        role: 'SUPPLIER',
        email: 'test@example.com'
      };
      
      const token = jwt.sign(payload, 'test-secret-key', {
        issuer: 'wrong-issuer',
        audience: 'yieldharvest-users',
        expiresIn: '1h'
      });
      
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      await verifyToken(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'AUTH_INVALID'
      });
    });

    it('should reject token with wrong audience', async () => {
      const payload = {
        userId: 'user-123',
        accountId: '0.0.123456',
        role: 'SUPPLIER',
        email: 'test@example.com'
      };
      
      const token = jwt.sign(payload, 'test-secret-key', {
        issuer: 'yieldharvest',
        audience: 'wrong-audience',
        expiresIn: '1h'
      });
      
      mockRequest.headers = { authorization: `Bearer ${token}` };
      
      await verifyToken(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invalid token',
        code: 'AUTH_INVALID'
      });
    });
  });

  describe('requireRole', () => {
    beforeEach(() => {
      mockRequest.user = {
        userId: 'user-123',
        accountId: '0.0.123456',
        role: 'SUPPLIER',
        email: 'test@example.com'
      };
    });

    it('should allow access for correct role', async () => {
      const middleware = requireRole(UserRole.SUPPLIER);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should deny access for incorrect role', async () => {
      const middleware = requireRole(UserRole.INVESTOR);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        code: 'AUTH_INSUFFICIENT_ROLE'
      });
    });

    it('should allow access for multiple roles', async () => {
      const middleware = requireRole([UserRole.SUPPLIER, UserRole.AGENT]);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    it('should deny access when user role not in allowed roles', async () => {
      const middleware = requireRole([UserRole.INVESTOR, UserRole.AGENT]);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        code: 'AUTH_INSUFFICIENT_ROLE'
      });
    });

    it('should handle missing user object', async () => {
      mockRequest.user = undefined;
      const middleware = requireRole(UserRole.SUPPLIER);
      
      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);
      
      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Forbidden',
        code: 'AUTH_INSUFFICIENT_ROLE'
      });
    });
  });
});