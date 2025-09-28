import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InvoiceService } from '../services/invoices';
import { InvoiceStatus, InvoiceEventType } from '../services/invoices';
import { CreateInvoiceSchema, UpdateInvoiceSchema } from '../services/invoices';

// Mock Prisma
const mockPrisma = {
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
};

// Mock Prisma - will be injected via dependency injection

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;

  beforeEach(() => {
    jest.clearAllMocks();
    invoiceService = new InvoiceService();
  });

  describe('Schema Validation', () => {
    it('should validate CreateInvoiceSchema with valid data', () => {
      const validData = {
        invoiceNumber: 'INV-001',
        supplierId: 'supplier-123',
        buyerId: 'buyer-456',
        amount: '1000.50',
        currency: 'USD',
        dueDate: '2024-12-31',
        description: 'Test invoice'
      };

      const result = CreateInvoiceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid data', () => {
      const invalidData = {
        invoiceNumber: '', // Empty invoice number
        supplierId: 'supplier-123',
        buyerId: 'buyer-456',
        amount: '-100', // Negative amount
        currency: 'INVALID', // Invalid currency
        dueDate: 'invalid-date', // Invalid date
        description: 'Test invoice'
      };

      const result = CreateInvoiceSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate UpdateInvoiceSchema', () => {
      const validData = {
        status: InvoiceStatus.FUNDED,
      };

      const result = UpdateInvoiceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('Service Methods', () => {
    it('should have getAllInvoices method', () => {
      expect(typeof invoiceService.getAllInvoices).toBe('function');
    });

    it('should have getInvoiceById method', () => {
      expect(typeof invoiceService.getInvoiceById).toBe('function');
    });

    it('should have createInvoice method', () => {
      expect(typeof invoiceService.createInvoice).toBe('function');
    });

    it('should have updateInvoice method', () => {
      expect(typeof invoiceService.updateInvoice).toBe('function');
    });

    it('should have deleteInvoice method', () => {
      expect(typeof invoiceService.deleteInvoice).toBe('function');
    });

    it('should have addInvoiceEvent method', () => {
      expect(typeof invoiceService.addInvoiceEvent).toBe('function');
    });

    it('should have updateInvoiceStatus method', () => {
      expect(typeof invoiceService.updateInvoiceStatus).toBe('function');
    });

    it('should have getInvoicesByStatus method', () => {
      expect(typeof invoiceService.getInvoicesByStatus).toBe('function');
    });
  });

  describe('Enums', () => {
    it('should have correct InvoiceStatus values', () => {
      expect(Object.values(InvoiceStatus)).toEqual([
        'ISSUED',
        'FUNDED',
        'PAID',
        'OVERDUE',
        'CANCELLED'
      ]);
    });

    it('should have correct InvoiceEventType values', () => {
      expect(Object.values(InvoiceEventType)).toEqual([
        'CREATED',
        'NFT_MINTED',
        'FILE_UPLOADED',
        'FUNDING_REQUESTED',
        'FUNDED',
        'PAYMENT_RECEIVED',
        'OVERDUE',
        'CANCELLED'
      ]);
    });
  });

  describe('Basic Functionality', () => {
    it('should initialize without errors', () => {
      expect(invoiceService).toBeInstanceOf(InvoiceService);
    });

    it('should have access to schemas', () => {
      expect(CreateInvoiceSchema).toBeDefined();
      expect(UpdateInvoiceSchema).toBeDefined();
    });
  });
});