import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HederaService, InvoiceNFTData } from '../services/hedera';
import { auditLogger } from '../utils/logger';
import { mirrorNodeService } from '../services/mirrorNodeService';

// Zod schemas for validation
const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase alphanumeric'),
  memo: z.string().max(100).optional(),
});

const mintNFTSchema = z.object({
  tokenId: z.string().regex(/^0\.0\.\d+$/, 'Invalid Hedera Token ID format'),
  invoiceId: z.string().min(1).max(50),
  invoiceNumber: z.string().min(1).max(50),
  amount: z.string().regex(/^\d+(\.\d{1,8})?$/, 'Invalid amount format'),
  currency: z.string().length(3).regex(/^[A-Z]{3}$/, 'Currency must be 3-letter code'),
  dueDate: z.string().datetime(),
  supplierId: z.string().min(1).max(50),
  buyerId: z.string().min(1).max(50),
  fileId: z.string().regex(/^0\.0\.\d+$/, 'Invalid Hedera File ID format').optional(),
  fileHash: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

const getNFTSchema = z.object({
  tokenId: z.string().regex(/^0\.0\.\d+$/, 'Invalid Hedera Token ID format'),
  serialNumber: z.string().regex(/^\d+$/, 'Invalid serial number format'),
});

interface CreateTokenRequest extends FastifyRequest {
  body: z.infer<typeof createTokenSchema>;
}

interface MintNFTRequest extends FastifyRequest {
  body: z.infer<typeof mintNFTSchema>;
}

interface GetNFTRequest extends FastifyRequest {
  params: z.infer<typeof getNFTSchema>;
}

export class HTSController {
  constructor(private hederaService: HederaService) {}

  /**
   * Create a new NFT token for invoices
   * POST /api/hedera/hts/tokens
   */
  async createToken(request: CreateTokenRequest, reply: FastifyReply) {
    try {
      const { name, symbol, memo } = createTokenSchema.parse(request.body);

      // Create NFT token on Hedera
      const tokenResult = await this.hederaService.createInvoiceNFTToken(
        name,
        symbol,
        memo
      );

      // Log successful token creation
      auditLogger.logHederaTransaction({
        txId: tokenResult.transactionId,
        tokenId: tokenResult.tokenId,
        action: 'token_create',
        success: true,
      });

      return reply.status(201).send({
        message: 'NFT token created successfully',
        tokenId: tokenResult.tokenId,
        transactionId: tokenResult.transactionId,
        name,
        symbol,
        memo,
        hashScanUrl: `https://hashscan.io/testnet/transaction/${tokenResult.transactionId}`,
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${tokenResult.transactionId}`,
        tokenUrl: `https://hashscan.io/testnet/token/${tokenResult.tokenId}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      auditLogger.logHederaTransaction({
        action: 'token_create',
        success: false,
        errorMessage,
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'Failed to create token',
        code: 'TOKEN_CREATE_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Mint an invoice NFT
   * POST /api/hedera/hts/mint
   */
  async mintNFT(request: MintNFTRequest, reply: FastifyReply) {
    try {
      const validatedData = mintNFTSchema.parse(request.body);

      // Prepare NFT metadata
      const nftMetadata: InvoiceNFTData = {
        invoiceId: validatedData.invoiceId,
        invoiceNumber: validatedData.invoiceNumber,
        amount: validatedData.amount,
        currency: validatedData.currency,
        dueDate: validatedData.dueDate,
        supplierId: validatedData.supplierId,
        buyerId: validatedData.buyerId,
        fileId: validatedData.fileId,
        fileHash: validatedData.fileHash,
      };

      // Mint NFT on Hedera
      const mintResult = await this.hederaService.mintInvoiceNFT(
        validatedData.tokenId,
        nftMetadata
      );

      // Log successful NFT minting
      auditLogger.logHederaTransaction({
        txId: mintResult.transactionId,
        tokenId: validatedData.tokenId,
        action: 'nft_mint',
        success: true,
      });

      return reply.status(201).send({
        message: 'Invoice NFT minted successfully',
        tokenId: validatedData.tokenId,
        serialNumber: mintResult.serialNumber,
        transactionId: mintResult.transactionId,
        invoiceId: validatedData.invoiceId,
        invoiceNumber: validatedData.invoiceNumber,
        amount: validatedData.amount,
        currency: validatedData.currency,
        hashScanUrl: `https://hashscan.io/testnet/transaction/${mintResult.transactionId}`,
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${mintResult.transactionId}`,
        nftUrl: `https://hashscan.io/testnet/token/${validatedData.tokenId}/${mintResult.serialNumber}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      auditLogger.logHederaTransaction({
        tokenId: request.body?.tokenId,
        action: 'nft_mint',
        success: false,
        errorMessage,
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'Failed to mint NFT',
        code: 'NFT_MINT_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Get NFT information
   * GET /api/hedera/hts/:tokenId/:serialNumber
   */
  async getNFT(request: GetNFTRequest, reply: FastifyReply) {
    try {
      const { tokenId, serialNumber } = getNFTSchema.parse(request.params);

      // Get NFT info from Hedera
      const nftInfo = await this.hederaService.getNFTInfo(tokenId, serialNumber);

      if (!nftInfo) {
        return reply.status(404).send({
          error: 'NFT not found',
          code: 'NFT_NOT_FOUND',
          tokenId,
          serialNumber,
        });
      }

      // Log NFT access
      auditLogger.logHederaTransaction({
        tokenId,
        action: 'nft_get',
        success: true,
      });

      return reply.send({
        tokenId,
        serialNumber,
        nftInfo,
        hashScanUrl: `https://hashscan.io/testnet/token/${tokenId}/${serialNumber}`,
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/tokens/${tokenId}/nfts/${serialNumber}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      auditLogger.logHederaTransaction({
        tokenId: request.params?.tokenId,
        action: 'nft_get',
        success: false,
        errorMessage,
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid parameters',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'Failed to retrieve NFT',
        code: 'NFT_GET_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * List NFTs for a token (placeholder)
   * GET /api/hedera/hts/:tokenId/nfts
   */
  /**
   * List NFTs for a token
   * GET /api/hedera/hts/:tokenId/nfts
   */
  async listNFTs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tokenId = (request.params as any)?.tokenId;
      
      if (!tokenId || !/^0\.0\.\d+$/.test(tokenId)) {
        return reply.status(400).send({
          error: 'Invalid token ID format',
          code: 'INVALID_TOKEN_ID',
        });
      }

      // Parse query parameters for pagination and filtering
      const query = request.query as any;
      const limit = Math.min(parseInt(query.limit) || 25, 100); // Max 100 NFTs per request
      const order = query.order === 'asc' ? 'asc' : 'desc';

      // Log API request
      auditLogger.logApiRequest({
        correlationId: 'hts-list-' + Date.now(),
        endpoint: request.url,
        method: request.method,
        statusCode: 200,
        duration: 0,
      });

      // Fetch NFTs from Mirror Node
      const nfts = await mirrorNodeService.getNFTsByToken(tokenId, limit);

      // Transform NFT data for response
      const transformedNfts = nfts.map(nft => ({
        tokenId: nft.token_id,
        serialNumber: nft.serial_number,
        accountId: nft.account_id,
        createdTimestamp: nft.created_timestamp,
        modifiedTimestamp: nft.modified_timestamp,
        metadata: nft.metadata ? JSON.parse(Buffer.from(nft.metadata, 'base64').toString()) : null,
        spender: nft.spender,
        hashScanUrl: mirrorNodeService.generateHashScanLinks({
          tokenId: nft.token_id
        }).token,
        mirrorNodeUrl: `${process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com'}/api/v1/tokens/${nft.token_id}/nfts/${nft.serial_number}`
      }));

      return reply.send({
        success: true,
        tokenId,
        nfts: transformedNfts,
        count: transformedNfts.length,
        limit,
        order,
        links: {
          hashScan: mirrorNodeService.generateHashScanLinks({ tokenId }).token,
          mirrorNode: `${process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com'}/api/v1/tokens/${tokenId}/nfts`
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return reply.status(500).send({
        error: 'Failed to list NFTs',
        code: 'LIST_NFTS_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Get token information
   * GET /api/hedera/hts/tokens/:tokenId
   */
  async getToken(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tokenId = (request.params as any)?.tokenId;
      
      if (!tokenId || !/^0\.0\.\d+$/.test(tokenId)) {
        return reply.status(400).send({
          error: 'Invalid token ID format',
          code: 'INVALID_TOKEN_ID',
        });
      }

      // Log token access
      auditLogger.logHederaTransaction({
        tokenId,
        action: 'token_get',
        success: true,
      });

      return reply.send({
        message: 'Token info retrieval not implemented yet',
        tokenId,
        note: 'This endpoint would typically query Mirror Node for token data',
        suggestion: 'Use Mirror Node API to query token information',
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/tokens/${tokenId}`,
        hashScanUrl: `https://hashscan.io/testnet/token/${tokenId}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      auditLogger.logHederaTransaction({
        tokenId: (request.params as any)?.tokenId,
        action: 'token_get',
        success: false,
        errorMessage,
      });

      return reply.status(500).send({
        error: 'Failed to retrieve token',
        code: 'TOKEN_GET_ERROR',
        message: errorMessage,
      });
    }
  }
}