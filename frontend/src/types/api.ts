// API Types for YieldHarvest

export interface ProofLink {
  type: 'hts' | 'hfs' | 'hcs' | 'hashscan' | 'mirror';
  label: string;
  url: string;
  hash?: string;
  timestamp?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  buyerId: string;
  agentId?: string;
  amount: string;
  currency: string;
  dueDate: string;
  status: 'ISSUED' | 'FUNDED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  description?: string;
  createdAt: string;
  updatedAt: string;
  
  // Hedera-specific fields
  tokenId?: string;
  serialNumber?: number;
  fileId?: string;
  topicId?: string;
  mintTransactionId?: string;
  
  // Proof links for on-chain verification
  proofLinks?: ProofLink[];
  
  // Mirror Node enriched data from backend
  onChainData?: {
    nftInfo?: {
      tokenId: string;
      serialNumber: number;
      accountId: string;
      createdTimestamp: string;
      modifiedTimestamp: string;
      metadata?: string;
    };
    hcsTimeline?: Array<{
      tokenId: string;
      serialNumber: string;
      status: string;
      timestamp: string;
      sequenceNumber: number;
      transactionId?: string;
    }>;
    fileInfo?: {
      fileId: string;
      size?: number;
      hash?: string;
    };
    mintTransaction?: {
      transactionId: string;
      timestamp: string;
      status: string;
    };
  };
  
  // Relations
  supplier?: {
    id: string;
    name: string;
    email: string;
  };
  agent?: {
    id: string;
    name: string;
    email: string;
  };
  events?: InvoiceEvent[];
  fundings?: Funding[];
}

export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  type: 'CREATED' | 'MINTED' | 'FUNDED' | 'PAID' | 'STATUS_CHANGED';
  data: Record<string, any>;
  transactionId?: string;
  createdAt: string;
}

export interface Funding {
  id: string;
  invoiceId: string;
  investorId: string;
  amount: string;
  interestRate: number;
  expectedReturn?: number;
  status: 'ACTIVE' | 'RELEASED' | 'REFUNDED' | 'CANCELLED';
  
  // Smart Contract Escrow fields
  escrowId?: string;
  transactionHash?: string;
  releaseTransactionHash?: string;
  refundTransactionHash?: string;
  
  // Legacy fields
  transactionId?: string;
  escrowAccountId?: string;
  scheduledTxId?: string;
  contractId?: string;
  
  // Timestamps
  fundedAt?: string;
  releasedAt?: string;
  refundedAt?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  investor?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateInvoiceRequest {
  invoiceNumber: string;
  supplierId: string;
  buyerId: string;
  agentId?: string;
  amount: string;
  currency: string;
  dueDate: string;
  description?: string;
  file?: File;
}

export interface CreateInvoiceResponse {
  invoice: Invoice;
  proofs: {
    mintTransactionId?: string;
    fileId?: string;
    topicSequenceNumber?: number;
  };
}

export interface UpdateInvoiceRequest {
  status?: Invoice['status'];
  agentId?: string;
  description?: string;
}

export interface CreateFundingRequest {
  invoiceId: string;
  investorId: string;
  amount: number;
  interestRate?: number;
}

export interface CreateFundingResponse {
  funding: Funding;
  proofs: {
    transactionHash?: string;
    escrowId?: string;
    hashScanUrl?: string;
  };
}

export interface FundingActionResponse {
  success: boolean;
  transactionHash?: string;
  hashScanUrl?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface InvoiceFilters {
  status?: string;
  supplierId?: string;
  page?: number;
  limit?: number;
}

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}