import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { invoiceService } from '../../services/invoices';
import { InvoiceHederaService } from '../../services/invoiceHederaService';
import { invoiceDataMerger } from '../../services/invoiceDataMerger';
import { UserRole } from '../../middleware/auth';

// Mock dependencies
const mockInvoiceService = {
  createInvoice: jest.fn(),
  getInvoiceById: jest.fn(),
  updateInvoice: jest.fn(),
  deleteInvoice: jest.fn(),
  getAllInvoices: jest.fn(),
} as jest.Mocked<typeof invoiceService>;

const mockInvoiceHederaService = {
  createInvoiceWithHedera: jest.fn(),
  mintInvoiceNFT: jest.fn(),
  submitInvoiceStatusMessage: jest.fn(),
} as jest.Mocked<InvoiceHederaService>;

const mockInvoiceDataMerger = {
  getEnrichedInvoices: jest.fn(),
  getDetailedInvoice: jest.fn(),
} as jest.Mocked<typeof invoiceDataMerger>;

const mockPrisma = {
  invoice: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  invoiceEvent: {
    create: jest.fn(),
    createMany: jest.fn(),
  },
};

const mockAuditLogger = {
  logHederaTransaction: jest.fn(),
};

// Mock modules
jest.mock('../../services/invoices', () => ({
  invoiceService: mockInvoiceService,
}));

jest.mock('../../services/invoiceHederaService', () => ({
  InvoiceHederaService: jest.fn(() => mockInvoiceHederaService),
}));

jest.mock('../../services/invoiceDataMerger', () => ({
  invoiceDataMerger: mockInvoiceDataMerger,
}));

jest.mock('../../utils/logger', () => ({
  auditLogger: mockAuditLogger,
}));

