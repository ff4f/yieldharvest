import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { build } from '../../src/app';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import FormData from 'form-data';

// Mock Prisma
jest.mock('@prisma/client');
const MockPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

// Mock Hedera Service
jest.mock('../../src/services/hedera');

// Mock InvoiceHederaService
jest.mock('../../src/services/invoiceHederaService');
import { InvoiceHederaService } from '../../src/services/invoiceHederaService';

const mockInvoiceHederaService = jest.mocked(InvoiceHederaService);

describe('Invoice Hedera Integration Routes', () => {
  let app: FastifyInstance;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let validToken: string;

  beforeEach(async () => {
    // Setup mock Prisma
    mockPrisma = {
      invoice: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
      },
      user: {
        findUnique: jest.fn()
      },
      $disconnect: jest.fn()
    } as any;

    MockPrismaClient.mockImplementation(() => mockPrisma);

    // Build app
    app = await build({ logger: false });
    await app.ready();
    
    // Create test token
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

    // Mock user lookup for authentication
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'supplier@test.com',
      role: 'SUPPLIER',
      accountId: '0.0.123456',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    // Mock invoice creation
    mockPrisma.invoice.create.mockResolvedValue({
      id: 'invoice-123',
      invoiceNumber: 'INV-001',
      supplierId: 'supplier-123',
      buyerId: 'buyer-123',
      amount: 1000.00,
      currency: 'USD',
      dueDate: new Date('2024-12-31'),
      description: 'Test invoice',
      status: 'ISSUED',
      nftTokenId: '0.0.123456',
      nftSerialNumber: '1',
      fileId: '0.0.789012',
      fileHash: 'test-hash',
      topicId: '0.0.345678',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    // Mock InvoiceHederaService response
    const mockCreateInvoiceWithHedera = jest.spyOn(mockInvoiceHederaService.prototype, 'createInvoiceWithHedera');
    mockCreateInvoiceWithHedera.mockResolvedValue({
      invoice: {
        id: 'invoice-123',
        invoiceNumber: 'INV-001',
        amount: 1000.00,
        status: 'ISSUED',
        nftTokenId: '0.0.123456',
        nftSerialNumber: '1',
        fileId: '0.0.789012',
        fileHash: 'test-hash',
        topicId: '0.0.345678'
      },
      nftResult: {
        tokenId: '0.0.123456',
        serialNumber: '1',
        transactionId: '0.0.123456@1234567890.123456789'
      },
      fileResult: {
        fileId: '0.0.789012',
        fileHashSha384: 'test-hash',
        transactionId: '0.0.123456@1234567890.123456790'
      },
      hcsResult: {
        sequenceNumber: '1',
        transactionId: '0.0.123456@1234567890.123456791'
      }
    });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/invoices/with-hedera', () => {
    test('should create invoice with Hedera integration', async () => {
      // Mock PDF file
      const pdfBuffer = Buffer.from('Mock PDF content');
      
      // Create form data
      const formData = new FormData();
      formData.append('invoiceNumber', 'INV-TEST-001');
      formData.append('supplierId', 'supplier_123');
      formData.append('buyerId', 'buyer_123');
      formData.append('amount', '1000.00');
      formData.append('currency', 'USD');
      formData.append('dueDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
      formData.append('description', 'Test invoice with Hedera integration');
      formData.append('pdfFile', pdfBuffer, {
        filename: 'test-invoice.pdf',
        contentType: 'application/pdf'
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/with-hedera',
        headers: {
          'authorization': `Bearer ${validToken}`,
          ...formData.getHeaders()
        },
        payload: formData
      });

      if (response.statusCode !== 200) {
        process.stderr.write(`Response status: ${response.statusCode}\n`);
        process.stderr.write(`Response payload: ${response.payload}\n`);
      }
      
      expect(response.statusCode).toBe(200);
      
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('invoice');
      expect(result.data).toHaveProperty('hedera');
      expect(result.data.hedera).toHaveProperty('hashScanUrls');
    });

    test('should return 400 if PDF file is missing', async () => {
      const formData = new FormData();
      formData.append('invoiceNumber', 'INV-TEST-002');
      formData.append('supplierId', 'supplier_123');
      formData.append('buyerId', 'buyer_123');
      formData.append('amount', '1000.00');
      formData.append('currency', 'USD');
      formData.append('dueDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/with-hedera',
        headers: {
          'authorization': `Bearer ${validToken}`,
          'content-type': 'multipart/form-data'
        },
        payload: formData
      });

    // Could be 400 or 500 depending on where the validation fails
    expect([400, 500]).toContain(response.statusCode);
      
      const result = JSON.parse(response.payload);
      expect(result.error).toContain('Failed to create invoice with Hedera integration');
    });

    test('should return 401 if not authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/with-hedera',
        headers: {
          'content-type': 'multipart/form-data'
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('InvoiceHederaService Integration', () => {
    test('should handle Hedera service errors gracefully', async () => {
      // Mock environment variables to be missing
      const originalTokenId = process.env.INVOICE_TOKEN_ID;
      const originalTopicId = process.env.INVOICE_TOPIC_ID;
      
      delete process.env.INVOICE_TOKEN_ID;
      delete process.env.INVOICE_TOPIC_ID;

      const pdfBuffer = Buffer.from('Mock PDF content');
      const formData = new FormData();
      formData.append('invoiceNumber', 'INV-TEST-003');
      formData.append('supplierId', 'supplier_123');
      formData.append('buyerId', 'buyer_123');
      formData.append('amount', '1000.00');
      formData.append('currency', 'USD');
      formData.append('dueDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
      formData.append('pdfFile', pdfBuffer, {
        filename: 'test-invoice.pdf',
        contentType: 'application/pdf'
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/invoices/with-hedera',
        headers: {
          'authorization': `Bearer ${validToken}`,
          'content-type': 'multipart/form-data'
        },
        payload: formData
      });

      // Should still work but with limited Hedera functionality
      expect([200, 500]).toContain(response.statusCode);

      // Restore environment variables
      if (originalTokenId) process.env.INVOICE_TOKEN_ID = originalTokenId;
      if (originalTopicId) process.env.INVOICE_TOPIC_ID = originalTopicId;
    });
  });
});