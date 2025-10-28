import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicInfoQuery,
  TopicId,
  PrivateKey,
  AccountId,
  Hbar,
  TransactionId,
  TransactionReceipt,
  Status
} from '@hashgraph/sdk';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface InvoiceStatusMessage {
  invoiceId: string;
  invoiceNumber: string;
  supplierId: string;
  status: 'ISSUED' | 'FUNDED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  previousStatus?: string;
  amount: number;
  currency: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface TopicCreationResult {
  success: boolean;
  topicId?: string;
  transactionId?: string;
  hashScanUrl?: string;
  mirrorNodeUrl?: string;
  error?: string;
}

export interface MessageSubmissionResult {
  success: boolean;
  messageId?: string;
  sequenceNumber?: string;
  transactionId?: string;
  consensusTimestamp?: string;
  hashScanUrl?: string;
  mirrorNodeUrl?: string;
  error?: string;
}

export interface TopicInfo {
  topicId: string;
  adminKey?: string;
  submitKey?: string;
  memo?: string;
  runningHash: string;
  sequenceNumber: string;
  expirationTime?: string;
  autoRenewPeriod?: string;
  autoRenewAccount?: string;
}

class HederaConsensusService {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private network: string;

  constructor() {
    this.network = process.env.HEDERA_NETWORK || 'testnet';
    
    if (!process.env.HEDERA_OPERATOR_ID || !process.env.HEDERA_OPERATOR_KEY) {
      throw new Error('Missing required Hedera environment variables');
    }

    this.operatorId = AccountId.fromString(process.env.HEDERA_OPERATOR_ID);
    this.operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY);

    // Initialize client based on network
    if (this.network === 'mainnet') {
      this.client = Client.forMainnet();
    } else {
      this.client = Client.forTestnet();
    }

    this.client.setOperator(this.operatorId, this.operatorKey);
    
    logger.info({ network: this.network }, `HederaConsensusService initialized for ${this.network}`);
  }

  /**
   * Create a new HCS topic for invoice status tracking
   */
  async createTopic(
    memo: string,
    adminKey?: PrivateKey,
    submitKey?: PrivateKey
  ): Promise<TopicCreationResult> {
    try {
      logger.info({ memo }, `Creating HCS topic with memo: ${memo}`);

      const transaction = new TopicCreateTransaction()
        .setTopicMemo(memo)
        .setMaxTransactionFee(new Hbar(2));

      // Set admin key if provided
      if (adminKey) {
        transaction.setAdminKey(adminKey);
      }

      // Set submit key if provided
      if (submitKey) {
        transaction.setSubmitKey(submitKey);
      }

      // Execute transaction
      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Topic creation failed with status: ${receipt.status}`);
      }

      const topicId = receipt.topicId?.toString();
      if (!topicId) {
        throw new Error('Topic ID not found in receipt');
      }

      const transactionId = txResponse.transactionId.toString();
      const hashScanUrl = `https://hashscan.io/${this.network}/transaction/${transactionId}`;
      const mirrorNodeUrl = `https://${this.network}.mirrornode.hedera.com/api/v1/transactions/${transactionId}`;

      logger.info({ topicId }, `HCS topic created successfully: ${topicId}`);

      return {
        success: true,
        topicId,
        transactionId,
        hashScanUrl,
        mirrorNodeUrl
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to create HCS topic`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Submit an invoice status message to HCS topic
   */
  async submitInvoiceStatusMessage(
    topicId: string,
    message: InvoiceStatusMessage
  ): Promise<MessageSubmissionResult> {
    try {
      logger.info({ topicId, invoiceId: message.invoiceId }, `Submitting message to HCS topic ${topicId} for invoice ${message.invoiceId}`);

      // Create message payload
      const messagePayload = {
        type: 'INVOICE_STATUS_UPDATE',
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: message
      };

      const messageString = JSON.stringify(messagePayload);
      const messageBuffer = Buffer.from(messageString, 'utf8');

      // Create and execute transaction
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(messageBuffer)
        .setMaxTransactionFee(new Hbar(1));

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Message submission failed with status: ${receipt.status}`);
      }

      const transactionId = txResponse.transactionId.toString();
      const hashScanUrl = `https://hashscan.io/${this.network}/transaction/${transactionId}`;
      const mirrorNodeUrl = `https://${this.network}.mirrornode.hedera.com/api/v1/transactions/${transactionId}`;

      // Get sequence number from receipt
      const sequenceNumber = receipt.topicSequenceNumber?.toString();

      logger.info({ topicId, sequenceNumber }, `Message submitted successfully to topic ${topicId}, sequence: ${sequenceNumber}`);

      return {
        success: true,
        messageId: crypto.randomUUID(),
        sequenceNumber,
        transactionId,
        hashScanUrl,
        mirrorNodeUrl
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to submit message to HCS`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get topic information
   */
  async getTopicInfo(topicId: string): Promise<TopicInfo | null> {
    try {
      logger.info({ topicId }, `Getting info for HCS topic: ${topicId}`);

      const query = new TopicInfoQuery()
        .setTopicId(TopicId.fromString(topicId));

      const topicInfo = await query.execute(this.client);

      return {
        topicId: topicInfo.topicId.toString(),
        adminKey: topicInfo.adminKey?.toString(),
        submitKey: topicInfo.submitKey?.toString(),
        memo: topicInfo.topicMemo,
        runningHash: Buffer.from(topicInfo.runningHash).toString('hex'),
        sequenceNumber: topicInfo.sequenceNumber.toString(),
        expirationTime: topicInfo.expirationTime?.toString(),
        autoRenewPeriod: topicInfo.autoRenewPeriod?.toString(),
        autoRenewAccount: topicInfo.autoRenewAccountId?.toString()
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to get topic info`);
      return null;
    }
  }

  /**
   * Submit a generic event message to HCS topic
   */
  async submitEventMessage(
    topicId: string,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<MessageSubmissionResult> {
    try {
      logger.info({ eventType, topicId }, `Submitting ${eventType} event to HCS topic ${topicId}`);

      const messagePayload = {
        type: eventType,
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: eventData
      };

      const messageString = JSON.stringify(messagePayload);
      const messageBuffer = Buffer.from(messageString, 'utf8');

      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(TopicId.fromString(topicId))
        .setMessage(messageBuffer)
        .setMaxTransactionFee(new Hbar(1));

      const txResponse = await transaction.execute(this.client);
      const receipt = await txResponse.getReceipt(this.client);

      if (receipt.status !== Status.Success) {
        throw new Error(`Event message submission failed with status: ${receipt.status}`);
      }

      const transactionId = txResponse.transactionId.toString();
      const hashScanUrl = `https://hashscan.io/${this.network}/transaction/${transactionId}`;
      const mirrorNodeUrl = `https://${this.network}.mirrornode.hedera.com/api/v1/transactions/${transactionId}`;
      const sequenceNumber = receipt.topicSequenceNumber?.toString();

      logger.info({ eventType }, `Event message submitted successfully: ${eventType}`);

      return {
        success: true,
        messageId: crypto.randomUUID(),
        sequenceNumber,
        transactionId,
        hashScanUrl,
        mirrorNodeUrl
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, `Failed to submit event message`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a topic specifically for an invoice
   */
  async createInvoiceTopic(invoiceId: string, invoiceNumber: string): Promise<TopicCreationResult> {
    const memo = `YieldHarvest Invoice Topic - ID: ${invoiceId}, Number: ${invoiceNumber}`;
    return this.createTopic(memo);
  }

  /**
   * Submit invoice creation event
   */
  async submitInvoiceCreatedEvent(
    topicId: string,
    invoiceData: {
      invoiceId: string;
      invoiceNumber: string;
      supplierId: string;
      amount: number;
      currency: string;
      dueDate: string;
      nftTokenId?: string;
      nftSerialNumber?: string;
    }
  ): Promise<MessageSubmissionResult> {
    return this.submitEventMessage(topicId, 'INVOICE_CREATED', invoiceData);
  }

  /**
   * Submit NFT minting event
   */
  async submitNFTMintedEvent(
    topicId: string,
    nftData: {
      invoiceId: string;
      tokenId: string;
      serialNumber: string;
      transactionId: string;
      metadata: Record<string, any>;
    }
  ): Promise<MessageSubmissionResult> {
    return this.submitEventMessage(topicId, 'NFT_MINTED', nftData);
  }

  /**
   * Submit file upload event
   */
  async submitFileUploadedEvent(
    topicId: string,
    fileData: {
      invoiceId: string;
      fileId: string;
      filename: string;
      hash: string;
      size: number;
      documentType: string;
    }
  ): Promise<MessageSubmissionResult> {
    return this.submitEventMessage(topicId, 'FILE_UPLOADED', fileData);
  }

  /**
   * Submit funding event
   */
  async submitFundingEvent(
    topicId: string,
    fundingData: {
      invoiceId: string;
      investorId: string;
      amount: number;
      interestRate: number;
      escrowId?: string;
      transactionId: string;
    }
  ): Promise<MessageSubmissionResult> {
    return this.submitEventMessage(topicId, 'INVOICE_FUNDED', fundingData);
  }

  /**
   * Submit payment received event
   */
  async submitPaymentReceivedEvent(
    topicId: string,
    paymentData: {
      invoiceId: string;
      amount: number;
      currency: string;
      transactionId: string;
      paidBy?: string;
    }
  ): Promise<MessageSubmissionResult> {
    return this.submitEventMessage(topicId, 'PAYMENT_RECEIVED', paymentData);
  }
}

// Export singleton instance
export const hederaConsensusService = new HederaConsensusService();