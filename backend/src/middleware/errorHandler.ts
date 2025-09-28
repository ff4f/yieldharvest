import { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import { ZodError } from 'zod';
import { PrismaClientKnownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { auditLogger } from '../utils/logger';

// Custom error classes
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR', true);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR', true);
  }
}

export class HederaError extends AppError {
  public readonly hederaStatus: string | undefined;
  public readonly transactionId: string | undefined;

  constructor(
    message: string,
    hederaStatus?: string,
    transactionId?: string,
    details?: any
  ) {
    const statusCode = mapHederaStatusToHttpStatus(hederaStatus);
    const code = mapHederaStatusToErrorCode(hederaStatus);
    
    super(message, statusCode, code, true, details);
    this.hederaStatus = hederaStatus;
    this.transactionId = transactionId;
  }
}

export class FileUploadError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'FILE_UPLOAD_ERROR', true, details);
  }
}

export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string, details?: any) {
    super(`${service} service error: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, details);
    this.service = service;
  }
}

// Hedera status code mappings
const hederaStatusMappings: Record<string, { httpStatus: number; errorCode: string; description: string }> = {
  // Success statuses
  'SUCCESS': { httpStatus: 200, errorCode: 'HEDERA_SUCCESS', description: 'Transaction successful' },
  
  // Client errors (4xx)
  'INVALID_TRANSACTION': { httpStatus: 400, errorCode: 'HEDERA_INVALID_TRANSACTION', description: 'Invalid transaction' },
  'INVALID_ACCOUNT_ID': { httpStatus: 400, errorCode: 'HEDERA_INVALID_ACCOUNT_ID', description: 'Invalid account ID' },
  'INVALID_SIGNATURE': { httpStatus: 400, errorCode: 'HEDERA_INVALID_SIGNATURE', description: 'Invalid signature' },
  'INSUFFICIENT_ACCOUNT_BALANCE': { httpStatus: 400, errorCode: 'HEDERA_INSUFFICIENT_BALANCE', description: 'Insufficient account balance' },
  'INSUFFICIENT_PAYER_BALANCE': { httpStatus: 400, errorCode: 'HEDERA_INSUFFICIENT_PAYER_BALANCE', description: 'Insufficient payer balance' },
  'DUPLICATE_TRANSACTION': { httpStatus: 409, errorCode: 'HEDERA_DUPLICATE_TRANSACTION', description: 'Duplicate transaction' },
  'TRANSACTION_EXPIRED': { httpStatus: 400, errorCode: 'HEDERA_TRANSACTION_EXPIRED', description: 'Transaction expired' },
  'INVALID_NODE_ACCOUNT': { httpStatus: 400, errorCode: 'HEDERA_INVALID_NODE_ACCOUNT', description: 'Invalid node account' },
  'INVALID_TRANSACTION_BODY': { httpStatus: 400, errorCode: 'HEDERA_INVALID_TRANSACTION_BODY', description: 'Invalid transaction body' },
  'INVALID_TRANSACTION_ID': { httpStatus: 400, errorCode: 'HEDERA_INVALID_TRANSACTION_ID', description: 'Invalid transaction ID' },
  'ACCOUNT_ID_DOES_NOT_EXIST': { httpStatus: 404, errorCode: 'HEDERA_ACCOUNT_NOT_FOUND', description: 'Account does not exist' },
  'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT': { httpStatus: 400, errorCode: 'HEDERA_TOKEN_NOT_ASSOCIATED', description: 'Token not associated to account' },
  'INVALID_TOKEN_ID': { httpStatus: 400, errorCode: 'HEDERA_INVALID_TOKEN_ID', description: 'Invalid token ID' },
  'TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT': { httpStatus: 409, errorCode: 'HEDERA_TOKEN_ALREADY_ASSOCIATED', description: 'Token already associated to account' },
  'INVALID_FILE_ID': { httpStatus: 400, errorCode: 'HEDERA_INVALID_FILE_ID', description: 'Invalid file ID' },
  'FILE_DELETED': { httpStatus: 410, errorCode: 'HEDERA_FILE_DELETED', description: 'File has been deleted' },
  'INVALID_TOPIC_ID': { httpStatus: 400, errorCode: 'HEDERA_INVALID_TOPIC_ID', description: 'Invalid topic ID' },
  'INVALID_TOPIC_MESSAGE': { httpStatus: 400, errorCode: 'HEDERA_INVALID_TOPIC_MESSAGE', description: 'Invalid topic message' },
  'UNAUTHORIZED': { httpStatus: 401, errorCode: 'HEDERA_UNAUTHORIZED', description: 'Unauthorized access' },
  'INVALID_CONTRACT_ID': { httpStatus: 400, errorCode: 'HEDERA_INVALID_CONTRACT_ID', description: 'Invalid contract ID' },
  'CONTRACT_EXECUTION_EXCEPTION': { httpStatus: 400, errorCode: 'HEDERA_CONTRACT_EXECUTION_ERROR', description: 'Contract execution failed' },
  'INVALID_SOLIDITY_ADDRESS': { httpStatus: 400, errorCode: 'HEDERA_INVALID_SOLIDITY_ADDRESS', description: 'Invalid Solidity address' },
  
  // Server errors (5xx)
  'PLATFORM_TRANSACTION_NOT_CREATED': { httpStatus: 503, errorCode: 'HEDERA_PLATFORM_ERROR', description: 'Platform transaction not created' },
  'PLATFORM_NOT_ACTIVE': { httpStatus: 503, errorCode: 'HEDERA_PLATFORM_INACTIVE', description: 'Platform not active' },
  'BUSY': { httpStatus: 503, errorCode: 'HEDERA_BUSY', description: 'Network is busy' },
  'UNKNOWN': { httpStatus: 500, errorCode: 'HEDERA_UNKNOWN_ERROR', description: 'Unknown Hedera error' },
  'RECEIPT_NOT_FOUND': { httpStatus: 404, errorCode: 'HEDERA_RECEIPT_NOT_FOUND', description: 'Transaction receipt not found' },
  'RECORD_NOT_FOUND': { httpStatus: 404, errorCode: 'HEDERA_RECORD_NOT_FOUND', description: 'Transaction record not found' },
};

function mapHederaStatusToHttpStatus(status?: string): number {
  if (!status) return 500;
  return hederaStatusMappings[status]?.httpStatus || 500;
}

function mapHederaStatusToErrorCode(status?: string): string {
  if (!status) return 'HEDERA_UNKNOWN_ERROR';
  return hederaStatusMappings[status]?.errorCode || 'HEDERA_UNKNOWN_ERROR';
}

function getHederaErrorDescription(status?: string): string {
  if (!status) return 'Unknown Hedera error';
  return hederaStatusMappings[status]?.description || 'Unknown Hedera error';
}

// Error response formatter
interface ErrorResponse {
  error: string;
  code: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  correlationId?: string;
  details?: any;
  stack?: string;
}

function formatErrorResponse(
  error: Error,
  request: FastifyRequest,
  includeStack: boolean = false
): ErrorResponse {
  const correlationId = (request as any).correlationId;
  
  const response: ErrorResponse = {
    error: error.name,
    code: (error as AppError).code || 'INTERNAL_ERROR',
    message: error.message,
    statusCode: (error as AppError).statusCode || 500,
    timestamp: new Date().toISOString(),
    path: request.url,
    correlationId,
  };

  if ((error as AppError).details) {
    response.details = (error as AppError).details;
  }

  if (includeStack && error.stack) {
    response.stack = error.stack;
  }

  return response;
}

// Specific error handlers
function handleZodError(error: ZodError): ValidationError {
  const details = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  return new ValidationError('Validation failed', details);
}

function handlePrismaError(error: PrismaClientKnownRequestError | PrismaClientValidationError): AppError {
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return new ConflictError(`Unique constraint violation: ${error.meta?.['target']}`);
      case 'P2025':
        return new NotFoundError('Record');
      case 'P2003':
        return new ValidationError('Foreign key constraint violation');
      case 'P2004':
        return new ValidationError('Database constraint violation');
      default:
        return new AppError(`Database error: ${error.message}`, 500, 'DATABASE_ERROR', true, {
          code: error.code,
          meta: error.meta,
        });
    }
  }

  if (error instanceof PrismaClientValidationError) {
    return new ValidationError('Database validation error', { originalError: error.message });
  }

  return new AppError('Database error', 500, 'DATABASE_ERROR');
}

function handleHederaSDKError(error: any): HederaError {
  // Extract Hedera status from different error formats
  let status: string | undefined;
  let transactionId: string | undefined;
  let message = error.message || 'Hedera operation failed';

  // Handle different Hedera SDK error formats
  if (error.status) {
    status = error.status.toString();
  } else if (error.code) {
    status = error.code;
  } else if (error.message && error.message.includes('HEDERA_')) {
    const match = error.message.match(/HEDERA_([A-Z_]+)/);
    if (match) {
      status = match[1];
    }
  }

  if (error.transactionId) {
    transactionId = error.transactionId.toString();
  }

  // Enhance message with Hedera context
  if (status) {
    const description = getHederaErrorDescription(status);
    message = `${description}: ${message}`;
  }

  return new HederaError(message, status, transactionId, {
    originalError: error.message,
    stack: error.stack,
  });
}

// Main error handler
export const errorHandler = async (
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  let processedError: AppError;

  // Handle different error types
  if (error instanceof AppError) {
    processedError = error;
  } else if (error instanceof ZodError) {
    processedError = handleZodError(error);
  } else if (error instanceof PrismaClientKnownRequestError || error instanceof PrismaClientValidationError) {
    processedError = handlePrismaError(error);
  } else if (error.name === 'HederaError' || error.message.includes('Hedera') || error.message.includes('HEDERA_')) {
    processedError = handleHederaSDKError(error);
  } else if ((error as FastifyError).statusCode) {
    // Handle Fastify errors
    const fastifyError = error as FastifyError;
    processedError = new AppError(
      fastifyError.message,
      fastifyError.statusCode,
      fastifyError.code || 'FASTIFY_ERROR',
      true
    );
  } else {
    // Handle unknown errors
    processedError = new AppError(
      error.message || 'Internal server error',
      500,
      'INTERNAL_ERROR',
      false
    );
  }

  // Log error based on severity
  const isClientError = processedError.statusCode < 500;
  const severity = isClientError ? 'low' : 'high';
  
  const logData: any = {
    eventType: isClientError ? 'client_error' : 'server_error',
    severity,
    details: {
      error: processedError.name,
      code: processedError.code,
      message: processedError.message,
      statusCode: processedError.statusCode,
      endpoint: request.url,
      method: request.method,
      userAgent: request.headers['user-agent'],
      correlationId: (request as any).correlationId,
      stack: processedError.isOperational ? undefined : processedError.stack,
    },
    ip: request.ip,
  };
  
  if (request.user?.id) {
    logData.userId = request.user.id;
  }
  
  auditLogger.logSecurity(logData);

  // Format response
  const isDevelopment = process.env['NODE_ENV'] === 'development';
  const response = formatErrorResponse(
    processedError,
    request,
    isDevelopment && !processedError.isOperational
  );

  // Send error response
  return reply.status(processedError.statusCode).send(response);
};

// Not found handler
export const notFoundHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  const error = new NotFoundError('Endpoint');
  return errorHandler(error, request, reply);
};

// Register error handlers
export const registerErrorHandlers = (fastify: FastifyInstance) => {
  // Set error handler
  fastify.setErrorHandler(errorHandler);
  
  // Set not found handler
  fastify.setNotFoundHandler(notFoundHandler);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    auditLogger.logSecurity({
      eventType: 'uncaught_exception',
      severity: 'critical',
      details: {
        error: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
    
    // Graceful shutdown
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    auditLogger.logSecurity({
      eventType: 'unhandled_rejection',
      severity: 'critical',
      details: {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      },
    });
    
    // Graceful shutdown
    process.exit(1);
  });
};

export {
  mapHederaStatusToHttpStatus,
  mapHederaStatusToErrorCode,
  getHederaErrorDescription,
  formatErrorResponse,
  handleZodError,
  handlePrismaError,
  handleHederaSDKError,
};

export default {
  errorHandler,
  notFoundHandler,
  registerErrorHandlers,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  HederaError,
  FileUploadError,
  ExternalServiceError,
};