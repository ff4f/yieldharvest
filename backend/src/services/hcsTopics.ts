import { Client, TopicCreateTransaction, TopicId, PrivateKey, AccountId } from '@hashgraph/sdk';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface TopicCreationResult {
  topicId: string;
  transactionId: string;
  consensusTimestamp: string;
}

export interface DealTopicInfo {
  topicId: string;
  invoiceKey: string;
  createdAt: Date;
  isActive: boolean;
}

/**
 * HCS Topics Service for managing milestone tracking topics
 * Each invoice/deal gets its own HCS topic for milestone events
 */
export class HcsTopicsService {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;

  constructor() {
    // Initialize Hedera client
    this.operatorId = AccountId.fromString(process.env.OPERATOR_ID!);
    this.operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY!);
    
    if (process.env.HEDERA_NETWORK === 'mainnet') {
      this.client = Client.forMainnet();
    } else if (process.env.HEDERA_NETWORK === 'previewnet') {
      this.client = Client.forPreviewnet();
    } else {
      this.client = Client.forTestnet();
    }
    
    this.client.setOperator(this.operatorId, this.operatorKey);
  }

  /**
   * Create a new HCS topic for milestone tracking
   * @param memo - Topic memo/description
   * @param adminKey - Optional admin key for topic management
   * @param submitKey - Optional submit key for message submission
   * @returns Promise<TopicCreationResult>
   */
  async createTopic(
    memo?: string,
    adminKey?: string,
    submitKey?: string
  ): Promise<TopicCreationResult> {
    try {
      const transaction = new TopicCreateTransaction();
      
      if (memo) {
        transaction.setTopicMemo(memo);
      }
      
      // Set admin key if provided, otherwise use operator key
      const adminPrivateKey = adminKey ? PrivateKey.fromString(adminKey) : this.operatorKey;
      transaction.setAdminKey(adminPrivateKey);
      
      // Set submit key if provided, otherwise use operator key
      const submitPrivateKey = submitKey ? PrivateKey.fromString(submitKey) : this.operatorKey;
      transaction.setSubmitKey(submitPrivateKey);
      
      // Execute transaction
      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      
      if (!receipt.topicId) {
        throw new Error('Topic creation failed - no topic ID returned');
      }
      
      const result: TopicCreationResult = {
        topicId: receipt.topicId.toString(),
        transactionId: response.transactionId.toString(),
        consensusTimestamp: new Date().toISOString()
      };
      
      logger.info('HCS topic created successfully', {
        topicId: result.topicId,
        transactionId: result.transactionId,
        memo
      });
      
      return result;
    } catch (error) {
      logger.error('Failed to create HCS topic', { error, memo });
      throw new Error(`Topic creation failed: ${error}`);
    }
  }

  /**
   * Get or create a topic for a specific deal/invoice
   * @param invoiceKey - Unique identifier for the invoice (tokenId-serialNumber or invoiceId)
   * @returns Promise<string> - Topic ID
   */
  async getOrCreateDealTopic(invoiceKey: string): Promise<string> {
    try {
      // Check if topic already exists for this invoice
      const existingTopic = await prisma.dealTopic.findUnique({
        where: { invoiceKey }
      });

      if (existingTopic && existingTopic.isActive) {
        logger.debug('Using existing topic for deal', {
          invoiceKey,
          topicId: existingTopic.topicId
        });
        return existingTopic.topicId;
      }

      // Create new topic
      const memo = `YieldHarvest Milestone Tracking - ${invoiceKey}`;
      const topicResult = await this.createTopic(memo);

      // Store topic info in database
      const dealTopic = await prisma.dealTopic.create({
        data: {
          topicId: topicResult.topicId,
          invoiceKey,
          transactionId: topicResult.transactionId,
          isActive: true
        }
      });

      logger.info('Created new deal topic', {
        invoiceKey,
        topicId: topicResult.topicId,
        transactionId: topicResult.transactionId
      });

      return topicResult.topicId;
    } catch (error) {
      logger.error('Failed to get or create deal topic', { error, invoiceKey });
      throw new Error(`Deal topic creation failed: ${error}`);
    }
  }

  /**
   * Get topic information for a deal
   * @param invoiceKey - Invoice key
   * @returns Promise<DealTopicInfo | null>
   */
  async getDealTopicInfo(invoiceKey: string): Promise<DealTopicInfo | null> {
    try {
      const dealTopic = await prisma.dealTopic.findUnique({
        where: { invoiceKey }
      });

      if (!dealTopic) {
        return null;
      }

      return {
        topicId: dealTopic.topicId,
        invoiceKey: dealTopic.invoiceKey,
        createdAt: dealTopic.createdAt,
        isActive: dealTopic.isActive
      };
    } catch (error) {
      logger.error('Failed to get deal topic info', { error, invoiceKey });
      throw error;
    }
  }

  /**
   * Deactivate a topic (mark as inactive)
   * @param invoiceKey - Invoice key
   * @returns Promise<void>
   */
  async deactivateDealTopic(invoiceKey: string): Promise<void> {
    try {
      await prisma.dealTopic.update({
        where: { invoiceKey },
        data: { isActive: false }
      });

      logger.info('Deal topic deactivated', { invoiceKey });
    } catch (error) {
      logger.error('Failed to deactivate deal topic', { error, invoiceKey });
      throw error;
    }
  }

  /**
   * List all active topics
   * @returns Promise<DealTopicInfo[]>
   */
  async listActiveTopics(): Promise<DealTopicInfo[]> {
    try {
      const topics = await prisma.dealTopic.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      return topics.map(topic => ({
        topicId: topic.topicId,
        invoiceKey: topic.invoiceKey,
        createdAt: topic.createdAt,
        isActive: topic.isActive
      }));
    } catch (error) {
      logger.error('Failed to list active topics', { error });
      throw error;
    }
  }

  /**
   * Get topic ID by invoice key (convenience method)
   * @param invoiceKey - Invoice key
   * @returns Promise<string | null>
   */
  async getTopicId(invoiceKey: string): Promise<string | null> {
    const topicInfo = await this.getDealTopicInfo(invoiceKey);
    return topicInfo?.topicId || null;
  }

  /**
   * Health check for HCS service
   * @returns Promise<boolean>
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to create a test topic (we won't store it)
      const testMemo = `Health Check - ${Date.now()}`;
      await this.createTopic(testMemo);
      return true;
    } catch (error) {
      logger.error('HCS Topics health check failed', { error });
      return false;
    }
  }

  /**
   * Close the HCS client connection
   */
  async close(): Promise<void> {
    try {
      await this.client.close();
      logger.info('HCS Topics service client closed');
    } catch (error) {
      logger.error('Error closing HCS Topics service client', { error });
    }
  }
}

// Export singleton instance
export const hcsTopicsService = new HcsTopicsService();