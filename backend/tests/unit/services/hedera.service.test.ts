import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HederaTokenService } from '../../../src/services/hedera-token.js';
import { HederaFileService } from '../../../src/services/hedera-file.js';
import { HederaConsensusService } from '../../../src/services/hedera-consensus.js';

// Mock Hedera SDK
jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn(() => ({
      setOperator: jest.fn(),
      close: jest.fn()
    }))
  },
  TokenCreateTransaction: jest.fn(() => ({
    setTokenName: jest.fn().mockReturnThis(),
    setTokenSymbol: jest.fn().mockReturnThis(),
    setTokenType: jest.fn().mockReturnThis(),
    setSupplyType: jest.fn().mockReturnThis(),
    setInitialSupply: jest.fn().mockReturnThis(),
    setTreasuryAccountId: jest.fn().mockReturnThis(),
    setAdminKey: jest.fn().mockReturnThis(),
    setSupplyKey: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    execute: jest.fn()
  })),
  TokenMintTransaction: jest.fn(() => ({
    setTokenId: jest.fn().mockReturnThis(),
    setMetadata: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    execute: jest.fn()
  })),
  FileCreateTransaction: jest.fn(() => ({
    setContents: jest.fn().mockReturnThis(),
    setKeys: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    execute: jest.fn()
  })),
  TopicCreateTransaction: jest.fn(() => ({
    setTopicMemo: jest.fn().mockReturnThis(),
    setAdminKey: jest.fn().mockReturnThis(),
    setSubmitKey: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    execute: jest.fn()
  })),
  TopicMessageSubmitTransaction: jest.fn(() => ({
    setTopicId: jest.fn().mockReturnThis(),
    setMessage: jest.fn().mockReturnThis(),
    freezeWith: jest.fn().mockReturnThis(),
    execute: jest.fn()
  })),
  PrivateKey: {
    fromString: jest.fn(() => ({
      publicKey: 'mock-public-key'
    }))
  },
  AccountId: {
    fromString: jest.fn()
  },
  TokenId: {
    fromString: jest.fn()
  },
  FileId: {
    fromString: jest.fn()
  },
  TopicId: {
    fromString: jest.fn()
  },
  TokenType: {
    NonFungibleUnique: 'NON_FUNGIBLE_UNIQUE'
  },
  TokenSupplyType: {
    Finite: 'FINITE'
  }
}));

describe('HederaTokenService', () => {
  let tokenService: HederaTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    tokenService = new HederaTokenService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createNFTCollection', () => {
    it('should create NFT collection successfully', async () => {
      const mockReceipt = {
        tokenId: { toString: () => '0.0.123456' }
      };
      
      const mockTransaction = {
        setTokenName: jest.fn().mockReturnThis(),
        setTokenSymbol: jest.fn().mockReturnThis(),
        setTokenType: jest.fn().mockReturnThis(),
        setSupplyType: jest.fn().mockReturnThis(),
        setInitialSupply: jest.fn().mockReturnThis(),
        setTreasuryAccountId: jest.fn().mockReturnThis(),
        setAdminKey: jest.fn().mockReturnThis(),
        setSupplyKey: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue(mockReceipt)
        })
      };

      // Mock the TokenCreateTransaction constructor
      const { TokenCreateTransaction } = await import('@hashgraph/sdk');
      (TokenCreateTransaction as jest.Mock).mockImplementation(() => mockTransaction);

      const result = await tokenService.createNFTCollection('Test Collection', 'TEST');

      expect(result.success).toBe(true);
      expect(result.data.tokenId).toBe('0.0.123456');
      expect(mockTransaction.setTokenName).toHaveBeenCalledWith('Test Collection');
      expect(mockTransaction.setTokenSymbol).toHaveBeenCalledWith('TEST');
    });

    it('should handle creation errors', async () => {
      const mockTransaction = {
        setTokenName: jest.fn().mockReturnThis(),
        setTokenSymbol: jest.fn().mockReturnThis(),
        setTokenType: jest.fn().mockReturnThis(),
        setSupplyType: jest.fn().mockReturnThis(),
        setInitialSupply: jest.fn().mockReturnThis(),
        setTreasuryAccountId: jest.fn().mockReturnThis(),
        setAdminKey: jest.fn().mockReturnThis(),
        setSupplyKey: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Network error'))
      };

      const { TokenCreateTransaction } = await import('@hashgraph/sdk');
      (TokenCreateTransaction as jest.Mock).mockImplementation(() => mockTransaction);

      const result = await tokenService.createNFTCollection('Test Collection', 'TEST');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('mintNFT', () => {
    it('should mint NFT successfully', async () => {
      const mockReceipt = {
        serials: [{ low: 1, high: 0 }]
      };
      
      const mockTransaction = {
        setTokenId: jest.fn().mockReturnThis(),
        setMetadata: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue(mockReceipt)
        })
      };

      const { TokenMintTransaction } = await import('@hashgraph/sdk');
      (TokenMintTransaction as jest.Mock).mockImplementation(() => mockTransaction);

      const metadata = { invoiceId: 'test-invoice', amount: 1000 };
      const result = await tokenService.mintNFT('0.0.123456', metadata);

      expect(result.success).toBe(true);
      expect(result.data.serialNumber).toBe(1);
      expect(mockTransaction.setTokenId).toHaveBeenCalled();
      expect(mockTransaction.setMetadata).toHaveBeenCalledWith([Buffer.from(JSON.stringify(metadata))]);
    });
  });
});

