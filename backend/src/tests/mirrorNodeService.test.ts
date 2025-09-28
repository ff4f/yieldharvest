import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies BEFORE importing the service
const mockAxiosInstance = {
  get: jest.fn().mockResolvedValue({ data: {} }),
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

  describe('getNftsByTokenId', () => {
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
      (mockCacheService.get as jest.Mock).mockReturnValue(null);

      const result = await mirrorNodeService.getNftsByTokenId('0.0.123456');

      expect(result).toEqual(mockResponse.data.nfts);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/tokens/0.0.123456/nfts');
    });

    it('should return cached data when available', async () => {
      const cachedData = [{ token_id: '0.0.123456', serial_number: 1 }];
      (mockCacheService.get as jest.Mock).mockReturnValue(cachedData);

      const result = await mirrorNodeService.getNftsByTokenId('0.0.123456');

      expect(result).toEqual(cachedData);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });
  });

  describe('getNftBySerial', () => {
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

      const result = await mirrorNodeService.getNftBySerial('0.0.123456', 1);

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/tokens/0.0.123456/nfts/1');
    });
  });

  describe('getHcsMessages', () => {
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
                type: 'INVOICE_ISSUED',
                tokenId: '0.0.123456',
                serialNumber: 1,
                timestamp: '2024-01-15T10:00:00Z'
              })).toString('base64')
            }
          ]
        }
      };

      (mockAxiosInstance.get as jest.Mock).mockResolvedValue(mockResponse);
      (mockCacheService.get as jest.Mock).mockReturnValue(null);

      const result = await mirrorNodeService.getHcsMessages('0.0.654321');

      expect(result).toEqual(mockResponse.data.messages);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/v1/topics/0.0.654321/messages');
    });
  });

  describe('parseInvoiceMessage', () => {
    it('should parse valid base64 encoded JSON message', () => {
      const messageData = { event: 'issued', invoiceId: '123' };
      const base64Message = Buffer.from(JSON.stringify(messageData)).toString('base64');
      const mockMessage = {
        consensus_timestamp: '1640995200.000000000',
        topic_id: '0.0.654321',
        sequence_number: 1,
        running_hash: 'hash123',
        running_hash_version: 3,
        payer_account_id: '0.0.123',
        message: base64Message
      };

      const result = mirrorNodeService.parseInvoiceMessage(mockMessage);

      expect(result).toEqual(messageData);
    });

    it('should return null for invalid base64', () => {
      const mockMessage = {
        consensus_timestamp: '1640995200.000000000',
        topic_id: '0.0.654321',
        sequence_number: 1,
        running_hash: 'hash123',
        running_hash_version: 3,
        payer_account_id: '0.0.123',
        message: 'invalid-base64'
      };
      const result = mirrorNodeService.parseInvoiceMessage(mockMessage);
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const invalidJson = Buffer.from('invalid json').toString('base64');
      const mockMessage = {
        consensus_timestamp: '1640995200.000000000',
        topic_id: '0.0.654321',
        sequence_number: 1,
        running_hash: 'hash123',
        running_hash_version: 3,
        payer_account_id: '0.0.123',
        message: invalidJson
      };
      const result = mirrorNodeService.parseInvoiceMessage(mockMessage);
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      (mockAxiosInstance.get as jest.Mock).mockRejectedValue(new Error('Network error'));
      (mockCacheService.get as jest.Mock).mockReturnValue(null);

      await expect(mirrorNodeService.getNftsByTokenId('0.0.123456')).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});