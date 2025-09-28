import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requireRole, UserRole } from '../middleware/auth';
import { validate, fundingSchemas, paramSchemas } from '../middleware/validation';
import { fundingService, CreateFundingSchema } from '../services/fundingService';
import { auditLogger } from '../utils/logger';
import { NotFoundError } from '../middleware/errorHandler';

export async function fundingRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Get all fundings
  fastify.get('/', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER, UserRole.INVESTOR])]
  }, async (request, reply) => {
    try {
      const fundings = await fastify.prisma.funding.findMany({
        include: {
          invoice: true,
          investor: { select: { id: true, name: true, email: true, hederaAccountId: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { data: fundings };
    } catch (error) {
      auditLogger.logBusiness({ operation: 'list', entityType: 'funding', entityId: '', success: false });
      return reply.code(500).send({ error: 'Failed to get fundings' });
    }
  });

  // Get funding by ID with escrow details
  fastify.get('/:id', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.SUPPLIER, UserRole.INVESTOR])]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const funding = await fundingService.getFundingById(id);
      
      if (!funding) {
        return reply.code(404).send({ error: 'Funding not found' });
      }
      
      return { data: funding };
    } catch (error) {
      auditLogger.logBusiness({ operation: 'read', entityType: 'funding', entityId: '', success: false });
      return reply.code(500).send({ error: 'Failed to get funding' });
    }
  });

  // Get fundings by invoice ID
  fastify.get('/invoice/:invoiceId', async (request, reply) => {
    try {
      const { invoiceId } = request.params as { invoiceId: string };
      const fundings = await fundingService.getFundingsByInvoice(invoiceId);
      return { data: fundings };
    } catch (error) {
      auditLogger.logBusiness({ operation: 'read', entityType: 'funding', entityId: '', success: false });
      return reply.code(500).send({ error: 'Failed to get fundings by invoice' });
    }
  });

  // Create funding with smart contract escrow
  fastify.post('/', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.INVESTOR]), validate(fundingSchemas.create)]
  }, async (request, reply) => {
    try {
      const validatedData = CreateFundingSchema.parse(request.body);
      const result = await fundingService.createFunding(validatedData);
      
      return reply.code(201).send({
        data: result.funding,
        escrowId: result.escrowId,
        transactionHash: result.transactionHash,
        hcsMessageId: result.hcsMessageId,
        proofLinks: {
          transaction: `https://hashscan.io/testnet/transaction/${result.transactionHash}`,
          contract: `https://hashscan.io/testnet/contract/${process.env['ESCROW_CONTRACT_ADDRESS']}`,
        },
      });
    } catch (error) {
      auditLogger.logBusiness({ operation: 'create', entityType: 'funding', entityId: '', success: false });
      
      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }
      
      return reply.code(500).send({ error: 'Failed to create funding' });
    }
  });

  // Release escrow (when invoice is paid)
  fastify.post('/:id/release', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.INVESTOR])]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await fundingService.releaseEscrow(id);
      
      return {
        message: 'Escrow released successfully',
        transactionHash: result.transactionHash,
        proofLinks: {
          transaction: `https://hashscan.io/testnet/transaction/${result.transactionHash}`,
          contract: `https://hashscan.io/testnet/contract/${process.env['ESCROW_CONTRACT_ADDRESS']}`,
        },
      };
    } catch (error) {
      auditLogger.logBusiness({ operation: 'release', entityType: 'funding', entityId: '', success: false });
      
      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }
      
      return reply.code(500).send({ error: 'Failed to release escrow' });
    }
  });

  // Refund escrow (if invoice is overdue or cancelled)
  fastify.post('/:id/refund', {
    preHandler: [authenticate, requireRole([UserRole.ADMIN, UserRole.INVESTOR])]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const result = await fundingService.refundEscrow(id);
      
      return {
        message: 'Escrow refunded successfully',
        transactionHash: result.transactionHash,
        proofLinks: {
          transaction: `https://hashscan.io/testnet/transaction/${result.transactionHash}`,
          contract: `https://hashscan.io/testnet/contract/${process.env['ESCROW_CONTRACT_ADDRESS']}`,
        },
      };
    } catch (error) {
      auditLogger.logBusiness({ operation: 'refund', entityType: 'funding', entityId: '', success: false });
      
      if (error instanceof Error) {
        return reply.code(400).send({ error: error.message });
      }
      
      return reply.code(500).send({ error: 'Failed to refund escrow' });
    }
  });
}