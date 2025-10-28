import { z } from 'zod';
import { FastifyRequest, FastifyReply } from 'fastify';
import { auditLogger } from '../utils/logger';
import { UserRole } from './auth';

// Common validation schemas
const hederaAccountIdSchema = z.string().regex(/^0\.0\.[0-9]+$/, 'Invalid Hedera account ID format');
const hederaTransactionIdSchema = z.string().regex(/^0\.0\.[0-9]+@[0-9]+\.[0-9]+$/, 'Invalid Hedera transaction ID format');
const hederaFileIdSchema = z.string().regex(/^0\.0\.[0-9]+$/, 'Invalid Hedera file ID format');
const hederaTokenIdSchema = z.string().regex(/^0\.0\.[0-9]+$/, 'Invalid Hedera token ID format');
const hederaTopicIdSchema = z.string().regex(/^0\.0\.[0-9]+$/, 'Invalid Hedera topic ID format');
const uuidSchema = z.string().uuid('Invalid UUID format');
const cuidSchema = z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid CUID format');
const emailSchema = z.string().email('Invalid email format');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long');
const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional();
const urlSchema = z.string().url('Invalid URL format').optional();

// Pagination schemas
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Date range schema
const dateRangeSchema = z.object({
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, 'Start date must be before end date');

// Extract date range fields for reuse
const dateRangeFields = {
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
};

// User validation schemas
export const userSchemas = {
  register: z.object({
    email: emailSchema,
    password: passwordSchema,
    firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
    role: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Invalid user role' }) }),
    accountId: hederaAccountIdSchema,
    phone: phoneSchema,
    company: z.string().max(100, 'Company name too long').optional(),
    website: urlSchema,
  }),

  login: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),

  updateProfile: z.object({
    firstName: z.string().min(1, 'First name is required').max(50, 'First name too long').optional(),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long').optional(),
    phone: phoneSchema,
    company: z.string().max(100, 'Company name too long').optional(),
    website: urlSchema,
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),

  refreshToken: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
};

// Invoice validation schemas
export const invoiceSchemas = {
  create: z.object({
    invoiceNumber: z.string().min(1, 'Invoice number is required').max(50, 'Invoice number too long'),
    amount: z.number().positive('Amount must be positive').max(1000000000, 'Amount too large'),
    currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
    dueDate: z.string().datetime('Invalid due date format'),
    description: z.string().max(500, 'Description too long').optional(),
    buyerName: z.string().min(1, 'Buyer name is required').max(100, 'Buyer name too long'),
    buyerEmail: emailSchema.optional(),
    buyerAddress: z.string().max(200, 'Buyer address too long').optional(),
    supplierAccountId: hederaAccountIdSchema,
    metadata: z.record(z.any()).optional(),
  }),

  update: z.object({
    amount: z.number().positive('Amount must be positive').max(1000000000, 'Amount too large').optional(),
    dueDate: z.string().datetime('Invalid due date format').optional(),
    description: z.string().max(500, 'Description too long').optional(),
    buyerName: z.string().min(1, 'Buyer name is required').max(100, 'Buyer name too long').optional(),
    buyerEmail: emailSchema.optional(),
    buyerAddress: z.string().max(200, 'Buyer address too long').optional(),
    metadata: z.record(z.any()).optional(),
  }),

  list: paginationSchema.extend({
    status: z.enum(['draft', 'issued', 'funded', 'paid', 'overdue', 'cancelled']).optional(),
    supplierId: cuidSchema.optional(),
    minAmount: z.coerce.number().positive().optional(),
    maxAmount: z.coerce.number().positive().optional(),
    ...dateRangeFields,
  }),

  uploadDocument: z.object({
    documentType: z.enum(['invoice', 'contract', 'receipt', 'other']).default('invoice'),
    description: z.string().max(200, 'Description too long').optional(),
  }),
};

// Funding validation schemas
export const fundingSchemas = {
  create: z.object({
    invoiceId: cuidSchema,
    amount: z.number().positive('Amount must be positive').max(1000000000, 'Amount too large'),
    interestRate: z.number().min(0, 'Interest rate cannot be negative').max(100, 'Interest rate too high'),
    termDays: z.number().int().min(1, 'Term must be at least 1 day').max(365, 'Term cannot exceed 365 days'),
    investorAccountId: hederaAccountIdSchema,
    supplierAccountId: hederaAccountIdSchema,
    nftSerialNumber: z.number().int().positive('NFT serial number must be positive'),
    conditions: z.string().max(1000, 'Conditions too long').optional(),
  }),

  update: z.object({
    amount: z.number().positive('Amount must be positive').max(1000000000, 'Amount too large').optional(),
    interestRate: z.number().min(0, 'Interest rate cannot be negative').max(100, 'Interest rate too high').optional(),
    termDays: z.number().int().min(1, 'Term must be at least 1 day').max(365, 'Term cannot exceed 365 days').optional(),
    conditions: z.string().max(1000, 'Conditions too long').optional(),
  }),

  list: paginationSchema.extend({
    status: z.enum(['pending', 'active', 'completed', 'cancelled']).optional(),
    investorId: cuidSchema.optional(),
    invoiceId: cuidSchema.optional(),
    minAmount: z.coerce.number().positive().optional(),
    maxAmount: z.coerce.number().positive().optional(),
    ...dateRangeFields,
  }),

  approve: z.object({
    approved: z.boolean(),
    notes: z.string().max(500, 'Notes too long').optional(),
  }),
};

// Hedera operation schemas
export const hederaSchemas = {
  createToken: z.object({
    name: z.string().min(1, 'Token name is required').max(100, 'Token name too long'),
    symbol: z.string().min(1, 'Token symbol is required').max(10, 'Token symbol too long'),
    decimals: z.number().int().min(0).max(18).default(0),
    initialSupply: z.number().int().min(0).default(0),
    treasuryAccountId: hederaAccountIdSchema,
  }),

  mintNft: z.object({
    tokenId: hederaTokenIdSchema,
    metadata: z.string().max(1000, 'Metadata too long'),
    receiverAccountId: hederaAccountIdSchema,
  }),

  uploadFile: z.object({
    contents: z.string().min(1, 'File contents required'),
    memo: z.string().max(100, 'Memo too long').optional(),
  }),

  submitMessage: z.object({
    topicId: hederaTopicIdSchema,
    message: z.string().min(1, 'Message is required').max(1024, 'Message too long'),
    submitKey: z.string().optional(),
  }),

  transferToken: z.object({
    tokenId: hederaTokenIdSchema,
    fromAccountId: hederaAccountIdSchema,
    toAccountId: hederaAccountIdSchema,
    amount: z.number().positive('Amount must be positive'),
  }),
};

// Contract operation schemas
export const contractSchemas = {
  deploy: z.object({
    bytecode: z.string().min(1, 'Bytecode is required'),
    constructorParams: z.array(z.any()).default([]),
    gas: z.number().int().positive().default(100000),
    initialBalance: z.number().min(0).default(0),
  }),

  call: z.object({
    contractId: z.string().min(1, 'Contract ID is required'),
    functionName: z.string().min(1, 'Function name is required'),
    functionParams: z.array(z.any()).default([]),
    gas: z.number().int().positive().default(100000),
    amount: z.number().min(0).default(0),
  }),

  escrowCreate: z.object({
    invoiceId: cuidSchema,
    amount: z.number().positive('Amount must be positive'),
    supplierAccountId: hederaAccountIdSchema,
    investorAccountId: hederaAccountIdSchema,
    releaseConditions: z.string().max(500, 'Release conditions too long').optional(),
  }),
};

// Parameter validation schemas
export const paramSchemas = {
  id: z.object({
    id: cuidSchema,
  }),

  hederaAccountId: z.object({
    accountId: hederaAccountIdSchema,
  }),

  hederaTransactionId: z.object({
    transactionId: hederaTransactionIdSchema,
  }),

  hederaTokenId: z.object({
    tokenId: hederaTokenIdSchema,
  }),
};

// Validation middleware factory
export const validate = (schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      let data;
      
      switch (source) {
        case 'body':
          data = request.body;
          break;
        case 'query':
          data = request.query;
          break;
        case 'params':
          data = request.params;
          break;
        default:
          throw new Error('Invalid validation source');
      }

      const validatedData = schema.parse(data);
      
      // Replace the original data with validated data
      switch (source) {
        case 'body':
          request.body = validatedData;
          break;
        case 'query':
          request.query = validatedData;
          break;
        case 'params':
          request.params = validatedData;
          break;
      }
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        const logData: any = {
          eventType: 'validation_failed',
          severity: 'low',
          details: {
            source,
            errors: validationErrors,
            endpoint: request.url,
            method: request.method,
          },
          ip: request.ip,
        };
        if (request.user?.id) {
          logData.userId = request.user.id;
        }
        auditLogger.logSecurity(logData);

        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationErrors,
        });
      }

      // Handle other validation errors
      const logData: any = {
        eventType: 'validation_error',
        severity: 'medium',
        details: {
          source,
          error: error instanceof Error ? error.message : 'Unknown validation error',
          endpoint: request.url,
          method: request.method,
        },
        ip: request.ip,
      };
      if (request.user?.id) {
        logData.userId = request.user.id;
      }
      auditLogger.logSecurity(logData);

      return reply.status(500).send({
        error: 'Internal validation error',
        code: 'VALIDATION_INTERNAL_ERROR',
      });
    }
  };
};

