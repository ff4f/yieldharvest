import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HederaService, HederaConfig, InvoiceNFTData, HCSMessageData } from '../services/hedera';

// Mock the entire Hedera SDK
jest.mock('@hashgraph/sdk', () => {
  const mockClient = {
    setOperator: jest.fn(),
    ping: jest.fn(),
    close: jest.fn(),
  };

  return {
    Client: {
      forTestnet: jest.fn().mockReturnValue(mockClient),
      forMainnet: jest.fn().mockReturnValue(mockClient),
    },
    PrivateKey: {
      fromString: jest.fn().mockReturnValue({}),
    },
    AccountId: {
      fromString: jest.fn().mockReturnValue({}),
    },
    TokenCreateTransaction: jest.fn(),
    TokenMintTransaction: jest.fn(),
    FileCreateTransaction: jest.fn(),
    TopicCreateTransaction: jest.fn(),
    TopicMessageSubmitTransaction: jest.fn(),
    ScheduleCreateTransaction: jest.fn(),
    TransferTransaction: jest.fn(),
  };
});

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('HederaService', () => {
  let hederaService: HederaService;
  let mockConfig: HederaConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      operatorId: '0.0.123456',
      operatorKey: 'test-private-key',
      network: 'testnet',
      mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
    };
    
    hederaService = new HederaService(mockConfig);
  });

  describe('Configuration', () => {
    it('should initialize with correct config', () => {
      expect(hederaService).toBeDefined();
      expect(hederaService).toBeInstanceOf(HederaService);
    });
  });

  describe('Connection Management', () => {
    it('should check connection status', async () => {
      const result = await hederaService.isConnected();
      expect(typeof result).toBe('boolean');
    });

    it('should disconnect without errors', async () => {
      await expect(hederaService.disconnect()).resolves.not.toThrow();
    });
  });

  describe('Mirror Node API Integration', () => {
    beforeEach(() => {
      mockFetch.mockClear();
    });

    it('should fetch transaction details', async () => {
      const mockResponse = {
        transactions: [{
          transaction_id: '0.0.123@1234567890.123456789',
          consensus_timestamp: '1234567890.123456789',
          result: 'SUCCESS'
        }]
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await hederaService.getTransactionDetails('0.0.123@1234567890.123456789');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/transactions/0.0.123@1234567890.123456789')
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fetch topic messages', async () => {
      const mockResponse = {
        messages: [{
          consensus_timestamp: '1234567890.123456789',
          message: 'dGVzdCBtZXNzYWdl',
          sequence_number: 1
        }]
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await hederaService.getTopicMessages('0.0.789', 5);
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/topics/0.0.789/messages?limit=5')
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fetch NFT information', async () => {
      const mockResponse = {
        token_id: '0.0.123',
        serial_number: 1,
        metadata: 'base64encodedmetadata'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await hederaService.getNFTInfo('0.0.123', '1');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tokens/0.0.123/nfts/1')
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fetch file contents', async () => {
      const mockResponse = {
        file_id: '0.0.456',
        contents: 'base64encodedcontent'
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await hederaService.getFileContents('0.0.456');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/files/0.0.456')
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      await expect(hederaService.getTransactionDetails('invalid-id'))
        .rejects.toThrow('Network error');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);
      
      await expect(hederaService.getTransactionDetails('not-found-id'))
        .rejects.toThrow();
    });
  });

  describe('Data Validation', () => {
    it('should validate invoice NFT data structure', () => {
      const mockData: InvoiceNFTData = {
        invoiceId: 'inv-123',
        invoiceNumber: 'INV-001',
        amount: '1000.00',
        currency: 'USD',
        dueDate: '2024-12-31',
        supplierId: 'supplier-123',
        buyerId: 'buyer-123'
      };
      
      expect(mockData).toHaveProperty('invoiceId');
      expect(mockData).toHaveProperty('invoiceNumber');
      expect(mockData).toHaveProperty('amount');
      expect(mockData).toHaveProperty('currency');
      expect(mockData).toHaveProperty('dueDate');
      expect(mockData).toHaveProperty('supplierId');
      expect(mockData).toHaveProperty('buyerId');
    });

    it('should validate HCS message data structure', () => {
      const mockData: HCSMessageData = {
        tokenId: '0.0.123',
        serialNumber: '1',
        status: 'issued',
        timestamp: new Date().toISOString()
      };
      
      expect(mockData).toHaveProperty('tokenId');
      expect(mockData).toHaveProperty('serialNumber');
      expect(mockData).toHaveProperty('status');
      expect(mockData).toHaveProperty('timestamp');
      expect(['issued', 'funded', 'paid', 'defaulted']).toContain(mockData.status);
    });
  });

  describe('Service Methods Existence', () => {
    it('should have all required HTS methods', () => {
      expect(typeof hederaService.createInvoiceNFTToken).toBe('function');
      expect(typeof hederaService.mintInvoiceNFT).toBe('function');
    });

    it('should have all required HFS methods', () => {
      expect(typeof hederaService.uploadPdfToHfs).toBe('function');
      expect(typeof hederaService.uploadFile).toBe('function');
    });

    it('should have all required HCS methods', () => {
      expect(typeof hederaService.createTopic).toBe('function');
      expect(typeof hederaService.submitTopicMessage).toBe('function');
      expect(typeof hederaService.submitInvoiceStatusMessage).toBe('function');
    });

    it('should have all required Mirror Node methods', () => {
      expect(typeof hederaService.getTransactionDetails).toBe('function');
      expect(typeof hederaService.getTopicMessages).toBe('function');
      expect(typeof hederaService.getNFTInfo).toBe('function');
      expect(typeof hederaService.getFileContents).toBe('function');
    });

    it('should have scheduled transaction method', () => {
      expect(typeof hederaService.createScheduledTransfer).toBe('function');
    });
  });
});