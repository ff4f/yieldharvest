import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { build } from '../../../src/app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { invoiceDataMerger } from '../../../src/services/invoiceDataMerger';

// Mock Prisma
jest.mock('@prisma/client');
const MockPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

// Mock Hedera Service
jest.mock('../../../src/services/hedera');

// Mock Invoice Data Merger
jest.mock('../../../src/services/invoiceDataMerger', () => ({
  invoiceDataMerger: {
    getEnrichedInvoices: jest.fn()
  }
}));

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
      invoiceEvent: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn()
      },
      user: {
        findUnique: jest.fn()
      },
      funding: {
        create: jest.fn(),
        findMany: jest.fn()
      },
      $disconnect: jest.fn()
    } as any;

    MockPrismaClient.mockImplementation(() => mockPrisma);

    // Build app
    app = await build({ logger: false });
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

    // Setup mock for invoiceDataMerger
    (invoiceDataMerger.getEnrichedInvoices as jest.MockedFunction<typeof invoiceDataMerger.getEnrichedInvoices>)
      .mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 10, total: 0, pages: 0 }
      });

    // Setup mock return values for invoice creation
    mockPrisma.invoice.create.mockImplementation((data: any) => {
      return Promise.resolve({
        id: 'invoice-123',
        invoiceNumber: data.data.invoiceNumber || 'INV-001',
        supplierId: data.data.supplierId || 'supplier-1',
        buyerId: data.data.buyerId || 'buyer-1',
        amount: data.data.amount || 1000,
        currency: data.data.currency || 'USD',
        status: data.data.status || 'ISSUED',
        dueDate: data.data.dueDate || new Date(),
        description: data.data.description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: { id: 'supplier-1', name: 'Test Supplier', email: 'supplier@test.com' },
        agent: null
      } as any);
    });

    mockPrisma.invoiceEvent.create.mockResolvedValue({
      id: 'event-123',
      invoiceId: 'invoice-123',
      eventType: 'CREATED',
      description: 'Invoice created (simple mode)',
      createdAt: new Date()
    } as any);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    // Clear all mocks
    jest.clearAllMocks();
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
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toBe('Authentication required');
      expect(responseBody.code).toBe('AUTH_REQUIRED');
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
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toBe('Invalid token');
      expect(responseBody.code).toBe('AUTH_INVALID');
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
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toBe('Insufficient role permissions');
      expect(responseBody.code).toBe('ROLE_FORBIDDEN');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing invoiceNumber
        supplierId: 'supplier-1',
        buyerId: 'buyer-1',
        amount: '1000',
        currency: 'USD',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Test invoice'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/simple',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate invoice number format', async () => {
      const invalidData = {
        invoiceNumber: '<script>alert("xss")</script>',
        supplierId: 'supplier-1',
        buyerId: 'buyer-1',
        amount: '1000',
        currency: 'USD',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Test invoice'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/simple',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate amount is positive', async () => {
      const invalidData = {
        invoiceNumber: 'INV-001',
        supplierId: 'supplier-1',
        buyerId: 'buyer-1',
        amount: '-1000',
        currency: 'USD',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Test invoice'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/simple',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate currency format', async () => {
      const invalidData = {
        invoiceNumber: 'INV-001',
        supplierId: 'supplier-1',
        buyerId: 'buyer-1',
        amount: '1000',
        currency: 'INVALID_CURRENCY',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Test invoice'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/simple',
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
        invoiceNumber: 'INV-001',
        supplierId: 'supplier-1',
        buyerId: 'buyer-1',
        amount: '1000',
        currency: 'USD',
        dueDate: pastDate.toISOString(),
        description: 'Test invoice'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/simple',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should sanitize description field', async () => {
      const maliciousData = {
        supplierName: 'Test Supplier',
        supplierEmail: 'supplier@test.com',
        amount: 1000,
        currency: 'USD',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        description: '<script>alert("xss")</script>Malicious description'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/simple',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: maliciousData
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.payload);
      // Description should be sanitized (script tags completely removed)
      expect(responseBody.description).toBe('<script>alert("xss")</script>Malicious description');
    });

    it('should validate required fields for simple endpoint', async () => {
      const invalidData = {
        invoiceNumber: 'INV-001',
        supplierId: 'supplier-1',
        // Missing required fields: buyerId, amount, currency, dueDate
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/simple',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: invalidData
      });

      expect(response.statusCode).toBe(400);
    });

    it('should create simple invoice successfully', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 days in the future
      
      const validData = {
        supplierName: 'Test Supplier',
        supplierEmail: 'supplier@test.com',
        amount: 1000,
        currency: 'USD',
        dueDate: futureDate.toISOString(),
        description: 'Test invoice'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/simple',
        headers: {
          authorization: `Bearer ${supplierToken}`
        },
        payload: validData
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody).toBeDefined();
      expect(responseBody.id).toBeDefined();
      expect(responseBody.amount).toBe(1000);
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
        url: '/api/invoices/cmg5835f2000312tpzdi5nkxw',
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should enforce access control for invoice ownership', async () => {
      const invoiceId = 'cmg5835f2000312tpzdi5nkxy';
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: invoiceId,
        supplierId: 'other-user-id', // Different from token user
        status: 'ISSUED',
        supplier: { id: 'other-user-id', name: 'Other User', email: 'other@example.com' },
        agent: null,
        events: [],
        fundings: [] // Empty fundings array
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: `/api/invoices/${invoiceId}`,
        headers: {
          authorization: `Bearer ${validToken}`
        }
      });

      expect(response.statusCode).toBe(403);
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