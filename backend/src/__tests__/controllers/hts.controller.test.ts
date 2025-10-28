import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Fastify from 'fastify';
import { HTSController } from '../../controllers/hts.controller';
import { HederaService } from '../../services/hedera';
import { CacheService } from '../../services/cacheService';

// Mock the entire HederaService module
jest.mock('../../services/hedera');

describe('HTSController', () => {
  let app: FastifyInstance;
  let htsController: HTSController;
  let mockHederaService: any;

  beforeEach(async () => {
    app = Fastify();
    
    // Mock HederaService with only the methods we need
    mockHederaService = {
      createInvoiceNFTToken: jest.fn(),
      mintInvoiceNFT: jest.fn(),
      getNFTInfo: jest.fn()
    };
    
    htsController = new HTSController(mockHederaService as HederaService);
  });

  afterEach(async () => {
    // Clean up cache timers to prevent Jest hanging
    CacheService.clearAllCaches();
    await app.close();
    jest.clearAllMocks();
  });

  describe('createToken', () => {
    it('should create token successfully', async () => {
      const mockRequest = {
        name: 'YieldHarvest Invoice NFT',
        symbol: 'YHINV',
        memo: 'Invoice NFT collection'
      };

      const mockTokenResult = {
        tokenId: '0.0.123456',
        transactionId: '0.0.123@1234567890.123456789',
        status: 'SUCCESS'
      };

      mockHederaService.createInvoiceNFTToken.mockResolvedValue(mockTokenResult);

      const request = {
        body: mockRequest
      } as FastifyRequest<{ Body: typeof mockRequest }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await htsController.createToken(request, reply);

      expect(mockHederaService.createInvoiceNFTToken).toHaveBeenCalledWith(
        mockRequest.name,
        mockRequest.symbol,
        mockRequest.memo
      );
      expect(reply.send).toHaveBeenCalledWith({
        message: 'NFT token created successfully',
        tokenId: mockTokenResult.tokenId,
        transactionId: mockTokenResult.transactionId,
        name: mockRequest.name,
        symbol: mockRequest.symbol,
        memo: mockRequest.memo,
        hashScanUrl: `https://hashscan.io/testnet/transaction/${mockTokenResult.transactionId}`,
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${mockTokenResult.transactionId}`,
        tokenUrl: `https://hashscan.io/testnet/token/${mockTokenResult.tokenId}`
      });
    });

    it('should handle token creation failure', async () => {
      const mockRequest = {
        name: 'YieldHarvest Invoice NFT',
        symbol: 'YHINV'
      };

      mockHederaService.createInvoiceNFTToken.mockRejectedValue(new Error('Token creation failed'));

      const request = {
        body: mockRequest
      } as FastifyRequest<{ Body: typeof mockRequest }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await htsController.createToken(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Failed to create token',
        code: 'TOKEN_CREATE_ERROR',
        message: 'Token creation failed'
      });
    });
  });

  describe('mintNFT', () => {
    it('should mint NFT successfully', async () => {
      const mockBody = {
        tokenId: '0.0.123456',
        invoiceId: 'INV-001',
        invoiceNumber: 'INV-2024-001',
        amount: '1000.00',
        currency: 'USD',
        dueDate: '2024-12-31T23:59:59.000Z',
        supplierId: 'SUPP-001',
        buyerId: 'BUYER-001',
        fileId: '0.0.789012',
        fileHash: 'abc123hash',
        metadata: { description: 'Test invoice' }
      };

      const mockMintResult = {
        serialNumber: '1',
        transactionId: '0.0.123456@1234567890.123456789'
      };

      mockHederaService.mintInvoiceNFT.mockResolvedValue(mockMintResult);

      const request = {
        body: mockBody
      } as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await htsController.mintNFT(request as any, reply);

      expect(mockHederaService.mintInvoiceNFT).toHaveBeenCalledWith(
        mockBody.tokenId,
        {
          invoiceId: mockBody.invoiceId,
          invoiceNumber: mockBody.invoiceNumber,
          amount: mockBody.amount,
          currency: mockBody.currency,
          dueDate: mockBody.dueDate,
          supplierId: mockBody.supplierId,
          buyerId: mockBody.buyerId,
          fileId: mockBody.fileId,
          fileHash: mockBody.fileHash
        }
      );
      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith({
        message: 'Invoice NFT minted successfully',
        tokenId: mockBody.tokenId,
        serialNumber: mockMintResult.serialNumber,
        transactionId: mockMintResult.transactionId,
        invoiceId: mockBody.invoiceId,
        invoiceNumber: mockBody.invoiceNumber,
        amount: mockBody.amount,
        currency: mockBody.currency,
        hashScanUrl: `https://hashscan.io/testnet/transaction/${mockMintResult.transactionId}`,
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${mockMintResult.transactionId}`,
        nftUrl: `https://hashscan.io/testnet/token/${mockBody.tokenId}/${mockMintResult.serialNumber}`
      });
    });

    it('should handle NFT minting failure', async () => {
      const mockBody = {
        tokenId: '0.0.123456',
        invoiceId: 'INV-001',
        invoiceNumber: 'INV-2024-001',
        amount: '1000.00',
        currency: 'USD',
        dueDate: '2024-12-31T23:59:59.000Z',
        supplierId: 'SUPP-001',
        buyerId: 'BUYER-001'
      };

      mockHederaService.mintInvoiceNFT.mockRejectedValue(new Error('Minting failed'));

      const request = {
        body: mockBody
      } as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await htsController.mintNFT(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Failed to mint NFT',
        code: 'NFT_MINT_ERROR',
        message: 'Minting failed'
      });
    });
  });

  describe('getNFT', () => {
    it('should get NFT info successfully', async () => {
      const mockParams = {
        tokenId: '0.0.123456',
        serialNumber: '1'
      };

      const mockNFTData = {
        account_id: '0.0.789012',
        created_timestamp: '2024-01-01T00:00:00.000Z',
        metadata: 'eyJpbnZvaWNlSWQiOiJJTlYtMDAxIn0=',
        serial_number: 1,
        token_id: '0.0.123456'
      };

      mockHederaService.getNFTInfo.mockResolvedValue(mockNFTData);

      const request = {
        params: mockParams
      } as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await htsController.getNFT(request as any, reply);

      expect(mockHederaService.getNFTInfo).toHaveBeenCalledWith(
        mockParams.tokenId,
        mockParams.serialNumber
      );
      expect(reply.send).toHaveBeenCalledWith({
        tokenId: '0.0.123456',
        serialNumber: '1',
        nftInfo: mockNFTData,
        hashScanUrl: 'https://hashscan.io/testnet/token/0.0.123456/1',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com/api/v1/tokens/0.0.123456/nfts/1'
      });
    });

    it('should handle NFT not found', async () => {
      const mockParams = {
        tokenId: '0.0.999999',
        serialNumber: '1'
      };

      mockHederaService.getNFTInfo.mockResolvedValue(null);

      const request = {
        params: mockParams
      } as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await htsController.getNFT(request as any, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'NFT not found',
        code: 'NFT_NOT_FOUND',
        tokenId: '0.0.999999',
        serialNumber: '1'
      });
    });
  });

  describe('listNFTs', () => {
    it('should handle invalid token ID in listNFTs', async () => {
      const mockParams = {
        tokenId: 'invalid-token'
      };

      const request = {
        params: mockParams,
        query: {},
        url: '/api/hedera/hts/invalid-token/nfts',
        method: 'GET'
      } as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await htsController.listNFTs(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Invalid token ID format',
        code: 'INVALID_TOKEN_ID',
      });
    });
  });

  describe('getToken', () => {
    it('should return placeholder message for getToken', async () => {
      const mockParams = {
        tokenId: '0.0.123456'
      };

      const request = {
        params: mockParams
      } as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await htsController.getToken(request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        message: 'Token info retrieval not implemented yet',
        tokenId: '0.0.123456',
        note: 'This endpoint would typically query Mirror Node for token data',
        suggestion: 'Use Mirror Node API to query token information',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com/api/v1/tokens/0.0.123456',
        hashScanUrl: 'https://hashscan.io/testnet/token/0.0.123456'
      });
    });

    it('should handle invalid token ID in getToken', async () => {
      const mockParams = {
        tokenId: 'invalid-token'
      };

      const request = {
        params: mockParams
      } as FastifyRequest;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await htsController.getToken(request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'Invalid token ID format',
        code: 'INVALID_TOKEN_ID'
      });
    });
  });
});