import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { auditLogger } from '../utils/logger';

// Extend FastifyRequest to include correlationId
declare module 'fastify' {
  interface FastifyRequest {
    correlationId?: string;
  }
}

/**
 * Middleware to add correlation ID to requests for tracking
 * Generates a new UUID if not provided in headers
 */
export const correlationIdMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  // Check if correlation ID is provided in headers
  let correlationId = request.headers['x-correlation-id'] as string;
  
  // Generate new correlation ID if not provided
  if (!correlationId) {
    correlationId = uuidv4();
  }
  
  // Add to request object
  request.correlationId = correlationId;
  
  // Add to response headers
  reply.header('X-Correlation-ID', correlationId);
  
  // Log request start with correlation ID
  const logData: any = {
    method: request.method,
    endpoint: request.url,
    correlationId,
    ip: request.ip,
  };
  
  if (request.headers['user-agent']) {
    logData.userAgent = request.headers['user-agent'];
  }
  
  auditLogger.logApiRequest(logData);
};

export default correlationIdMiddleware;