import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { fundingRoutes } from '../src/routes/fundings';
import { contractService } from '../src/services/contract';

// Mock the contract service for E2E testing
jest.mock('../src/services/contract');
const mockContractService = contractService as jest.Mocked<typeof contractService>;

const prisma = new PrismaClient();

describe('Funding API E2E Tests', () => {
  let app: FastifyInstance;
  let testInvoiceId: string;
  let testInvestorId: string;
  let testFundingId: string;

  beforeAll(async () => {
    // Setup Fastify app
    app = Fastify({ logger: false });
    
    // Add Prisma to context
    app.decorate('prisma', prisma);
    
    // Register routes
    await app.register(fundingRoutes, { prefix: '/api/fundings' });
    
    await app.ready();

    // Setup test data
    const testUser = await prisma.user.create({
      data: {
        name: 'Test Investor E2E',
        email: 'investor-e2e@test.com',
        hederaAccountId: '0.0.123456',
        role: 'INVESTOR',
      },
    });
    testInvestorId = testUser.id;

    const testInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: 'E2E-001',
        buyerId: 'test-buyer-e2e',
        amount: '2000.00',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'ISSUED',
        description: 'E2E test invoice',
        tokenId: '0.0.789012',
        fileId: '0.0.345678',
        topicId: '0.0.901234',
      },
    });
    testInvoiceId = testInvoice.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.funding.deleteMany({ where: { invoiceId: testInvoiceId } });
    await prisma.invoice.delete({ where: { id: testInvoiceId } });
    await prisma.user.delete({ where: { id: testInvestorId } });
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/fundings', () => {
    it('should create funding with smart contract escrow', async () => {
      // Mock contract service
      mockContractService.createEscrow.mockResolvedValue({
        escrowId: '1',
        transactionHash: '0xe2e123abc',
        status: 'confirmed',
        blockNumber: 12345,
        gasUsed: '150000',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/fundings',
        payload: {
          invoiceId: testInvoiceId,
          investorId: testInvestorId,
          amount: '1000',
          buyerAddress: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        },
      });

      expect(response.statusCode).toBe(201);
      
      const responseData = JSON.parse(response.body);
      expect(responseData).toHaveProperty('data');
      expect(responseData).toHaveProperty('escrowId', '1');
      expect(responseData).toHaveProperty('transactionHash', '0xe2e123abc');
      expect(responseData).toHaveProperty('proofLinks');
      expect(responseData.proofLinks).toHaveProperty('transaction');
      expect(responseData.proofLinks).toHaveProperty('contract');
      
      expect(responseData.data.amount).toBe('1000');
      expect(responseData.data.status).toBe('ACTIVE');
      expect(responseData.data.escrowId).toBe('1');
      expect(responseData.data.transactionHash).toBe('0xe2e123abc');

      testFundingId = responseData.data.id;
    });

    it('should return 400 for invalid request data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/fundings',
        payload: {
          invoiceId: testInvoiceId,
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for non-existent invoice', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/fundings',
        payload: {
          invoiceId: 'non-existent-invoice',
          investorId: testInvestorId,
          amount: '500',
          buyerAddress: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        },
      });

      expect(response.statusCode).toBe(400);
      
      const responseData = JSON.parse(response.body);
      expect(responseData.error).toContain('Invoice not found');
    });
  });

  describe('GET /api/fundings', () => {
    it('should retrieve all fundings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/fundings',
      });

      expect(response.statusCode).toBe(200);
      
      const responseData = JSON.parse(response.body);
      expect(responseData).toHaveProperty('data');
      expect(Array.isArray(responseData.data)).toBe(true);
      expect(responseData.data.length).toBeGreaterThan(0);
      
      const funding = responseData.data.find((f: any) => f.id === testFundingId);
      expect(funding).toBeTruthy();
      expect(funding.escrowId).toBe('1');
      expect(funding.transactionHash).toBe('0xe2e123abc');
    });
  });

  describe('GET /api/fundings/:id', () => {
    it('should retrieve funding by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/fundings/${testFundingId}`,
      });

      expect(response.statusCode).toBe(200);
      
      const responseData = JSON.parse(response.body);
      expect(responseData).toHaveProperty('data');
      expect(responseData.data.id).toBe(testFundingId);
      expect(responseData.data.escrowId).toBe('1');
      expect(responseData.data.transactionHash).toBe('0xe2e123abc');
      expect(responseData.data.status).toBe('ACTIVE');
    });

    it('should return 404 for non-existent funding', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/fundings/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      
      const responseData = JSON.parse(response.body);
      expect(responseData.error).toContain('Funding not found');
    });
  });

  describe('GET /api/fundings/invoice/:invoiceId', () => {
    it('should retrieve fundings by invoice ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/fundings/invoice/${testInvoiceId}`,
      });

      expect(response.statusCode).toBe(200);
      
      const responseData = JSON.parse(response.body);
      expect(responseData).toHaveProperty('data');
      expect(Array.isArray(responseData.data)).toBe(true);
      expect(responseData.data.length).toBeGreaterThan(0);
      
      const funding = responseData.data[0];
      expect(funding.invoiceId).toBe(testInvoiceId);
      expect(funding.escrowId).toBe('1');
    });

    it('should return empty array for invoice with no fundings', async () => {
      // Create a new invoice with no fundings
      const emptyInvoice = await prisma.invoice.create({
        data: {
          invoiceNumber: 'EMPTY-E2E-001',
          buyerId: 'test-buyer-empty',
          amount: '1000.00',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'ISSUED',
          description: 'Empty invoice for E2E test',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/fundings/invoice/${emptyInvoice.id}`,
      });

      expect(response.statusCode).toBe(200);
      
      const responseData = JSON.parse(response.body);
      expect(responseData.data).toEqual([]);

      // Cleanup
      await prisma.invoice.delete({ where: { id: emptyInvoice.id } });
    });
  });

  describe('POST /api/fundings/:id/release', () => {
    it('should release escrow successfully', async () => {
      // Mock contract service
      mockContractService.releaseEscrow.mockResolvedValue({
        escrowId: '1',
        transactionHash: '0xe2erelease123',
        status: 'confirmed',
        blockNumber: 12346,
        gasUsed: '80000',
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/fundings/${testFundingId}/release`,
      });

      expect(response.statusCode).toBe(200);
      
      const responseData = JSON.parse(response.body);
      expect(responseData.message).toContain('Escrow released successfully');
      expect(responseData.transactionHash).toBe('0xe2erelease123');
      expect(responseData.proofLinks).toHaveProperty('transaction');
      expect(responseData.proofLinks).toHaveProperty('contract');

      // Verify funding status was updated
      const updatedFunding = await prisma.funding.findUnique({
        where: { id: testFundingId },
      });
      expect(updatedFunding?.status).toBe('RELEASED');
      expect(updatedFunding?.releaseTransactionHash).toBe('0xe2erelease123');
    });

    it('should return 400 for non-existent funding', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/fundings/non-existent-id/release',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/fundings/:id/refund', () => {
    it('should refund escrow successfully', async () => {
      // Create another funding for refund test
      mockContractService.createEscrow.mockResolvedValue({
        escrowId: '2',
        transactionHash: '0xe2erefund123',
        status: 'confirmed',
        blockNumber: 12347,
        gasUsed: '150000',
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/fundings',
        payload: {
          invoiceId: testInvoiceId,
          investorId: testInvestorId,
          amount: '500',
          buyerAddress: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        },
      });

      const createData = JSON.parse(createResponse.body);
      const refundFundingId = createData.data.id;

      // Mock refund response
      mockContractService.refundEscrow.mockResolvedValue({
        escrowId: '2',
        transactionHash: '0xe2erefundtx123',
        status: 'confirmed',
        blockNumber: 12348,
        gasUsed: '75000',
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/fundings/${refundFundingId}/refund`,
      });

      expect(response.statusCode).toBe(200);
      
      const responseData = JSON.parse(response.body);
      expect(responseData.message).toContain('Escrow refunded successfully');
      expect(responseData.transactionHash).toBe('0xe2erefundtx123');
      expect(responseData.proofLinks).toHaveProperty('transaction');
      expect(responseData.proofLinks).toHaveProperty('contract');

      // Verify funding status was updated
      const updatedFunding = await prisma.funding.findUnique({
        where: { id: refundFundingId },
      });
      expect(updatedFunding?.status).toBe('REFUNDED');
      expect(updatedFunding?.refundTransactionHash).toBe('0xe2erefundtx123');

      // Cleanup
      await prisma.funding.delete({ where: { id: refundFundingId } });
    });
  });

  describe('Error handling', () => {
    it('should handle contract service errors gracefully', async () => {
      // Mock contract service to throw error
      mockContractService.createEscrow.mockRejectedValue(new Error('Contract execution failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/fundings',
        payload: {
          invoiceId: testInvoiceId,
          investorId: testInvestorId,
          amount: '100',
          buyerAddress: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        },
      });

      expect(response.statusCode).toBe(400);
      
      const responseData = JSON.parse(response.body);
      expect(responseData.error).toContain('Contract execution failed');
    });

    it('should handle database errors gracefully', async () => {
      // Mock Prisma to throw error
      const originalCreate = prisma.funding.create;
      prisma.funding.create = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/fundings',
        payload: {
          invoiceId: testInvoiceId,
          investorId: testInvestorId,
          amount: '100',
          buyerAddress: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        },
      });

      expect(response.statusCode).toBe(500);

      // Restore original method
      prisma.funding.create = originalCreate;
    });
  });
});