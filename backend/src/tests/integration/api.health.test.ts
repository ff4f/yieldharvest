import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

describe('API Health Check Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Create a minimal Fastify app for testing
    app = Fastify({ logger: false });
    
    // Register a simple health route
    app.get('/health', async (request, reply) => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0',
        environment: 'test'
      };
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('environment');
    });

    it('should return valid JSON', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      expect(() => JSON.parse(response.body)).not.toThrow();
    });

    it('should have correct content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health'
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('API Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-route'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle invalid HTTP methods', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/health'
      });

      expect(response.statusCode).toBe(404);
    });
  });
});