import { mirrorNodeService } from './mirrorNodeService';
import { invoiceService } from './invoices';
import { logger } from '../utils/logger';
import { mirrorNodeCache, CacheKeys } from './cacheService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EnrichedInvoice {
  // Database fields
  id: string;
  invoiceNumber: string;
  supplierId: string;
  buyerId?: string;
  agentId?: string;
  amount: number;
  currency: string;
  dueDate: Date;
  description?: string;
  status: string;
  nftTokenId?: string;
  nftSerialNumber?: string;
  fileId?: string;
  fileHash?: string;
  topicId?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Relations
  supplier?: any;
  agent?: any;
  events?: any[];
  fundings?: any[];
  
  // Mirror Node enriched data
  onChainData?: {
    nftInfo?: {
      tokenId: string;
      serialNumber: number;
      accountId: string;
      createdTimestamp: string;
      modifiedTimestamp: string;
      metadata?: string;
    };
    hcsTimeline?: {
      tokenId: string;
      serialNumber: string;
      status: string;
      timestamp: string;
      sequenceNumber: number;
      transactionId?: string;
    }[];
    fileInfo?: {
      fileId: string;
      size?: number;
      hash?: string;
    };
    mintTransaction?: {
      transactionId: string;
      timestamp: string;
      status: string;
    };
  };
}

