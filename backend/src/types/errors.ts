export class HederaError extends Error {
  public readonly service: 'HTS' | 'HFS' | 'HCS' | 'MIRROR';
  public readonly statusCode: string;
  public readonly transactionId?: string;

  constructor(
    message: string,
    service: 'HTS' | 'HFS' | 'HCS' | 'MIRROR',
    statusCode: string,
    transactionId?: string
  ) {
    super(message);
    this.name = 'HederaError';
    this.service = service;
    this.statusCode = statusCode;
    if (transactionId !== undefined) {
      this.transactionId = transactionId;
    }
  }
}

export class ContractError extends Error {
  public readonly code: string;
  public readonly contractId: string;
  public readonly functionName: string;
  public readonly gasUsed?: number;
  public readonly transactionId?: string;

  constructor(
    message: string,
    code: string,
    contractId: string,
    functionName: string,
    gasUsed?: number,
    transactionId?: string
  ) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
    this.contractId = contractId;
    this.functionName = functionName;
    if (gasUsed !== undefined) {
      this.gasUsed = gasUsed;
    }
    if (transactionId !== undefined) {
      this.transactionId = transactionId;
    }
  }
}

export class WalletError extends Error {
  public readonly code: string;
  public readonly walletType: 'HASHPACK' | 'BLADE' | 'METAMASK';
  public readonly accountId?: string;
  public readonly network?: string;

  constructor(
    message: string,
    code: string,
    walletType: 'HASHPACK' | 'BLADE' | 'METAMASK',
    accountId?: string,
    network?: string
  ) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
    this.walletType = walletType;
    if (accountId !== undefined) {
      this.accountId = accountId;
    }
    if (network !== undefined) {
      this.network = network;
    }
  }
}

export class ValidationError extends Error {
  public readonly field: string;
  public readonly value: any;
  public readonly constraint: string;

  constructor(
    message: string,
    field: string,
    value: any,
    constraint: string
  ) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.constraint = constraint;
  }
}

export class NetworkError extends Error {
  public readonly endpoint: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    endpoint: string,
    statusCode?: number,
    retryable: boolean = true
  ) {
    super(message);
    this.name = 'NetworkError';
    this.endpoint = endpoint;
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
    this.retryable = retryable;
  }
}

export class BusinessLogicError extends Error {
  public readonly code: string;
  public readonly context: Record<string, any>;

  constructor(
    message: string,
    code: string,
    context: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'BusinessLogicError';
    this.code = code;
    this.context = context;
  }
}

// Error factory functions
export const createHederaError = (
  message: string,
  service: 'HTS' | 'HFS' | 'HCS' | 'MIRROR',
  statusCode: string,
  transactionId?: string
): HederaError => {
  return new HederaError(message, service, statusCode, transactionId);
};

export const createContractError = (
  message: string,
  code: string,
  contractId: string,
  functionName: string,
  gasUsed?: number,
  transactionId?: string
): ContractError => {
  return new ContractError(message, code, contractId, functionName, gasUsed, transactionId);
};

export const createWalletError = (
  message: string,
  code: string,
  walletType: 'HASHPACK' | 'BLADE' | 'METAMASK',
  accountId?: string,
  network?: string
): WalletError => {
  return new WalletError(message, code, walletType, accountId, network);
};

export const createValidationError = (
  message: string,
  field: string,
  value: any,
  constraint: string
): ValidationError => {
  return new ValidationError(message, field, value, constraint);
};

// Error type guards
export const isHederaError = (error: unknown): error is HederaError => {
  return error instanceof HederaError;
};

export const isContractError = (error: unknown): error is ContractError => {
  return error instanceof ContractError;
};

export const isWalletError = (error: unknown): error is WalletError => {
  return error instanceof WalletError;
};

export const isValidationError = (error: unknown): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isNetworkError = (error: unknown): error is NetworkError => {
  return error instanceof NetworkError;
};

export const isBusinessLogicError = (error: unknown): error is BusinessLogicError => {
  return error instanceof BusinessLogicError;
};

// Common error codes
export const ERROR_CODES = {
  // Contract errors
  INSUFFICIENT_GAS: 'INSUFFICIENT_GAS',
  CONTRACT_REVERT: 'CONTRACT_REVERT',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  
  // Wallet errors
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  USER_REJECTED: 'USER_REJECTED',
  WRONG_NETWORK: 'WRONG_NETWORK',
  
  // Hedera service errors
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  INVALID_TOKEN_ID: 'INVALID_TOKEN_ID',
  INSUFFICIENT_TOKEN_BALANCE: 'INSUFFICIENT_TOKEN_BALANCE',
  TOKEN_FROZEN: 'TOKEN_FROZEN',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_SIZE_LIMIT_EXCEEDED: 'FILE_SIZE_LIMIT_EXCEEDED',
  TOPIC_NOT_FOUND: 'TOPIC_NOT_FOUND',
  MESSAGE_SIZE_TOO_LARGE: 'MESSAGE_SIZE_TOO_LARGE',
  
  // Business logic errors
  INVOICE_NOT_FOUND: 'INVOICE_NOT_FOUND',
  INVOICE_ALREADY_FUNDED: 'INVOICE_ALREADY_FUNDED',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  FUNDING_AMOUNT_INVALID: 'FUNDING_AMOUNT_INVALID',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];