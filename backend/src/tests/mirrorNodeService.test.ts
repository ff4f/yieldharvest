import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies BEFORE importing the service
const mockAxiosInstance = {
  get: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
} as any;

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => mockAxiosInstance),
  },
}));

jest.mock('../services/cacheService', () => ({
  mirrorNodeCache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest.fn(),
  },
  nftCache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest.fn(),
  },
  hcsCache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest.fn(),
  },
  CacheKeys: {
    nftsByToken: jest.fn((tokenId, limit, order) => `nfts:${tokenId}:${limit}:${order}`),
    nftBySerial: jest.fn((tokenId, serialNumber) => `nft:${tokenId}:${serialNumber}`),
    hcsMessages: jest.fn((topicId, limit, order) => `hcs:${topicId}:${limit}:${order}`),
    invoiceMessages: jest.fn((topicId, tokenId, limit) => `invoice_msgs:${topicId}:${tokenId || 'all'}:${limit || 100}`),
    transaction: jest.fn((transactionId) => `tx:${transactionId}`),
    fileInfo: jest.fn((fileId) => `file:${fileId}`),
  },
}));

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Now import the service after mocks are set up
import { MirrorNodeService } from '../services/mirrorNodeService';
import { mirrorNodeCache } from '../services/cacheService';
import { logger } from '../utils/logger';

const mockCacheService = mirrorNodeCache as jest.Mocked<typeof mirrorNodeCache>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('MirrorNodeService', () => {
  let mirrorNodeService: MirrorNodeService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockAxiosInstance.get as jest.Mock).mockReset();
    mirrorNodeService = new MirrorNodeService({
      baseUrl: 'https://testnet.mirrornode.hedera.com',
      timeout: 10000,
    });
  });

  describe('getNFTsByToken', () => {
    it('should fetch NFTs successfully', async () => {
      const mockResponse = {
        data: {
          nfts: [
            {
              token_id: '0.0.123456',
              serial_number: 1,
              account_id: '0.0.789',
              created_timestamp: '1640995200.000000000',
              modified_timestamp: '1640995200.000000000',
              metadata: 'eyJpbnZvaWNlTnVtYmVyIjoiSU5WLTAwMSJ9'
            }
          ]
        }
      };

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await mirrorNodeService.getNFTsByToken('0.0.123456');

      expect(result).toEqual(mockResponse.data.nfts);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/tokens/0.0.123456/nfts', {
        params: { limit: 25, order: 'desc' }
      });
    });

    it('should return empty array when no NFTs found', async () => {
      const mockResponse = { data: {} };
      (mockAxiosInstance.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await mirrorNodeService.getNFTsByToken('0.0.123456');

      expect(result).toEqual([]);
    });
  });

  describe('getNFTInfo', () => {
    it('should fetch single NFT successfully', async () => {
      const mockResponse = {
        data: {
          token_id: '0.0.123456',
          serial_number: 1,
          account_id: '0.0.789',
          created_timestamp: '1640995200.000000000',
          modified_timestamp: '1640995200.000000000',
          metadata: 'eyJpbnZvaWNlTnVtYmVyIjoiSU5WLTAwMSJ9'
        }
      };

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue(mockResponse);
      (mockCacheService.get as jest.Mock).mockReturnValue(null);

      const result = await mirrorNodeService.getNFTInfo('0.0.123456', '1');

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/tokens/0.0.123456/nfts/1');
    });
  });

  describe('getHCSMessages', () => {
    it('should fetch HCS messages successfully', async () => {
      const mockResponse = {
        data: {
          messages: [
            {
              consensus_timestamp: '1640995200.000000000',
              topic_id: '0.0.654321',
              sequence_number: 1,
              running_hash: 'hash123',
              running_hash_version: 3,
              payer_account_id: '0.0.123',
              message: Buffer.from(JSON.stringify({
                type: 'invoice',
                tokenId: '0.0.123456',
                serialNumber: '1',
                status: 'issued',
                amount: '1000.00',
                currency: 'USD'
              })).toString('base64')
            }
          ]
        }
      };

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue(mockResponse);
      (mockCacheService.get as jest.Mock).mockReturnValue(null);

      const result = await mirrorNodeService.getHCSMessages('0.0.654321');

      expect(result).toEqual(mockResponse.data.messages);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/topics/0.0.654321/messages', {
        params: { limit: 25, order: 'desc' }
      });
    });
  });

  describe('parseInvoiceMessages', () => {
    it('should parse valid invoice messages', () => {
      const messageData = {
        type: 'invoice',
        tokenId: '0.0.123456',
        serialNumber: '1',
        status: 'issued',
        amount: '1000.00',
        currency: 'USD'
      };
      const base64Message = Buffer.from(JSON.stringify(messageData)).toString('base64');
      
      const mockMessages = [{
        consensus_timestamp: '1640995200.000000000',
        topic_id: '0.0.654321',
        sequence_number: 1,
        running_hash: 'hash123',
        running_hash_version: 3,
        payer_account_id: '0.0.123',
        message: base64Message
      }];

      const result = mirrorNodeService.parseInvoiceMessages(mockMessages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        tokenId: '0.0.123456',
        serialNumber: '1',
        status: 'issued',
        sequenceNumber: 1
      });
    });

    it('should filter out invalid messages', () => {
      const mockMessages = [{
        consensus_timestamp: '1640995200.000000000',
        topic_id: '0.0.654321',
        sequence_number: 1,
        running_hash: 'hash123',
        running_hash_version: 3,
        payer_account_id: '0.0.123',
        message: 'invalid-base64'
      }];
      const result = mirrorNodeService.parseInvoiceMessages(mockMessages);
      expect(result).toHaveLength(0);
    });

    it('should handle empty message array', () => {
      const result = mirrorNodeService.parseInvoiceMessages([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      (mockAxiosInstance.get as jest.Mock).mockRejectedValue(new Error('Network error'));
      (mockCacheService.get as jest.Mock).mockReturnValue(null);

      const result = await mirrorNodeService.getNFTsByToken('0.0.123456');
      
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});