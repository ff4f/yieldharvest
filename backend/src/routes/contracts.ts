import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { contractService } from '../services/contract';
import { logger } from '../utils/logger';

// Request schemas
const createEscrowSchema = z.object({
  invoiceId: z.string().min(1),
  supplierAccountId: z.string().regex(/^0\.0\.\d+$/, 'Invalid Hedera account ID'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  nftSerialNumber: z.number().int().positive(),
});

const escrowIdSchema = z.object({
  escrowId: z.string().regex(/^\d+$/, 'Invalid escrow ID'),
});

const invoiceIdSchema = z.object({
  invoiceId: z.string().min(1),
});

type CreateEscrowRequest = FastifyRequest<{
  Body: z.infer<typeof createEscrowSchema>;
}>;

type EscrowIdRequest = FastifyRequest<{
  Params: z.infer<typeof escrowIdSchema>;
}>;

type InvoiceIdRequest = FastifyRequest<{
  Params: z.infer<typeof invoiceIdSchema>;
}>;

export async function contractRoutes(fastify: FastifyInstance) {
  // Get contract information
  fastify.get('/info', {
    schema: {
      tags: ['contracts'],
      summary: 'Get contract information',
      description: 'Retrieve EscrowPool contract details and status',
      response: {
        200: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            owner: { type: 'string' },
            platformFeeRate: { type: 'string' },
            feeRecipient: { type: 'string' },
            balance: { type: 'string' },
            network: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                chainId: { type: 'number' },
              },
            },
            hashScanUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const contractInfo = await contractService.getContractInfo();
      const hashScanUrl = contractService.getContractHashScanUrl();
      
      return reply.send({
        ...contractInfo,
        hashScanUrl,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get contract info');
      return reply.code(500).send({
        error: 'Failed to retrieve contract information',
        details: errorMessage,
      });
    }
  });

  // Create new escrow
  fastify.post('/escrow', {
    schema: {
      tags: ['contracts'],
      summary: 'Create new escrow',
      description: 'Create a new escrow for an invoice with smart contract',
      body: {
        type: 'object',
        required: ['invoiceId', 'buyerAddress', 'amount', 'dueDateTimestamp'],
        properties: {
          invoiceId: { type: 'string', description: 'Invoice ID' },
          buyerAddress: { type: 'string', description: 'Buyer Ethereum address' },
          amount: { type: 'string', description: 'Amount in HBAR' },
          dueDateTimestamp: { type: 'number', description: 'Due date as Unix timestamp' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            escrowId: { type: 'string' },
            transactionHash: { type: 'string' },
            blockNumber: { type: 'number' },
            gasUsed: { type: 'string' },
            status: { type: 'string' },
            hashScanUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: CreateEscrowRequest, reply: FastifyReply) => {
    try {
      // Validate request body
      const validatedData = createEscrowSchema.parse(request.body);
      
      logger.info({
        invoiceId: validatedData.invoiceId,
        supplierAccountId: validatedData.supplierAccountId,
        amount: validatedData.amount,
        nftSerialNumber: validatedData.nftSerialNumber,
      }, 'Creating escrow via smart contract');
      
      // Create escrow using contract service
      const result = await contractService.createEscrow({
        ...validatedData,
        supplierAddress: validatedData.supplierAccountId, // Map to expected parameter
      });
      
      // Get HashScan URL
      const hashScanUrl = contractService.getHashScanUrl(result.transactionHash);
      
      // Update database with contract details
      try {
        await fastify.prisma.funding.updateMany({
          where: { invoiceId: validatedData.invoiceId },
          data: {
            contractId: result.escrowId,
            transactionHash: result.transactionHash,
            status: 'ACTIVE',
          },
        });
      } catch (dbError) {
        const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
        logger.warn({
          error: dbError instanceof Error ? dbError.message : String(dbError),
          escrowId: result.escrowId,
        }, 'Failed to update database with contract details');
      }
      
      return reply.send({
        ...result,
        hashScanUrl,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        body: request.body,
      }, 'Failed to create escrow');
      
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.code(400).send({
          error: 'Invalid request data',
          details: (error as any).errors,
        });
      }
      
      return reply.code(500).send({
        error: 'Failed to create escrow',
        details: errorMessage,
      });
    }
  });

  // Release escrow
  fastify.post('/escrow/:escrowId/release', {
    schema: {
      tags: ['contracts'],
      summary: 'Release escrow',
      description: 'Release escrow funds to seller',
      params: {
        type: 'object',
        required: ['escrowId'],
        properties: {
          escrowId: { type: 'string', description: 'Escrow ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            escrowId: { type: 'string' },
            transactionHash: { type: 'string' },
            blockNumber: { type: 'number' },
            gasUsed: { type: 'string' },
            status: { type: 'string' },
            hashScanUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: EscrowIdRequest, reply: FastifyReply) => {
    try {
      const { escrowId } = escrowIdSchema.parse(request.params);
      
      logger.info({ escrowId }, 'Releasing escrow');
      
      const result = await contractService.releaseEscrow(escrowId);
      const hashScanUrl = contractService.getHashScanUrl(result.transactionHash);
      
      // Update database
      try {
        await fastify.prisma.funding.updateMany({
          where: { contractId: escrowId },
          data: {
            status: 'RELEASED',
            releaseTransactionHash: result.transactionHash,
          },
        });
      } catch (dbError) {
        const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
        logger.warn({
          error: dbError instanceof Error ? dbError.message : String(dbError),
          escrowId,
        }, 'Failed to update database after release');
      }
      
      return reply.send({
        ...result,
        hashScanUrl,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        escrowId: request.params.escrowId,
      }, 'Failed to release escrow');
      
      return reply.code(500).send({
        error: 'Failed to release escrow',
        details: errorMessage,
      });
    }
  });

  // Note: Refund functionality removed as it's not supported by the current escrow contract

  // Get escrow details
  fastify.get('/escrow/:escrowId', {
    schema: {
      tags: ['contracts'],
      summary: 'Get escrow details',
      description: 'Retrieve escrow information by ID',
      params: {
        type: 'object',
        required: ['escrowId'],
        properties: {
          escrowId: { type: 'string', description: 'Escrow ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            invoiceId: { type: 'string' },
            seller: { type: 'string' },
            buyer: { type: 'string' },
            amount: { type: 'string' },
            dueDate: { type: 'string' },
            status: { type: 'number' },
            createdAt: { type: 'string' },
            amountFormatted: { type: 'string' },
            statusText: { type: 'string' },
          },
        },
      },
    },
  }, async (request: EscrowIdRequest, reply: FastifyReply) => {
    try {
      const { escrowId } = escrowIdSchema.parse(request.params);
      
      const escrow = await contractService.getEscrow(escrowId);
      
      if (!escrow) {
        return reply.code(404).send({
          error: 'Escrow not found',
        });
      }
      
      // Format response
      const statusMap = ['Active', 'Released'];
      
      return reply.send({
        id: escrow.id.toString(),
        invoiceId: escrow.invoiceId,
        investor: escrow.investor,
        supplier: escrow.supplier,
        amount: escrow.amount.toString(),
        nftSerialNumber: escrow.nftSerialNumber.toString(),
        status: escrow.status,
        createdAt: escrow.createdAt.toString(),
        releasedAt: escrow.releasedAt.toString(),
        amountFormatted: `${parseFloat(escrow.amount.toString()) / 1e18} HBAR`,
        statusText: statusMap[escrow.status] || 'Unknown',
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        escrowId: request.params.escrowId,
      }, 'Failed to get escrow details');
      
      return reply.code(500).send({
        error: 'Failed to retrieve escrow details',
        details: errorMessage,
      });
    }
  });

  // Get escrows by invoice
  fastify.get('/invoice/:invoiceId/escrows', {
    schema: {
      tags: ['contracts'],
      summary: 'Get escrows by invoice',
      description: 'Retrieve all escrows for a specific invoice',
      params: {
        type: 'object',
        required: ['invoiceId'],
        properties: {
          invoiceId: { type: 'string', description: 'Invoice ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            invoiceId: { type: 'string' },
            escrow: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                investor: { type: 'string' },
                supplier: { type: 'string' },
                amount: { type: 'string' },
                nftSerialNumber: { type: 'string' },
                status: { type: 'number' },
                createdAt: { type: 'string' },
                releasedAt: { type: 'string' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            invoiceId: { type: 'string' },
          },
        },
      },
    },
  }, async (request: InvoiceIdRequest, reply: FastifyReply) => {
    try {
      const { invoiceId } = invoiceIdSchema.parse(request.params);
      
      const escrow = await contractService.getEscrowByInvoice(invoiceId);
      
      if (!escrow) {
        return reply.code(404).send({
          error: 'Escrow not found for invoice',
          invoiceId,
        });
      }
      
      return reply.send({
        invoiceId,
        escrow: {
          id: escrow.id.toString(),
          investor: escrow.investor,
          supplier: escrow.supplier,
          amount: escrow.amount.toString(),
          nftSerialNumber: escrow.nftSerialNumber.toString(),
          status: escrow.status,
          createdAt: escrow.createdAt.toString(),
          releasedAt: escrow.releasedAt.toString(),
        },
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        invoiceId: request.params.invoiceId,
      }, 'Failed to get escrows by invoice');
      
      return reply.code(500).send({
        error: 'Failed to retrieve escrows for invoice',
        details: errorMessage,
      });
    }
  });
}