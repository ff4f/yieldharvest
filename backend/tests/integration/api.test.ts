import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../../src/app.js';

const prisma = new PrismaClient();

describe('API Integration Tests', () => {
  let server: any;
  let testUserId: string;
  let testSupplierId: string;
  let testInvoiceId: string;

  beforeAll(async () => {
    // Start the server
    server = app.listen(0);
    
    // Clean up test data
    await prisma.funding.deleteMany();
    await prisma.invoiceEvent.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.investor.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.funding.deleteMany();
    await prisma.invoiceEvent.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.investor.deleteMany();
    await prisma.user.deleteMany();
    
    await prisma.$disconnect();
    server.close();
  });

  beforeEach(async () => {
    // Create test user and supplier for each test
    const testUser = await prisma.user.create({
      data: {
        name: 'Test Supplier',
        email: 'supplier@test.com',
        accountId: '0.0.123456'
      }
    });
    testUserId = testUser.id;
    testSupplierId = testUser.id;
  });

  describe('Invoice Endpoints', () => {
    describe('POST /api/invoices', () => {
      it('should create a new invoice', async () => {
        const invoiceData = {
          invoiceNumber: 'INV-TEST-001',
          supplierId: testSupplierId,
          amount: '1000.00',
          currency: 'USD',
          dueDate: '2024-12-31',
          description: 'Test invoice for API integration'
        };

        const response = await request(server)
          .post('/api/invoices')
          .send(invoiceData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.invoiceNumber).toBe(invoiceData.invoiceNumber);
        expect(response.body.data.amount).toBe(1000);
        expect(response.body.data.status).toBe('ISSUED');
        
        testInvoiceId = response.body.data.id;
      });

      it('should validate required fields', async () => {
        const invalidData = {
          supplierId: testSupplierId,
          amount: '1000.00'
          // Missing required fields
        };

        const response = await request(server)
          .post('/api/invoices')
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('validation');
      });
    });

    describe('GET /api/invoices', () => {
      beforeEach(async () => {
        // Create test invoice
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber: 'INV-GET-001',
            supplierId: testSupplierId,
            amount: 1500,
            currency: 'USD',
            dueDate: new Date('2024-12-31'),
            status: 'ISSUED',
            description: 'Test invoice for GET endpoint'
          }
        });
        testInvoiceId = invoice.id;
      });

      it('should return paginated invoices', async () => {
        const response = await request(server)
          .get('/api/invoices')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.invoices).toBeInstanceOf(Array);
        expect(response.body.data.pagination).toHaveProperty('total');
        expect(response.body.data.pagination).toHaveProperty('page');
        expect(response.body.data.pagination).toHaveProperty('limit');
      });

      it('should support pagination parameters', async () => {
        const response = await request(server)
          .get('/api/invoices?page=1&limit=5')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.pagination.page).toBe(1);
        expect(response.body.data.pagination.limit).toBe(5);
      });
    });

    describe('GET /api/invoices/:id', () => {
      beforeEach(async () => {
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber: 'INV-GETID-001',
            supplierId: testSupplierId,
            amount: 2000,
            currency: 'USD',
            dueDate: new Date('2024-12-31'),
            status: 'ISSUED',
            description: 'Test invoice for GET by ID'
          }
        });
        testInvoiceId = invoice.id;
      });

      it('should return specific invoice with proof links', async () => {
        const response = await request(server)
          .get(`/api/invoices/${testInvoiceId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(testInvoiceId);
        expect(response.body.data).toHaveProperty('proofLinks');
      });

      it('should return 404 for non-existent invoice', async () => {
        const response = await request(server)
          .get('/api/invoices/non-existent-id')
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invoice not found');
      });
    });

    describe('PUT /api/invoices/:id', () => {
      beforeEach(async () => {
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber: 'INV-PUT-001',
            supplierId: testSupplierId,
            amount: 2500,
            currency: 'USD',
            dueDate: new Date('2024-12-31'),
            status: 'ISSUED',
            description: 'Test invoice for PUT'
          }
        });
        testInvoiceId = invoice.id;
      });

      it('should update invoice status', async () => {
        const updateData = {
          status: 'FUNDED',
          description: 'Updated description'
        };

        const response = await request(server)
          .put(`/api/invoices/${testInvoiceId}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('FUNDED');
        expect(response.body.data.description).toBe('Updated description');
      });
    });
  });

  describe('Funding Endpoints', () => {
    let testInvestorId: string;

    beforeEach(async () => {
      // Create test invoice
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-FUND-001',
          supplierId: testSupplierId,
          amount: 3000,
          currency: 'USD',
          dueDate: new Date('2024-12-31'),
          status: 'ISSUED',
          description: 'Test invoice for funding'
        }
      });
      testInvoiceId = invoice.id;

      // Create test investor
      const investor = await prisma.user.create({
        data: {
          name: 'Test Investor',
          email: 'investor@test.com',
          accountId: '0.0.789012'
        }
      });
      testInvestorId = investor.id;

      // Create investor profile
      await prisma.investor.create({
        data: {
          userId: testInvestorId,
          balance: 5000,
          totalInvested: 0
        }
      });
    });

    describe('POST /api/test/funding-simple', () => {
      it('should create funding successfully', async () => {
        const fundingData = {
          invoiceId: testInvoiceId,
          investorId: testInvestorId,
          amount: '1000',
          supplierAccountId: '0.0.123456',
          nftSerialNumber: 1
        };

        const response = await request(server)
          .post('/api/test/funding-simple')
          .send(fundingData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.funding.amount).toBe(1000);
        expect(response.body.data.funding.status).toBe('ACTIVE');
        expect(response.body.data).toHaveProperty('escrowId');
        expect(response.body.data).toHaveProperty('transactionHash');
        expect(response.body.data).toHaveProperty('proofLinks');
      });

      it('should handle insufficient balance', async () => {
        const fundingData = {
          invoiceId: testInvoiceId,
          investorId: testInvestorId,
          amount: '10000', // More than available balance
          supplierAccountId: '0.0.123456',
          nftSerialNumber: 1
        };

        const response = await request(server)
          .post('/api/test/funding-simple')
          .send(fundingData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Insufficient investor balance');
      });
    });

    describe('GET /api/test/funding/:invoiceId', () => {
      beforeEach(async () => {
        // Create test funding
        await prisma.funding.create({
          data: {
            invoiceId: testInvoiceId,
            investorId: testInvestorId,
            amount: 1500,
            status: 'ACTIVE',
            escrowId: 'test-escrow-123',
            transactionHash: '0xtest123'
          }
        });
      });

      it('should return fundings for invoice', async () => {
        const response = await request(server)
          .get(`/api/test/funding/${testInvoiceId}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].amount).toBe(1500);
      });
    });
  });

  describe('Test Data Endpoints', () => {
    describe('GET /api/test/invoices', () => {
      it('should return test invoices', async () => {
        const response = await request(server)
          .get('/api/test/invoices')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
      });
    });

    describe('GET /api/test/users', () => {
      it('should return test users', async () => {
        const response = await request(server)
          .get('/api/test/users')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent endpoints', async () => {
      const response = await request(server)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(server)
        .post('/api/invoices')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});