import { HederaService, InvoiceNFTData, HFSUploadResult, HCSMessageData } from './hedera';
import { InvoiceService, InvoiceEventType, InvoiceStatus, CreateInvoiceSchema } from './invoices';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface InvoiceHederaConfig {
  nftTokenId?: string;
  topicId?: string;
  autoMintNFT?: boolean;
  autoUploadToHFS?: boolean;
  autoSubmitToHCS?: boolean;
}

export interface CreateInvoiceWithHederaData {
  invoiceNumber: string;
  supplierId: string;
  buyerId?: string;
  agentId?: string;
  amount: number;
  currency: string;
  dueDate: Date;
  description?: string;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
  config?: InvoiceHederaConfig;
}

export interface InvoiceHederaResult {
  invoice: any;
  nftResult?: {
    tokenId: string;
    serialNumber: string;
    transactionId: string;
  };
  fileResult?: HFSUploadResult;
  hcsResult?: {
    transactionId: string;
    sequenceNumber: string;
  };
}

export class InvoiceHederaService {
  private hederaService: HederaService;
  private invoiceService: InvoiceService;
  private defaultConfig: InvoiceHederaConfig;

  constructor(
    hederaService: HederaService,
    invoiceService: InvoiceService,
    defaultConfig: InvoiceHederaConfig = {}
  ) {
    this.hederaService = hederaService;
    this.invoiceService = invoiceService;
    this.defaultConfig = {
      autoMintNFT: true,
      autoUploadToHFS: true,
      autoSubmitToHCS: true,
      ...defaultConfig
    };
  }

  /**
   * Create invoice with automatic Hedera integration
   */
  async createInvoiceWithHedera(data: CreateInvoiceWithHederaData): Promise<InvoiceHederaResult> {
    const config = { ...this.defaultConfig, ...data.config };
    const result: InvoiceHederaResult = { invoice: null };

    try {
      // Step 1: Create invoice in database first
      const invoiceData = CreateInvoiceSchema.parse({
        invoiceNumber: data.invoiceNumber,
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        agentId: data.agentId,
        amount: data.amount.toString(),
        currency: data.currency,
        dueDate: data.dueDate.toISOString(),
        description: data.description
      });
      
      const invoice = await this.invoiceService.createInvoice(invoiceData);

      result.invoice = invoice;
      logger.info(`Invoice created: ${invoice.id}`);

      // Step 2: Upload PDF to HFS if provided
      if (data.pdfBuffer && config.autoUploadToHFS) {
        try {
          const fileResult = await this.hederaService.uploadPdfToHfs(
            data.pdfBuffer,
            'application/pdf',
            data.pdfFilename || `invoice-${data.invoiceNumber}.pdf`
          );

          result.fileResult = fileResult;

          // Update invoice with file info
          await this.invoiceService.updateInvoice(invoice.id, {
            fileId: fileResult.fileId,
            fileHash: fileResult.fileHashSha384,
          });

          // Add event
          await this.invoiceService.addInvoiceEvent(
            invoice.id,
            InvoiceEventType.FILE_UPLOADED,
            `PDF uploaded to HFS: ${fileResult.fileId}`,
            { fileId: fileResult.fileId, fileHash: fileResult.fileHashSha384 },
            undefined,
            undefined,
            fileResult.transactionId
          );

          logger.info(`PDF uploaded to HFS: ${fileResult.fileId}`);
        } catch (error) {
          logger.error('Failed to upload PDF to HFS:', error);
          // Continue with NFT minting even if file upload fails
        }
      }

      // Step 3: Mint NFT if token ID is provided
      if (config.nftTokenId && config.autoMintNFT) {
        try {
          const nftMetadata: InvoiceNFTData = {
            invoiceId: invoice.id,
            invoiceNumber: data.invoiceNumber,
            amount: data.amount.toString(),
            currency: data.currency,
            dueDate: data.dueDate.toISOString(),
            supplierId: data.supplierId,
            buyerId: data.buyerId || '',
            fileId: result.fileResult?.fileId,
            fileHash: result.fileResult?.fileHashSha384,
          };

          const nftResult = await this.hederaService.mintInvoiceNFT(
            config.nftTokenId,
            nftMetadata
          );

          result.nftResult = {
            tokenId: config.nftTokenId,
            serialNumber: nftResult.serialNumber,
            transactionId: nftResult.transactionId,
          };

          // Update invoice with NFT info
          await this.invoiceService.updateInvoice(invoice.id, {
            nftTokenId: config.nftTokenId,
            nftSerialNumber: nftResult.serialNumber,
          });

          // Add event
          await this.invoiceService.addInvoiceEvent(
            invoice.id,
            InvoiceEventType.NFT_MINTED,
            `NFT minted: ${config.nftTokenId}/${nftResult.serialNumber}`,
            { tokenId: config.nftTokenId, serialNumber: nftResult.serialNumber },
            undefined,
            undefined,
            nftResult.transactionId
          );

          logger.info(`NFT minted: ${config.nftTokenId}/${nftResult.serialNumber}`);
        } catch (error) {
          logger.error('Failed to mint NFT:', error);
          // Continue with HCS submission even if NFT minting fails
        }
      }

      // Step 4: Submit to HCS if topic ID is provided
      if (config.topicId && config.autoSubmitToHCS) {
        try {
          const hcsMessage: HCSMessageData = {
            tokenId: result.nftResult?.tokenId || '',
            serialNumber: result.nftResult?.serialNumber || '',
            status: 'issued',
            timestamp: new Date().toISOString(),
            fileHash: result.fileResult?.fileHashSha384,
            amount: data.amount.toString(),
            currency: data.currency,
          };

          const hcsResult = await this.hederaService.submitInvoiceStatusMessage(
            config.topicId,
            hcsMessage
          );

          result.hcsResult = hcsResult;

          // Update invoice with topic info
          await this.invoiceService.updateInvoice(invoice.id, {
            topicId: config.topicId,
          });

          // Add event
          await this.invoiceService.addInvoiceEvent(
            invoice.id,
            InvoiceEventType.CREATED,
            `Status submitted to HCS: ${config.topicId}`,
            { topicId: config.topicId, sequenceNumber: hcsResult.sequenceNumber },
            hcsResult.sequenceNumber,
            new Date(),
            hcsResult.transactionId
          );

          logger.info(`Status submitted to HCS: ${config.topicId}`);
        } catch (error) {
          logger.error('Failed to submit to HCS:', error);
        }
      }

      // Step 5: Update invoice status to ISSUED
      await this.invoiceService.updateInvoiceStatus(
        invoice.id,
        InvoiceStatus.ISSUED,
        'Invoice issued with Hedera integration'
      );

      // Refresh invoice data
      result.invoice = await this.invoiceService.getInvoiceById(invoice.id);

      return result;
    } catch (error) {
      logger.error('Failed to create invoice with Hedera:', error);
      throw error;
    }
  }