describe('HederaFileService', () => {
  let fileService: HederaFileService;

  beforeEach(() => {
    jest.clearAllMocks();
    fileService = new HederaFileService();
  });

  describe('uploadFile', () => {
    it('should upload file successfully', async () => {
      const mockReceipt = {
        fileId: { toString: () => '0.0.789012' }
      };
      
      const mockTransaction = {
        setContents: jest.fn().mockReturnThis(),
        setKeys: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue(mockReceipt)
        })
      };

      const { FileCreateTransaction } = await import('@hashgraph/sdk');
      (FileCreateTransaction as jest.Mock).mockImplementation(() => mockTransaction);

      const fileContent = Buffer.from('test file content');
      const result = await fileService.uploadFile(fileContent);

      expect(result.success).toBe(true);
      expect(result.data.fileId).toBe('0.0.789012');
      expect(mockTransaction.setContents).toHaveBeenCalledWith(fileContent);
    });

    it('should handle upload errors', async () => {
      const mockTransaction = {
        setContents: jest.fn().mockReturnThis(),
        setKeys: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Upload failed'))
      };

      const { FileCreateTransaction } = await import('@hashgraph/sdk');
      (FileCreateTransaction as jest.Mock).mockImplementation(() => mockTransaction);

      const fileContent = Buffer.from('test file content');
      const result = await fileService.uploadFile(fileContent);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Upload failed');
    });
  });
});

describe('HederaConsensusService', () => {
  let consensusService: HederaConsensusService;

  beforeEach(() => {
    jest.clearAllMocks();
    consensusService = new HederaConsensusService();
  });

  describe('createTopic', () => {
    it('should create topic successfully', async () => {
      const mockReceipt = {
        topicId: { toString: () => '0.0.6984577' }
      };
      
      const mockTransaction = {
        setTopicMemo: jest.fn().mockReturnThis(),
        setAdminKey: jest.fn().mockReturnThis(),
        setSubmitKey: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue(mockReceipt)
        })
      };

      const { TopicCreateTransaction } = await import('@hashgraph/sdk');
      (TopicCreateTransaction as jest.Mock).mockImplementation(() => mockTransaction);

      const result = await consensusService.createTopic('Test Topic');

      expect(result.success).toBe(true);
      expect(result.data.topicId).toBe('0.0.6984577');
      expect(mockTransaction.setTopicMemo).toHaveBeenCalledWith('Test Topic');
    });
  });

  describe('submitMessage', () => {
    it('should submit message successfully', async () => {
      const mockReceipt = {
        topicSequenceNumber: { low: 1, high: 0 }
      };
      
      const mockTransaction = {
        setTopicId: jest.fn().mockReturnThis(),
        setMessage: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue(mockReceipt)
        })
      };

      const { TopicMessageSubmitTransaction } = await import('@hashgraph/sdk');
      (TopicMessageSubmitTransaction as jest.Mock).mockImplementation(() => mockTransaction);

      const message = { type: 'INVOICE_CREATED', invoiceId: 'test-invoice' };
      const result = await consensusService.submitMessage('0.0.6984577', message);

      expect(result.success).toBe(true);
      expect(result.data.sequenceNumber).toBe(1);
      expect(mockTransaction.setTopicId).toHaveBeenCalled();
      expect(mockTransaction.setMessage).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should handle submission errors', async () => {
      const mockTransaction = {
        setTopicId: jest.fn().mockReturnThis(),
        setMessage: jest.fn().mockReturnThis(),
        freezeWith: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('Submission failed'))
      };

      const { TopicMessageSubmitTransaction } = await import('@hashgraph/sdk');
      (TopicMessageSubmitTransaction as jest.Mock).mockImplementation(() => mockTransaction);

      const message = { type: 'INVOICE_CREATED', invoiceId: 'test-invoice' };
      const result = await consensusService.submitMessage('0.0.6984577', message);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Submission failed');
    });
  });
});