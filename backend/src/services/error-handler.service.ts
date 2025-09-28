import { Logger } from 'pino';
import { HederaError, ContractError, WalletError, ValidationError } from '../types/errors';
import { HcsService } from './hcs.service';

// Type guard to check if error is an Error instance
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export interface ErrorContext {
  userId?: string;
  invoiceId?: string;
  transactionId?: string;
  contractId?: string;
  operation: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ErrorRecoveryStrategy {
  canRecover: boolean;
  retryCount: number;
  maxRetries: number;
  backoffMs: number;
  alternativeAction?: string;
}

export class ErrorHandlerService {
  private logger: Logger;
  private hcsService: HcsService;
  private errorMetrics: Map<string, number> = new Map();

  constructor(logger: Logger, hcsService: HcsService) {
    this.logger = logger;
    this.hcsService = hcsService;
  }

  /**
   * Handle contract execution errors with recovery strategies
   */
  async handleContractError(
    error: ContractError,
    context: ErrorContext
  ): Promise<ErrorRecoveryStrategy> {
    this.logger.error({
      error: error.message,
      context,
      contractId: error.contractId,
      functionName: error.functionName,
      gasUsed: error.gasUsed
    }, 'Contract execution failed');

    // Log error to HCS for audit trail
    await this.logErrorToHCS(error, context);

    // Increment error metrics
    const errorKey = `contract_${error.contractId}_${error.functionName}`;
    this.errorMetrics.set(errorKey, (this.errorMetrics.get(errorKey) || 0) + 1);

    // Determine recovery strategy based on error type
    switch (error.code) {
      case 'INSUFFICIENT_GAS':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 3,
          backoffMs: 2000,
          alternativeAction: 'increase_gas_limit'
        };

      case 'CONTRACT_REVERT':
        return {
          canRecover: false,
          retryCount: 0,
          maxRetries: 0,
          backoffMs: 0,
          alternativeAction: 'manual_intervention_required'
        };

      case 'INSUFFICIENT_BALANCE':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 1,
          backoffMs: 5000,
          alternativeAction: 'request_funding'
        };

      case 'NETWORK_ERROR':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 5,
          backoffMs: 1000,
          alternativeAction: 'switch_network_endpoint'
        };

      default:
        return {
          canRecover: false,
          retryCount: 0,
          maxRetries: 0,
          backoffMs: 0,
          alternativeAction: 'escalate_to_support'
        };
    }
  }

  /**
   * Handle wallet connection and transaction errors
   */
  async handleWalletError(
    error: WalletError,
    context: ErrorContext
  ): Promise<ErrorRecoveryStrategy> {
    this.logger.error({
      error: error.message,
      context,
      walletType: error.walletType,
      accountId: error.accountId
    }, 'Wallet operation failed');

    await this.logErrorToHCS(error, context);

    switch (error.code) {
      case 'WALLET_NOT_CONNECTED':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 3,
          backoffMs: 1000,
          alternativeAction: 'reconnect_wallet'
        };

      case 'USER_REJECTED':
        return {
          canRecover: false,
          retryCount: 0,
          maxRetries: 0,
          backoffMs: 0,
          alternativeAction: 'user_education'
        };

      case 'INSUFFICIENT_BALANCE':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 1,
          backoffMs: 0,
          alternativeAction: 'show_funding_options'
        };

      case 'WRONG_NETWORK':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 1,
          backoffMs: 0,
          alternativeAction: 'prompt_network_switch'
        };

      default:
        return {
          canRecover: false,
          retryCount: 0,
          maxRetries: 0,
          backoffMs: 0,
          alternativeAction: 'contact_support'
        };
    }
  }

  /**
   * Handle Hedera service errors (HTS, HFS, HCS)
   */
  async handleHederaError(
    error: HederaError,
    context: ErrorContext
  ): Promise<ErrorRecoveryStrategy> {
    this.logger.error({
      error: error.message,
      context,
      service: error.service,
      statusCode: error.statusCode
    }, 'Hedera service error');

    // Don't log HCS errors to HCS to avoid infinite loops
    if (error.service !== 'HCS') {
      await this.logErrorToHCS(error, context);
    }

    switch (error.service) {
      case 'HTS':
        return this.handleHtsError(error, context);
      case 'HFS':
        return this.handleHfsError(error, context);
      case 'HCS':
        return this.handleHcsError(error, context);
      default:
        return {
          canRecover: false,
          retryCount: 0,
          maxRetries: 0,
          backoffMs: 0,
          alternativeAction: 'escalate_to_support'
        };
    }
  }

  /**
   * Handle validation errors
   */
  async handleValidationError(
    error: ValidationError,
    context: ErrorContext
  ): Promise<ErrorRecoveryStrategy> {
    this.logger.warn({
      error: error.message,
      context,
      field: error.field,
      value: error.value
    }, 'Validation error');

    return {
      canRecover: true,
      retryCount: 0,
      maxRetries: 1,
      backoffMs: 0,
      alternativeAction: 'fix_validation_errors'
    };
  }

  /**
   * Execute operation with automatic retry and error handling
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<T> {
    let lastError: Error;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = isError(error) ? error : new Error(String(error));
        retryCount++;

        if (retryCount > maxRetries) {
          break;
        }

        // Determine if error is retryable
        const strategy = await this.determineRecoveryStrategy(error instanceof Error ? error : new Error(String(error)), context);
        
        if (!strategy.canRecover) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = backoffMs * Math.pow(2, retryCount - 1);
        await this.sleep(delay);

        this.logger.info({
          context,
          retryCount,
          maxRetries,
          delay
        }, 'Retrying operation after error');
      }
    }

    // All retries exhausted, handle final error
    const finalStrategy = await this.determineRecoveryStrategy(lastError!, context);
    
    this.logger.error({
      error: lastError!.message,
      context,
      retryCount,
      strategy: finalStrategy
    }, 'Operation failed after all retries');

    throw lastError!;
  }

  /**
   * Get error metrics for monitoring
   */
  getErrorMetrics(): Record<string, number> {
    return Object.fromEntries(this.errorMetrics);
  }

  /**
   * Reset error metrics
   */
  resetErrorMetrics(): void {
    this.errorMetrics.clear();
  }

  /**
   * Check if system is healthy based on error rates
   */
  isSystemHealthy(): boolean {
    const totalErrors = Array.from(this.errorMetrics.values()).reduce((sum, count) => sum + count, 0);
    const errorThreshold = 100; // Adjust based on your requirements
    
    return totalErrors < errorThreshold;
  }

  private async handleHtsError(error: HederaError, _context: ErrorContext): Promise<ErrorRecoveryStrategy> {
    switch (error.statusCode) {
      case 'TOKEN_NOT_FOUND':
      case 'INVALID_TOKEN_ID':
        return {
          canRecover: false,
          retryCount: 0,
          maxRetries: 0,
          backoffMs: 0,
          alternativeAction: 'recreate_token'
        };

      case 'INSUFFICIENT_TOKEN_BALANCE':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 1,
          backoffMs: 0,
          alternativeAction: 'mint_additional_tokens'
        };

      case 'TOKEN_FROZEN':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 1,
          backoffMs: 0,
          alternativeAction: 'unfreeze_token'
        };

      default:
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 3,
          backoffMs: 2000,
          alternativeAction: 'retry_hts_operation'
        };
    }
  }

  private async handleHfsError(error: HederaError, _context: ErrorContext): Promise<ErrorRecoveryStrategy> {
    switch (error.statusCode) {
      case 'FILE_NOT_FOUND':
        return {
          canRecover: false,
          retryCount: 0,
          maxRetries: 0,
          backoffMs: 0,
          alternativeAction: 'recreate_file'
        };

      case 'FILE_SIZE_LIMIT_EXCEEDED':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 1,
          backoffMs: 0,
          alternativeAction: 'compress_file'
        };

      default:
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 3,
          backoffMs: 1500,
          alternativeAction: 'retry_hfs_operation'
        };
    }
  }

  private async handleHcsError(error: HederaError, _context: ErrorContext): Promise<ErrorRecoveryStrategy> {
    switch (error.statusCode) {
      case 'TOPIC_NOT_FOUND':
        return {
          canRecover: false,
          retryCount: 0,
          maxRetries: 0,
          backoffMs: 0,
          alternativeAction: 'recreate_topic'
        };

      case 'MESSAGE_SIZE_TOO_LARGE':
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 1,
          backoffMs: 0,
          alternativeAction: 'split_message'
        };

      default:
        return {
          canRecover: true,
          retryCount: 0,
          maxRetries: 3,
          backoffMs: 1000,
          alternativeAction: 'retry_hcs_operation'
        };
    }
  }

  private async determineRecoveryStrategy(
    error: Error,
    context: ErrorContext
  ): Promise<ErrorRecoveryStrategy> {
    if (error instanceof ContractError) {
      return this.handleContractError(error, context);
    } else if (error instanceof WalletError) {
      return this.handleWalletError(error, context);
    } else if (error instanceof HederaError) {
      return this.handleHederaError(error, context);
    } else if (error instanceof ValidationError) {
      return this.handleValidationError(error, context);
    } else {
      // Generic error handling
      this.logger.error({ error: error.message, context }, 'Unhandled error type');
      return {
        canRecover: false,
        retryCount: 0,
        maxRetries: 0,
        backoffMs: 0,
        alternativeAction: 'escalate_to_support'
      };
    }
  }

  private async logErrorToHCS(error: Error, context: ErrorContext): Promise<void> {
    try {
      const errorMessage = {
        type: 'ERROR',
        timestamp: context.timestamp.toISOString(),
        operation: context.operation,
        error: {
          message: error.message,
          name: error.constructor.name,
          stack: error.stack
        },
        context: {
          userId: context.userId,
          invoiceId: context.invoiceId,
          transactionId: context.transactionId,
          contractId: context.contractId,
          metadata: context.metadata
        }
      };

      // Use audit topic if available, otherwise skip HCS logging
      const auditTopic = this.hcsService.getAuditTopic();
      if (auditTopic) {
        await this.hcsService.submitMessage(auditTopic, JSON.stringify(errorMessage));
      } else {
        this.logger.debug('No audit topic configured, skipping HCS error logging');
      }
    } catch (hcsError) {
      // Don't throw if HCS logging fails, just log locally
      const errorMessage = isError(hcsError) ? hcsError.message : String(hcsError);
      this.logger.warn({ hcsError: errorMessage }, 'Failed to log error to HCS');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}