  /**
   * Update invoice status with HCS submission
   */
  async updateInvoiceStatusWithHCS(
    invoiceId: string,
    status: InvoiceStatus,
    description?: string
  ): Promise<void> {
    try {
      const invoice = await this.invoiceService.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Submit status change to HCS if topic ID exists
      if (invoice.topicId && invoice.nftTokenId && invoice.nftSerialNumber) {
        const hcsMessage: HCSMessageData = {
          tokenId: invoice.nftTokenId,
          serialNumber: invoice.nftSerialNumber,
          status: status.toLowerCase() as any,
          timestamp: new Date().toISOString(),
          fileHash: invoice.fileHash || undefined,
          amount: invoice.amount.toString(),
          currency: invoice.currency,
        };

        const hcsResult = await this.hederaService.submitInvoiceStatusMessage(
          invoice.topicId,
          hcsMessage
        );

        // Update invoice status with HCS info
        await this.invoiceService.updateInvoiceStatus(
          invoiceId,
          status,
          description,
          hcsResult.sequenceNumber,
          hcsResult.transactionId
        );

        logger.info(`Invoice ${invoiceId} status updated to ${status} with HCS`);
      } else {
        // Update without HCS
        await this.invoiceService.updateInvoiceStatus(invoiceId, status, description);
        logger.info(`Invoice ${invoiceId} status updated to ${status}`);
      }
    } catch (error) {
      logger.error(`Failed to update invoice status with HCS:`, error);
      throw error;
    }
  }

  /**
   * Get Hedera proof links for an invoice
   */
  async getInvoiceProofLinks(invoiceId: string): Promise<{
    nftLink?: string;
    fileLink?: string;
    topicLink?: string;
    transactionLinks: string[];
  }> {
    const invoice = await this.invoiceService.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const baseUrl = process.env.HEDERA_NETWORK === 'mainnet' 
      ? 'https://hashscan.io/mainnet' 
      : 'https://hashscan.io/testnet';

    const result: any = {
      transactionLinks: []
    };

    // NFT link
    if (invoice.nftTokenId && invoice.nftSerialNumber) {
      result.nftLink = `${baseUrl}/token/${invoice.nftTokenId}/${invoice.nftSerialNumber}`;
    }

    // File link
    if (invoice.fileId) {
      result.fileLink = `${baseUrl}/file/${invoice.fileId}`;
    }

    // Topic link
    if (invoice.topicId) {
      result.topicLink = `${baseUrl}/topic/${invoice.topicId}`;
    }

    // Transaction links from events
    const events = await prisma.invoiceEvent.findMany({
      where: { invoiceId },
      select: { transactionId: true }
    });

    result.transactionLinks = events
      .filter(event => event.transactionId)
      .map(event => `${baseUrl}/transaction/${event.transactionId}`);

    return result;
  }

