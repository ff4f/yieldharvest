import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InvoiceDataMerger } from '../services/invoiceDataMerger';

// Mock dependencies
jest.mock('../services/mirrorNodeService', () => ({
  mirrorNodeService: {
    getNFTsByToken: jest.fn(),
    getNFTInfo: jest.fn(),
    getHCSMessages: jest.fn(),
    parseInvoiceMessages: jest.fn(),
    getInvoiceMessages: jest.fn(),
  },
}));

jest.mock('../services/cacheService', () => ({
  mirrorNodeCache: {
    getOrSet: jest.fn(),
  },
  CacheKeys: {
    invoiceMessages: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockLogger = require('../utils/logger').logger;

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    invoice: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
  };
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
  };
});

describe('InvoiceDataMerger', () => {
  let invoiceDataMerger: InvoiceDataMerger;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    invoiceDataMerger = new InvoiceDataMerger();
    // Access the mocked Prisma instance
    const { PrismaClient } = require('@prisma/client');
    mockPrisma = new PrismaClient();
  });

  describe('getDetailedInvoice', () => {
    it('should return null when invoice not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      
      const result = await invoiceDataMerger.getDetailedInvoice('0.0.123456', 1);
      
      expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            nftTokenId: '0.0.123456',
            nftSerialNumber: '1'
          }
        })
      );
      expect(result).toBeNull();
    });

    it('should get detailed invoice with NFT data', async () => {
      const mockInvoice = {
         id: 1,
         nftTokenId: '0.0.123456',
         nftSerialNumber: '1',
         amount: 1000,
         status: 'ISSUED' as const,
         supplierId: 'supplier-1',
         agentId: 'agent-1',
         createdAt: new Date(),
         updatedAt: new Date()
       };

      const mockNftData = {
        token_id: '0.0.123456',
        serial_number: 1,
        account_id: '0.0.789',
        metadata: 'base64data'
      };

      mockPrisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      const { mirrorNodeService } = require('../services/mirrorNodeService');
      mirrorNodeService.getNFTInfo.mockResolvedValue(mockNftData);

      const result = await invoiceDataMerger.getDetailedInvoice('0.0.123456', 1);

       expect(result).toEqual({
         ...mockInvoice,
         onChainData: expect.any(Object)
       });
      expect(mockPrisma.invoice.findFirst).toHaveBeenCalled();
    });

    it('should call findFirst with correct parameters', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      
      await invoiceDataMerger.getDetailedInvoice('0.0.123456', 1);
      
      expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            nftTokenId: '0.0.123456',
            nftSerialNumber: '1',
          }
        })
      );
    });
  });

  describe('getEnrichedInvoices', () => {
    it('should return paginated results with correct structure', async () => {
      const mockInvoices = [
        {
          id: '1',
          invoiceNumber: 'INV-001',
          tokenId: '0.0.123456',
          serialNumber: '1',
          amount: '1000.00',
          currency: 'USD',
          status: 'ISSUED',
          supplier: { id: '1', name: 'Supplier 1', email: 'supplier@test.com' },
          events: [],
          fundings: [],
        },
      ];

      const mockTotal = 1;
      const mockStatusCounts = [{ status: 'ISSUED', _count: { status: 1 } }];
      const mockTotalValue = { _sum: { amount: 1000 } };

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(mockTotal);
      mockPrisma.invoice.groupBy.mockResolvedValue(mockStatusCounts);
      mockPrisma.invoice.aggregate.mockResolvedValue(mockTotalValue);

      const result = await invoiceDataMerger.getEnrichedInvoices(1, 10, {});

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.pages).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });

    it('should apply filters correctly', async () => {
      const filters = { status: 'PAID', supplierId: 'supplier-1' };
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.groupBy.mockResolvedValue([]);
      mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      const result = await invoiceDataMerger.getEnrichedInvoices(1, 10, filters);

      expect(mockPrisma.invoice.findMany).toHaveBeenCalled();
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      mockPrisma.invoice.count.mockResolvedValue(0);
      mockPrisma.invoice.groupBy.mockResolvedValue([]);
      mockPrisma.invoice.aggregate.mockResolvedValue({ _sum: { amount: 0 } });

      await invoiceDataMerger.getEnrichedInvoices(2, 5, {});

      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5, // (page - 1) * limit = (2 - 1) * 5
          take: 5,
        })
      );
    });
  });

  describe('constructor', () => {
    it('should create an instance successfully', () => {
      const merger = new InvoiceDataMerger();
      expect(merger).toBeInstanceOf(InvoiceDataMerger);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.invoice.findFirst.mockRejectedValue(dbError);
      
      // Mock mirrorNodeService to also throw error
      const { mirrorNodeService } = require('../services/mirrorNodeService');
      mirrorNodeService.getNFTInfo.mockRejectedValue(dbError);

      await expect(invoiceDataMerger.getDetailedInvoice('0.0.123456', 1))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle pagination errors gracefully', async () => {
      const dbError = new Error('Query failed');
      mockPrisma.invoice.findMany.mockRejectedValue(dbError);

      await expect(invoiceDataMerger.getEnrichedInvoices(1, 10, {}))
        .rejects.toThrow('Query failed');
    });
  });
});