// File upload validation
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
} = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'],
    required = true,
  } = options;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file();
      
      if (!data && required) {
        return reply.status(400).send({
          error: 'File upload required',
          code: 'FILE_REQUIRED',
        });
      }

      if (data) {
        // Check file size
        if (data.file.bytesRead > maxSize) {
          const logData: any = {
            eventType: 'file_size_exceeded',
            severity: 'medium',
            details: {
              filename: data.filename,
              size: data.file.bytesRead,
              maxSize,
              endpoint: request.url,
            },
            ip: request.ip,
          };
          if (request.user?.id) {
            logData.userId = request.user.id;
          }
          auditLogger.logSecurity(logData);

          return reply.status(400).send({
            error: 'File size exceeds limit',
            code: 'FILE_TOO_LARGE',
            maxSize,
          });
        }

        // Check file type
        if (!allowedTypes.includes(data.mimetype)) {
          const logData: any = {
            eventType: 'invalid_file_type',
            severity: 'medium',
            details: {
              filename: data.filename,
              mimetype: data.mimetype,
              allowedTypes,
              endpoint: request.url,
            },
            ip: request.ip,
          };
          if (request.user?.id) {
            logData.userId = request.user.id;
          }
          auditLogger.logSecurity(logData);

          return reply.status(400).send({
            error: 'Invalid file type',
            code: 'INVALID_FILE_TYPE',
            allowedTypes,
          });
        }

        // Basic security scan (check for suspicious patterns)
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
        
        const suspiciousPatterns = [
          /<script[^>]*>/i,
          /javascript:/i,
          /vbscript:/i,
          /onload=/i,
          /onerror=/i,
        ];

        const foundSuspicious = suspiciousPatterns.some(pattern => pattern.test(content));
        
        if (foundSuspicious) {
          const logData: any = {
            eventType: 'suspicious_file_content',
            severity: 'high',
            details: {
              filename: data.filename,
              mimetype: data.mimetype,
              endpoint: request.url,
            },
            ip: request.ip,
          };
          if (request.user?.id) {
            logData.userId = request.user.id;
          }
          auditLogger.logSecurity(logData);

          return reply.status(400).send({
            error: 'File contains suspicious content',
            code: 'SUSPICIOUS_FILE_CONTENT',
          });
        }

        // Attach file data to request for further processing
        (request as any).fileData = {
          filename: data.filename,
          mimetype: data.mimetype,
          buffer,
          size: buffer.length,
        };
      }
      
    } catch (error) {
      const logData: any = {
        eventType: 'file_upload_error',
        severity: 'medium',
        details: {
          error: error instanceof Error ? error.message : 'Unknown file upload error',
          endpoint: request.url,
        },
        ip: request.ip,
      };
      if (request.user?.id) {
        logData.userId = request.user.id;
      }
      auditLogger.logSecurity(logData);

      return reply.status(500).send({
        error: 'File upload processing failed',
        code: 'FILE_UPLOAD_ERROR',
      });
    }
  };
};

export default {
  validate,
  validateFileUpload,
  userSchemas,
  invoiceSchemas,
  fundingSchemas,
  hederaSchemas,
  contractSchemas,
  paramSchemas,
};