  /**
   * Prepare mint transaction for wallet signing
   */
  async prepareMintTransaction(data: {
    invoiceId: string;
    invoiceNumber: string;
    amount: number;
    currency: string;
    dueDate: Date;
    supplierId: string;
    buyerId: string;
    accountId: string;
  }): Promise<{
    transactionBytes: string;
    transactionId: string;
  }> {
    try {
      // Create NFT metadata
      const metadata: InvoiceNFTData = {
        invoiceNumber: data.invoiceNumber,
        amount: data.amount,
        currency: data.currency,
        dueDate: data.dueDate.toISOString(),
        supplierId: data.supplierId,
        buyerId: data.buyerId,
        status: 'issued',
        createdAt: new Date().toISOString(),
      };

      // Prepare mint transaction
      const result = await this.hederaService.prepareMintNFTTransaction(
        metadata,
        data.accountId
      );

      logger.info(`Prepared mint transaction for invoice ${data.invoiceId}`);
      return result;
    } catch (error) {
      logger.error('Error preparing mint transaction:', error);
      throw error;
    }
  }

  async submitSignedMintTransaction(data: {
    invoiceId: string;
    signedTransactionBytes: string;
    transactionId: string;
  }): Promise<{
    tokenId: string;
    serialNumber: string;
    transactionId: string;
    fileId?: string;
    fileHash?: string;
    topicId?: string;
  }> {
    try {
      // Submit signed transaction
      const result = await this.hederaService.submitSignedTransaction(
        data.signedTransactionBytes,
        data.transactionId
      );

      // Update invoice with NFT info
      await this.invoiceService.updateInvoice(data.invoiceId, {
        tokenId: result.tokenId,
        serialNumber: result.serialNumber,
        status: InvoiceStatus.ISSUED,
      });

      // Add event
      await this.invoiceService.addInvoiceEvent(
        data.invoiceId,
        InvoiceEventType.NFT_MINTED,
        `NFT minted: ${result.tokenId}/${result.serialNumber}`,
        { tokenId: result.tokenId, serialNumber: result.serialNumber },
        undefined,
        undefined,
        result.transactionId
      );

      logger.info(`NFT minted for invoice ${data.invoiceId}: ${result.tokenId}/${result.serialNumber}`);
      return result;
    } catch (error) {
      logger.error('Error submitting signed mint transaction:', error);
      throw error;
    }
  }

  async prepareFundTransaction(data: {
    invoiceId: string;
    amount: number;
    accountId: string;
  }): Promise<{
    transactionBytes: string;
    transactionId: string;
    escrowAccountId: string;
  }> {
    try {
      // Prepare fund transaction
      const result = await this.hederaService.prepareFundTransaction(
        data.invoiceId,
        data.amount,
        data.accountId
      );

      logger.info(`Prepared fund transaction for invoice ${data.invoiceId}`);
      return result;
    } catch (error) {
      logger.error('Error preparing fund transaction:', error);
      throw error;
    }
  }

  async submitSignedFundTransaction(data: {
    invoiceId: string;
    signedTransactionBytes: string;
    transactionId: string;
    amount: number;
    investorId: string;
  }): Promise<{
    transactionId: string;
    escrowId: string;
  }> {
    try {
      // Submit signed transaction
      const result = await this.hederaService.submitSignedFundTransaction(
        data.signedTransactionBytes,
        data.transactionId,
        data.amount,
        data.investorId
      );

      // Update invoice status
      await this.invoiceService.updateInvoice(data.invoiceId, {
        status: InvoiceStatus.FUNDED,
      });

      // Create funding record
      await prisma.funding.create({
        data: {
          invoiceId: data.invoiceId,
          investorId: data.investorId,
          amount: data.amount,
          transactionId: result.transactionId,
          escrowId: result.escrowId,
          status: 'active',
        },
      });

      // Add event
      await this.invoiceService.addInvoiceEvent(
        data.invoiceId,
        InvoiceEventType.FUNDED,
        `Invoice funded: ${data.amount}`,
        { amount: data.amount, investorId: data.investorId },
        undefined,
        undefined,
        result.transactionId
      );

      logger.info(`Invoice ${data.invoiceId} funded by ${data.investorId}: ${data.amount}`);
      return result;
    } catch (error) {
      logger.error('Error submitting signed fund transaction:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const createInvoiceHederaService = (
  hederaService: HederaService,
  invoiceService: InvoiceService,
  config?: InvoiceHederaConfig
) => {
  return new InvoiceHederaService(hederaService, invoiceService, config);
};