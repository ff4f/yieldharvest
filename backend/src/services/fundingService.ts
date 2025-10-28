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
  supplierAccountId: z.string().min(1), // Hedera account ID of the supplier
  nftSerialNumber: z.number().int().positive().optional().default(1), // NFT serial number
});

export type CreateFundingData = z.infer<typeof CreateFundingSchema>;

export interface FundingResult {
  funding: any;
  escrowId: string;
  transactionHash: string;
  hcsMessageId?: string | undefined;
  proofLinks: {
    transaction: string;
    contract: string;
    mirrorNode?: string;
  };
}

export interface WalletFundingData {
  invoiceId: string;
  investorId: string;
  amount: string;
  supplierAccountId: string;
  nftSerialNumber?: number;
  walletAccountId: string; // The connected wallet account
  signedTransactionBytes?: string; // For wallet-signed transactions
}

export const WalletFundingSchema = z.object({
  invoiceId: z.string().min(1),
  investorId: z.string().min(1),
  amount: z.string().transform(val => parseFloat(val)),
  supplierAccountId: z.string().min(1),
  nftSerialNumber: z.number().int().positive().optional().default(1),
  walletAccountId: z.string().min(1),
  signedTransactionBytes: z.string().optional(),
});

export type WalletFundingDataType = z.infer<typeof WalletFundingSchema>;

export class FundingService {
  /**
   * Create funding using smart contract escrow with wallet integration
   */
  async createFundingWithWallet(data: WalletFundingDataType): Promise<FundingResult> {
    try {
      logger.info('Creating funding with wallet integration', data);
      
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
      
      let escrowResult;
      
      if (data.signedTransactionBytes) {
        // Submit pre-signed transaction from wallet
        escrowResult = await hederaService.submitSignedTransaction(data.signedTransactionBytes);
      } else {
        // Create escrow on smart contract (fallback to service account)
        escrowResult = await contractService.createEscrow({
          invoiceId: data.invoiceId,
          supplierAddress: data.supplierAccountId,
          amount: data.amount.toString(),
          nftSerialNumber: data.nftSerialNumber || 1,
        });
      }
      
      // Create funding record in database
      const funding = await prisma.funding.create({
        data: {
          invoiceId: data.invoiceId,
          investorId: data.investorId,
          amount: data.amount,
          escrowId: escrowResult.escrowId || escrowResult.transactionId,
          transactionHash: escrowResult.transactionHash || escrowResult.transactionId,
          status: 'ACTIVE',
          walletAccountId: data.walletAccountId,
        },
        include: {
          invoice: true,
          investor: {
            select: { id: true, name: true, email: true, accountId: true }
          }
        }
      });
      
      // Update invoice status if fully funded
      const newTotalFunded = totalFunded + data.amount;
      if (newTotalFunded >= invoice.amount) {
        await invoiceService.updateInvoiceStatus(
          data.invoiceId,
          InvoiceStatus.FUNDED,
          `Invoice fully funded via escrow. Escrow ID: ${escrowResult.escrowId || escrowResult.transactionId}`,
          undefined,
          escrowResult.transactionHash || escrowResult.transactionId
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
              escrowId: escrowResult.escrowId || escrowResult.transactionId,
              amount: data.amount,
              investorId: data.investorId,
              walletAccountId: data.walletAccountId,
              transactionHash: escrowResult.transactionHash || escrowResult.transactionId,
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
        `Funding created via wallet. Amount: ${data.amount} HBAR, Escrow ID: ${escrowResult.escrowId || escrowResult.transactionId}`,
        {
          escrowId: escrowResult.escrowId || escrowResult.transactionId,
          amount: data.amount,
          investorId: data.investorId,
          supplierAccountId: data.supplierAccountId,
          nftSerialNumber: data.nftSerialNumber || 1,
          walletAccountId: data.walletAccountId,
        },
        hcsMessageId,
        new Date(),
        escrowResult.transactionHash || escrowResult.transactionId
      );
      
      const transactionHash = escrowResult.transactionHash || escrowResult.transactionId;
      
      logger.info('Funding created successfully with wallet', {
        fundingId: funding.id,
        escrowId: escrowResult.escrowId || escrowResult.transactionId,
        transactionHash,
      });
      
      return {
        funding,
        escrowId: escrowResult.escrowId || escrowResult.transactionId,
        transactionHash,
        hcsMessageId,
        proofLinks: {
          transaction: `https://hashscan.io/testnet/transaction/${transactionHash}`,
          contract: `https://hashscan.io/testnet/contract/${config.hedera.escrowContractAddress}`,
          mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${transactionHash}`,
        },
      };
    } catch (error) {
      logger.error('Failed to create funding with wallet', { error: error instanceof Error ? error.message : String(error), data });
      throw error;
    }
  }

  /**
   * Prepare funding transaction for wallet signing
   */
  async prepareFundingTransaction(data: WalletFundingDataType): Promise<{
    transactionBytes: string;
    transactionId: string;
    description: string;
  }> {
    try {
      logger.info('Preparing funding transaction for wallet signing', data);
      
      // Get invoice details
      const invoice = await invoiceService.getInvoiceById(data.invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }
      
      // Prepare the escrow deposit transaction
      const preparedTx = await contractService.prepareEscrowTransaction({
        invoiceId: data.invoiceId,
        supplierAddress: data.supplierAccountId,
        amount: data.amount.toString(),
        nftSerialNumber: data.nftSerialNumber || 1,
        payerAccountId: data.walletAccountId,
      });
      
      return {
        transactionBytes: preparedTx.transactionBytes,
        transactionId: preparedTx.transactionId,
        description: `Fund invoice ${invoice.invoiceNumber} with ${data.amount} HBAR`,
      };
    } catch (error) {
      logger.error('Failed to prepare funding transaction', { error: error instanceof Error ? error.message : String(error), data });
      throw error;
    }
  }

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
      const escrowResult = await contractService.createEscrow({
        invoiceId: data.invoiceId,
        supplierAddress: data.supplierAccountId,
        amount: data.amount.toString(),
        nftSerialNumber: data.nftSerialNumber,
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
            select: { id: true, name: true, email: true, accountId: true }
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
          supplierAccountId: data.supplierAccountId,
          nftSerialNumber: data.nftSerialNumber,
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
      const result = await contractService.releaseEscrow(funding.invoiceId);
      
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
   * Note: Refund functionality is not available in the current contract implementation.
   * The EscrowPool contract only supports deposit and release operations.
   */
  
  /**
   * Get funding by ID with escrow details
   */
  async getFundingById(id: string) {
    const funding = await prisma.funding.findUnique({
      where: { id },
      include: {
        invoice: true,
        investor: {
          select: { id: true, name: true, email: true, accountId: true }
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
          select: { id: true, name: true, email: true, accountId: true }
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