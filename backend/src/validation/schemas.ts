import { z } from 'zod';

// Common validation schemas
export const hederaAccountIdSchema = z.string().regex(
  /^0\.0\.\d+$/,
  'Invalid Hedera account ID format (expected: 0.0.xxxxx)'
);

export const hederaTransactionIdSchema = z.string().regex(
  /^0\.0\.\d+@\d+\.\d+$/,
  'Invalid Hedera transaction ID format'
);

export const hederaTokenIdSchema = z.string().regex(
  /^0\.0\.\d+$/,
  'Invalid Hedera token ID format'
);

export const hederaFileIdSchema = z.string().regex(
  /^0\.0\.\d+$/,
  'Invalid Hedera file ID format'
);

export const hederaTopicIdSchema = z.string().regex(
  /^0\.0\.\d+$/,
  'Invalid Hedera topic ID format'
);

export const hederaContractIdSchema = z.string().regex(
  /^0\.0\.\d+$/,
  'Invalid Hedera contract ID format'
);

// User validation schemas
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['buyer', 'supplier', 'auditor'], {
    errorMap: () => ({ message: 'Role must be buyer, supplier, or auditor' })
  }),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  hederaAccountId: hederaAccountIdSchema,
  walletAddress: z.string().optional(),
});

export const userLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  companyName: z.string().min(2).optional(),
  hederaAccountId: hederaAccountIdSchema.optional(),
  walletAddress: z.string().optional(),
});

// Invoice validation schemas
export const invoiceCreateSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  supplierId: z.string().uuid('Invalid supplier ID'),
  buyerId: z.string().uuid('Invalid buyer ID'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.enum(['HBAR', 'USD'], {
    errorMap: () => ({ message: 'Currency must be HBAR or USD' })
  }),
  dueDate: z.string().datetime('Invalid due date format'),
  description: z.string().min(1, 'Description is required'),
  items: z.array(z.object({
    description: z.string().min(1, 'Item description is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unitPrice: z.number().positive('Unit price must be positive'),
    total: z.number().positive('Total must be positive'),
  })).min(1, 'At least one item is required'),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

export const invoiceUpdateSchema = z.object({
  status: z.enum(['draft', 'issued', 'funded', 'paid', 'overdue', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid invoice status' })
  }).optional(),
  amount: z.number().positive().optional(),
  dueDate: z.string().datetime().optional(),
  description: z.string().min(1).optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    total: z.number().positive(),
  })).optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

// Funding validation schemas
export const fundingCreateSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  funderId: z.string().uuid('Invalid funder ID'),
  amount: z.number().positive('Amount must be positive'),
  interestRate: z.number().min(0).max(100, 'Interest rate must be between 0 and 100'),
  fundingType: z.enum(['full', 'partial'], {
    errorMap: () => ({ message: 'Funding type must be full or partial' })
  }),
  terms: z.string().optional(),
});

export const fundingUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'funded', 'released', 'refunded'], {
    errorMap: () => ({ message: 'Invalid funding status' })
  }).optional(),
  amount: z.number().positive().optional(),
  interestRate: z.number().min(0).max(100).optional(),
  terms: z.string().optional(),
});

// Milestone validation schemas
export const milestoneCreateSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  dueDate: z.string().datetime('Invalid due date format'),
  amount: z.number().positive('Amount must be positive'),
  order: z.number().int().min(1, 'Order must be a positive integer'),
});

export const milestoneUpdateSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'verified'], {
    errorMap: () => ({ message: 'Invalid milestone status' })
  }).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  dueDate: z.string().datetime().optional(),
  amount: z.number().positive().optional(),
  completedAt: z.string().datetime().optional(),
  verifiedAt: z.string().datetime().optional(),
});

// Hedera transaction validation schemas
export const hederaTransactionSchema = z.object({
  transactionId: hederaTransactionIdSchema,
  accountId: hederaAccountIdSchema,
  amount: z.number().optional(),
  memo: z.string().optional(),
  tokenId: hederaTokenIdSchema.optional(),
  fileId: hederaFileIdSchema.optional(),
  topicId: hederaTopicIdSchema.optional(),
  contractId: hederaContractIdSchema.optional(),
});

// File upload validation schemas
export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  mimetype: z.string().min(1, 'MIME type is required'),
  size: z.number().positive('File size must be positive'),
  buffer: z.any().refine((val) => val instanceof Buffer, {
    message: 'File buffer is required'
  }),
});

export const documentUploadSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  documentType: z.enum(['invoice', 'receipt', 'contract', 'other'], {
    errorMap: () => ({ message: 'Invalid document type' })
  }),
  filename: z.string().min(1, 'Filename is required'),
  description: z.string().optional(),
});

// Query parameter validation schemas
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1, 'Page must be >= 1').optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 1 && n <= 100, 'Limit must be between 1 and 100').optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const invoiceFilterSchema = z.object({
  status: z.enum(['draft', 'issued', 'funded', 'paid', 'overdue', 'cancelled']).optional(),
  supplierId: z.string().uuid().optional(),
  buyerId: z.string().uuid().optional(),
  minAmount: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  maxAmount: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  currency: z.enum(['HBAR', 'USD']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).merge(paginationSchema);

export const fundingFilterSchema = z.object({
  status: z.enum(['pending', 'approved', 'funded', 'released', 'refunded']).optional(),
  funderId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  minAmount: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
  maxAmount: z.string().regex(/^\d+(\.\d+)?$/).transform(Number).optional(),
}).merge(paginationSchema);

// API response validation schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  meta: z.object({
    page: z.number().optional(),
    limit: z.number().optional(),
    total: z.number().optional(),
    totalPages: z.number().optional(),
  }).optional(),
});

// Webhook validation schemas
export const webhookEventSchema = z.object({
  eventType: z.enum(['invoice.created', 'invoice.updated', 'funding.created', 'funding.updated', 'milestone.completed']),
  timestamp: z.string().datetime(),
  data: z.any(),
  signature: z.string(),
});

// Environment validation schema
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.string().regex(/^\d+$/).transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  HEDERA_NETWORK: z.enum(['testnet', 'mainnet']),
  HEDERA_ACCOUNT_ID: hederaAccountIdSchema,
  HEDERA_PRIVATE_KEY: z.string().min(1, 'Hedera private key is required'),
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_MAX: z.string().regex(/^\d+$/).optional(),
  RATE_LIMIT_WINDOW: z.string().regex(/^\d+$/).optional(),
});

export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>;
export type InvoiceUpdate = z.infer<typeof invoiceUpdateSchema>;
export type FundingCreate = z.infer<typeof fundingCreateSchema>;
export type FundingUpdate = z.infer<typeof fundingUpdateSchema>;
export type MilestoneCreate = z.infer<typeof milestoneCreateSchema>;
export type MilestoneUpdate = z.infer<typeof milestoneUpdateSchema>;
export type HederaTransaction = z.infer<typeof hederaTransactionSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type DocumentUpload = z.infer<typeof documentUploadSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type InvoiceFilter = z.infer<typeof invoiceFilterSchema>;
export type FundingFilter = z.infer<typeof fundingFilterSchema>;
export type ApiResponse = z.infer<typeof apiResponseSchema>;
export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type EnvConfig = z.infer<typeof envSchema>;