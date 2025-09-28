import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { build } from '../../app';
import { FastifyInstance } from 'fastify';

// Mock the HCS service to avoid Hedera dependency in tests
jest.mock('../../services/hcsTopics', () => ({
  hcsTopicsService: {
    publishMilestone: jest.fn().mockResolvedValue({
      success: true,
      topicId: '0.0.123456',
      sequenceNumber: 1,
      transactionId: '0.0.123456@1234567890.123456789'
    }),
    getTopicMessages: jest.fn().mockResolvedValue({
      success: true,
      messages: []
    })
  }
}));

// Mock the HCS service class
jest.mock('../../services/hcs.service', () => ({
  HcsService: jest.fn().mockImplementation(() => ({
    publishMessage: jest.fn().mockResolvedValue({
      success: true,
      topicId: '0.0.123456',
      sequenceNumber: 1,
      transactionId: '0.0.123456@1234567890.123456789'
    }),
    getMessages: jest.fn().mockResolvedValue({
      success: true,
      messages: []
    }),
    healthCheck: jest.fn().mockResolvedValue(true)
  }))
}));

// Mock the milestones service
jest.mock('../../services/milestonesService', () => ({
  milestonesService: {
    publishMilestone: jest.fn().mockResolvedValue({
      success: true,
      milestone: {
        id: 'test-milestone-id',
        tokenId: '0.0.123456',
        serial: '1',
        milestone: 'CREATED_ISSUED',
        timestamp: new Date().toISOString()
      }
    }),
    getMilestones: jest.fn().mockResolvedValue({
      success: true,
      data: []
    }),
    getTimeline: jest.fn().mockResolvedValue({
      success: true,
      data: []
    }),
    getStats: jest.fn().mockResolvedValue({
      success: true,
      data: {
        totalMilestones: 0,
        completedMilestones: 0,
        progressPercentage: 0
      }
    }),
    getNextValidMilestones: jest.fn().mockResolvedValue({
      success: true,
      data: []
    }),
    clearCache: jest.fn().mockResolvedValue({
      success: true,
      message: 'Cache cleared'
    }),
    healthCheck: jest.fn().mockResolvedValue(true)
  }
}));

// Mock the Mirror Node service
jest.mock('../../services/mirrorNodeService', () => ({
  mirrorNodeService: {
    getHcsMessages: jest.fn().mockResolvedValue({
      messages: []
    }),
    healthCheck: jest.fn().mockResolvedValue(true)
  }
}));

describe('Milestones API Integration Tests (Mocked)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set test environment variables
    process.env.HEDERA_ACCOUNT_ID = '0.0.123456';
    process.env.HEDERA_PRIVATE_KEY = '302e020100300506032b657004220420' + '0'.repeat(64);
    process.env.HEDERA_NETWORK = 'testnet';
    process.env.HEDERA_TOPIC_ID = '0.0.123456';
    
    app = await build({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/milestones/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/milestones/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('services');
      expect(body.services).toHaveProperty('milestonesService');
      expect(body.services).toHaveProperty('mirrorNodeService');
    });
  });

  describe('GET /api/milestones', () => {
    it('should require tokenId and serial parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/milestones'
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('tokenId');
    });

    it('should return milestones for valid tokenId and serial', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/milestones?tokenId=0.0.123456&serial=1'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('GET /api/milestones/timeline', () => {
    it('should return timeline for valid tokenId and serial', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/milestones/timeline?tokenId=0.0.123456&serial=1'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe('GET /api/milestones/stats', () => {
    it('should return stats for valid tokenId and serial', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/milestones/stats?tokenId=0.0.123456&serial=1'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('totalMilestones');
      expect(body.data).toHaveProperty('completedMilestones');
      expect(body.data).toHaveProperty('progressPercentage');
    });
  });

  describe('POST /api/milestones', () => {
    it('should require valid milestone data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/milestones',
        payload: {
          tokenId: '',
          serial: '',
          milestone: 'INVALID_MILESTONE'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should create milestone with valid data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/milestones',
        payload: {
          tokenId: '0.0.123456',
          serial: '1',
          milestone: 'CREATED_ISSUED',
          agentId: 'agent-123',
          location: 'Test Location',
          notes: 'Test milestone creation'
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
    });
  });

  describe('DELETE /api/milestones/cache', () => {
    it('should clear cache for valid tokenId and serial', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/milestones/cache?tokenId=0.0.123456&serial=1'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('message');
    });
  });
});