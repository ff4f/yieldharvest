import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { contractService } from '../services/contract';
import { logger } from '../utils/logger';

// Request schemas
const createEscrowSchema = z.object({
  invoiceId: z.string().min(1),
  buyerAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  amount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  dueDateTimestamp: z.number().int().positive(),
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
      logger.error('Failed to get contract info', { error: errorMessage });
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
      
      logger.info('Creating escrow via smart contract', {
        invoiceId: validatedData.invoiceId,
        buyerAddress: validatedData.buyerAddress,
        amount: validatedData.amount,
      });
      
      // Create escrow using contract service
      const result = await contractService.createEscrow(validatedData);
      
      // Get HashScan URL
      const hashScanUrl = contractService.getHashScanUrl(result.transactionHash);
      
      // Update database with contract details
      try {
        await fastify.prisma.funding.updateMany({
          where: { invoiceId: validatedData.invoiceId },
          data: {
            contractId: result.escrowId,
            contractTxHash: result.transactionHash,
            status: 'ESCROWED',
          },
        });
      } catch (dbError) {
        const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
        logger.warn('Failed to update database with contract details', {
          error: dbErrorMessage,
          escrowId: result.escrowId,
        });
      }
      
      return reply.send({
        ...result,
        hashScanUrl,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create escrow', {
        error: errorMessage,
        body: request.body,
      });
      
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
      
      logger.info('Releasing escrow', { escrowId });
      
      const result = await contractService.releaseEscrow(escrowId);
      const hashScanUrl = contractService.getHashScanUrl(result.transactionHash);
      
      // Update database
      try {
        await fastify.prisma.funding.updateMany({
          where: { contractId: escrowId },
          data: {
            status: 'COMPLETED',
            releaseTxHash: result.transactionHash,
          },
        });
      } catch (dbError) {
        const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
        logger.warn('Failed to update database after release', {
          error: dbErrorMessage,
          escrowId,
        });
      }
      
      return reply.send({
        ...result,
        hashScanUrl,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to release escrow', {
        error: errorMessage,
        escrowId: request.params.escrowId,
      });
      
      return reply.code(500).send({
        error: 'Failed to release escrow',
        details: errorMessage,
      });
    }
  });

  // Refund escrow
  fastify.post('/escrow/:escrowId/refund', {
    schema: {
      tags: ['contracts'],
      summary: 'Refund escrow',
      description: 'Refund escrow funds to buyer',
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
      
      logger.info('Refunding escrow', { escrowId });
      
      const result = await contractService.refundEscrow(escrowId);
      const hashScanUrl = contractService.getHashScanUrl(result.transactionHash);
      
      // Update database
      try {
        await fastify.prisma.funding.updateMany({
          where: { contractId: escrowId },
          data: {
            status: 'REFUNDED',
            refundTxHash: result.transactionHash,
          },
        });
      } catch (dbError) {
        const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
        logger.warn('Failed to update database after refund', {
          error: dbErrorMessage,
          escrowId,
        });
      }
      
      return reply.send({
        ...result,
        hashScanUrl,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to refund escrow', {
        error: errorMessage,
        escrowId: request.params.escrowId,
      });
      
      return reply.code(500).send({
        error: 'Failed to refund escrow',
        details: errorMessage,
      });
    }
  });

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
      const statusMap = ['Active', 'Released', 'Refunded'];
      
      return reply.send({
        id: escrow.id.toString(),
        invoiceId: escrow.invoiceId,
        seller: escrow.seller,
        buyer: escrow.buyer,
        amount: escrow.amount.toString(),
        dueDate: escrow.dueDate.toString(),
        status: escrow.status,
        createdAt: escrow.createdAt.toString(),
        amountFormatted: `${parseFloat(escrow.amount.toString()) / 1e18} HBAR`,
        statusText: statusMap[escrow.status] || 'Unknown',
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get escrow details', {
        error: errorMessage,
        escrowId: request.params.escrowId,
      });
      
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
            escrowIds: {
              type: 'array',
              items: { type: 'string' },
            },
            count: { type: 'number' },
          },
        },
      },
    },
  }, async (request: InvoiceIdRequest, reply: FastifyReply) => {
    try {
      const { invoiceId } = invoiceIdSchema.parse(request.params);
      
      const escrowIds = await contractService.getEscrowsByInvoice(invoiceId);
      
      return reply.send({
        invoiceId,
        escrowIds,
        count: escrowIds.length,
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get escrows by invoice', {
        error: errorMessage,
        invoiceId: request.params.invoiceId,
      });
      
      return reply.code(500).send({
        error: 'Failed to retrieve escrows for invoice',
        details: errorMessage,
      });
    }
  });
}