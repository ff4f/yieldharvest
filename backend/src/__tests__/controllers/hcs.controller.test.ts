import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { HCSController } from '../../controllers/hcs.controller';
import { HederaService } from '../../services/hedera';

// Mock audit logger
jest.mock('../../utils/logger', () => ({
  auditLogger: {
    logHederaTransaction: jest.fn(),
  },
}));

// Import the mocked logger to access it in tests
import { auditLogger } from '../../utils/logger';
const mockAuditLogger = auditLogger as jest.Mocked<typeof auditLogger>;

// Mock dependencies - Complete HederaService mock
const mockHederaService = {
  // Connection methods
  isConnected: jest.fn(),
  disconnect: jest.fn(),
  close: jest.fn(),
  
  // NFT Token methods
  createInvoiceNFTToken: jest.fn(),
  mintInvoiceNFT: jest.fn(),
  
  // File Service methods
  uploadPdfToHfs: jest.fn(),
  uploadFile: jest.fn(),
  getFileContents: jest.fn(),
  
  // Consensus Service methods
  createTopic: jest.fn(),
  submitTopicMessage: jest.fn(),
  submitInvoiceStatusMessage: jest.fn(),
  getTopicMessages: jest.fn(),
  
  // Transaction methods
  createScheduledTransfer: jest.fn(),
  getTransactionDetails: jest.fn(),
  getNFTInfo: jest.fn(),
  
  // Wallet integration methods
  prepareMintNFTTransaction: jest.fn(),
  submitSignedTransaction: jest.fn(),
  prepareFundTransaction: jest.fn(),
  submitSignedFundTransaction: jest.fn(),
} as jest.Mocked<HederaService>;

