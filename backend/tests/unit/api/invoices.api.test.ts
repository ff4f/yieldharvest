import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { build } from '../../../src/app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// Mock Hedera Service
jest.mock('../../../src/services/hedera');

// Mock Prisma
jest.mock('@prisma/client');
const MockPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

describe('Invoice API Integration Tests', () => {
  let app: FastifyInstance;
  let mockPrisma: any;
  let supplierToken: string;
  let investorToken: string;
  let adminToken: string;

  const mockInvoice = {
    id: 'inv_test_123',
    supplierName: 'Test Supplier',
    supplierEmail: 'supplier@test.com',
    amount: 10000,
    currency: 'USD',
    description: 'Test Invoice Description',
    status: 'ISSUED',
    nftTokenId: '0.0.123456',
    nftSerialNumber: '1',
    hfsFileId: '0.0.789012',
    hcsTopicId: '0.0.345678',
    createdAt: new Date(),
    updatedAt: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Setup mock Prisma
    mockPrisma = {
      invoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      funding: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    
    MockPrismaClient.mockImplementation(() => mockPrisma);
    
    // Build the Fastify app
    app = await build({ logger: false });
    await app.ready();

    // Create test tokens
    const jwtSecret = process.env.JWT_SECRET || 'test-secret';
    supplierToken = jwt.sign(
      { userId: 'supplier_123', role: 'SUPPLIER', email: 'supplier@test.com' },
      jwtSecret
    );
    investorToken = jwt.sign(
      { userId: 'investor_123', role: 'INVESTOR', email: 'investor@test.com' },
      jwtSecret
    );
    adminToken = jwt.sign(
      { userId: 'admin_123', role: 'ADMIN', email: 'admin@test.com' },
      jwtSecret
    );
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/invoices', () => {
    const validInvoiceData = {
      supplierName: 'Test Supplier',
      supplierEmail: 'supplier@test.com',
      amount: 10000,
      currency: 'USD',
      description: 'Test Invoice',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    it('should create invoice successfully with valid data', async () => {
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`,
          'content-type': 'application/json',
        },
        payload: validInvoiceData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('nftTokenId');
      expect(body.status).toBe('ISSUED');
      expect(body.amount).toBe(validInvoiceData.amount);
    });

    it('should reject request without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          'content-type': 'application/json',
        },
        payload: validInvoiceData,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        supplierName: 'Test Supplier',
        // Missing required fields
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`,
          'content-type': 'application/json',
        },
        payload: invalidData,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate amount is positive', async () => {
      const invalidData = {
        ...validInvoiceData,
        amount: -1000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`,
          'content-type': 'application/json',
        },
        payload: invalidData,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/invoices', () => {
    const mockInvoices = [
      { ...mockInvoice, id: 'inv_1' },
      { ...mockInvoice, id: 'inv_2', status: 'FUNDED' },
      { ...mockInvoice, id: 'inv_3', status: 'PAID' },
    ];

    it('should fetch invoices with pagination', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(3);

      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices',
        headers: {
          authorization: `Bearer ${supplierToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const fundedInvoices = mockInvoices.filter(inv => inv.status === 'FUNDED');
      mockPrisma.invoice.findMany.mockResolvedValue(fundedInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices?status=FUNDED',
        headers: {
          authorization: `Bearer ${supplierToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('FUNDED');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/invoices/:id', () => {
    it('should fetch single invoice by ID', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const response = await app.inject({
        method: 'GET',
        url: `/api/invoices/${mockInvoice.id}`,
        headers: {
          authorization: `Bearer ${supplierToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(mockInvoice.id);
      expect(body.supplierName).toBe(mockInvoice.supplierName);
    });

    it('should return 404 for non-existent invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices/non-existent-id',
        headers: {
          authorization: `Bearer ${supplierToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/invoices/${mockInvoice.id}`,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/invoices/:id/status', () => {
    it('should update invoice status to FUNDED', async () => {
      const updatedInvoice = { ...mockInvoice, status: 'FUNDED' };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue(updatedInvoice);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/invoices/${mockInvoice.id}/status`,
        headers: {
          authorization: `Bearer ${investorToken}`,
          'content-type': 'application/json',
        },
        payload: { status: 'FUNDED', transactionId: '0.0.123@1234567890.123456789' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('FUNDED');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/invoices/${mockInvoice.id}/status`,
        headers: {
          'content-type': 'application/json',
        },
        payload: { status: 'FUNDED' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/invoices/non-existent-id/status',
        headers: {
          authorization: `Bearer ${investorToken}`,
          'content-type': 'application/json',
        },
        payload: { status: 'FUNDED' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/invoices/:id/fund', () => {
    const fundingData = {
      investorName: 'Test Investor',
      investorEmail: 'investor@test.com',
      amount: 8000,
      walletAddress: '0.0.123456',
    };

    it('should fund invoice successfully', async () => {
      const fundedInvoice = { ...mockInvoice, status: 'FUNDED' };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue(fundedInvoice);

      const response = await app.inject({
        method: 'POST',
        url: `/api/invoices/${mockInvoice.id}/fund`,
        headers: {
          authorization: `Bearer ${investorToken}`,
          'content-type': 'application/json',
        },
        payload: fundingData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('FUNDED');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/invoices/${mockInvoice.id}/fund`,
        headers: {
          'content-type': 'application/json',
        },
        payload: fundingData,
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/invoices/:id/pay', () => {
    const paymentData = {
      walletAddress: '0.0.789012',
      transactionMemo: 'Payment for invoice',
    };

    it('should process payment successfully', async () => {
      const fundedInvoice = { ...mockInvoice, status: 'FUNDED' };
      const paidInvoice = { ...mockInvoice, status: 'PAID' };
      mockPrisma.invoice.findUnique.mockResolvedValue(fundedInvoice);
      mockPrisma.invoice.update.mockResolvedValue(paidInvoice);

      const response = await app.inject({
        method: 'POST',
        url: `/api/invoices/${mockInvoice.id}/pay`,
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        payload: paymentData,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('PAID');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/invoices/${mockInvoice.id}/pay`,
        headers: {
          'content-type': 'application/json',
        },
        payload: paymentData,
      });

      expect(response.statusCode).toBe(401);
    });
  });
});