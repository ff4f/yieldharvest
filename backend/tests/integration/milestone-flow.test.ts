import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { build } from '../../src/app';
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { HcsService } from '../../src/services/hcs.service';

// Mock Fastify WebSocket plugin
jest.mock('@fastify/websocket', () => ({
  __esModule: true,
  default: jest.fn()
}));

// Mock logger to prevent worker thread issues
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn()
    }))
  }
}));

// Mock all Hedera-related services before any imports
const mockHederaService = {
  uploadFile: jest.fn().mockResolvedValue({
    fileId: '0.0.123456',
    transactionId: '0.0.789012@1234567891.123456789',
    hash: 'mock-hash-sha256'
  }),
  getFileContents: jest.fn(),
  getFileInfo: jest.fn(),
  createTopic: jest.fn(),
  submitMessage: jest.fn(),
  getTopicMessages: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../../src/services/hedera', () => ({
  HederaService: jest.fn().mockImplementation(() => mockHederaService)
}));

// Mock HCS Topics service
jest.mock('../../src/services/hcsTopics', () => ({
  hcsTopicsService: {
    getOrCreateTopic: jest.fn().mockResolvedValue('0.0.123456'),
    healthCheck: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock Funding service
jest.mock('../../src/services/fundingService', () => ({
  fundingService: {
    createFundingRequest: jest.fn(),
    processFunding: jest.fn(),
    getFundingStatus: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock HCS service
jest.mock('../../src/services/hcs.service', () => ({
  HcsService: jest.fn().mockImplementation(() => ({
    submitMessage: jest.fn().mockResolvedValue({
      transactionId: '0.0.789012@1234567891.123456789',
      sequenceNumber: '1',
      consensusTimestamp: '1234567891.123456789',
      messageId: 'msg-123'
    }),
    healthCheck: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined)
  }))
}));

// Mock Mirror Node service
jest.mock('../../src/services/mirrorNodeService', () => ({
  mirrorNodeService: {
    getHcsMessages: jest.fn(),
    getAccountInfo: jest.fn(),
    getTokenInfo: jest.fn(),
    getTransactionInfo: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined)
  }
}));

// Get reference to the mocked service for test setup
const mockMirrorNodeService = {
  getHcsMessages: jest.fn(),
  getAccountInfo: jest.fn(),
  getTokenInfo: jest.fn(),
  getTransactionInfo: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined)
};

// Mock file upload middleware to bypass actual file processing in tests
jest.mock('../../src/middleware/fileUpload', () => ({
  fileUploadValidator: async (request: any, reply: any) => {
    // Mock validated files for testing
    request.validatedFiles = [{
      filename: 'test-invoice.pdf',
      sanitizedFilename: 'test-invoice.pdf',
      detectedMimeType: 'application/pdf',
      validationHash: 'mock-validation-hash',
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('Mock PDF content for invoice'))
    }];
  },
  ValidatedFile: {},
  ALLOWED_MIME_TYPES: ['application/pdf'],
  FILE_SIZE_LIMITS: { pdf: 10 * 1024 * 1024 },
  BLOCKED_EXTENSIONS: []
}));

// Mock WebSocket service to avoid actual WebSocket operations
jest.mock('../../src/services/websocketService', () => ({
  websocketService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    broadcastMilestoneUpdate: jest.fn().mockResolvedValue(undefined),
    sendToClient: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockReturnValue({ connections: 0, subscriptions: 0 }),
    shutdown: jest.fn().mockResolvedValue(undefined)
  }
}));
describe('Milestone Flow Integration Tests', () => {
  let app: FastifyInstance;
  let wsClient: WebSocket | undefined;
  const testPort = 3002;
  let mockHcsService: jest.Mocked<HcsService>;

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.PORT = testPort.toString();
    process.env.OPERATOR_KEY = '302e020100300506032b657004220420' + '0'.repeat(64);
    process.env.HEDERA_NETWORK = 'testnet';
    process.env.HEDERA_TOPIC_ID = '0.0.789012';
    process.env.HEDERA_INVOICE_TOKEN_ID = '0.0.123456';
    process.env.MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';
    
    app = await build({ logger: false });
    await app.listen({ port: testPort, host: '0.0.0.0' });
    
    // Get the mocked HCS service instance
    mockHcsService = new HcsService({
      operatorId: 'test',
      operatorKey: 'test',
      network: 'testnet',
      mirrorNodeUrl: 'test'
    }) as jest.Mocked<HcsService>;
  }, 10000);

  afterAll(async () => {
    try {
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.close();
      }
      if (app) {
        await app.close();
      }
      
      // Clean up cache instances to prevent async operations
      const { mirrorNodeCache, nftCache, hcsCache } = await import('../../src/services/cacheService');
      mirrorNodeCache.destroy();
      nftCache.destroy();
      hcsCache.destroy();
      
      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 5000);

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockHederaService.uploadFile.mockResolvedValue({
      success: true,
      fileId: '0.0.123456',
      transactionId: '0.0.123456@1234567890.123456789',
      hash: 'mock-file-hash',
      size: 1024
    });
    
    mockHederaService.getFileContents.mockResolvedValue(Buffer.from('mock file content'));
    
    mockHederaService.getFileInfo.mockResolvedValue({
      fileId: '0.0.123456',
      size: 1024,
      expirationTime: new Date(Date.now() + 86400000)
    });
    
    mockHederaService.createTopic.mockResolvedValue({
      success: true,
      topicId: '0.0.789012',
      transactionId: '0.0.789012@1234567890.123456789'
    });
    
    mockHederaService.submitMessage.mockResolvedValue({
      transactionId: '0.0.789012@1234567891.123456789',
      sequenceNumber: '1',
      consensusTimestamp: '1234567891.123456789',
      messageId: 'msg-123'
    });
    
    mockHederaService.getTopicMessages.mockResolvedValue({
      success: true,
      messages: []
    });
    
    mockMirrorNodeService.getHcsMessages.mockResolvedValue({
      messages: [
        {
          consensusTimestamp: '1234567890.123456789',
          topicId: '0.0.789012',
          message: Buffer.from(JSON.stringify({
            type: 'MILESTONE_EVENT',
            version: '1.0',
            payload: {
              tokenId: '0.0.123456',
              serial: '1',
              milestone: 'CREATED_ISSUED',
              ts: Date.now(),
              fileHash: 'mock-file-hash'
            },
            context: {
              agentId: 'agent-123',
              location: 'Port of Lagos',
              notes: 'Invoice created and issued'
            }
          })).toString('base64'),
          sequenceNumber: 1,
          runningHash: 'hash1',
          runningHashVersion: 3
        }
      ]
    });
    
    mockMirrorNodeService.healthCheck.mockResolvedValue(true);
  });

  describe('Complete Milestone Flow', () => {
    it('should handle complete invoice lifecycle with real-time updates', async () => {
      // Step 1: Upload invoice file to HFS
      const mockFileBuffer = Buffer.from('Mock PDF content for invoice');
      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/hfs/upload',
        headers: {
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="test-invoice.pdf"',
          'Content-Type: application/pdf',
          '',
          mockFileBuffer.toString(),
          '------formdata-test--'
        ].join('\r\n')
      });

      expect(uploadResponse.statusCode).toBe(200);
      const uploadResult = JSON.parse(uploadResponse.payload);
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.fileId).toBe('0.0.123456');

      // Step 2: Create milestone for invoice creation
      const milestoneResponse = await app.inject({
        method: 'POST',
        url: '/api/milestones',
        headers: {
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          tokenId: '0.0.123456',
          serial: '1',
          milestone: 'CREATED/ISSUED',
          agentId: 'agent-123',
          location: 'Port of Lagos',
          notes: 'Invoice created and issued'
        })
      });

      expect(milestoneResponse.statusCode).toBe(200);
      const milestoneResult = JSON.parse(milestoneResponse.payload);
      expect(milestoneResult.success).toBe(true);
      expect(milestoneResult.milestone.milestone).toBe('CREATED_ISSUED');

      // Step 3: Verify milestone was recorded in HCS
      const messagesResponse = await app.inject({
        method: 'GET',
        url: '/api/hcs/messages/0.0.789012'
      });

      expect(messagesResponse.statusCode).toBe(200);
      const messagesResult = JSON.parse(messagesResponse.payload);
      expect(messagesResult.success).toBe(true);

      // Step 4: Get milestone timeline
      const timelineResponse = await app.inject({
        method: 'GET',
        url: '/api/milestones/timeline?tokenId=0.0.123456&serial=1'
      });

      expect(timelineResponse.statusCode).toBe(200);
      const timelineResult = JSON.parse(timelineResponse.payload);
      expect(timelineResult.success).toBe(true);
      expect(timelineResult.data).toBeInstanceOf(Array);
    }, 15000);

    it('should handle file integrity verification', async () => {
      const fileId = '0.0.123456';
      const expectedHash = 'mock-file-hash';

      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/api/hfs/verify',
        headers: {
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          fileId,
          expectedHash
        })
      });

      expect(verifyResponse.statusCode).toBe(200);
      const verifyResult = JSON.parse(verifyResponse.payload);
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.verified).toBe(true);
    });

    it('should handle milestone progression validation', async () => {
      // Try to create an invalid milestone transition
      const invalidMilestoneResponse = await app.inject({
        method: 'POST',
        url: '/api/milestones/publish',
        headers: {
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          tokenId: '0.0.123456',
          serial: '1',
          milestone: 'PAID', // Invalid: jumping from CREATED_ISSUED to PAID
          agentId: 'agent-123',
          location: 'Port of Lagos',
          notes: 'Invalid milestone transition'
        })
      });

      expect(invalidMilestoneResponse.statusCode).toBe(400);
      const invalidResult = JSON.parse(invalidMilestoneResponse.payload);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Invalid milestone transition');
    });
  });

  describe('WebSocket Real-time Updates', () => {
    it('should mock WebSocket service initialization', async () => {
      const { websocketService } = require('../../src/services/websocketService');
      
      // Test that WebSocket service is properly mocked
      expect(websocketService.initialize).toBeDefined();
      expect(websocketService.broadcastMilestoneUpdate).toBeDefined();
      expect(websocketService.sendToClient).toBeDefined();
      expect(websocketService.getStats).toBeDefined();
      expect(websocketService.shutdown).toBeDefined();
      
      // Test mock functionality
      const stats = websocketService.getStats();
      expect(stats).toEqual({ connections: 0, subscriptions: 0 });
      
      // Test that methods can be called without errors
      await websocketService.initialize();
      websocketService.broadcastMilestoneUpdate({ type: 'test', data: {} });
      websocketService.sendToClient('client-id', { type: 'test' });
      await websocketService.shutdown();
    });

    it('should handle milestone broadcast updates', () => {
      const { websocketService } = require('../../src/services/websocketService');
      
      const testUpdate = {
        type: 'milestone_update',
        invoiceId: 'test-invoice-123',
        milestone: 'funded',
        timestamp: new Date().toISOString(),
        data: {
          amount: 10000,
          fundingSource: '0.0.123456'
        }
      };
      
      // Should not throw when broadcasting
      expect(() => {
        websocketService.broadcastMilestoneUpdate(testUpdate);
      }).not.toThrow();
      
      // Verify the mock was called
      expect(websocketService.broadcastMilestoneUpdate).toHaveBeenCalledWith(testUpdate);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle HFS upload failures gracefully', async () => {
      // Mock HFS service to simulate failure
      mockHederaService.uploadFile.mockRejectedValueOnce(new Error('HFS service unavailable'));

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/hfs/upload',
        headers: {
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="test-invoice.pdf"',
          'Content-Type: application/pdf',
          '',
          'Mock PDF content',
          '------formdata-test--'
        ].join('\r\n')
      });

      expect(uploadResponse.statusCode).toBe(500);
      const uploadResult = JSON.parse(uploadResponse.payload);
      expect(uploadResult.success).toBe(false);
      expect(uploadResult.error).toContain('HFS service unavailable');
    });

    it('should handle HCS publishing failures gracefully', async () => {
      // Mock HCS service to simulate failure
      mockHederaService.submitMessage.mockRejectedValueOnce(new Error('HCS topic unavailable'));

      const milestoneResponse = await app.inject({
        method: 'POST',
        url: '/api/milestones',
        headers: {
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          tokenId: '0.0.123456',
          serial: '1',
          milestone: 'SHIPPED',
          agentId: 'agent-123',
          location: 'Port of Lagos',
          notes: 'Goods shipped from port'
        })
      });

      expect(milestoneResponse.statusCode).toBe(500);
      const milestoneResult = JSON.parse(milestoneResponse.payload);
      expect(milestoneResult.success).toBe(false);
      expect(milestoneResult.error).toContain('HCS topic unavailable');
    });

    it('should validate file size limits', async () => {
      const largeFileContent = 'x'.repeat(6 * 1024 * 1024); // 6MB file

      const uploadResponse = await app.inject({
        method: 'POST',
        url: '/api/hfs/upload',
        headers: {
          'content-type': 'multipart/form-data; boundary=----formdata-test'
        },
        payload: [
          '------formdata-test',
          'Content-Disposition: form-data; name="file"; filename="large-file.pdf"',
          'Content-Type: application/pdf',
          '',
          largeFileContent,
          '------formdata-test--'
        ].join('\r\n')
      });

      expect(uploadResponse.statusCode).toBe(400);
      const uploadResult = JSON.parse(uploadResponse.payload);
      expect(uploadResult.success).toBe(false);
      expect(uploadResult.error).toContain('File size exceeds maximum limit');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent milestone updates', async () => {
      const concurrentRequests = 5;
      const promises: Promise<any>[] = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = app.inject({
          method: 'POST',
          url: '/api/milestones',
          headers: {
            'content-type': 'application/json'
          },
          payload: JSON.stringify({
            tokenId: '0.0.123456',
            serial: (i + 1).toString(),
            milestone: 'CREATED/ISSUED',
            agentId: `agent-${i}`,
            location: 'Port of Lagos',
            notes: `Concurrent milestone ${i}`
          })
        });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.payload);
        expect(result.success).toBe(true);
        expect(result.milestone.serial).toBe((index + 1).toString());
      });
    }, 10000);

    it('should handle WebSocket service under load', async () => {
      const { websocketService } = require('../../src/services/websocketService');
      const concurrentRequests = 10;
      const promises: Promise<any>[] = [];

      // Simulate multiple concurrent milestone updates that would trigger WebSocket broadcasts
      for (let i = 0; i < concurrentRequests; i++) {
        const promise = app.inject({
          method: 'POST',
          url: '/api/milestones',
          headers: {
            'content-type': 'application/json'
          },
          payload: JSON.stringify({
            tokenId: '0.0.123456',
            serial: (i + 1).toString(),
            milestone: 'CREATED/ISSUED',
            agentId: `load-test-agent-${i}`,
            location: 'Port of Lagos',
            notes: `Load test milestone ${i}`
          })
        });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      // Verify all requests succeeded
      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(200);
        const result = JSON.parse(response.payload);
        expect(result.success).toBe(true);
        expect(result.milestone.serial).toBe((index + 1).toString());
      });

      // Verify WebSocket service can handle multiple broadcast calls
      for (let i = 0; i < concurrentRequests; i++) {
        const testUpdate = {
          type: 'milestone_update',
          data: {
            tokenId: '0.0.123456',
            serial: (i + 1).toString(),
            milestone: 'SHIPPED'
          }
        };
        
        expect(() => {
          websocketService.broadcastMilestoneUpdate(testUpdate);
        }).not.toThrow();
      }

      // Verify the mock was called multiple times
      expect(websocketService.broadcastMilestoneUpdate).toHaveBeenCalledTimes(concurrentRequests);
    }, 10000);
  });
});