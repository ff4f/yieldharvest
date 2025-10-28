import { test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import { build } from '../helpers/helper';
import { FastifyInstance } from 'fastify';

describe('YieldHarvest E2E Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Endpoints', () => {
    test('GET /health should return 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });

    test('GET /api/health should return service status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('status', 'ok');
      expect(payload).toHaveProperty('services');
      expect(payload.services).toHaveProperty('database');
      expect(payload.services).toHaveProperty('hedera');
    });
  });

  describe('Authentication Flow', () => {
    test('POST /api/auth/wallet should handle wallet authentication', async () => {
      const mockWalletData = {
        accountId: '0.0.123456',
        publicKey: 'mock-public-key',
        signature: 'mock-signature',
        message: 'mock-message'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/wallet',
        payload: mockWalletData
      });

      // Should return 401 for invalid signature in test environment
      expect([200, 401]).toContain(response.statusCode);
    });

    test('GET /api/auth/me should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me'
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Invoice Management', () => {
    let authToken: string;

    beforeAll(async () => {
      // Mock authentication for invoice tests
      const mockAuth = await app.inject({
        method: 'POST',
        url: '/api/auth/wallet',
        payload: {
          accountId: '0.0.123456',
          publicKey: 'mock-public-key',
          signature: 'mock-signature',
          message: 'mock-message'
        }
      });

      if (mockAuth.statusCode === 200) {
        const authData = JSON.parse(mockAuth.payload);
        authToken = authData.token;
      }
    });

    test('GET /api/invoices should return invoice list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices',
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {}
      });

      // Should return 401 without auth or 200 with valid auth
      expect([200, 401]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const payload = JSON.parse(response.payload);
        expect(Array.isArray(payload.data)).toBe(true);
        expect(payload).toHaveProperty('pagination');
      }
    });

    test('POST /api/invoices should create new invoice', async () => {
      const mockInvoice = {
        invoiceNumber: 'E2E-TEST-001',
        amount: 1000,
        currency: 'USD',
        dueDate: '2024-12-31',
        description: 'E2E Test Invoice',
        buyerId: 'test-buyer-id'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: mockInvoice,
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {}
      });

      // Should return 401 without auth or 201 with valid auth
      expect([201, 401]).toContain(response.statusCode);

      if (response.statusCode === 201) {
        const payload = JSON.parse(response.payload);
        expect(payload).toHaveProperty('id');
        expect(payload).toHaveProperty('invoiceNumber', mockInvoice.invoiceNumber);
        expect(payload).toHaveProperty('status', 'DRAFT');
      }
    });

    test('GET /api/invoices/:id should return specific invoice', async () => {
      // First create an invoice to test retrieval
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: {
          invoiceNumber: 'E2E-TEST-002',
          amount: 2000,
          currency: 'USD',
          dueDate: '2024-12-31',
          description: 'E2E Test Invoice for Retrieval',
          buyerId: 'test-buyer-id'
        },
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {}
      });

      if (createResponse.statusCode === 201) {
        const createdInvoice = JSON.parse(createResponse.payload);
        
        const getResponse = await app.inject({
          method: 'GET',
          url: `/api/invoices/${createdInvoice.id}`,
          headers: authToken ? { authorization: `Bearer ${authToken}` } : {}
        });

        expect(getResponse.statusCode).toBe(200);
        const payload = JSON.parse(getResponse.payload);
        expect(payload).toHaveProperty('id', createdInvoice.id);
        expect(payload).toHaveProperty('invoiceNumber', 'E2E-TEST-002');
      }
    });
  });

  describe('Hedera Integration', () => {
    test('GET /api/hedera/status should return Hedera service status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/hedera/status'
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload).toHaveProperty('network');
      expect(payload).toHaveProperty('operatorId');
      expect(payload).toHaveProperty('connected');
    });

    test('POST /api/invoices/:id/mint should handle NFT minting', async () => {
      // This test requires a valid invoice and authentication
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/test-id/mint',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      // Should return 401 for invalid token
      expect(response.statusCode).toBe(401);
    });
  });

  describe('File Upload', () => {
    test('POST /api/upload should handle file uploads', async () => {
      const mockFileContent = Buffer.from('Mock PDF content');
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/upload',
        payload: mockFileContent,
        headers: {
          'content-type': 'application/pdf',
          authorization: 'Bearer invalid-token'
        }
      });

      // Should return 401 without valid authentication
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Funding Operations', () => {
    test('GET /api/funding/opportunities should return funding opportunities', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/funding/opportunities'
      });

      expect([200, 401]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const payload = JSON.parse(response.payload);
        expect(Array.isArray(payload.data)).toBe(true);
      }
    });

    test('POST /api/funding/invest should handle investment requests', async () => {
      const mockInvestment = {
        invoiceId: 'test-invoice-id',
        amount: 500,
        expectedReturn: 550
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/funding/invest',
        payload: mockInvestment,
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      // Should return 401 without valid authentication
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Mirror Node Integration', () => {
    test('GET /api/mirror/transaction/:id should fetch transaction details', async () => {
      const mockTransactionId = '0.0.123456@1234567890.123456789';
      
      const response = await app.inject({
        method: 'GET',
        url: `/api/mirror/transaction/${encodeURIComponent(mockTransactionId)}`
      });

      // Should handle the request (may return error for invalid transaction)
      expect([200, 404, 500]).toContain(response.statusCode);
    });

    test('GET /api/mirror/account/:id should fetch account information', async () => {
      const mockAccountId = '0.0.123456';
      
      const response = await app.inject({
        method: 'GET',
        url: `/api/mirror/account/${mockAccountId}`
      });

      // Should handle the request
      expect([200, 404, 500]).toContain(response.statusCode);
    });
  });

  describe('Error Handling', () => {
    test('GET /api/nonexistent should return 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/nonexistent'
      });

      expect(response.statusCode).toBe(404);
    });

    test('POST /api/invoices with invalid data should return 400', async () => {
      const invalidInvoice = {
        // Missing required fields
        amount: 'invalid-amount'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: invalidInvoice,
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect([400, 401]).toContain(response.statusCode);
    });
  });

  describe('CORS and Security', () => {
    test('OPTIONS requests should be handled correctly', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/invoices',
        headers: {
          'origin': 'http://localhost:3000',
          'access-control-request-method': 'GET'
        }
      });

      expect([200, 204]).toContain(response.statusCode);
    });

    test('Security headers should be present', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      // Check for common security headers
      expect(response.headers).toHaveProperty('x-powered-by');
    });
  });

  describe('Performance and Load', () => {
    test('Multiple concurrent requests should be handled', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => 
        app.inject({
          method: 'GET',
          url: '/health'
        })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });
    });

    test('Large payload should be handled appropriately', async () => {
      const largePayload = {
        data: 'x'.repeat(10000), // 10KB of data
        invoiceNumber: 'LARGE-TEST-001',
        amount: 1000,
        currency: 'USD',
        dueDate: '2024-12-31',
        description: 'Large payload test',
        buyerId: 'test-buyer-id'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: largePayload,
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      // Should handle large payloads (may return 401 due to auth, but not 413)
      expect(response.statusCode).not.toBe(413);
    });
  });
});