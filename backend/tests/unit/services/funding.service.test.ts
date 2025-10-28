import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { FundingService, FundingStatus } from '../../../src/services/funding.js';

// Mock Prisma
jest.mock('@prisma/client');
const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

describe('FundingService', () => {
  let fundingService: FundingService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPrisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;
    
    mockPrisma.funding = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    } as any;

    mockPrisma.investor = {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as any;

    mockPrisma.invoice = {
      findUnique: jest.fn(),
      update: jest.fn(),
    } as any;

    fundingService = new FundingService();
    (fundingService as any).prisma = mockPrisma;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createFunding', () => {
    it('should create funding with escrow mechanism', async () => {
      const mockInvestor = {
        id: 'investor-1',
        userId: 'user-1',
        balance: 1000,
        totalInvested: 0
      };

      const mockInvoice = {
        id: 'invoice-1',
        status: 'ISSUED',
        amount: 1000,
        supplierId: 'supplier-1'
      };

      const mockFunding = {
        id: 'funding-1',
        invoiceId: 'invoice-1',
        investorId: 'investor-1',
        amount: 500,
        status: FundingStatus.ACTIVE,
        escrowId: 'mock-escrow-123',
        transactionHash: '0xabc123',
        createdAt: new Date(),
        updatedAt: new Date(),
        invoice: mockInvoice,
        investor: mockInvestor
      };

      mockPrisma.investor.findUnique.mockResolvedValue(mockInvestor as any);
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice as any);
      mockPrisma.funding.create.mockResolvedValue(mockFunding as any);
      mockPrisma.investor.update.mockResolvedValue({
        ...mockInvestor,
        balance: 500,
        totalInvested: 500
      } as any);

      const fundingData = {
        invoiceId: 'invoice-1',
        investorId: 'investor-1',
        amount: 500,
        supplierAccountId: '0.0.123456',
        nftSerialNumber: 1
      };

      const result = await fundingService.createFunding(fundingData);

      expect(result.success).toBe(true);
      expect(result.data.funding.amount).toBe(500);
      expect(result.data.escrowId).toBeDefined();
      expect(result.data.transactionHash).toBeDefined();
      expect(mockPrisma.funding.create).toHaveBeenCalled();
      expect(mockPrisma.investor.update).toHaveBeenCalledWith({
        where: { id: 'investor-1' },
        data: {
          balance: 500,
          totalInvested: 500
        }
      });
    });

    it('should handle insufficient investor balance', async () => {
      const mockInvestor = {
        id: 'investor-1',
        userId: 'user-1',
        balance: 100,
        totalInvested: 0
      };

      const mockInvoice = {
        id: 'invoice-1',
        status: 'ISSUED',
        amount: 1000,
        supplierId: 'supplier-1'
      };

      mockPrisma.investor.findUnique.mockResolvedValue(mockInvestor as any);
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice as any);

      const fundingData = {
        invoiceId: 'invoice-1',
        investorId: 'investor-1',
        amount: 500,
        supplierAccountId: '0.0.123456',
        nftSerialNumber: 1
      };

      const result = await fundingService.createFunding(fundingData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient investor balance');
      expect(mockPrisma.funding.create).not.toHaveBeenCalled();
    });

    it('should handle non-existent investor', async () => {
      mockPrisma.investor.findUnique.mockResolvedValue(null);

      const fundingData = {
        invoiceId: 'invoice-1',
        investorId: 'non-existent',
        amount: 500,
        supplierAccountId: '0.0.123456',
        nftSerialNumber: 1
      };

      const result = await fundingService.createFunding(fundingData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Investor not found');
    });

    it('should handle non-issued invoice', async () => {
      const mockInvestor = {
        id: 'investor-1',
        userId: 'user-1',
        balance: 1000,
        totalInvested: 0
      };

      const mockInvoice = {
        id: 'invoice-1',
        status: 'PAID',
        amount: 1000,
        supplierId: 'supplier-1'
      };

      mockPrisma.investor.findUnique.mockResolvedValue(mockInvestor as any);
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice as any);

      const fundingData = {
        invoiceId: 'invoice-1',
        investorId: 'investor-1',
        amount: 500,
        supplierAccountId: '0.0.123456',
        nftSerialNumber: 1
      };

      const result = await fundingService.createFunding(fundingData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice must be in ISSUED status to be funded');
    });
  });

  describe('getFundingsByInvoice', () => {
    it('should return all fundings for an invoice', async () => {
      const mockFundings = [
        {
          id: 'funding-1',
          invoiceId: 'invoice-1',
          investorId: 'investor-1',
          amount: 500,
          status: FundingStatus.ACTIVE,
          investor: { name: 'Test Investor' }
        }
      ];

      mockPrisma.funding.findMany.mockResolvedValue(mockFundings as any);

      const result = await fundingService.getFundingsByInvoice('invoice-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockPrisma.funding.findMany).toHaveBeenCalledWith({
        where: { invoiceId: 'invoice-1' },
        include: { investor: true },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should handle database errors', async () => {
      mockPrisma.funding.findMany.mockRejectedValue(new Error('Database error'));

      const result = await fundingService.getFundingsByInvoice('invoice-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getAllFundings', () => {
    it('should return paginated fundings', async () => {
      const mockFundings = [
        {
          id: 'funding-1',
          invoiceId: 'invoice-1',
          investorId: 'investor-1',
          amount: 500,
          status: FundingStatus.ACTIVE,
          invoice: { invoiceNumber: 'INV-001' },
          investor: { name: 'Test Investor' }
        }
      ];

      mockPrisma.funding.findMany.mockResolvedValue(mockFundings as any);
      mockPrisma.funding.count.mockResolvedValue(1);

      const result = await fundingService.getAllFundings(1, 10);

      expect(result.success).toBe(true);
      expect(result.data.fundings).toHaveLength(1);
      expect(result.data.pagination.total).toBe(1);
      expect(mockPrisma.funding.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('generateEscrowId', () => {
    it('should generate unique escrow ID', () => {
      const escrowId1 = (fundingService as any).generateEscrowId();
      const escrowId2 = (fundingService as any).generateEscrowId();

      expect(escrowId1).toMatch(/^mock-escrow-\d+$/);
      expect(escrowId2).toMatch(/^mock-escrow-\d+$/);
      expect(escrowId1).not.toBe(escrowId2);
    });
  });

  describe('generateTransactionHash', () => {
    it('should generate mock transaction hash', () => {
      const hash = (fundingService as any).generateTransactionHash();

      expect(hash).toMatch(/^0x[a-f0-9]+$/);
      expect(hash.length).toBeGreaterThan(10);
    });
  });
});