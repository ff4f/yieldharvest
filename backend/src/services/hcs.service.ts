import { Client, TopicCreateTransaction, TopicMessageSubmitTransaction, TopicId, PrivateKey, AccountId } from '@hashgraph/sdk';
import { Logger } from 'pino';
import { logger } from '../utils/logger';

export interface HcsConfig {
  operatorId: string;
  operatorKey: string;
  network: 'testnet' | 'mainnet' | 'previewnet';
  mirrorNodeUrl: string;
}

export interface TopicInfo {
  topicId: string;
  transactionId: string;
  consensusTimestamp: string;
}

export interface MessageSubmissionResult {
  transactionId: string;
  sequenceNumber: string;
  consensusTimestamp?: string;
  messageId: string;
}

export interface TopicMessage {
  type: string;
  timestamp: string;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Hedera Consensus Service (HCS) implementation
 * Handles topic creation, message submission, and audit logging
 */
export class HcsService {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private logger: Logger;
  private auditTopicId?: string;

  constructor(config: HcsConfig, customLogger?: Logger) {
    this.logger = customLogger || logger;
    
    try {
      this.operatorId = AccountId.fromString(config.operatorId);
      this.operatorKey = PrivateKey.fromString(config.operatorKey);
      
      // Initialize Hedera client
      if (config.network === 'testnet') {
        this.client = Client.forTestnet();
      } else if (config.network === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        this.client = Client.forPreviewnet();
      }
      
      this.client.setOperator(this.operatorId, this.operatorKey);
      
      this.logger.info('HCS Service initialized', {
        network: config.network,
        operatorId: config.operatorId
      });
    } catch (error) {
      this.logger.error('Failed to initialize HCS Service', { error });
      throw new Error(`HCS Service initialization failed: ${error}`);
    }
  }

  /**
   * Create a new HCS topic
   */
  async createTopic(
    memo?: string,
    adminKey?: string,
    submitKey?: string
  ): Promise<TopicInfo> {
    try {
      const transaction = new TopicCreateTransaction();
      
      if (memo) {
        transaction.setTopicMemo(memo);
      }
      
      if (adminKey) {
        transaction.setAdminKey(PrivateKey.fromString(adminKey));
      }
      
      if (submitKey) {
        transaction.setSubmitKey(PrivateKey.fromString(submitKey));
      }
      
      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      if (!receipt.topicId) {
        throw new Error('Topic creation failed - no topic ID returned');
      }
      
      const topicInfo: TopicInfo = {
        topicId: receipt.topicId.toString(),
        transactionId: response.transactionId.toString(),
        consensusTimestamp: new Date().toISOString()
      };
      
      this.logger.info('HCS topic created successfully', topicInfo);
      return topicInfo;
    } catch (error) {
      this.logger.error('Failed to create HCS topic', { error });
      throw new Error(`Topic creation failed: ${error}`);
    }
  }

  /**
   * Submit a message to an HCS topic
   */
  async submitMessage(
    topicId: string,
    message: string | TopicMessage,
    chunkSize?: number
  ): Promise<MessageSubmissionResult> {
    try {
      const messageString = typeof message === 'string' 
        ? message 
        : JSON.stringify(message);
      
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(messageString);
      
      if (chunkSize && messageString.length > chunkSize) {
        transaction.setMaxChunks(Math.ceil(messageString.length / chunkSize));
      }
      
      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      const result: MessageSubmissionResult = {
        transactionId: response.transactionId.toString(),
        sequenceNumber: receipt.topicSequenceNumber?.toString() || '0',
        consensusTimestamp: new Date().toISOString(),
        messageId: `${topicId}-${receipt.topicSequenceNumber?.toString() || '0'}`
      };
      
      this.logger.debug('Message submitted to HCS topic', {
        topicId,
        sequenceNumber: result.sequenceNumber,
        transactionId: result.transactionId
      });
      
      return result;
    } catch (error) {
      this.logger.error('Failed to submit message to HCS topic', {
        topicId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Message submission failed: ${error}`);
    }
  }

  /**
   * Submit an audit log message to the designated audit topic
   */
  async submitAuditLog(
    operation: string,
    data: any,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<MessageSubmissionResult | null> {
    if (!this.auditTopicId) {
      this.logger.warn('No audit topic configured, skipping audit log');
      return null;
    }
    
    try {
      const auditMessage: TopicMessage = {
        type: 'AUDIT_LOG',
        timestamp: new Date().toISOString(),
        data: {
          operation,
          userId,
          data,
          metadata
        }
      };
      
      return await this.submitMessage(this.auditTopicId, auditMessage);
    } catch (error) {
      this.logger.error('Failed to submit audit log', {
        operation,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw for audit log failures
      return null;
    }
  }

  /**
   * Submit an invoice event to HCS
   */
  async submitInvoiceEvent(
    topicId: string,
    eventType: string,
    invoiceId: string,
    data: any,
    transactionId?: string
  ): Promise<MessageSubmissionResult> {
    const eventMessage: TopicMessage = {
      type: 'INVOICE_EVENT',
      timestamp: new Date().toISOString(),
      data: {
        eventType,
        invoiceId,
        transactionId,
        ...data
      }
    };
    
    return await this.submitMessage(topicId, eventMessage);
  }

  /**
   * Submit a funding event to HCS
   */
  async submitFundingEvent(
    topicId: string,
    eventType: string,
    fundingId: string,
    invoiceId: string,
    amount: number,
    investorId: string,
    escrowId?: string,
    transactionId?: string
  ): Promise<MessageSubmissionResult> {
    const eventMessage: TopicMessage = {
      type: 'FUNDING_EVENT',
      timestamp: new Date().toISOString(),
      data: {
        eventType,
        fundingId,
        invoiceId,
        amount,
        investorId,
        escrowId,
        transactionId
      }
    };
    
    return await this.submitMessage(topicId, eventMessage);
  }

  /**
   * Submit an error event to HCS for audit trail
   */
  async submitErrorEvent(
    topicId: string,
    error: Error,
    context: any,
    userId?: string
  ): Promise<MessageSubmissionResult> {
    const errorMessage: TopicMessage = {
      type: 'ERROR_EVENT',
      timestamp: new Date().toISOString(),
      data: {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context,
        userId
      }
    };
    
    return await this.submitMessage(topicId, errorMessage);
  }

  /**
   * Set the audit topic ID for automatic audit logging
   */
  setAuditTopic(topicId: string): void {
    this.auditTopicId = topicId;
    this.logger.info('Audit topic configured', { topicId });
  }

  /**
   * Get the current audit topic ID
   */
  getAuditTopic(): string | undefined {
    return this.auditTopicId;
  }

  /**
   * Close the HCS client connection
   */
  async close(): Promise<void> {
    try {
      await this.client.close();
      this.logger.info('HCS Service client closed');
    } catch (error) {
      this.logger.error('Error closing HCS Service client', { error });
    }
  }

  /**
   * Health check for HCS service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - verify client is initialized
      if (!this.client || !this.operatorId || !this.operatorKey) {
        return false;
      }
      
      this.logger.debug('HCS Service health check passed', {
        operatorId: this.operatorId.toString()
      });
      return true;
    } catch (error) {
      this.logger.error('HCS Service health check failed', { error });
      return false;
    }
  }
}

// Export a default instance for convenience
export const createHcsService = (config: HcsConfig, logger?: Logger): HcsService => {
  return new HcsService(config, logger);
};