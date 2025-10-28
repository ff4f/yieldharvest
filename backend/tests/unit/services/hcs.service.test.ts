import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HcsService } from '../../../src/services/hcs.service';
import { logger } from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock Hedera SDK
const mockExecute = jest.fn();
const mockGetReceipt = jest.fn();
const mockSetTopicId = jest.fn();
const mockSetMessage = jest.fn();
const mockSetMaxChunks = jest.fn();
const mockSetTopicMemo = jest.fn();
const mockSetAdminKey = jest.fn();
const mockSetSubmitKey = jest.fn();

jest.mock('@hashgraph/sdk', () => ({
  Client: {
    forTestnet: jest.fn(() => ({
      setOperator: jest.fn(),
      close: jest.fn()
    })),
    forMainnet: jest.fn(() => ({
      setOperator: jest.fn(),
      close: jest.fn()
    })),
    forPreviewnet: jest.fn(() => ({
      setOperator: jest.fn(),
      close: jest.fn()
    }))
  },
  AccountId: {
    fromString: jest.fn((id) => ({ toString: () => id }))
  },
  PrivateKey: {
    fromString: jest.fn((key) => ({ toString: () => key }))
  },
  TopicCreateTransaction: jest.fn(() => ({
    setTopicMemo: jest.fn().mockReturnThis(),
    setAdminKey: jest.fn().mockReturnThis(),
    setSubmitKey: jest.fn().mockReturnThis(),
    execute: mockExecute
  })),
  TopicMessageSubmitTransaction: jest.fn().mockImplementation(() => ({
    setTopicId: mockSetTopicId.mockReturnThis(),
    setMessage: mockSetMessage.mockReturnThis(),
    setMaxChunks: mockSetMaxChunks.mockReturnThis(),
    execute: mockExecute
  })),
  TopicId: {
    fromString: jest.fn((id) => ({ toString: () => id }))
  }
}));

describe('HcsService', () => {
  let hcsService: HcsService;
  const mockTopicId = '0.0.123456';
  const mockTransactionId = '0.0.123456@1234567890.123456789';
  const mockSequenceNumber = 1;
  const mockConfig = {
    operatorId: '0.0.123456',
    operatorKey: 'test-private-key',
    network: 'testnet' as const,
    mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful responses
    mockExecute.mockResolvedValue({
      transactionId: { toString: () => '0.0.123456@1234567890.123456789' },
      getReceipt: mockGetReceipt
    });

    mockGetReceipt.mockResolvedValue({
      topicId: { toString: () => '0.0.789012' },
      topicSequenceNumber: { toString: () => '1' }
    });
    
    hcsService = new HcsService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTopic', () => {
    it('should successfully create a new HCS topic', async () => {
      const result = await hcsService.createTopic('Test topic memo');

      expect(result).toEqual({
        topicId: '0.0.789012',
        transactionId: '0.0.123456@1234567890.123456789',
        consensusTimestamp: expect.any(String)
      });

      expect(logger.info).toHaveBeenCalledWith('HCS topic created successfully', expect.any(Object));
    });

    it('should fail to create topic', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Network error'));

      await expect(hcsService.createTopic('Test topic')).rejects.toThrow('Topic creation failed: Error: Network error');
    });
  });

  describe('submitMessage', () => {
    const mockMessage = {
      type: 'invoice_status_change',
      timestamp: new Date().toISOString(),
      data: {
        invoiceId: 'inv-123',
        status: 'funded',
        amount: 1000,
        currency: 'USD'
      }
    };

    it('should successfully submit message to HCS topic', async () => {
      const result = await hcsService.submitMessage(mockTopicId, mockMessage);

      expect(result).toEqual({
        transactionId: '0.0.123456@1234567890.123456789',
        sequenceNumber: '1',
        messageId: expect.any(String),
        consensusTimestamp: expect.any(String)
      });
    });

    it('should handle message submission failure', async () => {
      mockExecute.mockRejectedValueOnce(new Error('Network error'));

      await expect(hcsService.submitMessage('0.0.789012', 'test message')).rejects.toThrow('Message submission failed: Error: Network error');
    });

    it('should handle string messages', async () => {
      const stringMessage = 'Simple string message';
      
      const result = await hcsService.submitMessage(mockTopicId, stringMessage);

      expect(result).toEqual({
        transactionId: '0.0.123456@1234567890.123456789',
        sequenceNumber: '1',
        messageId: expect.any(String),
        consensusTimestamp: expect.any(String)
      });
    });
  });

  describe('submitInvoiceEvent', () => {
    it('should successfully submit invoice event', async () => {
      const eventData = {
        invoiceId: 'inv-123',
        amount: 1000,
        currency: 'USD',
        status: 'issued'
      };

      const result = await hcsService.submitInvoiceEvent(
        mockTopicId,
        'invoice_created',
        'inv-123',
        eventData
      );

      expect(result).toEqual({
        transactionId: '0.0.123456@1234567890.123456789',
        sequenceNumber: '1',
        messageId: expect.any(String),
        consensusTimestamp: expect.any(String)
      });
    });
  });

  describe('submitFundingEvent', () => {
    it('should successfully submit funding event', async () => {
      const result = await hcsService.submitFundingEvent(
        mockTopicId,
        'funding_received',
        'fund-123',
        'inv-123',
        1000,
        'investor-456'
      );

      expect(result).toEqual({
        transactionId: '0.0.123456@1234567890.123456789',
        sequenceNumber: '1',
        messageId: expect.any(String),
        consensusTimestamp: expect.any(String)
      });
    });
  });

  describe('submitAuditLog', () => {
    it('should successfully submit audit log when audit topic is set', async () => {
      hcsService.setAuditTopic(mockTopicId);
      
      const result = await hcsService.submitAuditLog(
        'invoice_created',
        { invoiceId: 'inv-123' },
        'user-456'
      );

      expect(result).toEqual({
        transactionId: '0.0.123456@1234567890.123456789',
        sequenceNumber: '1',
        messageId: expect.any(String),
        consensusTimestamp: expect.any(String)
      });
    });

    it('should return null when no audit topic is set', async () => {
      const result = await hcsService.submitAuditLog(
        'invoice_created',
        { invoiceId: 'inv-123' },
        'user-456'
      );

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('No audit topic configured, skipping audit log');
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy service', async () => {
      const result = await hcsService.healthCheck();
      expect(result).toBe(true);
    });
  });

  describe('close', () => {
    it('should close the client connection', async () => {
      await hcsService.close();
      expect(logger.info).toHaveBeenCalledWith('HCS Service client closed');
    });
  });


});