import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { build } from '../../../src/app';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { generateAccessToken, UserRole, getUserPermissions } from '../../../src/middleware/auth';
import { invoiceDataMerger, InvoiceListResponse } from '../../../src/services/invoiceDataMerger';

// Mock Hedera service
jest.mock('../../../src/services/hedera');

// Mock invoiceDataMerger
jest.mock('../../../src/services/invoiceDataMerger', () => ({
  invoiceDataMerger: {
    getEnrichedInvoices: jest.fn(),
    getDetailedInvoice: jest.fn(),
  },
}));

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
    id: 'cmg5835f2000312tpzdi5nkxw',
    supplierId: 'supplier_123',
    supplierName: 'Test Supplier',
    supplierEmail: 'supplier@test.com',
    amount: 1000,
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
      invoiceEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    
    MockPrismaClient.mockImplementation(() => mockPrisma);
    
    // Build the Fastify app
    app = await build({ logger: false });
    await app.ready();

    // Create test tokens using generateAccessToken
    const supplierUser = {
      id: 'supplier_123',
      accountId: '0.0.123456',
      email: 'supplier@test.com',
      role: UserRole.SUPPLIER,
      permissions: getUserPermissions(UserRole.SUPPLIER),
    };
    
    const investorUser = {
      id: 'investor_123',
      accountId: '0.0.123457',
      email: 'investor@test.com',
      role: UserRole.INVESTOR,
      permissions: getUserPermissions(UserRole.INVESTOR),
    };
    
    const adminUser = {
      id: 'admin_123',
      accountId: '0.0.123458',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
      permissions: getUserPermissions(UserRole.ADMIN),
    };

    supplierToken = await generateAccessToken(supplierUser);
    investorToken = await generateAccessToken(investorUser);
    adminToken = await generateAccessToken(adminUser);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/invoices/simple', () => {
    const validInvoiceData = {
      supplierName: 'Test Supplier',
      supplierEmail: 'supplier@test.com',
      amount: 1000,
      currency: 'USD',
      description: 'Test invoice',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    it('should create invoice successfully with valid data', async () => {
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice);

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/simple',
        headers: {
          authorization: `Bearer ${supplierToken}`,
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
        url: '/api/invoices/simple',
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
        url: '/api/invoices/simple',
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
        url: '/api/invoices/simple',
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
      const mockResult = {
        data: mockInvoices,
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
          pages: 1,
        },
      };
      
      (invoiceDataMerger.getEnrichedInvoices as jest.Mock).mockResolvedValue(mockResult);

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
      const mockResult = {
        data: fundedInvoices,
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
        },
      };
      
      (invoiceDataMerger.getEnrichedInvoices as jest.Mock).mockResolvedValue(mockResult);

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
      const mockInvoiceWithRelations = {
        ...mockInvoice,
        supplier: { id: 'supplier-1', name: 'Test Supplier', email: 'supplier@test.com' },
        agent: null,
        events: [],
        fundings: [],
      };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoiceWithRelations);

      const response = await app.inject({
        method: 'GET',
        url: `/api/invoices/${mockInvoice.id}`,
        headers: {
          authorization: `Bearer ${supplierToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBe(mockInvoice.id);
      expect(body.data.supplier.name).toBe('Test Supplier');
    });

    it('should return 404 for non-existent invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/invoices/cmg5835f2000312tpzdi5nkxy',
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
        url: `/api/invoices/${mockInvoice.id}`,
        headers: {
          authorization: `Bearer ${supplierToken}`,
          'content-type': 'application/json',
        },
        payload: { status: 'FUNDED' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('FUNDED');
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/invoices/${mockInvoice.id}`,
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
      amount: 8000,
      walletAddress: '0.0.123456',
      transactionMemo: 'Test funding transaction',
    };

    it('should fund invoice successfully', async () => {
      const fundedInvoice = { ...mockInvoice, status: 'FUNDED' };
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue(fundedInvoice);
      mockPrisma.invoiceEvent.create.mockResolvedValue({});

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
      expect(body.data.status).toBe('FUNDED');
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
      expect(body.data.status).toBe('PAID');
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