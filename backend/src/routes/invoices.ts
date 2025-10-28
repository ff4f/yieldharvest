import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';
import { invoiceService, CreateInvoiceSchema, UpdateInvoiceSchema, InvoiceStatus } from '../services/invoices';
import { InvoiceHederaService } from '../services/invoiceHederaService';
import { HederaService } from '../services/hedera';
import { invoiceController } from '../controllers/invoiceController';
import { walletJwtGuard, walletSupplierGuard, walletInvestorGuard, walletAdminGuard } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Schema definitions
const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).refine((val) => {
    const pattern = /^[A-Z]{2,4}-\d{3,6}$/;
    return pattern.test(val);
  }, { message: "Invalid invoice number format" }),
  supplierId: z.string().min(1),
  buyerId: z.string().min(1),
  agentId: z.string().optional(),
  amount: z.string().min(1).refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, { message: "Amount must be a positive number" }),
  currency: z.string().min(3).max(3).refine((val) => {
    const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
    return validCurrencies.includes(val.toUpperCase());
  }, { message: "Invalid currency format" }),
  dueDate: z.string().datetime().refine((date) => {
    const dueDate = new Date(date);
    const now = new Date();
    return dueDate > now;
  }, { message: "Due date must be in the future" }),
  description: z.string().optional().transform((desc) => {
    if (!desc || desc.trim() === '') {
      return undefined;
    }
    return desc.trim();
  }),
});

const createInvoiceWithFileSchema = z.object({
  invoiceNumber: z.string().min(1),
  supplierId: z.string().min(1),
  buyerId: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().min(3).max(3),
  dueDate: z.string().datetime(),
  description: z.string().optional(),
});

