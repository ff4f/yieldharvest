import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { auditLogger } from '../utils/logger';

// Rate limiting configurations
const rateLimitConfigs = {
  // General API rate limiting
  general: {
    max: 100, // requests
    timeWindow: '15 minutes',
    errorResponseBuilder: (request: FastifyRequest, context: any) => {
      auditLogger.logSecurity({
        eventType: 'rate_limit_exceeded',
        severity: 'medium',
        details: {
          ip: request.ip,
          endpoint: request.url,
          method: request.method,
          limit: context.max,
          timeWindow: context.timeWindow,
        },
        ip: request.ip,
      });
      
      return {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Try again in ${context.timeWindow}`,
        retryAfter: context.ttl,
      };
    },
  },

  // Authentication endpoints (more restrictive)
  auth: {
    max: 10,
    timeWindow: '15 minutes',
    errorResponseBuilder: (request: FastifyRequest, context: any) => {
      auditLogger.logSecurity({
        eventType: 'auth_rate_limit_exceeded',
        severity: 'high',
        details: {
          ip: request.ip,
          endpoint: request.url,
          method: request.method,
          limit: context.max,
          timeWindow: context.timeWindow,
        },
        ip: request.ip,
      });
      
      return {
        error: 'Too many authentication attempts',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: `Too many authentication attempts. Try again in ${context.timeWindow}`,
        retryAfter: context.ttl,
      };
    },
  },

  // File upload endpoints
  upload: {
    max: 20,
    timeWindow: '1 hour',
    errorResponseBuilder: (request: FastifyRequest, context: any) => {
      auditLogger.logSecurity({
        eventType: 'upload_rate_limit_exceeded',
        severity: 'medium',
        details: {
          ip: request.ip,
          endpoint: request.url,
          method: request.method,
          limit: context.max,
          timeWindow: context.timeWindow,
        },
        ip: request.ip,
      });
      
      return {
        error: 'Too many upload attempts',
        code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
        message: `Too many upload attempts. Try again in ${context.timeWindow}`,
        retryAfter: context.ttl,
      };
    },
  },

  // Hedera transaction endpoints (very restrictive)
  hedera: {
    max: 50,
    timeWindow: '1 hour',
    errorResponseBuilder: (request: FastifyRequest, context: any) => {
      auditLogger.logSecurity({
        eventType: 'hedera_rate_limit_exceeded',
        severity: 'high',
        details: {
          ip: request.ip,
          endpoint: request.url,
          method: request.method,
          limit: context.max,
          timeWindow: context.timeWindow,
        },
        ip: request.ip,
      });
      
      return {
        error: 'Too many Hedera transaction requests',
        code: 'HEDERA_RATE_LIMIT_EXCEEDED',
        message: `Too many Hedera transaction requests. Try again in ${context.timeWindow}`,
        retryAfter: context.ttl,
      };
    },
  },
};

// CORS configuration
const corsConfig = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://yieldharvest.vercel.app',
    // Add production domains here
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Correlation-ID',
    'Accept',
    'Origin',
  ],
  exposedHeaders: [
    'X-Correlation-ID',
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
  ],
};

// CORS violation checker middleware
export const corsViolationChecker = async (request: FastifyRequest, reply: FastifyReply) => {
  const origin = request.headers.origin;
  
  if (origin && !corsConfig.origin.includes(origin)) {
    auditLogger.logSecurity({
      eventType: 'cors_violation',
      severity: 'medium',
      details: {
        origin,
        allowedOrigins: corsConfig.origin,
        endpoint: request.url,
        method: request.method,
      },
      ip: request.ip,
    });
  }
};

// Helmet security configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", 'https://testnet.mirrornode.hedera.com', 'https://hashscan.io'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
};

// Security headers middleware
export const securityHeaders = async (request: FastifyRequest, reply: FastifyReply) => {
  // Add custom security headers
  reply.header('X-API-Version', '1.0.0');
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server information
  reply.removeHeader('X-Powered-By');
  reply.removeHeader('Server');
};

// IP whitelist middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs: string[] = []) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const clientIP = request.ip;
    
    // Allow localhost in development
    const developmentIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    const isDevelopment = process.env['NODE_ENV'] === 'development';
    
    const isAllowed = allowedIPs.includes(clientIP) || 
                     (isDevelopment && developmentIPs.includes(clientIP));
    
    if (!isAllowed) {
      auditLogger.logSecurity({
        eventType: 'ip_access_denied',
        severity: 'high',
        details: {
          ip: clientIP,
          endpoint: request.url,
          method: request.method,
          allowedIPs,
        },
        ip: clientIP,
      });
      
      return reply.status(403).send({
        error: 'Access denied',
        code: 'IP_NOT_ALLOWED',
        message: 'Your IP address is not authorized to access this endpoint',
      });
    }
  };
};

// Request size limiter
export const requestSizeLimiter = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const contentLength = request.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      auditLogger.logSecurity({
        eventType: 'request_size_exceeded',
        severity: 'medium',
        details: {
          contentLength: parseInt(contentLength),
          maxSize,
          endpoint: request.url,
          method: request.method,
        },
        ip: request.ip,
      });
      
      return reply.status(413).send({
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE',
        message: `Request size exceeds limit of ${maxSize} bytes`,
        maxSize,
      });
    }
  };
};

// Security event logger middleware
export const securityEventLogger = async (request: FastifyRequest, reply: FastifyReply) => {
  const startTime = Date.now();
  
  // Log security-relevant requests
  const securityEndpoints = ['/auth/', '/admin/', '/hedera/', '/upload/'];
  const isSecurityEndpoint = securityEndpoints.some(endpoint => 
    request.url.includes(endpoint)
  );
  
  if (isSecurityEndpoint) {
    auditLogger.logSecurity({
      eventType: 'security_endpoint_access',
      severity: 'low',
      details: {
        endpoint: request.url,
        method: request.method,
        userAgent: request.headers['user-agent'],
        referer: request.headers.referer,
      },
      ip: request.ip,
    });
  }
  
  // Store start time for later use
  (request as any).startTime = startTime;
};

// Response logger hook
export const responseLogger = async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
  const startTime = (request as any).startTime || Date.now();
  const duration = Date.now() - startTime;
  const statusCode = reply.statusCode;
  
  // Log suspicious response patterns
  if (statusCode >= 400 || duration > 10000) { // 10 seconds
    const logData: any = {
      eventType: statusCode >= 500 ? 'server_error' : 'client_error',
      severity: statusCode >= 500 ? 'high' : 'medium',
      details: {
        endpoint: request.url,
        method: request.method,
        statusCode,
        duration,
        userAgent: request.headers['user-agent'],
      },
      ip: request.ip,
    };
    
    if (request.user?.id) {
      logData.userId = request.user.id;
    }
    
    auditLogger.logSecurity(logData);
  }
  
  return payload;
};

// Register all security middleware
export const registerSecurityMiddleware = async (fastify: FastifyInstance) => {
  // Register Helmet for security headers
  await fastify.register(helmet);
  
  // Register CORS
  await fastify.register(cors, {
    origin: corsConfig.origin,
    credentials: corsConfig.credentials,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowedHeaders,
    exposedHeaders: corsConfig.exposedHeaders,
  });
  
  // Register general rate limiting
  await fastify.register(rateLimit, rateLimitConfigs.general);
  
  // Add custom security middleware
  fastify.addHook('onRequest', securityHeaders);
  fastify.addHook('onRequest', corsViolationChecker);
  fastify.addHook('onRequest', securityEventLogger);
  fastify.addHook('onSend', responseLogger);
  
  // Add request size limiter for specific routes
  fastify.addHook('preHandler', requestSizeLimiter());
  
  // Register specific rate limiters for different route groups
  fastify.register(async function (fastify) {
    await fastify.register(rateLimit, {
      ...rateLimitConfigs.auth,
      prefix: '/auth',
    });
  });
  
  fastify.register(async function (fastify) {
    await fastify.register(rateLimit, {
      ...rateLimitConfigs.upload,
      prefix: '/upload',
    });
  });
  
  fastify.register(async function (fastify) {
    await fastify.register(rateLimit, {
      ...rateLimitConfigs.hedera,
      prefix: '/hedera',
    });
  });
};

export {
  rateLimitConfigs,
  corsConfig,
  helmetConfig,
};

export default {
  registerSecurityMiddleware,
  securityHeaders,
  ipWhitelist,
  requestSizeLimiter,
  securityEventLogger,
  rateLimitConfigs,
  corsConfig,
  helmetConfig,
};