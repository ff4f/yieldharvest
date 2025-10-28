import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { InvoiceService, InvoiceStatus, InvoiceEventType } from '../../../src/services/invoices';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    invoice: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    invoiceEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  })),
}));

const MockedPrismaClient = PrismaClient as jest.MockedClass<typeof PrismaClient>;

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a new instance for each test
    mockPrisma = new MockedPrismaClient() as jest.Mocked<PrismaClient>;
    
    // Mock the prisma methods
    mockPrisma.invoice = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    } as any;

    mockPrisma.invoiceEvent = {
      create: jest.fn(),
    } as any;

    // Create service instance
    invoiceService = new InvoiceService();
    
    // Replace the internal prisma instance
    (invoiceService as any).prisma = mockPrisma;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAllInvoices', () => {
    it('should return paginated invoices with proof links', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-001',
          supplierId: 'supplier-1',
          amount: 1000,
          status: InvoiceStatus.ISSUED,
          nftTokenId: '0.0.123456',
          nftSerialNumber: '1',
          fileId: '0.0.789012',
          topicId: '0.0.6984577',
          createdAt: new Date(),
          updatedAt: new Date(),
          supplier: { name: 'Test Supplier' },
          buyer: { name: 'Test Buyer' },
          agent: { name: 'Test Agent' },
          events: []
        }
      ];

      mockPrisma.invoice.findMany.mockResolvedValue(mockInvoices);
      mockPrisma.invoice.count.mockResolvedValue(1);

      const result = await invoiceService.getAllInvoices(1, 10);

      expect(result.success).toBe(true);
      expect(result.data.invoices).toHaveLength(1);
      expect(result.data.invoices[0]).toHaveProperty('proofLinks');
      expect(result.data.pagination.total).toBe(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.invoice.findMany.mockRejectedValue(new Error('Database error'));

      const result = await invoiceService.getAllInvoices();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  describe('getInvoiceById', () => {
    it('should return invoice with proof links when found', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        supplierId: 'supplier-1',
        amount: 1000,
        status: InvoiceStatus.ISSUED,
        nftTokenId: '0.0.123456',
        nftSerialNumber: '1',
        fileId: '0.0.789012',
        topicId: '0.0.6984577',
        createdAt: new Date(),
        updatedAt: new Date(),
        supplier: { name: 'Test Supplier' },
        buyer: { name: 'Test Buyer' },
        agent: { name: 'Test Agent' },
        events: []
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await invoiceService.getInvoiceById('invoice-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('proofLinks');
      expect(result.data.proofLinks).toHaveProperty('nft');
      expect(result.data.proofLinks).toHaveProperty('file');
      expect(result.data.proofLinks).toHaveProperty('topic');
    });

    it('should return error when invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const result = await invoiceService.getInvoiceById('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invoice not found');
    });
  });

  describe('createInvoice', () => {
    it('should create invoice and add creation event', async () => {
      const mockInvoiceData = {
        invoiceNumber: 'INV-001',
        supplierId: 'supplier-1',
        amount: 1000,
        currency: 'USD',
        dueDate: new Date('2024-12-31'),
        description: 'Test invoice'
      };

      const mockCreatedInvoice = {
        id: 'invoice-1',
        ...mockInvoiceData,
        status: InvoiceStatus.ISSUED,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.invoice.create.mockResolvedValue(mockCreatedInvoice);
      mockPrisma.invoiceEvent.create.mockResolvedValue({
        id: 'event-1',
        invoiceId: 'invoice-1',
        eventType: InvoiceEventType.CREATED,
        createdAt: new Date()
      } as any);

      const result = await invoiceService.createInvoice(mockInvoiceData);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('invoice-1');
      expect(mockPrisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ...mockInvoiceData,
          status: InvoiceStatus.ISSUED
        })
      });
      expect(mockPrisma.invoiceEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: 'invoice-1',
          eventType: InvoiceEventType.CREATED
        })
      });
    });
  });

  describe('updateInvoiceStatus', () => {
    it('should update invoice status and add event', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        status: InvoiceStatus.FUNDED,
        updatedAt: new Date()
      };

      mockPrisma.invoice.update.mockResolvedValue(mockInvoice as any);
      mockPrisma.invoiceEvent.create.mockResolvedValue({
        id: 'event-1',
        invoiceId: 'invoice-1',
        eventType: InvoiceEventType.FUNDED,
        createdAt: new Date()
      } as any);

      const result = await invoiceService.updateInvoiceStatus(
        'invoice-1',
        InvoiceStatus.FUNDED,
        'Invoice funded successfully'
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        data: { status: InvoiceStatus.FUNDED }
      });
      expect(mockPrisma.invoiceEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: 'invoice-1',
          eventType: InvoiceEventType.FUNDED,
          description: 'Invoice funded successfully'
        })
      });
    });
  });

  describe('addInvoiceEvent', () => {
    it('should serialize metadata to JSON string', async () => {
      const mockEvent = {
        id: 'event-1',
        invoiceId: 'invoice-1',
        eventType: InvoiceEventType.FUNDED,
        metadata: '{"amount":500,"investor":"test"}',
        createdAt: new Date()
      };

      mockPrisma.invoiceEvent.create.mockResolvedValue(mockEvent as any);

      const metadata = { amount: 500, investor: 'test' };
      await invoiceService.addInvoiceEvent(
        'invoice-1',
        InvoiceEventType.FUNDED,
        'Test event',
        metadata
      );

      expect(mockPrisma.invoiceEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: JSON.stringify(metadata)
        })
      });
    });

    it('should handle null metadata', async () => {
      const mockEvent = {
        id: 'event-1',
        invoiceId: 'invoice-1',
        eventType: InvoiceEventType.FUNDED,
        metadata: null,
        createdAt: new Date()
      };

      mockPrisma.invoiceEvent.create.mockResolvedValue(mockEvent as any);

      await invoiceService.addInvoiceEvent(
        'invoice-1',
        InvoiceEventType.FUNDED,
        'Test event',
        null
      );

      expect(mockPrisma.invoiceEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: null
        })
      });
    });
  });
});