export interface InvoiceListResponse {
  data: EnrichedInvoice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class InvoiceDataMerger {


   /**
    * Get detailed invoice by tokenId and serial number
    */
   async getDetailedInvoice(tokenId: string, serialNumber: number): Promise<EnrichedInvoice | null> {
     try {
       // First try to get from database by tokenId and serialNumber
       const invoice = await this.findInvoiceByNft(tokenId, serialNumber.toString());
 
       if (invoice) {
         // Enrich with Mirror Node data
         return await this.enrichInvoiceWithMirrorData(invoice);
       }
 
       // If not found in DB, try to create from NFT metadata
       const nftInfo = await mirrorNodeService.getNFTInfo(tokenId, serialNumber.toString());
       if (nftInfo && nftInfo.metadata) {
         return await this.createMinimalInvoiceFromNft(nftInfo);
       }
 
       return null;
     } catch (error) {
       logger.error({ error }, 'Error getting detailed invoice');
       throw error;
     }
   }

  /**
   * Get enriched invoices list with Mirror Node data
   */
  async getEnrichedInvoices(
    page = 1,
    limit = 10,
    filters: {
      status?: string;
      supplierId?: string;
    } = {}
  ): Promise<InvoiceListResponse> {
    try {
      let dbResult;
      
      // Apply filters
      if (filters.status) {
        dbResult = await invoiceService.getInvoicesByStatus(filters.status as any, page, limit);
      } else if (filters.supplierId) {
        dbResult = await invoiceService.getInvoicesBySupplier(filters.supplierId, page, limit);
      } else {
        dbResult = await invoiceService.getAllInvoices(page, limit);
      }
      
      // Enrich each invoice with Mirror Node data
      const enrichedInvoices = await Promise.all(
        dbResult.invoices.map(async (invoice) => {
          return this.enrichInvoiceWithMirrorData(invoice);
        })
      );

      return {
        data: enrichedInvoices,
        pagination: dbResult.pagination,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get enriched invoices');
      throw error;
    }
  }

  /**
   * Get a single enriched invoice by ID
   */
  async getEnrichedInvoiceById(id: string): Promise<EnrichedInvoice | null> {
    try {
      const invoice = await invoiceService.getInvoiceById(id);
      if (!invoice) {
        return null;
      }

      return this.enrichInvoiceWithMirrorData(invoice);
    } catch (error) {
      logger.error({ id, error }, `Failed to get enriched invoice ${id}`);
      throw error;
    }
  }

  /**
   * Get enriched invoice by NFT token and serial
   */
  async getEnrichedInvoiceByNft(
    tokenId: string,
    serialNumber: number
  ): Promise<EnrichedInvoice | null> {
    try {
      // First, try to find the invoice in the database
      const invoice = await this.findInvoiceByNft(tokenId, serialNumber.toString());
      
      if (invoice) {
        return this.enrichInvoiceWithMirrorData(invoice);
      }

      // If not found in DB, try to get NFT data from Mirror Node
      // and create a minimal invoice object
      const nftInfo = await mirrorNodeService.getNFTInfo(tokenId, serialNumber.toString());
      
      if (!nftInfo) {
        return null;
      }

      // Create a minimal invoice object from NFT metadata
      const minimalInvoice = await this.createMinimalInvoiceFromNft(nftInfo);
      return this.enrichInvoiceWithMirrorData(minimalInvoice);
    } catch (error) {
      logger.error({ tokenId, serialNumber, error }, `Failed to get enriched invoice by NFT ${tokenId}/${serialNumber}`);
      throw error;
    }
  }

  /**
   * Enrich a single invoice with Mirror Node data
   */
  async enrichInvoiceWithMirrorData(invoice: any): Promise<EnrichedInvoice> {
    const enriched: EnrichedInvoice = {
      ...invoice,
      onChainData: {},
    };

    try {
      // Get NFT information if available
      if (invoice.nftTokenId && invoice.nftSerialNumber) {
        const nftInfo = await mirrorNodeService.getNFTInfo(
          invoice.nftTokenId,
          invoice.nftSerialNumber
        );
        
        if (nftInfo) {
          enriched.onChainData!.nftInfo = {
            tokenId: nftInfo.token_id,
            serialNumber: nftInfo.serial_number,
            accountId: nftInfo.account_id,
            createdTimestamp: nftInfo.created_timestamp,
            modifiedTimestamp: nftInfo.modified_timestamp,
            ...(nftInfo.metadata && { metadata: nftInfo.metadata }),
          };
        }
      }

      // Get HCS timeline if topic ID is available
      if (invoice.topicId) {
        const timeline = await this.getInvoiceTimeline(
          invoice.topicId,
          invoice.nftTokenId
        );
        enriched.onChainData!.hcsTimeline = timeline;
      }

      // Get file information if available
      if (invoice.fileId) {
        // File info is stored in the invoice record itself
        enriched.onChainData!.fileInfo = {
          fileId: invoice.fileId,
          hash: invoice.fileHash,
        };
      }

    } catch (error) {
      logger.warn({ invoiceId: invoice.id, error }, `Failed to enrich invoice ${invoice.id} with Mirror Node data`);
      // Continue without Mirror Node data if there's an error
    }

    return enriched;
  }

  /**
   * Get invoice timeline from HCS messages
   */
  private async getInvoiceTimeline(
    topicId: string,
    tokenId?: string
  ): Promise<any[]> {
    try {
      const cacheKey = CacheKeys.invoiceMessages(topicId, tokenId);
      
      return mirrorNodeCache.getOrSet(cacheKey, async () => {
        const hcsMessages = await mirrorNodeService.getHCSMessages(topicId);
        const parsedMessages = mirrorNodeService.parseInvoiceMessages(hcsMessages);
        
        // Filter by tokenId if provided
        const filteredMessages = tokenId 
          ? parsedMessages.filter((msg: any) => msg.tokenId === tokenId)
          : parsedMessages;
        
        return filteredMessages.map((msg: any) => ({
          tokenId: msg.tokenId,
          serialNumber: msg.serialNumber,
          status: msg.status,
          timestamp: msg.timestamp,
          sequenceNumber: msg.sequenceNumber,
          transactionId: msg.transactionId,
        }));
      }, 60000); // 1 minute cache
    } catch (error) {
      logger.warn({ topicId, error }, `Failed to get invoice timeline for topic ${topicId}`);
      return [];
    }
  }

  /**
   * Find invoice by NFT token and serial in database
   */
  private async findInvoiceByNft(
    tokenId: string,
    serialNumber: string
  ): Promise<any | null> {
    try {
      const invoice = await prisma.invoice.findFirst({
        where: {
          nftTokenId: tokenId,
          nftSerialNumber: serialNumber,
        },
        include: {
          supplier: {
            select: { id: true, name: true, email: true }
          },
          agent: {
            select: { id: true, name: true, email: true }
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          fundings: {
            include: {
              investor: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      });
      
      return invoice;
    } catch (error) {
      logger.error({ tokenId, serialNumber, error }, `Failed to find invoice by NFT ${tokenId}/${serialNumber}`);
      return null;
    }
  }

  /**
   * Create a minimal invoice object from NFT metadata
   */
  private async createMinimalInvoiceFromNft(nftInfo: any): Promise<any> {
    try {
      let metadata = {};
      
      if (nftInfo.metadata) {
        try {
          // Try to decode base64 metadata
          const decodedMetadata = Buffer.from(nftInfo.metadata, 'base64').toString('utf-8');
          metadata = JSON.parse(decodedMetadata);
        } catch (error) {
          logger.warn({ error }, 'Failed to parse NFT metadata');
        }
      }

      // Create minimal invoice object
      return {
        id: `nft-${nftInfo.token_id}-${nftInfo.serial_number}`,
        invoiceNumber: (metadata as any).invoiceNumber || `NFT-${nftInfo.serial_number}`,
        supplierId: (metadata as any).supplierId || 'unknown',
        buyerId: (metadata as any).buyerId,
        amount: parseFloat((metadata as any).amount || '0'),
        currency: (metadata as any).currency || 'HBAR',
        dueDate: new Date((metadata as any).dueDate || nftInfo.created_timestamp),
        description: (metadata as any).description || 'Invoice from NFT',
        status: 'ISSUED',
        nftTokenId: nftInfo.token_id,
        nftSerialNumber: nftInfo.serial_number.toString(),
        fileId: (metadata as any).fileId,
        fileHash: (metadata as any).fileHash,
        createdAt: new Date(nftInfo.created_timestamp),
        updatedAt: new Date(nftInfo.modified_timestamp),
        supplier: null,
        agent: null,
        events: [],
        fundings: [],
      };
    } catch (error) {
      logger.error({ error }, 'Failed to create minimal invoice from NFT');
      throw error;
    }
  }

  /**
   * Get invoice statistics with on-chain data
   */
  async getInvoiceStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    onChainCount: number;
    totalValue: number;
  }> {
    try {
      const [total, byStatus, onChainCount, totalValue] = await Promise.all([
        prisma.invoice.count(),
        prisma.invoice.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        prisma.invoice.count({
          where: {
            nftTokenId: { not: null },
          },
        }),
        prisma.invoice.aggregate({
          _sum: { amount: true },
        }),
      ]);
      
      const statusCounts = byStatus.reduce((acc: Record<string, number>, item: any) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {} as Record<string, number>);

      return {
        total,
        byStatus: statusCounts,
        onChainCount,
        totalValue: totalValue._sum.amount || 0,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get invoice stats');
      throw error;
    }
  }
}

export const invoiceDataMerger = new InvoiceDataMerger();