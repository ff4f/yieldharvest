import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { invoiceService, InvoiceStatus, InvoiceEventType } from '../services/invoices';
import { HederaService } from '../services/hedera';
import { logger } from '../utils/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

const hederaService = new HederaService({
  operatorId: process.env['OPERATOR_ID']!,
  operatorKey: process.env['OPERATOR_KEY']!,
  network: process.env['HEDERA_NETWORK'] || 'testnet',
  mirrorNodeUrl: process.env['MIRROR_NODE_URL'] || 'https://testnet.mirrornode.hedera.com',
});

const SimpleFundingSchema = z.object({
  invoiceId: z.string().min(1),
  investorId: z.string().min(1),
  amount: z.string().transform(val => parseFloat(val)),
  supplierAccountId: z.string().min(1),
  nftSerialNumber: z.number().int().positive().optional().default(1),
});

export async function testFundingSimpleRoutes(fastify: FastifyInstance) {
  // Simple funding without smart contract (for testing)
  fastify.post('/test/funding-simple', async (request, reply) => {
    try {
      const data = SimpleFundingSchema.parse(request.body);
      
      // Get invoice details
      const invoice = await invoiceService.getInvoiceById(data.invoiceId);
      if (!invoice) {
        return reply.status(404).send({ success: false, error: 'Invoice not found' });
      }
      
      if (invoice.status !== InvoiceStatus.ISSUED) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Invoice must be in ISSUED status to be funded' 
        });
      }
      
      // Validate funding amount
      if (data.amount <= 0 || data.amount > invoice.amount) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Invalid funding amount' 
        });
      }
      
      // Check if invoice is already fully funded
      const existingFundings = await prisma.funding.findMany({
        where: { invoiceId: data.invoiceId }
      });
      
      const totalFunded = existingFundings.reduce((sum: number, f: any) => sum + f.amount, 0);
      if (totalFunded + data.amount > invoice.amount) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Funding amount exceeds invoice amount' 
        });
      }
      
      // Ensure investor profile exists
      let investor = await prisma.investor.findUnique({
        where: { userId: data.investorId }
      });
      
      if (!investor) {
        // Create investor profile if it doesn't exist
        investor = await prisma.investor.create({
          data: {
            userId: data.investorId,
            availableBalance: 10000, // Mock balance
            totalInvested: 0,
            totalReturns: 0,
            riskTolerance: 'MEDIUM',
          }
        });
      }
      
      // Create funding record in database (without smart contract)
      const funding = await prisma.funding.create({
        data: {
          invoiceId: data.invoiceId,
          investorId: data.investorId,
          amount: data.amount,
          escrowId: `mock-escrow-${Date.now()}`, // Mock escrow ID
          transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`, // Mock transaction hash
          status: 'ACTIVE',
        },
        include: {
          invoice: true,
          investor: {
            select: { id: true, name: true, email: true, accountId: true }
          }
        }
      });
      
      // Update investor balance
      await prisma.investor.update({
        where: { userId: data.investorId },
        data: {
          totalInvested: { increment: data.amount }
        }
      });
      
      // Update invoice status if fully funded
      const newTotalFunded = totalFunded + data.amount;
      if (newTotalFunded >= invoice.amount) {
        await invoiceService.updateInvoiceStatus(
          data.invoiceId,
          InvoiceStatus.FUNDED,
          `Invoice fully funded with ${newTotalFunded} HBAR`
        );
      }
      
      // Log funding event to HCS
      let hcsMessageId: string | undefined;
      try {
        const fundingMessage = {
          type: 'FUNDING_CREATED',
          invoiceId: data.invoiceId,
          investorId: data.investorId,
          amount: data.amount,
          escrowId: funding.escrowId,
          transactionHash: funding.transactionHash,
          timestamp: new Date().toISOString(),
        };
        
        const hcsResult = await hederaService.submitMessage(
          invoice.topicId || '0.0.6984577', // Use invoice topic or default
          JSON.stringify(fundingMessage)
        );
        
        hcsMessageId = hcsResult.receipt.topicSequenceNumber?.toString();
        logger.info('Funding logged to HCS', { hcsMessageId, invoiceId: data.invoiceId });
      } catch (hcsError) {
        logger.warn('Failed to log funding to HCS', { error: hcsError });
      }
      
      // Add invoice event
      await invoiceService.addInvoiceEvent(
        data.invoiceId,
        InvoiceEventType.FUNDED,
        `Received funding of ${data.amount} HBAR from investor`,
        { fundingId: funding.id, escrowId: funding.escrowId },
        hcsMessageId,
        new Date(),
        funding.transactionHash
      );
      
      const proofLinks = {
        transaction: `https://hashscan.io/testnet/transaction/${funding.transactionHash}`,
        contract: 'https://hashscan.io/testnet/contract/0.0.123456', // Mock contract
        mirrorNode: hcsMessageId 
          ? `https://testnet.mirrornode.hedera.com/api/v1/topics/${invoice.topicId}/messages/${hcsMessageId}`
          : undefined,
      };
      
      return reply.send({
        success: true,
        data: {
          funding,
          escrowId: funding.escrowId,
          transactionHash: funding.transactionHash,
          hcsMessageId,
          proofLinks,
        }
      });
      
    } catch (error) {
      logger.error('Error creating simple funding', { error });
      return reply.status(500).send({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      });
    }
  });
  
  // Get funding by invoice ID
  fastify.get('/test/funding/:invoiceId', async (request, reply) => {
    try {
      const { invoiceId } = request.params as { invoiceId: string };
      
      const fundings = await prisma.funding.findMany({
        where: { invoiceId },
        include: {
          investor: {
            select: { id: true, name: true, email: true, accountId: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      return reply.send({
        success: true,
        data: fundings
      });
      
    } catch (error) {
      logger.error('Error getting fundings', { error });
      return reply.status(500).send({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  });
}