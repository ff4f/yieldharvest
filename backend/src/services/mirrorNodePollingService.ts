import { logger } from '../utils/logger';
import { mirrorNodeService } from './mirrorNodeService';
import { websocketService, MilestoneUpdate } from './websocketService';
import { HCSMessage, ParsedInvoiceMessage } from './mirrorNodeService';
import { parseMilestoneMessage, MirrorNodeMilestone } from './mirrorNodeMilestones';

interface PollingConfig {
  interval: number; // milliseconds
  enabled: boolean;
  topicIds: string[];
  tokenIds: string[];
}

interface LastPolledState {
  [topicId: string]: {
    lastSequenceNumber: number;
    lastTimestamp: string;
  };
}

class MirrorNodePollingService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private config: PollingConfig;
  private lastPolledState: LastPolledState = {};
  private isPolling: boolean = false;

  constructor() {
    this.config = {
      interval: parseInt(process.env.MIRROR_POLLING_INTERVAL || '10000'), // 10 seconds default
      enabled: process.env.MIRROR_POLLING_ENABLED === 'true',
      topicIds: (process.env.HEDERA_INVOICE_TOPIC_ID || '0.0.4567890').split(','),
      tokenIds: (process.env.HEDERA_INVOICE_TOKEN_ID || '0.0.1234567').split(','),
    };
  }

  /**
   * Start polling Mirror Node for real-time updates
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('Mirror Node polling is disabled');
      return;
    }

    if (this.pollingInterval) {
      logger.warn('Mirror Node polling is already running');
      return;
    }

    logger.info('Starting Mirror Node polling service', {
      interval: this.config.interval,
      topicIds: this.config.topicIds,
      tokenIds: this.config.tokenIds,
    });

    this.pollingInterval = setInterval(async () => {
      if (!this.isPolling) {
        await this.pollForUpdates();
      }
    }, this.config.interval);
  }

  /**
   * Stop polling Mirror Node
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info('Mirror Node polling service stopped');
    }
  }

  /**
   * Poll Mirror Node for new messages and updates
   */
  private async pollForUpdates(): Promise<void> {
    this.isPolling = true;

    try {
      // Poll HCS messages for each topic
      for (const topicId of this.config.topicIds) {
        await this.pollHCSMessages(topicId);
      }

      // Poll NFT updates for each token
      for (const tokenId of this.config.tokenIds) {
        await this.pollNFTUpdates(tokenId);
      }
    } catch (error) {
      logger.error('Error during Mirror Node polling:', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Poll HCS messages for a specific topic
   */
  private async pollHCSMessages(topicId: string): Promise<void> {
    try {
      const lastState = this.lastPolledState[topicId];
      const filters: any = {
        limit: 25,
        order: 'desc' as const,
      };

      // If we have a last sequence number, only get newer messages
      if (lastState?.lastSequenceNumber) {
        filters.sequencenumber = `gt:${lastState.lastSequenceNumber}`;
      }

      const messages = await mirrorNodeService.getHCSMessages(topicId, filters);
      
      if (messages.length === 0) {
        return;
      }

      // Parse both legacy invoice messages and new milestone messages
      const parsedInvoiceMessages = mirrorNodeService.parseInvoiceMessages(messages);
      const parsedMilestoneMessages: MirrorNodeMilestone[] = [];

      // Parse milestone messages using the new normalized structure
      for (const message of messages) {
        try {
          const milestoneMessage = parseMilestoneMessage(message);
          if (milestoneMessage) {
            parsedMilestoneMessages.push(milestoneMessage);
          }
        } catch (error) {
          logger.debug(`Failed to parse message as milestone: ${message.sequence_number}`, error);
        }
      }
      
      // Update last polled state
      const latestMessage = messages[0]; // messages are ordered desc, so first is latest
      this.lastPolledState[topicId] = {
        lastSequenceNumber: latestMessage.sequence_number,
        lastTimestamp: latestMessage.consensus_timestamp,
      };

      // Broadcast legacy invoice messages via WebSocket
      for (const parsedMessage of parsedInvoiceMessages) {
        const milestoneUpdate: MilestoneUpdate = {
          type: 'hcs_message',
          data: {
            ...parsedMessage,
            topicId,
            rawMessage: messages.find(m => m.sequence_number === parsedMessage.sequenceNumber),
          },
          timestamp: new Date().toISOString(),
          dealId: parsedMessage.tokenId,
          invoiceId: parsedMessage.serialNumber,
        };

        websocketService.broadcastMilestoneUpdate(milestoneUpdate);
      }

      // Broadcast new milestone messages via WebSocket
      for (const milestoneMessage of parsedMilestoneMessages) {
        const milestoneUpdate: MilestoneUpdate = {
          type: 'milestone_updated',
          data: {
            ...milestoneMessage,
            topicId,
            rawMessage: messages.find(m => m.sequence_number === milestoneMessage.sequenceNumber),
          },
          timestamp: new Date().toISOString(),
          dealId: milestoneMessage.parsedData.payload?.tokenId || milestoneMessage.parsedData.data?.tokenId,
          invoiceId: milestoneMessage.parsedData.payload?.serial || milestoneMessage.parsedData.data?.serial,
        };

        websocketService.broadcastMilestoneUpdate(milestoneUpdate);
      }

      const totalMessages = parsedInvoiceMessages.length + parsedMilestoneMessages.length;
      if (totalMessages > 0) {
        logger.info(`Polled ${messages.length} new HCS messages from topic ${topicId} (${parsedInvoiceMessages.length} legacy, ${parsedMilestoneMessages.length} milestone)`);
      }
    } catch (error) {
      logger.error(`Error polling HCS messages for topic ${topicId}:`, error);
    }
  }

  /**
   * Poll NFT updates for a specific token
   */
  private async pollNFTUpdates(tokenId: string): Promise<void> {
    try {
      // Get recent NFTs for the token
      const nfts = await mirrorNodeService.getNFTsByToken(tokenId, 10);
      
      if (nfts.length === 0) {
        return;
      }

      // Check for newly minted NFTs (created in the last polling interval)
      const recentThreshold = Date.now() - (this.config.interval * 2); // 2x polling interval
      const recentNFTs = nfts.filter(nft => {
        const createdTime = new Date(nft.created_timestamp).getTime();
        return createdTime > recentThreshold;
      });

      // Broadcast new NFT updates via WebSocket
      for (const nft of recentNFTs) {
        const milestoneUpdate: MilestoneUpdate = {
          type: 'milestone_created',
          data: {
            type: 'NFT_MINTED',
            tokenId: nft.token_id,
            serialNumber: nft.serial_number.toString(),
            accountId: nft.account_id,
            createdTimestamp: nft.created_timestamp,
            metadata: nft.metadata,
          },
          timestamp: new Date().toISOString(),
          dealId: nft.token_id,
          invoiceId: nft.serial_number.toString(),
        };

        websocketService.broadcastMilestoneUpdate(milestoneUpdate);
      }

      if (recentNFTs.length > 0) {
        logger.info(`Found ${recentNFTs.length} new NFTs for token ${tokenId}`);
      }
    } catch (error) {
      logger.error(`Error polling NFT updates for token ${tokenId}:`, error);
    }
  }

  /**
   * Get polling statistics
   */
  getStats() {
    return {
      isRunning: this.pollingInterval !== null,
      isPolling: this.isPolling,
      config: this.config,
      lastPolledState: this.lastPolledState,
    };
  }

  /**
   * Update polling configuration
   */
  updateConfig(newConfig: Partial<PollingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.pollingInterval && newConfig.interval) {
      // Restart with new interval
      this.stop();
      this.start();
    }
    
    logger.info('Mirror Node polling config updated', this.config);
  }

  /**
   * Force a polling cycle (for testing or manual triggers)
   */
  async forcePoll(): Promise<void> {
    if (this.isPolling) {
      logger.warn('Polling is already in progress');
      return;
    }

    logger.info('Force polling Mirror Node...');
    await this.pollForUpdates();
  }
}

// Export singleton instance
export const mirrorNodePollingService = new MirrorNodePollingService();
export { MirrorNodePollingService };
export type { PollingConfig, LastPolledState };