describe('HCSController', () => {
  let hcsController: HCSController;
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    jest.clearAllMocks();
    hcsController = new HCSController(mockHederaService);

    mockRequest = {
      body: {},
      params: {},
      query: {},
    };

    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe('createTopic', () => {
    it('should create a topic successfully', async () => {
      const mockTopicResult = {
        topicId: '0.0.654321',
        transactionId: '0.0.123@1640995200.000000000',
        memo: 'Invoice tracking topic',
      };

      mockRequest.body = {
        memo: 'Invoice tracking topic',
      };

      mockHederaService.createTopic.mockResolvedValue(mockTopicResult);

      await hcsController.createTopic(mockRequest, mockReply);

      expect(mockHederaService.createTopic).toHaveBeenCalledWith('Invoice tracking topic');

      expect(mockAuditLogger.logHederaTransaction).toHaveBeenCalledWith({
        txId: mockTopicResult.transactionId,
        action: 'create_topic',
        success: true,
      });

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'Topic created successfully',
        topicId: '0.0.654321',
        transactionId: '0.0.123@1640995200.000000000',
        memo: 'Invoice tracking topic',
        hashScanUrl: 'https://hashscan.io/testnet/topic/0.0.654321',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.654321',
        topicUrl: 'https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.654321/messages',
      });
    });

    it('should handle topic creation errors', async () => {
      const error = new Error('Topic creation failed');
      mockRequest.body = {
        memo: 'Invoice tracking topic',
      };

      mockHederaService.createTopic.mockRejectedValue(error);

      await hcsController.createTopic(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to create topic',
        code: 'HCS_CREATE_ERROR',
        message: 'Topic creation failed',
      });
    });
  });

  describe('submitMessage', () => {
    it('should submit a message successfully', async () => {
      const mockMessageResult = {
        transactionId: '0.0.456@1640995300.000000000',
        sequenceNumber: '1',
      };

      mockRequest.body = {
        topicId: '0.0.654321',
        message: 'Invoice status updated',
        messageType: 'status_update',
      };

      mockHederaService.submitTopicMessage.mockResolvedValue(mockMessageResult);

      await hcsController.submitMessage(mockRequest, mockReply);

      expect(mockHederaService.submitTopicMessage).toHaveBeenCalledWith(
        '0.0.654321',
        expect.objectContaining({
          type: 'status_update',
          message: 'Invoice status updated',
          timestamp: expect.any(String),
        })
      );

      expect(mockAuditLogger.logHederaTransaction).toHaveBeenCalledWith({
        txId: mockMessageResult.transactionId,
        action: 'submit_message',
        success: true,
      });

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'Message submitted successfully',
        topicId: '0.0.654321',
        sequenceNumber: '1',
        transactionId: '0.0.456@1640995300.000000000',
        messageType: 'status_update',
        invoiceId: undefined,
        hashScanUrl: 'https://hashscan.io/testnet/transaction/0.0.456@1640995300.000000000',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.456@1640995300.000000000',
        messageUrl: 'https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.654321/messages/1',
      });
    });

    it('should handle message submission errors', async () => {
      const error = new Error('Message submission failed');
      mockRequest.body = {
        topicId: '0.0.654321',
        message: 'Invoice status updated',
        messageType: 'status_update',
      };

      mockHederaService.submitTopicMessage.mockRejectedValue(error);

      await hcsController.submitMessage(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to submit message',
        code: 'HCS_SUBMIT_ERROR',
        message: 'Message submission failed',
      });
    });
  });

  describe('getMessages', () => {
    it('should retrieve messages successfully', async () => {
      const mockMessages = [
        {
          sequence_number: 1,
          message: 'Invoice created',
          timestamp: '2023-01-01T00:00:00Z',
          consensus_timestamp: '1640995200.000000000',
        },
        {
          sequence_number: 2,
          message: 'Invoice funded',
          timestamp: '2023-01-01T01:00:00Z',
          consensus_timestamp: '1640998800.000000000',
        },
      ];

      mockRequest.params = {
        topicId: '0.0.654321',
      };

      mockRequest.query = {
        limit: '10',
        order: 'desc',
      };

      mockHederaService.getTopicMessages.mockResolvedValue(mockMessages);

      await hcsController.getMessages(mockRequest, mockReply);

      expect(mockHederaService.getTopicMessages).toHaveBeenCalledWith(
        '0.0.654321',
        10
      );

      expect(mockAuditLogger.logHederaTransaction).toHaveBeenCalledWith({
        action: 'get_messages',
        success: true,
      });

      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({
        topicId: '0.0.654321',
        messages: mockMessages.map((msg) => ({
          ...msg,
          messageUrl: `https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.654321/messages/${msg.sequence_number}`,
        })),
        count: 2,
        limit: 10,
        sequenceNumber: undefined,
        hashScanUrl: 'https://hashscan.io/testnet/topic/0.0.654321',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.654321/messages',
      });
    });

    it('should handle message retrieval errors', async () => {
      const error = new Error('Message retrieval failed');
      mockRequest.params = {
        topicId: '0.0.654321',
      };

      mockHederaService.getTopicMessages.mockRejectedValue(error);

      await hcsController.getMessages(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to get messages',
        code: 'HCS_GET_ERROR',
        message: 'Message retrieval failed',
      });
    });
  });

  describe('getTopic', () => {
     it('should retrieve topic info successfully', async () => {
       mockRequest.params = {
         topicId: '0.0.654321',
       };

       await hcsController.getTopic(mockRequest, mockReply);

       expect(mockAuditLogger.logHederaTransaction).toHaveBeenCalledWith({
         action: 'get_topic',
         success: true,
       });

       expect(mockReply.status).toHaveBeenCalledWith(200);
       expect(mockReply.send).toHaveBeenCalledWith({
         message: 'Topic information retrieval',
         topicId: '0.0.654321',
         note: 'Topic info retrieval via Mirror Node API - implementation pending',
         suggestion: 'Use Mirror Node REST API to get topic details',
         mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.654321',
         hashScanUrl: 'https://hashscan.io/testnet/topic/0.0.654321',
       });
     });

     it('should handle invalid topic ID format', async () => {
       mockRequest.params = {
         topicId: 'invalid-topic-id',
       };

       await hcsController.getTopic(mockRequest, mockReply);

       expect(mockReply.status).toHaveBeenCalledWith(400);
       expect(mockReply.send).toHaveBeenCalledWith({
         error: 'Invalid topic ID format',
         code: 'INVALID_TOPIC_ID',
       });
     });
   });
});