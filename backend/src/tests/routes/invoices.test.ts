import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { build } from '../../app';
import { logger } from '../../utils/logger';
import { generateAccessToken, UserRole } from '../../middleware/auth';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

describe('Invoice Routes', () => {
  let app: FastifyInstance;
  let testUserId: string;
  let testSupplierId: string;
  let testBuyerId: string;
  let supplierToken: string;
  let buyerToken: string;

  beforeAll(async () => {
    app = await build({ logger: false });
    await app.ready();

    // Create test users
    const testSupplier = await prisma.user.create({
      data: {
        email: 'supplier@test.com',
        name: 'Test Supplier',
        role: 'SUPPLIER',
        hederaAccountId: '0.0.123456',
      },
    });
    testSupplierId = testSupplier.id;
    testUserId = testSupplier.id;

    const testBuyer = await prisma.user.create({
      data: {
        email: 'buyer@test.com',
        name: 'Test Buyer',
        role: 'BUYER',
        hederaAccountId: '0.0.123457',
      },
    });
    testBuyerId = testBuyer.id;

    // Generate JWT tokens for test users
    supplierToken = generateAccessToken({
      id: testSupplierId,
      accountId: '0.0.123456',
      role: UserRole.SUPPLIER,
      email: 'supplier@test.com',
    });

    buyerToken = generateAccessToken({
      id: testBuyerId,
      accountId: '0.0.123457',
      role: UserRole.SUPPLIER, // Note: Using SUPPLIER role for buyer to access invoice routes
      email: 'buyer@test.com',
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.invoice.deleteMany({
      where: {
        OR: [
          { supplierId: testSupplierId },
          { buyerId: testBuyerId },
        ],
      },
    });

    await prisma.invoiceEvent.deleteMany({
      where: {
        invoice: {
          OR: [
            { supplierId: testSupplierId },
            { buyerId: testBuyerId },
          ],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testSupplierId, testBuyerId],
        },
      },
    });

    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up invoices before each test
    await prisma.invoice.deleteMany({
      where: { supplierId: testSupplierId },
    });
  });

  describe('POST /api/invoices/simple', () => {
    it('should create a simple invoice without file upload', async () => {
      const invoiceData = {
        supplierName: 'Test Supplier',
        supplierEmail: 'supplier@test.com',
        amount: 1000.50,
        currency: 'USD',
        dueDate: '2024-12-31T23:59:59Z',
        description: 'Test invoice description',
      };

      const response = await request(app.server)
        .post('/api/invoices/simple')
        .set('Authorization', `Bearer ${supplierToken}`)
        .send(invoiceData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('invoiceNumber');
      expect(response.body).toHaveProperty('amount', 1000.50);
      expect(response.body).toHaveProperty('currency', 'USD');
      expect(response.body).toHaveProperty('status', 'ISSUED');

      // Should have mock NFT data
      expect(response.body).toHaveProperty('nftTokenId');
      expect(response.body).toHaveProperty('nftSerialNumber');

      logger.info('Simple invoice created successfully:', response.body.id);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        invoiceNumber: 'INV-TEST-002',
        // Missing required fields
      };

      const response = await request(app.server)
        .post('/api/invoices/simple')
        .set('Authorization', `Bearer ${supplierToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/invoices', () => {
    it('should create invoice with PDF file upload (mock Hedera integration)', async () => {
      // Create a test PDF file
      const testPdfContent = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('Test PDF content for invoice upload test')
      ]);
      
      const testPdfPath = path.join(__dirname, 'test-invoice.pdf');
      fs.writeFileSync(testPdfPath, testPdfContent);

      try {
        const response = await request(app.server)
          .post('/api/invoices')
          .set('Authorization', `Bearer ${supplierToken}`)
          .field('invoiceNumber', 'INV-TEST-003')
          .field('amount', '2500.75')
          .field('currency', 'USD')
          .field('dueDate', '2024-12-31T23:59:59Z')
          .field('description', 'Test invoice with PDF upload')
          .field('supplierId', testSupplierId)
          .field('buyerId', testBuyerId)
          .attach('pdfFile', testPdfPath)
          .expect(201);

        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('invoice');
        expect(response.body.data).toHaveProperty('nft');
        expect(response.body.data).toHaveProperty('file');
        expect(response.body.data).toHaveProperty('hcs');
        expect(response.body.data).toHaveProperty('hashScanUrls');

        // Validate invoice data
        const invoice = response.body.data.invoice;
        expect(invoice).toHaveProperty('id');
        expect(invoice).toHaveProperty('invoiceNumber', 'INV-TEST-003');
        expect(invoice).toHaveProperty('amount', 2500.75);
        expect(invoice).toHaveProperty('status', 'ISSUED');

        // Validate NFT data (should be real or mock depending on environment)
        const nft = response.body.data.nft;
        expect(nft).toHaveProperty('tokenId');
        expect(nft).toHaveProperty('serialNumber');
        expect(nft).toHaveProperty('transactionId');

        // Validate file data
        const file = response.body.data.file;
        expect(file).toHaveProperty('fileId');
        expect(file).toHaveProperty('transactionId');
        expect(file).toHaveProperty('fileHashSha384');

        // Validate HCS data
        const hcs = response.body.data.hcs;
        expect(hcs).toHaveProperty('transactionId');
        expect(hcs).toHaveProperty('sequenceNumber');

        // Validate HashScan URLs
        const hashScanUrls = response.body.data.hashScanUrls;
        expect(hashScanUrls).toHaveProperty('nft');
        expect(hashScanUrls).toHaveProperty('file');
        expect(hashScanUrls).toHaveProperty('topic');
        expect(hashScanUrls.nft).toContain('hashscan.io/testnet/token');
        expect(hashScanUrls.file).toContain('hashscan.io/testnet/transaction');
        expect(hashScanUrls.topic).toContain('hashscan.io/testnet/topic');

        logger.info('Invoice with PDF created successfully:', invoice.id);
        logger.info('NFT Token ID:', nft.tokenId);
        logger.info('File ID:', file.fileId);
        logger.info('HCS Transaction:', hcs.transactionId);
      } finally {
        // Clean up test file
        if (fs.existsSync(testPdfPath)) {
          fs.unlinkSync(testPdfPath);
        }
      }
    });

    it('should reject non-PDF files', async () => {
      const testTxtContent = Buffer.from('This is not a PDF file');
      const testTxtPath = path.join(__dirname, 'test-file.txt');
      fs.writeFileSync(testTxtPath, testTxtContent);

      try {
        const response = await request(app.server)
          .post('/api/invoices')
          .set('Authorization', `Bearer ${supplierToken}`)
          .field('invoiceNumber', 'INV-TEST-004')
          .field('amount', '1500.00')
          .field('currency', 'USD')
          .field('dueDate', '2024-12-31T23:59:59Z')
          .field('description', 'Test invoice with invalid file')
          .field('supplierId', testSupplierId)
          .field('buyerId', testBuyerId)
          .attach('file', testTxtPath)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      } finally {
        // Clean up test file
        if (fs.existsSync(testTxtPath)) {
          fs.unlinkSync(testTxtPath);
        }
      }
    });

    it('should handle missing file upload', async () => {
      const response = await request(app.server)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${supplierToken}`)
        .field('invoiceNumber', 'INV-TEST-005')
        .field('amount', '1000.00')
        .field('currency', 'USD')
        .field('dueDate', '2024-12-31T23:59:59Z')
        .field('description', 'Test invoice without file')
        .field('supplierId', testSupplierId)
        .field('buyerId', testBuyerId)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/invoices', () => {
    beforeEach(async () => {
      // Create test invoices
      await prisma.invoice.createMany({
        data: [
          {
            invoiceNumber: 'INV-GET-001',
            amount: 1000,
            currency: 'USD',
            dueDate: new Date('2024-12-31'),
            description: 'Test invoice 1',
            status: 'CREATED',
            supplierId: testSupplierId,
            buyerId: testBuyerId,
            nftTokenId: '0.0.123456',
            nftSerialNumber: '1',
          },
          {
            invoiceNumber: 'INV-GET-002',
            amount: 2000,
            currency: 'USD',
            dueDate: new Date('2024-12-31'),
            description: 'Test invoice 2',
            status: 'ISSUED',
            supplierId: testSupplierId,
            buyerId: testBuyerId,
            nftTokenId: '0.0.123456',
            nftSerialNumber: '2',
          },
        ],
      });
    });

    it('should get all invoices', async () => {
      const response = await request(app.server)
        .get('/api/invoices')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);

      const invoice = response.body.data[0];
      expect(invoice).toHaveProperty('id');
      expect(invoice).toHaveProperty('invoiceNumber');
      expect(invoice).toHaveProperty('amount');
      expect(invoice).toHaveProperty('status');
      expect(invoice).toHaveProperty('supplier');
      expect(invoice).toHaveProperty('buyerId');
    });

    it('should filter invoices by status', async () => {
      const response = await request(app.server)
        .get('/api/invoices?status=ISSUED')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // All returned invoices should have ISSUED status
      response.body.data.forEach((invoice: any) => {
        expect(invoice.status).toBe('ISSUED');
      });
    });

    it('should paginate results', async () => {
      const response = await request(app.server)
        .get('/api/invoices?page=1&limit=1')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
      
      const pagination = response.body.pagination;
      expect(pagination).toHaveProperty('page', 1);
      expect(pagination).toHaveProperty('limit', 1);
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('pages');
    });
  });

  describe('GET /api/invoices/:id', () => {
    let testInvoiceId: string;

    beforeEach(async () => {
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'INV-DETAIL-001',
          amount: 1500,
          currency: 'USD',
          dueDate: new Date('2024-12-31'),
          description: 'Test invoice for detail view',
          status: 'ISSUED',
          supplierId: testSupplierId,
          buyerId: testBuyerId,
          nftTokenId: '0.0.123456',
          nftSerialNumber: '1',
          fileId: '0.0.789012',
          fileHash: 'sha384-test-hash',
        },
      });
      testInvoiceId = invoice.id;
      logger.info('Created test invoice with ID:', testInvoiceId);
    });

    it('should get invoice by ID', async () => {
      // First, let's check if the ID is valid CUID
      const cuidRegex = /^c[a-z0-9]{24}$/;
      expect(testInvoiceId).toMatch(cuidRegex);
      
      const response = await request(app.server)
        .get(`/api/invoices/${testInvoiceId}`)
        .set('Authorization', `Bearer ${supplierToken}`);
      
      // If we get 400, let's see what the error is
      if (response.status === 400) {
        throw new Error(`Validation error: ${JSON.stringify(response.body)}`);
      }
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      
      const invoice = response.body.data;
      expect(invoice).toHaveProperty('id', testInvoiceId);
      expect(invoice).toHaveProperty('invoiceNumber', 'INV-DETAIL-001');
      expect(invoice).toHaveProperty('amount', 1500);
      expect(invoice).toHaveProperty('status', 'ISSUED');
      expect(invoice).toHaveProperty('supplier');
      expect(invoice).toHaveProperty('buyerId', testBuyerId);
      expect(invoice).toHaveProperty('nftTokenId', '0.0.123456');
      expect(invoice).toHaveProperty('fileId', '0.0.789012');
    });

    it('should return 404 for non-existent invoice', async () => {
      const nonExistentId = 'cmg5835f2000312tpzdi5nkxz';
      
      const response = await request(app.server)
        .get(`/api/invoices/${nonExistentId}`)
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Invoice not found');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app.server)
        .get('/api/invoices/invalid-uuid')
        .set('Authorization', `Bearer ${supplierToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});