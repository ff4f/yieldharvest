import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fundingService, CreateFundingSchema, WalletFundingSchema } from '../services/fundingService';
import { logger } from '../utils/logger';

export default async function testFundingRoutes(fastify: FastifyInstance) {
  // Test endpoint to create funding without authentication
  fastify.post('/test/funding', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      logger.info('Test funding request received', body);
      
      // Validate the request body
      const validatedData = CreateFundingSchema.parse(body);
      
      // Create funding using the service
      const result = await fundingService.createFunding(validatedData);
      
      return reply.send({
        success: true,
        data: {
          funding: result.funding,
          escrowId: result.escrowId,
          transactionHash: result.transactionHash,
          hcsMessageId: result.hcsMessageId,
          proofLinks: result.proofLinks,
        },
      });
    } catch (error) {
      logger.error('Test funding failed', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test funding',
      });
    }
  });

  // Test endpoint to create funding with wallet
  fastify.post('/test/funding/wallet', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      logger.info('Test wallet funding request received', body);
      
      // Validate the request body
      const validatedData = WalletFundingSchema.parse(body);
      
      // Create funding using the wallet service
      const result = await fundingService.createFundingWithWallet(validatedData);
      
      return reply.send({
        success: true,
        data: {
          funding: result.funding,
          escrowId: result.escrowId,
          transactionHash: result.transactionHash,
          hcsMessageId: result.hcsMessageId,
          proofLinks: result.proofLinks,
        },
      });
    } catch (error) {
      logger.error('Test wallet funding failed', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create test wallet funding',
      });
    }
  });

  // Test endpoint to release escrow
  fastify.post('/test/funding/:id/release', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      logger.info('Test escrow release request received', { fundingId: id });
      
      // Release escrow using the service
      const result = await fundingService.releaseEscrow(id);
      
      return reply.send({
        success: true,
        data: {
          transactionHash: result.transactionHash,
          proofLinks: {
            transaction: `https://hashscan.io/testnet/transaction/${result.transactionHash}`,
            contract: `https://hashscan.io/testnet/contract/${process.env['ESCROW_CONTRACT_ADDRESS']}`,
          },
        },
      });
    } catch (error) {
      logger.error('Test escrow release failed', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to release test escrow',
      });
    }
  });

  // Test endpoint to get funding by invoice
  fastify.get('/test/funding/invoice/:invoiceId', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { invoiceId } = request.params as { invoiceId: string };
      logger.info('Test get funding by invoice request received', { invoiceId });
      
      // Get fundings using the service
      const fundings = await fundingService.getFundingsByInvoice(invoiceId);
      
      return reply.send({
        success: true,
        data: fundings,
      });
    } catch (error) {
      logger.error('Test get funding by invoice failed', { error: error instanceof Error ? error.message : String(error) });
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get test fundings',
      });
    }
  });
}