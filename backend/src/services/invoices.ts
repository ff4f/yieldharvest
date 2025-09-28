import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Define enums locally since they're not exported from Prisma client
export enum InvoiceStatus {
  ISSUED = 'ISSUED',
  FUNDED = 'FUNDED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export enum InvoiceEventType {
  CREATED = 'CREATED',
  NFT_MINTED = 'NFT_MINTED',
  FILE_UPLOADED = 'FILE_UPLOADED',
  FUNDING_REQUESTED = 'FUNDING_REQUESTED',
  FUNDED = 'FUNDED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

// Validation schemas
export const CreateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  supplierId: z.string().min(1),
  buyerId: z.string().optional(),
  agentId: z.string().optional(),
  amount: z.string().transform(val => parseFloat(val)),
  currency: z.string().default('HBAR'),
  dueDate: z.string().transform(val => new Date(val)),
  description: z.string().optional(),
  // Hedera fields
  nftTokenId: z.string().optional(),
  nftSerialNumber: z.string().optional(),
  fileId: z.string().optional(),
  fileHash: z.string().optional(),
  topicId: z.string().optional(),
});

export const UpdateInvoiceSchema = z.object({
  status: z.nativeEnum(InvoiceStatus).optional(),
  description: z.string().optional(),
  nftTokenId: z.string().optional(),
  nftSerialNumber: z.string().optional(),
  fileId: z.string().optional(),
  fileHash: z.string().optional(),
  topicId: z.string().optional(),
});

export type CreateInvoiceData = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceData = z.infer<typeof UpdateInvoiceSchema>;

export class InvoiceService {
  /**
   * Get all invoices with pagination
   */
  async getAllInvoices(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        skip,
        take: limit,
        include: {
          supplier: {
            select: { id: true, name: true, email: true }
          },
          agent: {
            select: { id: true, name: true, email: true }
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          fundings: {
            include: {
              investor: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.invoice.count()
    ]);

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { id: true, name: true, email: true, hederaAccountId: true }
        },
        agent: {
          select: { id: true, name: true, email: true, hederaAccountId: true }
        },
        events: {
          orderBy: { createdAt: 'desc' }
        },
        fundings: {
          include: {
            investor: {
              select: { id: true, name: true, email: true, hederaAccountId: true }
            }
          }
        }
      }
    });
  }

  /**
   * Create new invoice
   */
  async createInvoice(data: CreateInvoiceData) {
    return prisma.invoice.create({
      data: {
        invoiceNumber: data.invoiceNumber,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        agentId: data.agentId,
        amount: data.amount,
        currency: data.currency,
        dueDate: data.dueDate,
        description: data.description,
        nftTokenId: data.nftTokenId,
        nftSerialNumber: data.nftSerialNumber,
        fileId: data.fileId,
        fileHash: data.fileHash,
        topicId: data.topicId,
      },
      include: {
        supplier: {
          select: { id: true, name: true, email: true }
        },
        agent: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  /**
   * Update invoice
   */
  async updateInvoice(id: string, data: UpdateInvoiceData) {
    return prisma.invoice.update({
      where: { id },
      data,
      include: {
        supplier: {
          select: { id: true, name: true, email: true }
        },
        agent: {
          select: { id: true, name: true, email: true }
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });
  }

  /**
   * Delete invoice
   */
  async deleteInvoice(id: string) {
    return prisma.invoice.delete({
      where: { id }
    });
  }

  /**
   * Add invoice event (for HCS tracking)
   */
  async addInvoiceEvent(
    invoiceId: string,
    eventType: InvoiceEventType,
    description?: string,
    metadata?: any,
    hcsMessageId?: string,
    hcsTimestamp?: Date,
    transactionId?: string
  ) {
    return prisma.invoiceEvent.create({
      data: {
        invoiceId,
        eventType,
        description,
        metadata,
        hcsMessageId,
        hcsTimestamp,
        transactionId
      }
    });
  }

  /**
   * Get invoices by supplier
   */
  async getInvoicesBySupplier(supplierId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { supplierId },
        skip,
        take: limit,
        include: {
          agent: {
            select: { id: true, name: true, email: true }
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 3
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.invoice.count({ where: { supplierId } })
    ]);

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get invoices by status
   */
  async getInvoicesByStatus(status: InvoiceStatus, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { status },
        skip,
        take: limit,
        include: {
          supplier: {
            select: { id: true, name: true, email: true }
          },
          agent: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.invoice.count({ where: { status } })
    ]);

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update invoice status and create event
   */
  async updateInvoiceStatus(
    id: string,
    status: InvoiceStatus,
    description?: string,
    hcsMessageId?: string,
    transactionId?: string
  ) {
    const [updatedInvoice] = await Promise.all([
      this.updateInvoice(id, { status }),
      this.addInvoiceEvent(
        id,
        this.getEventTypeFromStatus(status),
        description,
        { status, previousStatus: status },
        hcsMessageId,
        new Date(),
        transactionId
      )
    ]);

    return updatedInvoice;
  }

  /**
   * Helper to map status to event type
   */
  private getEventTypeFromStatus(status: InvoiceStatus): InvoiceEventType {
    switch (status) {
      case InvoiceStatus.ISSUED:
        return InvoiceEventType.CREATED;
      case InvoiceStatus.FUNDED:
        return InvoiceEventType.FUNDED;
      case InvoiceStatus.PAID:
        return InvoiceEventType.PAYMENT_RECEIVED;
      case InvoiceStatus.OVERDUE:
        return InvoiceEventType.OVERDUE;
      case InvoiceStatus.CANCELLED:
        return InvoiceEventType.CANCELLED;
      default:
        return InvoiceEventType.CREATED;
    }
  }
}

export const invoiceService = new InvoiceService();