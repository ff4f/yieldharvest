import { PrismaClient } from '@prisma/client';
import { contractService } from './contract';
import { HederaService } from './hedera';
import { invoiceService, InvoiceStatus, InvoiceEventType } from './invoices';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Create hedera service instance
const hederaService = new HederaService({
  operatorId: process.env['OPERATOR_ID']!,
  operatorKey: process.env['OPERATOR_KEY']!,
  network: process.env['HEDERA_NETWORK'] || 'testnet',
  mirrorNodeUrl: process.env['MIRROR_NODE_URL'] || 'https://testnet.mirrornode.hedera.com',
});

const prisma = new PrismaClient();

export const CreateFundingSchema = z.object({
  invoiceId: z.string().min(1),
  investorId: z.string().min(1),
  amount: z.string().transform(val => parseFloat(val)),
  buyerAddress: z.string().min(1), // Hedera account ID of the buyer
});

export type CreateFundingData = z.infer<typeof CreateFundingSchema>;

export interface FundingResult {
  funding: any;
  escrowId: string;
  transactionHash: string;
  hcsMessageId?: string | undefined;
}

export class FundingService {
  /**
   * Create funding using smart contract escrow
   */
  async createFunding(data: CreateFundingData): Promise<FundingResult> {
    try {
      logger.info('Creating funding with escrow', data);
      
      // Get invoice details
      const invoice = await invoiceService.getInvoiceById(data.invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }
      
      if (invoice.status !== InvoiceStatus.ISSUED) {
        throw new Error('Invoice must be in ISSUED status to be funded');
      }
      
      // Validate funding amount
      if (data.amount <= 0 || data.amount > invoice.amount) {
        throw new Error('Invalid funding amount');
      }
      
      // Check if invoice is already fully funded
      const existingFundings = await prisma.funding.findMany({
        where: { invoiceId: data.invoiceId }
      });
      
      const totalFunded = existingFundings.reduce((sum: number, f: any) => sum + f.amount, 0);
      if (totalFunded + data.amount > invoice.amount) {
        throw new Error('Funding amount exceeds invoice amount');
      }
      
      // Create escrow on smart contract
      const dueDateTimestamp = Math.floor(invoice.dueDate.getTime() / 1000);
      const escrowResult = await contractService.createEscrow({
        invoiceId: data.invoiceId,
        buyerAddress: data.buyerAddress,
        amount: data.amount.toString(),
        dueDateTimestamp,
      });
      
      // Create funding record in database
      const funding = await prisma.funding.create({
        data: {
          invoiceId: data.invoiceId,
          investorId: data.investorId,
          amount: data.amount,
          escrowId: escrowResult.escrowId,
          transactionHash: escrowResult.transactionHash,
          status: 'ACTIVE',
        },
        include: {
          invoice: true,
          investor: {
            select: { id: true, name: true, email: true, hederaAccountId: true }
          }
        }
      });
      
      // Update invoice status if fully funded
      const newTotalFunded = totalFunded + data.amount;
      if (newTotalFunded >= invoice.amount) {
        await invoiceService.updateInvoiceStatus(
          data.invoiceId,
          InvoiceStatus.FUNDED,
          `Invoice fully funded via escrow. Escrow ID: ${escrowResult.escrowId}`,
          undefined,
          escrowResult.transactionHash
        );
      }
      
      // Log funding event to HCS if topic exists
      let hcsMessageId: string | undefined;
      if (invoice.topicId) {
        try {
          const hcsResult = await hederaService.submitTopicMessage(
            invoice.topicId,
            {
              eventType: 'FUNDING_CREATED',
              invoiceId: data.invoiceId,
              escrowId: escrowResult.escrowId,
              amount: data.amount,
              investorId: data.investorId,
              transactionHash: escrowResult.transactionHash,
              timestamp: new Date().toISOString(),
            }
          );
          hcsMessageId = hcsResult.sequenceNumber;
        } catch (error) {
          logger.warn('Failed to log funding to HCS', { error: error instanceof Error ? error.message : String(error) });
        }
      }
      
      // Add invoice event
      await invoiceService.addInvoiceEvent(
        data.invoiceId,
        InvoiceEventType.FUNDING_REQUESTED,
        `Funding created via escrow. Amount: ${data.amount} HBAR, Escrow ID: ${escrowResult.escrowId}`,
        {
          escrowId: escrowResult.escrowId,
          amount: data.amount,
          investorId: data.investorId,
          buyerAddress: data.buyerAddress,
        },
        hcsMessageId,
        new Date(),
        escrowResult.transactionHash
      );
      
      logger.info('Funding created successfully', {
        fundingId: funding.id,
        escrowId: escrowResult.escrowId,
        transactionHash: escrowResult.transactionHash,
      });
      
      return {
        funding,
        escrowId: escrowResult.escrowId,
        transactionHash: escrowResult.transactionHash,
        hcsMessageId,
      };
    } catch (error) {
      logger.error('Failed to create funding', { error: error instanceof Error ? error.message : String(error), data });
      throw error;
    }
  }
  
