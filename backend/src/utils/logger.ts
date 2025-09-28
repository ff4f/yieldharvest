import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

// Enhanced logger with structured logging for audit trail
export const logger = pino({
  level: process.env['LOG_LEVEL'] || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  },
  base: {
    service: 'yieldharvest-backend',
    version: process.env['npm_package_version'] || '1.0.0',
  },
});

// Structured logging interfaces
export interface HederaLogContext {
  txId?: string;
  topicSeq?: number;
  fileId?: string;
  accountId?: string;
  tokenId?: string;
  contractId?: string;
}

export interface RequestLogContext {
  correlationId: string;
  userId?: string;
  userRole?: string;
  endpoint: string;
  method: string;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogContext extends RequestLogContext, HederaLogContext {
  action: string;
  resource: string;
  resourceId?: string;
  previousState?: any;
  newState?: any;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

// Enhanced logging functions
export const auditLogger = {
  // Log Hedera transactions
  logHederaTransaction: (context: HederaLogContext & { action: string; success: boolean; errorMessage?: string }) => {
    logger.info({
      event: 'hedera_transaction',
      ...context,
      timestamp: new Date().toISOString(),
    }, `Hedera ${context.action}: ${context.success ? 'SUCCESS' : 'FAILED'}`);
  },

  // Log API requests
  logApiRequest: (context: RequestLogContext & { duration?: number; statusCode?: number }) => {
    logger.info({
      event: 'api_request',
      ...context,
      timestamp: new Date().toISOString(),
    }, `${context.method} ${context.endpoint} - ${context.statusCode || 'PENDING'}`);
  },

  // Log authentication events
  logAuth: (context: { userId?: string; accountId?: string; action: string; success: boolean; ip?: string; userAgent?: string; errorMessage?: string }) => {
    const level = context.success ? 'info' : 'warn';
    logger[level]({
      event: 'authentication',
      ...context,
      timestamp: new Date().toISOString(),
    }, `Auth ${context.action}: ${context.success ? 'SUCCESS' : 'FAILED'}`);
  },

  // Log security events
  logSecurity: (context: { eventType: string; severity: 'low' | 'medium' | 'high' | 'critical'; details: any; ip?: string; userId?: string }) => {
    const level = context.severity === 'critical' || context.severity === 'high' ? 'error' : 'warn';
    logger[level]({
      event: 'security_event',
      ...context,
      timestamp: new Date().toISOString(),
    }, `Security Alert: ${context.eventType}`);
  },

  // Log audit trail
  logAudit: (context: AuditLogContext) => {
    logger.info({
      event: 'audit_trail',
      ...context,
      timestamp: new Date().toISOString(),
    }, `Audit: ${context.action} on ${context.resource}`);
  },

  // Log business operations
  logBusiness: (context: { operation: string; entityType: string; entityId: string; userId?: string; details?: any; success: boolean }) => {
    logger.info({
      event: 'business_operation',
      ...context,
      timestamp: new Date().toISOString(),
    }, `Business: ${context.operation} ${context.entityType} ${context.entityId}`);
  },
};

// Correlation ID generator
export const generateCorrelationId = (): string => {
  return uuidv4();
};

// Request context middleware helper
export const createRequestContext = (req: any): RequestLogContext => {
  return {
    correlationId: req.headers['x-correlation-id'] || generateCorrelationId(),
    userId: req.user?.id,
    userRole: req.user?.role,
    endpoint: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
};

export default logger;