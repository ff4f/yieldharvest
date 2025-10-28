import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { walletJwtGuard, walletSupplierGuard, walletInvestorGuard, walletAdminGuard } from '../middleware/auth.middleware';
import { validate, fundingSchemas, paramSchemas } from '../middleware/validation';
import { fundingService, CreateFundingSchema, WalletFundingSchema } from '../services/fundingService';
import { auditLogger } from '../utils/logger';
import { NotFoundError } from '../middleware/errorHandler';

export async function fundingRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Get all fundings
  fastify.get('/', {
    preHandler: [walletJwtGuard]
  }, async (request, reply) => {
    try {
      const fundings = await fastify.prisma.funding.findMany({
        include: {
          invoice: true,
          investor: { select: { id: true, name: true, email: true, accountId: true } },
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
    preHandler: [walletJwtGuard]
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
  fastify.get('/invoice/:invoiceId', {
    preHandler: [walletJwtGuard]
  }, async (request, reply) => {
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
    preHandler: [walletInvestorGuard, validate(fundingSchemas.create)]
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
    preHandler: [walletInvestorGuard]
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

  // Note: Refund functionality is not available in the current contract implementation
  
  // Wallet-based funding endpoints
  fastify.post('/fundings/wallet/prepare', {
    schema: {
      body: {
        type: 'object',
        required: ['invoiceId', 'investorId', 'amount', 'supplierAccountId', 'walletAccountId'],
        properties: {
          invoiceId: { type: 'string' },
          investorId: { type: 'string' },
          amount: { type: 'string' },
          supplierAccountId: { type: 'string' },
          nftSerialNumber: { type: 'number' },
          walletAccountId: { type: 'string' },
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = WalletFundingSchema.parse(request.body);
      
      const preparedTx = await fundingService.prepareFundingTransaction(data);
      
      return reply.code(200).send({
        success: true,
        data: preparedTx,
        message: 'Transaction prepared for wallet signing'
      });
    } catch (error) {
      logger.error('Failed to prepare funding transaction', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare transaction'
      });
    }
  });
  
  fastify.post('/fundings/wallet/submit', {
    schema: {
      body: {
        type: 'object',
        required: ['invoiceId', 'investorId', 'amount', 'supplierAccountId', 'walletAccountId', 'signedTransactionBytes'],
        properties: {
          invoiceId: { type: 'string' },
          investorId: { type: 'string' },
          amount: { type: 'string' },
          supplierAccountId: { type: 'string' },
          nftSerialNumber: { type: 'number' },
          walletAccountId: { type: 'string' },
          signedTransactionBytes: { type: 'string' },
        }
      }
    }
  }, async (request, reply) => {
    try {
      const data = WalletFundingSchema.parse(request.body);
      
      const result = await fundingService.createFundingWithWallet(data);
      
      return reply.code(201).send({
        success: true,
        data: {
          funding: result.funding,
          escrowId: result.escrowId,
          transactionHash: result.transactionHash,
          hcsMessageId: result.hcsMessageId,
          proofLinks: result.proofLinks,
        },
        message: 'Funding created successfully via wallet',
        links: {
          transaction: result.proofLinks.transaction,
          contract: result.proofLinks.contract,
          mirrorNode: result.proofLinks.mirrorNode,
        }
      });
    } catch (error) {
      logger.error('Failed to create wallet funding', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create funding'
      });
    }
  });
}