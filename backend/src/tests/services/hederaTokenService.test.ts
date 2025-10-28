import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HederaTokenService, InvoiceNFTMetadata, NFTMintResult, TokenCreationResult } from '../../services/hederaTokenService';
import { Client, TokenCreateTransaction, TokenMintTransaction, TokenNftInfoQuery, TransferTransaction } from '@hashgraph/sdk';

// Mock the Hedera SDK
jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn().mockReturnValue({
      setOperator: jest.fn().mockReturnThis(),
      close: jest.fn()
    })
  },
  PrivateKey: {
    fromString: jest.fn().mockReturnValue({
      publicKey: {
        toString: jest.fn().mockReturnValue('mock-public-key')
      }
    })
  },
  AccountId: {
    fromString: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('0.0.123456')
    })
  },
  TokenCreateTransaction: jest.fn().mockImplementation(() => ({
    setTokenName: jest.fn().mockReturnThis(),
    setTokenSymbol: jest.fn().mockReturnThis(),
    setTokenType: jest.fn().mockReturnThis(),
    setSupplyType: jest.fn().mockReturnThis(),
    setInitialSupply: jest.fn().mockReturnThis(),
    setTreasuryAccountId: jest.fn().mockReturnThis(),
    setAdminKey: jest.fn().mockReturnThis(),
    setSupplyKey: jest.fn().mockReturnThis(),
    setTokenMemo: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      getReceipt: jest.fn().mockResolvedValue({
        tokenId: { toString: jest.fn().mockReturnValue('0.0.123456') }
      }),
      transactionId: { toString: jest.fn().mockReturnValue('0.0.123456@1234567890.123456789') }
    })
  })),
  TokenMintTransaction: jest.fn().mockImplementation(() => ({
    setTokenId: jest.fn().mockReturnThis(),
    setMetadata: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      getReceipt: jest.fn().mockResolvedValue({
        serials: [{ toNumber: jest.fn().mockReturnValue(1) }]
      }),
      transactionId: { toString: jest.fn().mockReturnValue('0.0.123456@1234567890.123456789') }
    })
  })),
  TokenNftInfoQuery: jest.fn().mockImplementation(() => ({
    setTokenId: jest.fn().mockReturnThis(),
    setNftId: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([{
      nftId: { tokenId: '0.0.123456', serial: 1 },
      accountId: '0.0.123456',
      creationTime: new Date(),
      metadata: Buffer.from('test-metadata')
    }])
  })),
  TokenTransferTransaction: jest.fn().mockImplementation(() => ({
    addNftTransfer: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      transactionId: { toString: jest.fn().mockReturnValue('0.0.123456@1234567890.123456789') }
    })
  })),
  TokenType: {
    NonFungibleUnique: 'NON_FUNGIBLE_UNIQUE'
  },
  TokenSupplyType: {
    Finite: 'FINITE'
  },
  NftId: jest.fn().mockImplementation((tokenId, serial) => ({
    tokenId,
    serial
  }))
}));

