import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { build } from '../../../src/app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Mock Prisma
jest.mock('@prisma/client');
const MockPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

// Mock Hedera Service
jest.mock('../../../src/services/hedera');

describe('Invoice Routes Security Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let validToken: string;
  let supplierToken: string;
  let investorToken: string;

  beforeEach(async () => {
    // Setup mock Prisma
    mockPrisma = {
      invoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      user: {
        findUnique: jest.fn()
      },
      funding: {
        create: jest.fn(),
        findMany: jest.fn()
      }
    } as any;

    MockPrismaClient.mockImplementation(() => mockPrisma);

    // Build app
    app = build({ logger: false });
    await app.ready();

    // Create test tokens
    const secret = process.env.JWT_SECRET || 'test-secret';
    
    validToken = jwt.sign(
      {
        userId: 'user-123',
        accountId: '0.0.123456',
        role: 'SUPPLIER',
        email: 'supplier@test.com'
      },
      secret,
      {
        issuer: 'yieldharvest',
        audience: 'yieldharvest-users',
        expiresIn: '1h'
      }
    );

    supplierToken = validToken;

    investorToken = jwt.sign(
      {
        userId: 'investor-123',
        accountId: '0.0.789012',
        role: 'INVESTOR',
        email: 'investor@test.com'
      },
      secret,
      {
        issuer: 'yieldharvest',
        audience: 'yieldharvest-users',
        expiresIn: '1h'
      }
    );
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/invoices - Create Invoice', () => {
    const validInvoiceData = {
      invoiceNumber: 'INV-001',
      amount: 1000,
      currency: 'USD',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
      buyerId: 'buyer-123',
      description: 'Test invoice',
      items: [
        {
          description: 'Item 1',
          quantity: 1,
          unitPrice: 1000,
          total: 1000
        }
      ]
    };

    it('should reject requests without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: validInvoiceData
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Unauthorized',
        code: 'AUTH_MISSING_TOKEN'
      });
    });

    it('should reject requests with invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: 'Bearer invalid-token'
        },
        payload: validInvoiceData
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Invalid token',
        code: 'AUTH_INVALID'
      });
    });

    it('should reject requests from non-supplier users', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${investorToken}`
        },
        payload: validInvoiceData
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload)).toEqual({
        error: 'Forbidden',
        code: 'AUTH_INSUFFICIENT_ROLE'
      });
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validInvoiceData };
      delete (invalidData as any).invoiceNumber;

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toBe('Validation Error');
    });

    it('should validate invoice number format', async () => {
      const invalidData = {
        ...validInvoiceData,
        invoiceNumber: '<script>alert("xss")</script>'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate amount is positive', async () => {
      const invalidData = {
        ...validInvoiceData,
        amount: -1000
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate currency format', async () => {
      const invalidData = {
        ...validInvoiceData,
        currency: 'INVALID_CURRENCY'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate due date is in the future', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const invalidData = {
        ...validInvoiceData,
        dueDate: pastDate.toISOString()
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should sanitize description field', async () => {
      const maliciousData = {
        ...validInvoiceData,
        description: '<script>alert("xss")</script>Malicious description'
      };

      mockPrisma.invoice.create.mockResolvedValue({
        id: 'invoice-123',
        ...maliciousData,
        description: 'Malicious description', // Sanitized
        supplierId: 'user-123',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date()
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: maliciousData
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.invoice.description).not.toContain('<script>');
    });

    it('should validate items array structure', async () => {
      const invalidData = {
        ...validInvoiceData,
        items: [
          {
            description: 'Item 1',
            quantity: -1, // Invalid quantity
            unitPrice: 1000,
            total: 1000
          }
        ]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate total amount matches items', async () => {
      const invalidData = {
        ...validInvoiceData,
        amount: 2000, // Doesn't match items total
        items: [
          {
            description: 'Item 1',
            quantity: 1,
            unitPrice: 1000,
            total: 1000
          }
        ]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/invoices - List Invoices', () => {
    it('should reject requests without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices'
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices?page=-1&limit=1000', // Invalid pagination
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate status filter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices?status=INVALID_STATUS',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should prevent SQL injection in search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices?search=\'; DROP TABLE invoices; --',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      // Should not crash and should sanitize the search
      expect(response.statusCode).not.toBe(500);
    });
  });

  describe('GET /api/invoices/:id - Get Invoice', () => {
    it('should validate invoice ID format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices/invalid-id',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should prevent access to non-existent invoices', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices/non-existent-id',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should enforce access control for invoice ownership', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'invoice-123',
        supplierId: 'other-user-id', // Different from token user
        status: 'ISSUED'
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices/invoice-123',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/invoices/:id/fund - Fund Invoice', () => {
    it('should reject requests from non-investor users', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/invoice-123/fund',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: {
          amount: 1000
        }
      });

      expect(response.statusCode).toBe(403);
    });

    it('should validate funding amount', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/invoice-123/fund',
        headers: {
          authorization: `Bearer ${investorToken}`
        },
        payload: {
          amount: -1000 // Invalid amount
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate invoice exists and is fundable', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'invoice-123',
        status: 'PAID', // Already paid, not fundable
        amount: 1000
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/invoice-123/fund',
        headers: {
          authorization: `Bearer ${investorToken}`
        },
        payload: {
          amount: 1000
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should prevent overfunding', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'invoice-123',
        status: 'ISSUED',
        amount: 1000,
        fundings: [
          { amount: 800 } // Already 800 funded
        ]
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/invoice-123/fund',
        headers: {
          authorization: `Bearer ${investorToken}`
        },
        payload: {
          amount: 500 // Would exceed total amount
        }
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Rate Limiting and Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should handle CORS properly', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/invoices',
        headers: {
          origin: 'https://malicious-site.com'
        }
      });

      // Should not allow arbitrary origins
      expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });
  });
});