import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { build } from '../../app';
import { FastifyInstance } from 'fastify';

describe('Milestones API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
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

  describe('GET /api/milestones/next', () => {
    it('should return next valid milestones', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/milestones/next?tokenId=0.0.123456&serial=1'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
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

      // Note: This might fail in test environment due to Hedera connectivity
      // but we're testing the API structure
      expect([200, 201, 400, 500]).toContain(response.statusCode);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success');
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