describe('HederaTokenService', () => {
  const mockInvoiceMetadata: InvoiceNFTMetadata = {
    invoiceId: 'test-invoice-123',
    supplierId: 'supplier-456',
    buyerId: 'buyer-789',
    amount: 1000.50,
    currency: 'USD',
    dueDate: '2024-03-15T00:00:00.000Z',
    issueDate: '2024-01-15T00:00:00.000Z',
    status: 'issued',
    description: 'Test invoice for agricultural equipment',
    documentHash: 'bafkreiabcd1234567890abcdef1234567890abcdef1234567890abcdef12',
    fileId: '0.0.200001'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNFTToken', () => {
    it('should create NFT token successfully', async () => {
      const result = await hederaTokenService.createNFTToken(
        'Test Invoice Token',
        'TIT',
        'Token for invoice NFTs'
      );

      expect(result.success).toBe(true);
      expect(result.tokenId).toBe('0.0.123456');
      expect(result.transactionId).toBe('0.0.123456@1234567890.123456789');
    });

    it('should handle token creation errors', async () => {
      const { TokenCreateTransaction } = require('@hashgraph/sdk');
      TokenCreateTransaction.mockImplementationOnce(() => ({
        setTokenName: jest.fn().mockReturnThis(),
        setTokenSymbol: jest.fn().mockReturnThis(),
        setTokenType: jest.fn().mockReturnThis(),
        setSupplyType: jest.fn().mockReturnThis(),
        setInitialSupply: jest.fn().mockReturnThis(),
        setTreasuryAccountId: jest.fn().mockReturnThis(),
        setAdminKey: jest.fn().mockReturnThis(),
        setSupplyKey: jest.fn().mockReturnThis(),
        setTokenMemo: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Network error'))
      }));

      const result = await hederaTokenService.createNFTToken(
        'Test Token',
        'TT',
        'Test memo'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('mintInvoiceNFT', () => {
    it('should mint invoice NFT successfully', async () => {
      const result = await hederaTokenService.mintInvoiceNFT(mockInvoiceMetadata);

      expect(result.success).toBe(true);
      expect(result.tokenId).toBe('0.0.6861251'); // Default token ID from env
      expect(result.serialNumber).toBe('1');
      expect(result.transactionId).toBe('0.0.123456@1234567890.123456789');
      expect(result.hashScanUrl).toContain('hashscan.io');
      expect(result.mirrorNodeUrl).toContain('mirrornode.hedera.com');
    });

    it('should handle minting errors', async () => {
      const { TokenMintTransaction } = require('@hashgraph/sdk');
      TokenMintTransaction.mockImplementationOnce(() => ({
        setTokenId: jest.fn().mockReturnThis(),
        setMetadata: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Insufficient balance'))
      }));

      const result = await hederaTokenService.mintInvoiceNFT(mockInvoiceMetadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient balance');
    });

    it('should create proper metadata for invoice NFT', async () => {
      const { TokenMintTransaction } = require('@hashgraph/sdk');
      const mockSetMetadata = jest.fn().mockReturnThis();
      
      TokenMintTransaction.mockImplementationOnce(() => ({
        setTokenId: jest.fn().mockReturnThis(),
        setMetadata: mockSetMetadata,
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            serials: [{ toNumber: jest.fn().mockReturnValue(1) }]
          }),
          transactionId: { toString: jest.fn().mockReturnValue('0.0.123456@1234567890.123456789') }
        })
      }));

      await hederaTokenService.mintInvoiceNFT(mockInvoiceMetadata);

      expect(mockSetMetadata).toHaveBeenCalledWith([
        expect.any(Buffer)
      ]);

      // Verify the metadata content
      const metadataBuffer = mockSetMetadata.mock.calls[0][0][0];
      const metadataString = metadataBuffer.toString('utf8');
      const metadata = JSON.parse(metadataString);

      expect(metadata.invoiceId).toBe(mockInvoiceMetadata.invoiceId);
      expect(metadata.amount).toBe(mockInvoiceMetadata.amount);
      expect(metadata.currency).toBe(mockInvoiceMetadata.currency);
      expect(metadata.status).toBe(mockInvoiceMetadata.status);
    });
  });

  describe('getNFTInfo', () => {
    it('should retrieve NFT information successfully', async () => {
      const result = await hederaTokenService.getNFTInfo('0.0.123456', '1');

      expect(result.nftId.tokenId).toBe('0.0.123456');
      expect(result.nftId.serial).toBe(1);
      expect(result.accountId).toBe('0.0.123456');
      expect(result.metadata).toBeInstanceOf(Buffer);
    });

    it('should handle NFT info query errors', async () => {
      const { TokenNftInfoQuery } = require('@hashgraph/sdk');
      TokenNftInfoQuery.mockImplementationOnce(() => ({
        setTokenId: jest.fn().mockReturnThis(),
        setNftId: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('NFT not found'))
      }));

      await expect(
        hederaTokenService.getNFTInfo('0.0.123456', '1')
      ).rejects.toThrow('NFT not found');
    });
  });

  describe('transferInvoiceNFT', () => {
    it('should transfer NFT successfully', async () => {
      const result = await hederaTokenService.transferInvoiceNFT(
        '0.0.123456',
        '1',
        '0.0.100001',
        '0.0.100002'
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('0.0.123456@1234567890.123456789');
    });

    it('should handle transfer errors', async () => {
      const { TokenTransferTransaction } = require('@hashgraph/sdk');
      TokenTransferTransaction.mockImplementationOnce(() => ({
        addNftTransfer: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Transfer failed'))
      }));

      const result = await hederaTokenService.transferInvoiceNFT(
        '0.0.123456',
        '1',
        '0.0.100001',
        '0.0.100002'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Transfer failed');
    });
  });
});