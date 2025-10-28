import { it, expect, describe, beforeAll, afterAll, jest } from '@jest/globals';
import { HederaService, HederaConfig, NFTMetadata, InvoiceNFTData, HFSUploadResult, HCSMessageData } from '../../src/services/hedera';
import { logger } from '../../src/utils/logger';
import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock Hedera SDK
jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn(),
    forMainnet: jest.fn(),
    forPreviewnet: jest.fn(),
  },
  PrivateKey: {
    fromString: jest.fn(),
  },
  AccountId: {
    fromString: jest.fn(),
  },
  TokenCreateTransaction: jest.fn(),
  TokenMintTransaction: jest.fn(),
  FileCreateTransaction: jest.fn(),
  FileAppendTransaction: jest.fn(),
  TopicCreateTransaction: jest.fn(),
  TopicMessageSubmitTransaction: jest.fn(),
  TransferTransaction: jest.fn(),
  ScheduleCreateTransaction: jest.fn(),
  Hbar: {
    fromTinybars: jest.fn(),
  },
  TokenType: {
    NonFungibleUnique: 'NON_FUNGIBLE_UNIQUE',
  },
  TokenSupplyType: {
    Finite: 'FINITE',
  },
}));

describe('HederaService', () => {
  let hederaService: HederaService;
  let mockClient: any;
  let mockPrivateKey: any;
  let mockAccountId: any;

  const mockConfig: HederaConfig = {
    operatorId: '0.0.123456',
    operatorKey: 'mock-private-key',
    network: 'testnet',
    mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com',
    testMode: true,
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    mockClient = {
      setOperator: jest.fn(),
      close: jest.fn(),
    };
    mockPrivateKey = {};
    mockAccountId = {};

    (Client.forTestnet as jest.Mock).mockReturnValue(mockClient);
    (PrivateKey.fromString as jest.Mock).mockReturnValue(mockPrivateKey);
    (AccountId.fromString as jest.Mock).mockReturnValue(mockAccountId);

    hederaService = new HederaService(mockConfig);
  });

  afterEach(async () => {
    if (hederaService) {
      await hederaService.close();
    }
  });

  describe('Initialization', () => {
    it('should initialize with testnet configuration', () => {
      expect(Client.forTestnet).toHaveBeenCalled();
      expect(PrivateKey.fromString).toHaveBeenCalledWith(mockConfig.operatorKey);
      expect(AccountId.fromString).toHaveBeenCalledWith(mockConfig.operatorId);
      expect(mockClient.setOperator).toHaveBeenCalledWith(mockAccountId, mockPrivateKey);
    });

    it('should initialize with mainnet configuration', () => {
      const mainnetConfig = { ...mockConfig, network: 'mainnet' };
      (Client.forMainnet as jest.Mock).mockReturnValue(mockClient);
      
      new HederaService(mainnetConfig);
      
      expect(Client.forMainnet).toHaveBeenCalled();
    });

    it('should throw error for invalid network', () => {
      const invalidConfig = { ...mockConfig, network: 'invalid' };
      
      expect(() => new HederaService(invalidConfig)).toThrow('Unsupported network: invalid');
    });
  });

  describe('Connection Management', () => {
    it('should check connection status', async () => {
      const isConnected = await hederaService.isConnected();
      expect(typeof isConnected).toBe('boolean');
    });

    it('should close connection', async () => {
      await hederaService.close();
      expect(mockClient.close).toHaveBeenCalled();
    });
  });

  describe('NFT Token Operations (HTS)', () => {
    it('should create invoice NFT token', async () => {
      const mockTransaction = {
        setTokenName: jest.fn().mockReturnThis(),
        setTokenSymbol: jest.fn().mockReturnThis(),
        setTokenType: jest.fn().mockReturnThis(),
        setSupplyType: jest.fn().mockReturnThis(),
        setInitialSupply: jest.fn().mockReturnThis(),
        setTreasuryAccountId: jest.fn().mockReturnThis(),
        setAdminKey: jest.fn().mockReturnThis(),
        setSupplyKey: jest.fn().mockReturnThis(),
        setTokenMemo: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            tokenId: { toString: () => '0.0.789012' }
          }),
          transactionId: { toString: () => '0.0.123456@1234567890.123456789' }
        })
      };

      const TokenCreateTransaction = require('@hashgraph/sdk').TokenCreateTransaction;
      TokenCreateTransaction.mockImplementation(() => mockTransaction);

      const result = await hederaService.createInvoiceNFTToken('Test Token', 'TEST', 'Test memo');

      expect(result).toEqual({
        tokenId: '0.0.789012',
        transactionId: '0.0.123456@1234567890.123456789'
      });
    });

    it('should mint invoice NFT', async () => {
      const mockMetadata: InvoiceNFTData = {
        invoiceId: 'inv-123',
        invoiceNumber: 'INV-001',
        amount: '1000.00',
        currency: 'USD',
        dueDate: '2024-12-31',
        supplierId: 'supplier-123',
        buyerId: 'buyer-123'
      };

      const mockTransaction = {
        setTokenId: jest.fn().mockReturnThis(),
        setMetadata: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            serials: [{ toString: () => '1' }]
          }),
          transactionId: { toString: () => '0.0.123456@1234567890.123456789' }
        })
      };

      const TokenMintTransaction = require('@hashgraph/sdk').TokenMintTransaction;
      TokenMintTransaction.mockImplementation(() => mockTransaction);

      const result = await hederaService.mintInvoiceNFT('0.0.789012', mockMetadata);

      expect(result).toEqual({
        serialNumber: '1',
        transactionId: '0.0.123456@1234567890.123456789'
      });
    });
  });

  describe('File Service Operations (HFS)', () => {
    it('should upload file to HFS', async () => {
      const mockFileBuffer = Buffer.from('test file content');
      
      const mockCreateTransaction = {
        setContents: jest.fn().mockReturnThis(),
        setKeys: jest.fn().mockReturnThis(),
        setFileMemo: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            fileId: { toString: () => '0.0.789013' }
          }),
          transactionId: { toString: () => '0.0.123456@1234567890.123456789' }
        })
      };

      const FileCreateTransaction = require('@hashgraph/sdk').FileCreateTransaction;
      FileCreateTransaction.mockImplementation(() => mockCreateTransaction);

      const result = await hederaService.uploadFile(mockFileBuffer, 'Test file');

      expect(result.fileId).toBe('0.0.789013');
      expect(result.transactionId).toBe('0.0.123456@1234567890.123456789');
      expect(result.hash).toBeDefined();
    });

    it('should upload PDF to HFS', async () => {
      const mockPdfBuffer = Buffer.from('PDF content');
      
      const mockCreateTransaction = {
        setContents: jest.fn().mockReturnThis(),
        setKeys: jest.fn().mockReturnThis(),
        setFileMemo: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            fileId: { toString: () => '0.0.789013' }
          }),
          transactionId: { toString: () => '0.0.123456@1234567890.123456789' }
        })
      };

      const FileCreateTransaction = require('@hashgraph/sdk').FileCreateTransaction;
      FileCreateTransaction.mockImplementation(() => mockCreateTransaction);

      const result = await hederaService.uploadPdfToHfs(mockPdfBuffer, 'application/pdf', 'invoice.pdf');

      expect(result.fileId).toBe('0.0.789013');
      expect(result.transactionId).toBe('0.0.123456@1234567890.123456789');
      expect(result.fileHashSha384).toBeDefined();
    });
  });

  describe('Consensus Service Operations (HCS)', () => {
    it('should create topic', async () => {
      const mockTransaction = {
        setTopicMemo: jest.fn().mockReturnThis(),
        setAdminKey: jest.fn().mockReturnThis(),
        setSubmitKey: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            topicId: { toString: () => '0.0.789014' }
          }),
          transactionId: { toString: () => '0.0.123456@1234567890.123456789' }
        })
      };

      const TopicCreateTransaction = require('@hashgraph/sdk').TopicCreateTransaction;
      TopicCreateTransaction.mockImplementation(() => mockTransaction);

      const result = await hederaService.createTopic('Test topic');

      expect(result).toEqual({
        topicId: '0.0.789014',
        transactionId: '0.0.123456@1234567890.123456789'
      });
    });

    it('should submit topic message', async () => {
      const mockTransaction = {
        setTopicId: jest.fn().mockReturnThis(),
        setMessage: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            topicSequenceNumber: { toString: () => '1' }
          }),
          transactionId: { toString: () => '0.0.123456@1234567890.123456789' }
        })
      };

      const TopicMessageSubmitTransaction = require('@hashgraph/sdk').TopicMessageSubmitTransaction;
      TopicMessageSubmitTransaction.mockImplementation(() => mockTransaction);

      const result = await hederaService.submitTopicMessage('0.0.789014', 'Test message');

      expect(result).toEqual({
        transactionId: '0.0.123456@1234567890.123456789',
        sequenceNumber: '1'
      });
    });

    it('should submit invoice status message', async () => {
      const mockMessageData: HCSMessageData = {
        tokenId: '0.0.789012',
        serialNumber: '1',
        status: 'issued',
        timestamp: new Date().toISOString(),
        amount: '1000.00',
        currency: 'USD'
      };

      const mockTransaction = {
        setTopicId: jest.fn().mockReturnThis(),
        setMessage: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({
          getReceipt: jest.fn().mockResolvedValue({
            topicSequenceNumber: { toString: () => '1' }
          }),
          transactionId: { toString: () => '0.0.123456@1234567890.123456789' }
        })
      };

      const TopicMessageSubmitTransaction = require('@hashgraph/sdk').TopicMessageSubmitTransaction;
      TopicMessageSubmitTransaction.mockImplementation(() => mockTransaction);

      const result = await hederaService.submitInvoiceStatusMessage('0.0.789014', mockMessageData);

      expect(result.transactionId).toBeDefined();
      expect(result.sequenceNumber).toBeDefined();
    });
  });

  describe('Mirror Node Integration', () => {
    beforeEach(() => {
      // Mock fetch for mirror node calls
      global.fetch = jest.fn();
    });

    it('should get transaction details', async () => {
      const mockResponse = {
        transactions: [{
          transaction_id: '0.0.123456@1234567890.123456789',
          consensus_timestamp: '1234567890.123456789',
          result: 'SUCCESS'
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await hederaService.getTransactionDetails('0.0.123456@1234567890.123456789');
      expect(result).toEqual(mockResponse);
    });

    it('should get topic messages', async () => {
      const mockResponse = {
        messages: [{
          consensus_timestamp: '1234567890.123456789',
          message: 'dGVzdCBtZXNzYWdl', // base64 encoded 'test message'
          sequence_number: 1
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await hederaService.getTopicMessages('0.0.789014');
      expect(result).toEqual(mockResponse);
    });

    it('should get NFT info', async () => {
      const mockResponse = {
        token_id: '0.0.789012',
        serial_number: 1,
        metadata: 'base64encodedmetadata'
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await hederaService.getNFTInfo('0.0.789012', '1');
      expect(result).toEqual(mockResponse);
    });

    it('should get file contents', async () => {
      const mockResponse = {
        file_id: '0.0.789013',
        contents: 'base64encodedcontent'
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await hederaService.getFileContents('0.0.789013');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Transaction Preparation', () => {
    it('should prepare mint NFT transaction', async () => {
      const mockMetadata: InvoiceNFTData = {
        invoiceId: 'inv-123',
        invoiceNumber: 'INV-001',
        amount: '1000.00',
        currency: 'USD',
        dueDate: '2024-12-31',
        supplierId: 'supplier-123',
        buyerId: 'buyer-123'
      };

      const result = await hederaService.prepareMintNFTTransaction(mockMetadata, '0.0.123456');

      expect(result.transactionBytes).toBeDefined();
      expect(result.transactionId).toBeDefined();
    });

    it('should prepare fund transaction', async () => {
      const result = await hederaService.prepareFundTransaction('inv-123', 1000, '0.0.123456');

      expect(result.transactionBytes).toBeDefined();
      expect(result.transactionId).toBeDefined();
      expect(result.escrowAccountId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(hederaService.getTransactionDetails('invalid-id')).rejects.toThrow();
    });

    it('should handle invalid transaction IDs', async () => {
      const mockResponse = { error: 'Invalid transaction ID' };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve(mockResponse)
      });

      await expect(hederaService.getTransactionDetails('invalid-id')).rejects.toThrow();
    });
  });

  describe('Configuration Management', () => {
    it('should validate required configuration', () => {
      expect(() => new HederaService({
        operatorId: '',
        operatorKey: 'key',
        network: 'testnet',
        mirrorNodeUrl: 'url'
      })).toThrow();
    });

    it('should use test mode when specified', () => {
      const testService = new HederaService({ ...mockConfig, testMode: true });
      expect(testService).toBeDefined();
    });
  });
});