import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Fastify from 'fastify';
import { registerSecurityMiddleware } from '../../middleware/security';

describe('Security Middleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await registerSecurityMiddleware(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      app.get('/test', async (request: FastifyRequest, reply: FastifyReply) => {
        return { success: true };
      });
      await app.ready();
    });

    it('should allow requests within rate limit', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test'
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ success: true });
    });

    it('should include rate limit headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test'
      });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should block requests exceeding rate limit', async () => {
      // Make multiple requests to exceed the rate limit
      const promises = Array.from({ length: 105 }, () =>
        app.inject({
          method: 'GET',
          url: '/test'
        })
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.statusCode === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('CORS Headers', () => {
    beforeEach(async () => {
      app.get('/test', async (request: FastifyRequest, reply: FastifyReply) => {
        return { success: true };
      });
      await app.ready();
    });

    it('should include CORS headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          origin: 'http://localhost:3000'
        }
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
      expect(response.headers).toHaveProperty('access-control-allow-methods');
      expect(response.headers).toHaveProperty('access-control-allow-headers');
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/test',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type'
        }
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Security Headers', () => {
    beforeEach(async () => {
      app.get('/test', async (request: FastifyRequest, reply: FastifyReply) => {
        return { success: true };
      });
      await app.ready();
    });

    it('should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test'
      });

      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });

    it('should set correct security header values', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test'
      });

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Content Security Policy', () => {
    beforeEach(async () => {
      app.get('/test', async (request: FastifyRequest, reply: FastifyReply) => {
        return { success: true };
      });
      await app.ready();
    });

    it('should include CSP header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test'
      });

      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('should have restrictive CSP policy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test'
      });

      const csp = response.headers['content-security-policy'] as string;
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("style-src 'self'");
    });
  });
});