const updateInvoiceSchema = z.object({
  status: z.enum(['ISSUED', 'FUNDED', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  agentId: z.string().optional(),
  description: z.string().optional(),
});

export async function invoiceRoutes(fastify: FastifyInstance, options: FastifyPluginOptions) {
  const hederaService = new HederaService({
    operatorId: process.env.HEDERA_OPERATOR_ID!,
    operatorKey: process.env.HEDERA_OPERATOR_KEY!,
    network: process.env.HEDERA_NETWORK || 'testnet',
    mirrorNodeUrl: process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com'
  });

  const invoiceHederaService = new InvoiceHederaService(hederaService, invoiceService);

  // Get all invoices
  fastify.get('/', {
    preHandler: [walletJwtGuard]
  }, async (request, reply) => {
    try {
      const invoices = await invoiceService.getAllInvoices();
      return reply.send({ data: invoices });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to fetch invoices');
      return reply.code(500).send({ error: 'Failed to fetch invoices' });
    }
  });

  // Get invoice by ID
  fastify.get('/:id', {
    preHandler: [walletJwtGuard],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const invoice = await invoiceService.getInvoiceById(id);
      
      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }
      
      return reply.send({ data: invoice });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to fetch invoice');
      return reply.code(500).send({ error: 'Failed to fetch invoice' });
    }
  });

  // Create invoice
  fastify.post('/', {
    preHandler: [walletSupplierGuard],
    schema: {
      body: {
        type: 'object',
        properties: {
          invoiceNumber: { type: 'string', minLength: 1 },
          supplierId: { type: 'string', minLength: 1 },
          buyerId: { type: 'string', minLength: 1 },
          amount: { type: 'string', minLength: 1 },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          dueDate: { type: 'string', format: 'date-time' },
          description: { type: 'string' }
        },
        required: ['invoiceNumber', 'supplierId', 'buyerId', 'amount', 'currency', 'dueDate']
      }
    }
  }, async (request, reply) => {
    try {
      const validatedData = request.body as any;
      
      const invoice = await invoiceService.createInvoice({
        ...validatedData,
        dueDate: new Date(validatedData.dueDate),
        amount: parseFloat(validatedData.amount),
        status: InvoiceStatus.ISSUED
      });

      return reply.code(201).send({ data: invoice });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to create invoice');
      return reply.code(500).send({ error: 'Failed to create invoice' });
    }
  });

  // Update invoice
  fastify.put('/:id', {
    preHandler: [walletSupplierGuard],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ISSUED', 'FUNDED', 'PAID', 'OVERDUE', 'CANCELLED'] },
          agentId: { type: 'string' },
          description: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updateData = request.body as any;
      
      const invoice = await invoiceService.updateInvoice(id, updateData);
      
      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }
      
      return reply.send({ data: invoice });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to update invoice');
      return reply.code(500).send({ error: 'Failed to update invoice' });
    }
  });

  // Delete invoice
  fastify.delete('/:id', {
    preHandler: [walletSupplierGuard],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 }
        },
        required: ['id']
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const deleted = await invoiceService.deleteInvoice(id);
      
      if (!deleted) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }
      
      return reply.code(204).send();
    } catch (error) {
      fastify.log.error({ error }, 'Failed to delete invoice');
      return reply.code(500).send({ error: 'Failed to delete invoice' });
    }
  });

  // Wallet signing endpoints
  
  // Prepare mint transaction for wallet signing
  fastify.post('/prepare-mint', {
    preHandler: [walletSupplierGuard],
    schema: {
      body: {
        type: 'object',
        properties: {
          invoiceNumber: { type: 'string', minLength: 1 },
          supplierId: { type: 'string', minLength: 1 },
          buyerId: { type: 'string', minLength: 1 },
          amount: { type: 'string', minLength: 1 },
          currency: { type: 'string', minLength: 3, maxLength: 3 },
          dueDate: { type: 'string', format: 'date-time' },
          description: { type: 'string' },
          accountId: { type: 'string', minLength: 1 }
        },
        required: ['invoiceNumber', 'supplierId', 'buyerId', 'amount', 'currency', 'dueDate', 'accountId']
      }
    }
  }, async (request, reply) => {
    try {
      const { accountId, ...invoiceData } = request.body as any;
      
      // Create invoice record first
      const invoice = await invoiceService.createInvoice({
        ...invoiceData,
        dueDate: new Date(invoiceData.dueDate),
        amount: parseFloat(invoiceData.amount),
        status: InvoiceStatus.ISSUED
      });

      const result = await invoiceHederaService.prepareMintTransaction({
        invoiceId: invoice.id,
        invoiceNumber: invoiceData.invoiceNumber,
        amount: parseFloat(invoiceData.amount),
        currency: invoiceData.currency,
        dueDate: new Date(invoiceData.dueDate),
        supplierId: invoiceData.supplierId,
        buyerId: invoiceData.buyerId,
        accountId
      });
      
      return reply.code(200).send({
        data: {
          transactionBytes: result.transactionBytes,
          invoiceId: invoice.id,
          transactionId: result.transactionId
        }
      });
    } catch (error) {
      fastify.log.error({ error }, 'Error preparing mint transaction');
      reply.code(500).send({ error: 'Failed to prepare mint transaction' });
    }
  });

  // Submit signed mint transaction
  fastify.post('/submit-mint', {
    preHandler: [walletSupplierGuard],
    schema: {
      body: {
        type: 'object',
        properties: {
          invoiceId: { type: 'string', minLength: 1 },
          signedTransactionBytes: { type: 'string', minLength: 1 },
          transactionId: { type: 'string', minLength: 1 }
        },
        required: ['invoiceId', 'signedTransactionBytes', 'transactionId']
      }
    }
  }, async (request, reply) => {
    try {
      const { invoiceId, signedTransactionBytes, transactionId } = request.body as any;
      
      const result = await invoiceHederaService.submitSignedMintTransaction({
        invoiceId,
        signedTransactionBytes,
        transactionId
      });
      
      return reply.code(200).send({
        data: {
          tokenId: result.tokenId,
          serialNumber: result.serialNumber,
          transactionId: result.transactionId,
          fileId: result.fileId,
          fileHash: result.fileHash,
          topicId: result.topicId
        }
      });
    } catch (error) {
      fastify.log.error({ error }, 'Error submitting mint transaction');
      reply.code(500).send({ error: 'Failed to submit mint transaction' });
    }
  });

  // Prepare fund transaction for wallet signing
  fastify.post('/prepare-fund', {
    preHandler: [walletInvestorGuard],
    schema: {
      body: {
        type: 'object',
        properties: {
          invoiceId: { type: 'string', minLength: 1 },
          accountId: { type: 'string', minLength: 1 }
        },
        required: ['invoiceId', 'accountId']
      }
    }
  }, async (request, reply) => {
    try {
      const { invoiceId, accountId } = request.body as any;
      
      const invoice = await invoiceService.getInvoiceById(invoiceId);
      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }

      const result = await invoiceHederaService.prepareFundTransaction({
        invoiceId,
        amount: invoice.amount,
        accountId
      });
      
      return reply.code(200).send({
        data: {
          transactionBytes: result.transactionBytes,
          invoiceId,
          transactionId: result.transactionId,
          escrowAccountId: result.escrowAccountId
        }
      });
    } catch (error) {
      fastify.log.error({ error }, 'Error preparing fund transaction');
      reply.code(500).send({ error: 'Failed to prepare fund transaction' });
    }
  });

  // Submit signed fund transaction
  fastify.post('/:id/submit-fund', {
    preHandler: [walletInvestorGuard],
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', minLength: 1 }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          signedTransactionBytes: { type: 'string', minLength: 1 },
          transactionId: { type: 'string', minLength: 1 },
          investorId: { type: 'string', minLength: 1 }
        },
        required: ['signedTransactionBytes', 'transactionId', 'investorId']
      }
    }
  }, async (request, reply) => {
    try {
      const { id: invoiceId } = request.params as { id: string };
      const { signedTransactionBytes, transactionId, investorId } = request.body as any;
      
      const invoice = await invoiceService.getInvoiceById(invoiceId);
      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }

      const result = await invoiceHederaService.submitSignedFundTransaction({
        invoiceId,
        signedTransactionBytes,
        transactionId,
        amount: invoice.amount,
        investorId
      });
      
      return reply.code(200).send({
        data: {
          transactionId: result.transactionId,
          escrowId: result.escrowId
        }
      });
    } catch (error) {
      fastify.log.error({ error }, 'Error submitting fund transaction');
      reply.code(500).send({ error: 'Failed to submit fund transaction' });
    }
  });

  // NFT-specific endpoints using the new controller
  
  // POST /api/invoices/:id/mint-nft - Mint NFT for existing invoice
  fastify.post('/:id/mint-nft', {
    preHandler: [walletSupplierGuard],
    schema: {
      description: 'Mint NFT for existing invoice',
      tags: ['invoices', 'nft'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                invoice: { type: 'object' },
                nft: {
                  type: 'object',
                  properties: {
                    tokenId: { type: 'string' },
                    serialNumber: { type: 'string' },
                    transactionId: { type: 'string' },
                    hashScanUrl: { type: 'string' },
                    mirrorNodeUrl: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const req = { ...request, body: { invoiceId: id } } as any;
    await invoiceController.mintNFT(req, reply as any);
  });

  // POST /api/invoices/:id/transfer-nft - Transfer NFT to another account
  fastify.post('/:id/transfer-nft', {
    preHandler: [walletSupplierGuard],
    schema: {
      description: 'Transfer NFT to another account',
      tags: ['invoices', 'nft'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['toAccountId'],
        properties: {
          toAccountId: { type: 'string', minLength: 1 },
          fromPrivateKey: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                transactionId: { type: 'string' },
                tokenId: { type: 'string' },
                serialNumber: { type: 'string' },
                toAccountId: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const req = { ...request, body: { ...body, invoiceId: id } } as any;
    await invoiceController.transferNFT(req, reply as any);
  });

}