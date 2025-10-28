import { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { hederaTokenService, InvoiceNFTMetadata } from '../services/hederaTokenService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Validation schemas
const createInvoiceSchema = z.object({
  supplierId: z.string().min(1),
  buyerId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  dueDate: z.string().datetime(),
  description: z.string().min(1),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    total: z.number().positive()
  })).optional(),
  documentHash: z.string().optional(),
  fileId: z.string().optional()
});

const mintNFTSchema = z.object({
  invoiceId: z.string().min(1)
});

const transferNFTSchema = z.object({
  invoiceId: z.string().min(1),
  toAccountId: z.string().min(1),
  fromPrivateKey: z.string().optional()
});

export class InvoiceController {
  /**
   * Create new invoice and mint NFT
   */
  async createInvoice(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = createInvoiceSchema.parse(req.body);
      
      logger.info('Creating new invoice with NFT minting...');

      // Create invoice in database
      const invoice = await prisma.invoice.create({
        data: {
          supplierId: validatedData.supplierId,
          buyerId: validatedData.buyerId,
          amount: validatedData.amount,
          currency: validatedData.currency,
          dueDate: new Date(validatedData.dueDate),
          description: validatedData.description,
          status: 'issued',
          items: validatedData.items ? JSON.stringify(validatedData.items) : null,
          documentHash: validatedData.documentHash,
          fileId: validatedData.fileId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Prepare NFT metadata
      const nftMetadata: InvoiceNFTMetadata = {
        invoiceId: invoice.id,
        supplierId: validatedData.supplierId,
        buyerId: validatedData.buyerId,
        amount: validatedData.amount,
        currency: validatedData.currency,
        dueDate: validatedData.dueDate,
        issueDate: invoice.createdAt.toISOString(),
        status: 'issued',
        description: validatedData.description,
        documentHash: validatedData.documentHash,
        fileId: validatedData.fileId
      };

      // Mint NFT on Hedera
      const mintResult = await hederaTokenService.mintInvoiceNFT(nftMetadata);

      if (mintResult.success) {
        // Update invoice with NFT information
        const updatedInvoice = await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            nftTokenId: mintResult.tokenId,
            nftSerialNumber: mintResult.serialNumber,
            mintTransactionId: mintResult.transactionId,
            hashScanUrl: mintResult.hashScanUrl,
            mirrorNodeUrl: mintResult.mirrorNodeUrl,
            updatedAt: new Date()
          }
        });

        logger.info(`Invoice created and NFT minted: ${invoice.id} -> ${mintResult.tokenId}/${mintResult.serialNumber}`);

        res.status(201).json({
          success: true,
          data: {
            invoice: updatedInvoice,
            nft: {
              tokenId: mintResult.tokenId,
              serialNumber: mintResult.serialNumber,
              transactionId: mintResult.transactionId,
              hashScanUrl: mintResult.hashScanUrl,
              mirrorNodeUrl: mintResult.mirrorNodeUrl
            }
          }
        });
      } else {
        // NFT minting failed, but invoice was created
        logger.error(`Invoice created but NFT minting failed: ${invoice.id} - ${mintResult.error}`);
        
        res.status(201).json({
          success: true,
          data: {
            invoice,
            nft: null,
            warning: 'Invoice created but NFT minting failed: ' + mintResult.error
          }
        });
      }

    } catch (error) {
      logger.error('Error creating invoice: ' + (error instanceof Error ? error.message : String(error)));
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Mint NFT for existing invoice
   */
  async mintNFT(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId } = mintNFTSchema.parse(req.body);

      // Get invoice from database
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId }
      });

      if (!invoice) {
        res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
        return;
      }

      if (invoice.nftTokenId && invoice.nftSerialNumber) {
        res.status(400).json({
          success: false,
          error: 'NFT already minted for this invoice',
          data: {
            tokenId: invoice.nftTokenId,
            serialNumber: invoice.nftSerialNumber
          }
        });
        return;
      }

      // Prepare NFT metadata
      const nftMetadata: InvoiceNFTMetadata = {
        invoiceId: invoice.id,
        supplierId: invoice.supplierId,
        buyerId: invoice.buyerId,
        amount: invoice.amount,
        currency: invoice.currency,
        dueDate: invoice.dueDate.toISOString(),
        issueDate: invoice.createdAt.toISOString(),
        status: invoice.status as 'issued' | 'funded' | 'paid',
        description: invoice.description,
        documentHash: invoice.documentHash || undefined,
        fileId: invoice.fileId || undefined
      };

      // Mint NFT
      const mintResult = await hederaTokenService.mintInvoiceNFT(nftMetadata);

      if (mintResult.success) {
        // Update invoice with NFT information
        const updatedInvoice = await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            nftTokenId: mintResult.tokenId,
            nftSerialNumber: mintResult.serialNumber,
            mintTransactionId: mintResult.transactionId,
            hashScanUrl: mintResult.hashScanUrl,
            mirrorNodeUrl: mintResult.mirrorNodeUrl,
            updatedAt: new Date()
          }
        });

        logger.info(`NFT minted for existing invoice: ${invoiceId} -> ${mintResult.tokenId}/${mintResult.serialNumber}`);

        res.status(200).json({
          success: true,
          data: {
            invoice: updatedInvoice,
            nft: {
              tokenId: mintResult.tokenId,
              serialNumber: mintResult.serialNumber,
              transactionId: mintResult.transactionId,
              hashScanUrl: mintResult.hashScanUrl,
              mirrorNodeUrl: mintResult.mirrorNodeUrl
            }
          }
        });
      } else {
        logger.error(`NFT minting failed for invoice ${invoiceId}: ${mintResult.error}`);
        
        res.status(500).json({
          success: false,
          error: 'NFT minting failed',
          message: mintResult.error
        });
      }

    } catch (error) {
      logger.error('Error minting NFT: ' + (error instanceof Error ? error.message : String(error)));
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Transfer NFT to another account
   */
  async transferNFT(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceId, toAccountId, fromPrivateKey } = transferNFTSchema.parse(req.body);

      // Get invoice from database
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId }
      });

      if (!invoice) {
        res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
        return;
      }

      if (!invoice.nftTokenId || !invoice.nftSerialNumber) {
        res.status(400).json({
          success: false,
          error: 'No NFT found for this invoice'
        });
        return;
      }

      // Transfer NFT
      const transferResult = await hederaTokenService.transferInvoiceNFT(
        invoice.nftTokenId,
        invoice.nftSerialNumber,
        process.env.HEDERA_OPERATOR_ID!, // From operator account
        toAccountId,
        fromPrivateKey
      );

      if (transferResult.success) {
        // Update invoice with transfer information
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            currentOwnerAccountId: toAccountId,
            lastTransferTransactionId: transferResult.transactionId,
            updatedAt: new Date()
          }
        });

        logger.info(`NFT transferred: ${invoice.nftTokenId}/${invoice.nftSerialNumber} -> ${toAccountId}`);

        res.status(200).json({
          success: true,
          data: {
            transactionId: transferResult.transactionId,
            tokenId: invoice.nftTokenId,
            serialNumber: invoice.nftSerialNumber,
            toAccountId
          }
        });
      } else {
        logger.error(`NFT transfer failed: ${transferResult.error}`);
        
        res.status(500).json({
          success: false,
          error: 'NFT transfer failed',
          message: transferResult.error
        });
      }

    } catch (error) {
      logger.error('Error transferring NFT: ' + (error instanceof Error ? error.message : String(error)));
      
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Get invoice with NFT information
   */
  async getInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const invoice = await prisma.invoice.findUnique({
        where: { id }
      });

      if (!invoice) {
        res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
        return;
      }

      // Get NFT info from Hedera if available
      let nftInfo = null;
      if (invoice.nftTokenId && invoice.nftSerialNumber) {
        try {
          nftInfo = await hederaTokenService.getNFTInfo(
            invoice.nftTokenId,
            invoice.nftSerialNumber
          );
        } catch (error) {
          logger.warn(`Could not fetch NFT info: ${error}`);
        }
      }

      res.status(200).json({
        success: true,
        data: {
          invoice,
          nftInfo
        }
      });

    } catch (error) {
      logger.error('Error getting invoice: ' + (error instanceof Error ? error.message : String(error)));
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all invoices with pagination
   */
  async getInvoices(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const supplierId = req.query.supplierId as string;
      const buyerId = req.query.buyerId as string;

      const skip = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;
      if (supplierId) where.supplierId = supplierId;
      if (buyerId) where.buyerId = buyerId;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.invoice.count({ where })
      ]);

      res.status(200).json({
        success: true,
        data: {
          invoices,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Error getting invoices: ' + (error instanceof Error ? error.message : String(error)));
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['issued', 'funded', 'paid'].includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Invalid status. Must be: issued, funded, or paid'
        });
        return;
      }

      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: {
          status,
          updatedAt: new Date()
        }
      });

      logger.info(`Invoice status updated: ${id} -> ${status}`);

      res.status(200).json({
        success: true,
        data: {
          invoice: updatedInvoice
        }
      });

    } catch (error) {
      logger.error('Error updating invoice status: ' + (error instanceof Error ? error.message : String(error)));
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const invoiceController = new InvoiceController();