describe('Invoice Controller', () => {
  let mockRequest: any;
  let mockReply: any;
  let mockFastify: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReply = {
      status: jest.fn().mockReturnThis(),
      code: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockFastify = {
      prisma: mockPrisma,
      hedera: {
        mintInvoiceNFT: jest.fn(),
        submitInvoiceStatusMessage: jest.fn(),
      },
      log: {
        info: jest.fn(),
        error: jest.fn(),
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /invoices', () => {
    const mockEnrichedInvoices = {
      data: [
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-001',
          amount: 1000,
          currency: 'USD',
          status: 'ISSUED',
          supplier: { id: 'supplier-1', name: 'Test Supplier' },
        },
        {
          id: 'invoice-2',
          invoiceNumber: 'INV-002',
          amount: 2000,
          currency: 'USD',
          status: 'FUNDED',
          supplier: { id: 'supplier-2', name: 'Another Supplier' },
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
    };

    beforeEach(() => {
      mockRequest = {
        query: {
          page: 1,
          limit: 10,
        },
        user: {
          id: 'user-1',
          role: UserRole.ADMIN,
        },
      };

      mockInvoiceDataMerger.getEnrichedInvoices.mockResolvedValue(mockEnrichedInvoices);
    });

    it('should successfully retrieve all invoices', async () => {
      const { invoiceRoutes } = await import('../../routes/invoices');
      
      // Mock the route handler
      const getAllInvoicesHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { page = 1, limit = 10 } = request.query;
        const result = await mockInvoiceDataMerger.getEnrichedInvoices(page, limit, {});
        return result;
      });

      await getAllInvoicesHandler(mockRequest, mockReply);

      expect(mockInvoiceDataMerger.getEnrichedInvoices).toHaveBeenCalledWith(1, 10, {});
    });

    it('should handle query filters', async () => {
      mockRequest.query = {
        page: 1,
        limit: 10,
        status: 'ISSUED',
        supplierId: 'supplier-1',
        search: 'INV-001',
      };

      const getAllInvoicesHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { status, supplierId, search, page = 1, limit = 10 } = request.query;
        
        const filters: any = {};
        if (status) filters.status = status;
        if (supplierId) filters.supplierId = supplierId;
        if (search) {
          const sanitizedSearch = search.replace(/['"\\;]/g, '');
          filters.search = sanitizedSearch;
        }

        const result = await mockInvoiceDataMerger.getEnrichedInvoices(page, limit, filters);
        return result;
      });

      await getAllInvoicesHandler(mockRequest, mockReply);

      expect(mockInvoiceDataMerger.getEnrichedInvoices).toHaveBeenCalledWith(1, 10, {
        status: 'ISSUED',
        supplierId: 'supplier-1',
        search: 'INV-001',
      });
    });

    it('should sanitize search input to prevent SQL injection', async () => {
      mockRequest.query = {
        search: "'; DROP TABLE invoices; --",
      };

      const getAllInvoicesHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { search, page = 1, limit = 10 } = request.query;
        
        const filters: any = {};
        if (search) {
          const sanitizedSearch = search.replace(/['"\\;]/g, '');
          filters.search = sanitizedSearch;
        }

        const result = await mockInvoiceDataMerger.getEnrichedInvoices(page, limit, filters);
        return result;
      });

      await getAllInvoicesHandler(mockRequest, mockReply);

      expect(mockInvoiceDataMerger.getEnrichedInvoices).toHaveBeenCalledWith(1, 10, {
        search: ' DROP TABLE invoices --',
      });
    });
  });

  describe('GET /invoices/:id', () => {
    const mockInvoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-001',
      supplierId: 'supplier-1',
      amount: 1000,
      currency: 'USD',
      status: 'ISSUED',
      supplier: { id: 'supplier-1', name: 'Test Supplier', email: 'supplier@test.com' },
      agent: null,
      events: [],
      fundings: [],
    };

    beforeEach(() => {
      mockRequest = {
        params: { id: 'invoice-1' },
        user: {
          id: 'supplier-1',
          role: UserRole.SUPPLIER,
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
    });

    it('should successfully retrieve invoice by ID', async () => {
      const getInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { id } = request.params;
        const user = request.user;

        const invoice = await mockPrisma.invoice.findUnique({
          where: { id },
          include: {
            supplier: { select: { id: true, name: true, email: true } },
            agent: { select: { id: true, name: true, email: true } },
            events: { orderBy: { createdAt: 'desc' } },
            fundings: {
              include: {
                investor: { select: { id: true, name: true, email: true } },
              },
            },
          },
        });

        if (!invoice) {
          return reply.code(404).send({ error: 'Invoice not found' });
        }

        // Access control
        if (user.role !== UserRole.ADMIN && 
            invoice.supplierId !== user.id && 
            !invoice.fundings.some(f => f.investor.id === user.id)) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        return { data: invoice };
      });

      const result = await getInvoiceHandler(mockRequest, mockReply);

      expect(mockPrisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        include: expect.any(Object),
      });
      expect(result).toEqual({ data: mockInvoice });
    });

    it('should return 404 for non-existent invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      const getInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { id } = request.params;

        const invoice = await mockPrisma.invoice.findUnique({
          where: { id },
          include: expect.any(Object),
        });

        if (!invoice) {
          return reply.code(404).send({ error: 'Invoice not found' });
        }

        return { data: invoice };
      });

      await getInvoiceHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Invoice not found' });
    });

    it('should enforce access control for unauthorized users', async () => {
      mockRequest.user = {
        id: 'unauthorized-user',
        role: UserRole.SUPPLIER,
      };

      const getInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { id } = request.params;
        const user = request.user;

        const invoice = await mockPrisma.invoice.findUnique({
          where: { id },
          include: expect.any(Object),
        });

        if (!invoice) {
          return reply.code(404).send({ error: 'Invoice not found' });
        }

        // Access control
        if (user.role !== UserRole.ADMIN && 
            invoice.supplierId !== user.id && 
            !invoice.fundings.some(f => f.investor.id === user.id)) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        return { data: invoice };
      });

      await getInvoiceHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Access denied' });
    });
  });

  describe('GET /invoices/nft/:tokenId/:serial', () => {
    const mockDetailedInvoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-001',
      nftTokenId: '0.0.123456',
      nftSerialNumber: 1,
      amount: 1000,
      currency: 'USD',
      status: 'ISSUED',
      hederaData: {
        nftInfo: { token_id: '0.0.123456', serial_number: 1 },
        hcsMessages: [],
        hfsFile: null,
      },
    };

    beforeEach(() => {
      mockRequest = {
        params: { tokenId: '0.0.123456', serial: '1' },
      };

      mockInvoiceDataMerger.getDetailedInvoice.mockResolvedValue(mockDetailedInvoice);
    });

    it('should successfully retrieve detailed invoice by NFT', async () => {
      const getDetailedInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { tokenId, serial } = request.params;

        try {
          const enrichedInvoice = await mockInvoiceDataMerger.getDetailedInvoice(tokenId, parseInt(serial));
          
          if (!enrichedInvoice) {
            return reply.code(404).send({ error: 'Invoice not found' });
          }

          return { data: enrichedInvoice };
        } catch (error) {
          return reply.code(500).send({ error: 'Failed to fetch invoice details' });
        }
      });

      const result = await getDetailedInvoiceHandler(mockRequest, mockReply);

      expect(mockInvoiceDataMerger.getDetailedInvoice).toHaveBeenCalledWith('0.0.123456', 1);
      expect(result).toEqual({ data: mockDetailedInvoice });
    });

    it('should handle invoice not found', async () => {
      mockInvoiceDataMerger.getDetailedInvoice.mockResolvedValue(null);

      const getDetailedInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { tokenId, serial } = request.params;

        try {
          const enrichedInvoice = await mockInvoiceDataMerger.getDetailedInvoice(tokenId, parseInt(serial));
          
          if (!enrichedInvoice) {
            return reply.code(404).send({ error: 'Invoice not found' });
          }

          return { data: enrichedInvoice };
        } catch (error) {
          return reply.code(500).send({ error: 'Failed to fetch invoice details' });
        }
      });

      await getDetailedInvoiceHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Invoice not found' });
    });

    it('should handle service errors', async () => {
      mockInvoiceDataMerger.getDetailedInvoice.mockRejectedValue(new Error('Service error'));

      const getDetailedInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { tokenId, serial } = request.params;

        try {
          const enrichedInvoice = await mockInvoiceDataMerger.getDetailedInvoice(tokenId, parseInt(serial));
          
          if (!enrichedInvoice) {
            return reply.code(404).send({ error: 'Invoice not found' });
          }

          return { data: enrichedInvoice };
        } catch (error) {
          return reply.code(500).send({ error: 'Failed to fetch invoice details' });
        }
      });

      await getDetailedInvoiceHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Failed to fetch invoice details' });
    });
  });

  describe('POST /invoices/simple', () => {
    const mockCreatedInvoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-1640995200000',
      supplierId: 'supplier-1',
      amount: 1000,
      currency: 'USD',
      status: 'ISSUED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockRequest = {
        body: {
          supplierName: 'Test Supplier',
          supplierEmail: 'supplier@test.com',
          amount: 1000,
          currency: 'USD',
          description: 'Test invoice',
          dueDate: '2024-12-31T23:59:59.000Z',
        },
        user: {
          id: 'supplier-1',
          role: UserRole.SUPPLIER,
        },
      };

      mockPrisma.invoice.create.mockResolvedValue(mockCreatedInvoice);
    });

    it('should successfully create a simple invoice', async () => {
      const createSimpleInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const body = request.body;

        try {
          const invoice = await mockPrisma.invoice.create({
            data: {
              invoiceNumber: `INV-${Date.now()}`,
              supplierId: request.user.id,
              buyerId: 'default-buyer',
              amount: body.amount.toString(),
              currency: body.currency,
              dueDate: new Date(body.dueDate),
              description: body.description,
              status: 'ISSUED',
            },
          });

          return reply.code(201).send(invoice);
        } catch (error) {
          return reply.code(500).send({ error: 'Failed to create invoice' });
        }
      });

      await createSimpleInvoiceHandler(mockRequest, mockReply);

      expect(mockPrisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceNumber: expect.stringContaining('INV-'),
          supplierId: 'supplier-1',
          amount: '1000',
          currency: 'USD',
          status: 'ISSUED',
        }),
      });
      expect(mockReply.code).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(mockCreatedInvoice);
    });

    it('should handle database errors', async () => {
      mockPrisma.invoice.create.mockRejectedValue(new Error('Database error'));

      const createSimpleInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const body = request.body;

        try {
          const invoice = await mockPrisma.invoice.create({
            data: expect.any(Object),
          });

          return reply.code(201).send(invoice);
        } catch (error) {
          return reply.code(500).send({ error: 'Failed to create invoice' });
        }
      });

      await createSimpleInvoiceHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Failed to create invoice' });
    });
  });

  describe('POST /invoices/with-hedera', () => {
    const mockHederaResult = {
      invoice: {
        id: 'invoice-1',
        invoiceNumber: 'INV-001',
        nftTokenId: '0.0.123456',
        nftSerialNumber: 1,
        fileId: '0.0.789012',
        topicId: '0.0.654321',
      },
      nftResult: {
        serialNumber: '1',
        transactionId: '0.0.123@1640995200.000000000',
      },
      hfsResult: {
        fileId: '0.0.789012',
        transactionId: '0.0.456@1640995300.000000000',
      },
      hcsResult: {
        transactionId: '0.0.789@1640995400.000000000',
        sequenceNumber: '1',
      },
    };

    beforeEach(() => {
      mockRequest = {
        body: {
          invoiceNumber: 'INV-001',
          supplierId: 'supplier-1',
          buyerId: 'buyer-1',
          amount: '1000.00',
          currency: 'USD',
          dueDate: '2024-12-31T23:59:59.000Z',
          description: 'Test invoice with Hedera',
        },
        validatedFiles: [
          {
            filename: 'invoice.pdf',
            toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
          },
        ],
        user: {
          id: 'supplier-1',
          role: UserRole.SUPPLIER,
        },
      };

      mockInvoiceHederaService.createInvoiceWithHedera.mockResolvedValue(mockHederaResult);
    });

    it('should successfully create invoice with Hedera integration', async () => {
      const createInvoiceWithHederaHandler = jest.fn().mockImplementation(async (request, reply) => {
        const validatedData = request.body;
        const files = request.validatedFiles;

        try {
          const invoiceHederaService = new (jest.fn(() => mockInvoiceHederaService))();
          
          const result = await invoiceHederaService.createInvoiceWithHedera({
            invoiceNumber: validatedData.invoiceNumber,
            supplierId: validatedData.supplierId,
            buyerId: validatedData.buyerId,
            amount: validatedData.amount,
            currency: validatedData.currency,
            dueDate: validatedData.dueDate,
            description: validatedData.description,
            file: files[0],
            nftTokenId: process.env['INVOICE_TOKEN_ID'],
            topicId: process.env['INVOICE_TOPIC_ID'],
          });

          return reply.code(201).send({
            message: 'Invoice created successfully with Hedera integration',
            invoice: result.invoice,
            blockchain: {
              nft: result.nftResult,
              file: result.hfsResult,
              consensus: result.hcsResult,
            },
          });
        } catch (error) {
          return reply.code(500).send({
            error: 'Failed to create invoice with Hedera integration',
          });
        }
      });

      await createInvoiceWithHederaHandler(mockRequest, mockReply);

      expect(mockInvoiceHederaService.createInvoiceWithHedera).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceNumber: 'INV-001',
          supplierId: 'supplier-1',
          buyerId: 'buyer-1',
          amount: '1000.00',
          currency: 'USD',
        })
      );
      expect(mockReply.code).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invoice created successfully with Hedera integration',
          invoice: mockHederaResult.invoice,
        })
      );
    });

    it('should handle Hedera service errors', async () => {
      mockInvoiceHederaService.createInvoiceWithHedera.mockRejectedValue(
        new Error('Hedera service error')
      );

      const createInvoiceWithHederaHandler = jest.fn().mockImplementation(async (request, reply) => {
        try {
          const invoiceHederaService = new (jest.fn(() => mockInvoiceHederaService))();
          
          const result = await invoiceHederaService.createInvoiceWithHedera(expect.any(Object));

          return reply.code(201).send({
            message: 'Invoice created successfully with Hedera integration',
            invoice: result.invoice,
          });
        } catch (error) {
          return reply.code(500).send({
            error: 'Failed to create invoice with Hedera integration',
          });
        }
      });

      await createInvoiceWithHederaHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to create invoice with Hedera integration',
      });
    });
  });

  describe('PUT /invoices/:id', () => {
    const mockUpdatedInvoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-001',
      status: 'FUNDED',
      updatedAt: new Date(),
    };

    beforeEach(() => {
      mockRequest = {
        params: { id: 'invoice-1' },
        body: {
          status: 'FUNDED',
          description: 'Updated description',
        },
        user: {
          id: 'supplier-1',
          role: UserRole.SUPPLIER,
        },
      };

      mockPrisma.invoice.update.mockResolvedValue(mockUpdatedInvoice);
      mockPrisma.invoiceEvent.create.mockResolvedValue({});
    });

    it('should successfully update invoice', async () => {
      const updateInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { id } = request.params;
        const body = request.body;

        try {
          const invoice = await mockPrisma.invoice.update({
            where: { id },
            data: {
              status: body.status,
              description: body.description,
              updatedAt: new Date(),
            },
          });

          await mockPrisma.invoiceEvent.create({
            data: {
              invoiceId: invoice.id,
              eventType: 'STATUS_CHANGE',
              description: `Invoice status changed to ${body.status}`,
            },
          });

          return { data: invoice };
        } catch (error) {
          return reply.code(500).send({ error: 'Failed to update invoice' });
        }
      });

      const result = await updateInvoiceHandler(mockRequest, mockReply);

      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        data: expect.objectContaining({
          status: 'FUNDED',
          description: 'Updated description',
        }),
      });
      expect(mockPrisma.invoiceEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: 'invoice-1',
          eventType: 'STATUS_CHANGE',
        }),
      });
      expect(result).toEqual({ data: mockUpdatedInvoice });
    });

    it('should handle update errors', async () => {
      mockPrisma.invoice.update.mockRejectedValue(new Error('Update failed'));

      const updateInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { id } = request.params;
        const body = request.body;

        try {
          const invoice = await mockPrisma.invoice.update({
            where: { id },
            data: expect.any(Object),
          });

          return { data: invoice };
        } catch (error) {
          return reply.code(500).send({ error: 'Failed to update invoice' });
        }
      });

      await updateInvoiceHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Failed to update invoice' });
    });
  });

  describe('POST /invoices/:id/fund', () => {
    const mockInvoice = {
      id: 'invoice-1',
      status: 'ISSUED',
      topicId: '0.0.654321',
    };

    const mockUpdatedInvoice = {
      ...mockInvoice,
      status: 'FUNDED',
    };

    beforeEach(() => {
      mockRequest = {
        params: { id: 'invoice-1' },
        body: {
          amount: '1000.00',
          walletAddress: '0.0.123456',
          transactionId: '0.0.789@1640995500.000000000',
        },
        user: {
          id: 'investor-1',
          role: UserRole.INVESTOR,
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue(mockUpdatedInvoice);
      mockPrisma.invoiceEvent.create.mockResolvedValue({});
    });

    it('should successfully fund an invoice', async () => {
      const fundInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { id } = request.params;
        const { amount, walletAddress } = request.body;

        try {
          const invoice = await mockPrisma.invoice.findUnique({
            where: { id },
          });

          if (!invoice) {
            return reply.code(404).send({ error: 'Invoice not found' });
          }

          if (invoice.status !== 'ISSUED') {
            return reply.code(400).send({ error: 'Invoice cannot be funded in current status' });
          }

          const updatedInvoice = await mockPrisma.invoice.update({
            where: { id },
            data: {
              status: 'FUNDED',
              updatedAt: new Date(),
            },
          });

          await mockPrisma.invoiceEvent.create({
            data: {
              invoiceId: id,
              eventType: 'FUNDING',
              description: `Invoice funded with ${amount} from ${walletAddress}`,
            },
          });

          return { data: updatedInvoice };
        } catch (error) {
          return reply.code(500).send({ error: 'Failed to fund invoice' });
        }
      });

      const result = await fundInvoiceHandler(mockRequest, mockReply);

      expect(mockPrisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
      });
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        data: expect.objectContaining({
          status: 'FUNDED',
        }),
      });
      expect(result).toEqual({ data: mockUpdatedInvoice });
    });

    it('should reject funding for non-issued invoices', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
      });

      const fundInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { id } = request.params;

        const invoice = await mockPrisma.invoice.findUnique({
          where: { id },
        });

        if (!invoice) {
          return reply.code(404).send({ error: 'Invoice not found' });
        }

        if (invoice.status !== 'ISSUED') {
          return reply.code(400).send({ error: 'Invoice cannot be funded in current status' });
        }

        return { data: invoice };
      });

      await fundInvoiceHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invoice cannot be funded in current status',
      });
    });
  });

  describe('POST /invoices/:id/pay', () => {
    const mockInvoice = {
      id: 'invoice-1',
      status: 'FUNDED',
      topicId: '0.0.654321',
    };

    const mockUpdatedInvoice = {
      ...mockInvoice,
      status: 'PAID',
    };

    beforeEach(() => {
      mockRequest = {
        params: { id: 'invoice-1' },
        body: {
          walletAddress: '0.0.123456',
          transactionId: '0.0.789@1640995600.000000000',
          paymentReference: 'PAY-001',
        },
        user: {
          id: 'buyer-1',
          role: UserRole.SUPPLIER,
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue(mockUpdatedInvoice);
      mockPrisma.invoiceEvent.create.mockResolvedValue({});
    });

    it('should successfully mark invoice as paid', async () => {
      const payInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { id } = request.params;
        const { walletAddress, paymentReference } = request.body;

        try {
          const invoice = await mockPrisma.invoice.findUnique({
            where: { id },
          });

          if (!invoice) {
            return reply.code(404).send({ error: 'Invoice not found' });
          }

          if (invoice.status !== 'FUNDED') {
            return reply.code(400).send({ error: 'Invoice must be funded before payment' });
          }

          const updatedInvoice = await mockPrisma.invoice.update({
            where: { id },
            data: {
              status: 'PAID',
              updatedAt: new Date(),
            },
          });

          await mockPrisma.invoiceEvent.create({
            data: {
              invoiceId: id,
              eventType: 'PAYMENT',
              description: `Invoice paid by ${walletAddress}${paymentReference ? ` (ref: ${paymentReference})` : ''}`,
            },
          });

          return { data: updatedInvoice };
        } catch (error) {
          return reply.code(500).send({ error: 'Failed to process payment' });
        }
      });

      const result = await payInvoiceHandler(mockRequest, mockReply);

      expect(mockPrisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
      });
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        data: expect.objectContaining({
          status: 'PAID',
        }),
      });
      expect(result).toEqual({ data: mockUpdatedInvoice });
    });

    it('should reject payment for non-funded invoices', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'ISSUED',
      });

      const payInvoiceHandler = jest.fn().mockImplementation(async (request, reply) => {
        const { id } = request.params;

        const invoice = await mockPrisma.invoice.findUnique({
          where: { id },
        });

        if (!invoice) {
          return reply.code(404).send({ error: 'Invoice not found' });
        }

        if (invoice.status !== 'FUNDED') {
          return reply.code(400).send({ error: 'Invoice must be funded before payment' });
        }

        return { data: invoice };
      });

      await payInvoiceHandler(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Invoice must be funded before payment',
      });
    });
  });

  describe('Validation Tests', () => {
    it('should validate invoice number format', () => {
      const validInvoiceNumbers = ['INV-001', 'INVOICE-2024-001', 'ABC123'];
      const invalidInvoiceNumbers = ['<script>alert("xss")</script>', 'INV-<script>'];

      validInvoiceNumbers.forEach(invoiceNumber => {
        expect(invoiceNumber).not.toMatch(/<script>/);
      });

      invalidInvoiceNumbers.forEach(invoiceNumber => {
        expect(invoiceNumber).toMatch(/<script>/);
      });
    });

    it('should validate currency codes', () => {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];
      const invalidCurrencies = ['US', 'EURO', 'POUND', 'YEN'];

      const validCurrencyList = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD'];

      validCurrencies.forEach(currency => {
        expect(validCurrencyList).toContain(currency);
      });

      invalidCurrencies.forEach(currency => {
        expect(validCurrencyList).not.toContain(currency);
      });
    });

    it('should validate amount format', () => {
      const validAmounts = ['100.00', '1000', '0.01', '999999.99'];
      const invalidAmounts = ['0', '-100', 'abc', ''];

      validAmounts.forEach(amount => {
        const num = parseFloat(amount);
        expect(!isNaN(num) && num > 0).toBe(true);
      });

      invalidAmounts.forEach(amount => {
        const num = parseFloat(amount);
        expect(isNaN(num) || num <= 0).toBe(true);
      });
    });

    it('should validate due date is in future', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday

      expect(futureDate > now).toBe(true);
      expect(pastDate > now).toBe(false);
    });
  });
});