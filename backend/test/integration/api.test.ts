import { test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import { build } from '../../src/app';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

describe('API Integration Tests', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Build the Fastify app
    app = await build({
      logger: false,
      disableRequestLogging: true
    });

    await app.ready();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('Health Endpoints', () => {
    test('GET /health should return system health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('services');
    });

    test('GET /api/health/hedera should return Hedera service status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health/hedera'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('network');
    });

    test('GET /api/health/mirror-node should return Mirror Node status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/health/mirror-node'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('url');
    });
  });

  describe('Invoice Endpoints', () => {
    test('GET /api/invoices should return list of invoices', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body).toHaveProperty('pagination');
    });

    test('GET /api/invoices/:id should return specific invoice', async () => {
      // First get an invoice ID from the list
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/invoices'
      });

      const listBody = JSON.parse(listResponse.body);
      if (listBody.data.length > 0) {
        const invoiceId = listBody.data[0].id;

        const response = await app.inject({
          method: 'GET',
          url: `/api/invoices/${invoiceId}`
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('id', invoiceId);
        expect(body).toHaveProperty('invoiceNumber');
        expect(body).toHaveProperty('amount');
        expect(body).toHaveProperty('status');
      }
    });

    test('GET /api/invoices/:id/proof should return blockchain proof', async () => {
      // Get an invoice with NFT data
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/invoices'
      });

      const listBody = JSON.parse(listResponse.body);
      const invoiceWithNFT = listBody.data.find((inv: any) => inv.nftTokenId);

      if (invoiceWithNFT) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/invoices/${invoiceWithNFT.id}/proof`
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty('nft');
        expect(body).toHaveProperty('file');
        expect(body).toHaveProperty('consensus');
        expect(body).toHaveProperty('links');
      }
    });
  });

  describe('Wallet Authentication', () => {
    test('POST /api/wallet-auth/login should handle invalid signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/wallet-auth/login',
        payload: {
          accountId: '0.0.123456',
          signature: 'invalid-signature',
          nonce: Date.now().toString()
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('INVALID_SIGNATURE');
    });

    test('POST /api/wallet-auth/login should handle expired nonce', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/wallet-auth/login',
        payload: {
          accountId: '0.0.123456',
          signature: 'some-signature',
          nonce: (Date.now() - 600000).toString() // 10 minutes ago
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('EXPIRED_NONCE');
    });

    test('GET /api/wallet-auth/validate should handle invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/wallet-auth/validate',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.valid).toBe(false);
      expect(body.error).toBe('INVALID_TOKEN');
    });
  });

  describe('Mirror Node Integration', () => {
    test('GET /api/mirror/account/:id should return account info', async () => {
      const testAccountId = '0.0.123456';
      const response = await app.inject({
        method: 'GET',
        url: `/api/mirror/account/${testAccountId}`
      });

      // Should return either account data or 404 if account doesn't exist
      expect([200, 404]).toContain(response.statusCode);
    });

    test('GET /api/mirror/token/:id should return token info', async () => {
      const testTokenId = '0.0.100001';
      const response = await app.inject({
        method: 'GET',
        url: `/api/mirror/token/${testTokenId}`
      });

      // Should return either token data or 404 if token doesn't exist
      expect([200, 404]).toContain(response.statusCode);
    });

    test('GET /api/mirror/topic/:id should return topic info', async () => {
      const testTopicId = '0.0.789012';
      const response = await app.inject({
        method: 'GET',
        url: `/api/mirror/topic/${testTopicId}`
      });

      // Should return either topic data or 404 if topic doesn't exist
      expect([200, 404]).toContain(response.statusCode);
    });
  });

  describe('File Upload', () => {
    test('POST /api/invoices should handle multipart form data', async () => {
      // This test would require a proper multipart form setup
      // For now, we'll test the endpoint exists and handles missing data
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        payload: {
          customerName: 'Test Customer',
          amount: '1000',
          currency: 'HBAR',
          description: 'Test Invoice'
        }
      });

      // Should return validation error for missing required fields
      expect([400, 422]).toContain(response.statusCode);
    });
  });

  describe('Funding Endpoints', () => {
    test('GET /api/funding should return funding opportunities', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/funding'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('GET /api/funding/stats should return funding statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/funding/stats'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('totalFunded');
      expect(body).toHaveProperty('totalInvoices');
      expect(body).toHaveProperty('averageReturn');
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

    test('GET /api/invoices/invalid-id should return 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices/invalid-id'
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('CORS and Security Headers', () => {
    test('OPTIONS request should include CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/invoices',
        headers: {
          origin: 'http://localhost:3000'
        }
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    test('Response should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });
});