  /**
   * Release escrow payment (when invoice is paid)
   */
  async releaseEscrow(fundingId: string): Promise<{ transactionHash: string }> {
    try {
      const funding = await prisma.funding.findUnique({
        where: { id: fundingId },
        include: { invoice: true }
      });
      
      if (!funding) {
        throw new Error('Funding not found');
      }
      
      if (funding.status !== 'ACTIVE') {
        throw new Error('Escrow is not active');
      }
      
      // Release escrow on smart contract
      const result = await contractService.releaseEscrow(funding.escrowId!);
      
      // Update funding status
      await prisma.funding.update({
        where: { id: fundingId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          releaseTransactionHash: result.transactionHash,
        }
      });
      
      // Log to HCS if topic exists
      if (funding.invoice.topicId) {
        try {
          await hederaService.submitTopicMessage(
            funding.invoice.topicId,
            {
              eventType: 'ESCROW_RELEASED',
              invoiceId: funding.invoiceId,
              escrowId: funding.escrowId,
              amount: funding.amount,
              transactionHash: result.transactionHash,
              timestamp: new Date().toISOString(),
            }
          );
        } catch (error) {
          logger.warn('Failed to log escrow release to HCS', { error: error instanceof Error ? error.message : String(error) });
        }
      }
      
      // Add invoice event
      await invoiceService.addInvoiceEvent(
        funding.invoiceId,
        InvoiceEventType.PAYMENT_RECEIVED,
        `Escrow released. Amount: ${funding.amount} HBAR`,
        {
          escrowId: funding.escrowId,
          amount: funding.amount,
        },
        undefined,
        new Date(),
        result.transactionHash
      );
      
      logger.info('Escrow released successfully', {
        fundingId,
        escrowId: funding.escrowId,
        transactionHash: result.transactionHash,
      });
      
      return { transactionHash: result.transactionHash };
    } catch (error) {
      logger.error('Failed to release escrow', { error: error instanceof Error ? error.message : String(error), fundingId });
      throw error;
    }
  }
  
  /**
   * Refund escrow (if invoice is overdue or cancelled)
   */
  async refundEscrow(fundingId: string): Promise<{ transactionHash: string }> {
    try {
      const funding = await prisma.funding.findUnique({
        where: { id: fundingId },
        include: { invoice: true }
      });
      
      if (!funding) {
        throw new Error('Funding not found');
      }
      
      if (funding.status !== 'ACTIVE') {
        throw new Error('Escrow is not active');
      }
      
      // Refund escrow on smart contract
      const result = await contractService.refundEscrow(funding.escrowId!);
      
      // Update funding status
      await prisma.funding.update({
        where: { id: fundingId },
        data: {
          status: 'REFUNDED',
          refundedAt: new Date(),
          refundTransactionHash: result.transactionHash,
        }
      });
      
      // Log to HCS if topic exists
      if (funding.invoice.topicId) {
        try {
          await hederaService.submitTopicMessage(
            funding.invoice.topicId,
            {
              eventType: 'ESCROW_REFUNDED',
              invoiceId: funding.invoiceId,
              escrowId: funding.escrowId,
              amount: funding.amount,
              transactionHash: result.transactionHash,
              timestamp: new Date().toISOString(),
            }
          );
        } catch (error) {
          logger.warn('Failed to log escrow refund to HCS', { error: error instanceof Error ? error.message : String(error) });
        }
      }
      
      // Add invoice event
      await invoiceService.addInvoiceEvent(
        funding.invoiceId,
        InvoiceEventType.CANCELLED,
        `Escrow refunded. Amount: ${funding.amount} HBAR`,
        {
          escrowId: funding.escrowId,
          amount: funding.amount,
        },
        undefined,
        new Date(),
        result.transactionHash
      );
      
      logger.info('Escrow refunded successfully', {
        fundingId,
        escrowId: funding.escrowId,
        transactionHash: result.transactionHash,
      });
      
      return { transactionHash: result.transactionHash };
    } catch (error) {
      logger.error('Failed to refund escrow', { error: error instanceof Error ? error.message : String(error), fundingId });
      throw error;
    }
  }
  
  /**
   * Get funding by ID with escrow details
   */
  async getFundingById(id: string) {
    const funding = await prisma.funding.findUnique({
      where: { id },
      include: {
        invoice: true,
        investor: {
          select: { id: true, name: true, email: true, hederaAccountId: true }
        }
      }
    });
    
    if (!funding || !funding.escrowId) {
      return funding;
    }
    
    // Get escrow details from smart contract
    try {
      const escrowData = await contractService.getEscrow(funding.escrowId);
      return {
        ...funding,
        escrowData,
      };
    } catch (error) {
      logger.warn('Failed to get escrow data', { error: error instanceof Error ? error.message : String(error), escrowId: funding.escrowId });
      return funding;
    }
  }
  
  /**
   * Get all fundings for an invoice with escrow details
   */
  async getFundingsByInvoice(invoiceId: string) {
    const fundings = await prisma.funding.findMany({
      where: { invoiceId },
      include: {
        investor: {
          select: { id: true, name: true, email: true, hederaAccountId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Enrich with escrow data
    const enrichedFundings = await Promise.all(
      fundings.map(async (funding: any) => {
        if (!funding.escrowId) {
          return funding;
        }
        
        try {
          const escrowData = await contractService.getEscrow(funding.escrowId);
          return {
            ...funding,
            escrowData,
          };
        } catch (error) {
          logger.warn('Failed to get escrow data', { error: error instanceof Error ? error.message : String(error), escrowId: funding.escrowId });
          return funding;
        }
      })
    );
    
    return enrichedFundings;
  }
}

export const fundingService = new FundingService();