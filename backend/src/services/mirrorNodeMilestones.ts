import { logger } from '../utils/logger';
import { mirrorNodeService } from './mirrorNodeService';
import { MilestoneType, MilestoneRecord } from './milestonesService';
import { hcsCache, CacheKeys } from './cacheService';

export interface MirrorNodeMilestone {
  consensusTimestamp: string;
  sequenceNumber: string;
  topicId: string;
  message: string;
  runningHash: string;
  runningHashVersion: number;
  payerAccountId: string;
  validStartTimestamp: string;
  chunkInfo?: {
    initialTransactionId: string;
    number: number;
    total: number;
  };
  parsedData?: {
    type: string;
    timestamp: string;
    data: {
      tokenId: string;
      serial: string;
      milestone: MilestoneType;
      fileHash?: string;
      agentId?: string;
      location?: string;
      notes?: string;
      documentUrl?: string;
      metadata?: Record<string, any>;
    };
  };
}

export interface MilestoneTimeline {
  tokenId: string;
  serial: string;
  milestones: MirrorNodeMilestone[];
  totalCount: number;
  lastUpdated: string;
  topicId?: string;
}

export interface MilestoneTimelineFilter {
  tokenId?: string;
  serial?: string;
  milestone?: MilestoneType;
  agentId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
}

/**
 * Mirror Node Milestones Service
 * Fetches and processes milestone data from Hedera Mirror Node
 */
export class MirrorNodeMilestonesService {
  private readonly CACHE_TTL = 30; // 30 seconds cache
  private readonly DEFAULT_LIMIT = 100;

  /**
   * Get milestone timeline for a specific token from Mirror Node
   * @param tokenId - Token ID
   * @param serial - Serial number
   * @param options - Additional options
   * @returns Promise<MilestoneTimeline>
   */
  async getMilestoneTimeline(
    tokenId: string,
    serial: string,
    options: { useCache?: boolean; limit?: number } = {}
  ): Promise<MilestoneTimeline> {
    const { useCache = true, limit = this.DEFAULT_LIMIT } = options;
    const cacheKey = `milestone_timeline:${tokenId}:${serial}`;

    try {
      // Check cache first
      if (useCache) {
        const cached = hcsCache.get<MilestoneTimeline>(cacheKey);
        if (cached) {
          logger.debug('Returning cached milestone timeline', { tokenId, serial });
          return cached;
        }
      }

      // Get topic ID for this token
      const topicId = await this.getTopicIdForToken(tokenId, serial);
      if (!topicId) {
        return {
          tokenId,
          serial,
          milestones: [],
          totalCount: 0,
          lastUpdated: new Date().toISOString()
        };
      }

      // Fetch messages from Mirror Node
      const messagesResponse = await mirrorNodeService.getHcsMessages(topicId, {
        limit,
        order: 'asc'
      });
      const messages = messagesResponse.messages;

      // Filter and parse milestone messages
      const milestones = await this.parseMilestoneMessages(messages, tokenId, serial);

      const timeline: MilestoneTimeline = {
        tokenId,
        serial,
        milestones,
        totalCount: milestones.length,
        lastUpdated: new Date().toISOString(),
        topicId
      };

      // Cache the result
      if (useCache) {
        hcsCache.set(cacheKey, timeline, this.CACHE_TTL * 1000); // Convert to milliseconds
      }

      logger.info('Milestone timeline retrieved', {
        tokenId,
        serial,
        topicId,
        milestoneCount: milestones.length
      });

      return timeline;
    } catch (error) {
      logger.error('Failed to get milestone timeline', {
        error,
        tokenId,
        serial
      });
      throw error;
    }
  }

  /**
   * Get filtered milestone timeline
   * @param filter - Filter criteria
   * @returns Promise<MilestoneTimeline[]>
   */
  async getFilteredMilestones(filter: MilestoneTimelineFilter): Promise<MilestoneTimeline[]> {
    try {
      const { tokenId, serial, milestone, agentId, fromTimestamp, toTimestamp, limit = this.DEFAULT_LIMIT } = filter;

      // If tokenId and serial are provided, get specific timeline
      if (tokenId && serial) {
        const timeline = await this.getMilestoneTimeline(tokenId, serial, { limit });
        return [this.filterTimeline(timeline, filter)];
      }

      // Otherwise, we need to query multiple topics
      // This is more complex and would require getting all active topics
      // For now, return empty array if no specific token is provided
      logger.warn('Filtered milestone search without tokenId/serial not implemented', { filter });
      return [];
    } catch (error) {
      logger.error('Failed to get filtered milestones', { error, filter });
      throw error;
    }
  }

  /**
   * Get real-time milestone updates for a token
   * @param tokenId - Token ID
   * @param serial - Serial number
   * @param callback - Callback function for new milestones
   * @returns Promise<() => void> - Cleanup function
   */
  async subscribeToMilestoneUpdates(
    tokenId: string,
    serial: string,
    callback: (milestone: MirrorNodeMilestone) => void
  ): Promise<() => void> {
    try {
      const topicId = await this.getTopicIdForToken(tokenId, serial);
      if (!topicId) {
        throw new Error(`No topic found for token ${tokenId}-${serial}`);
      }

      // Note: Real-time subscription would require WebSocket implementation
      // For now, return a polling-based subscription
      let isActive = true;
      const pollInterval = setInterval(async () => {
        if (!isActive) return;
        
        try {
          const timeline = await this.getMilestoneTimeline(tokenId, serial, { useCache: false });
          // Check for new milestones and call callback
          // This is a simplified implementation
        } catch (error) {
          logger.error('Error in milestone polling', { error });
        }
      }, 5000); // Poll every 5 seconds
      
      const cleanup = () => {
        isActive = false;
        clearInterval(pollInterval);
      };

      logger.info('Subscribed to milestone updates', { tokenId, serial, topicId });
      return cleanup;
    } catch (error) {
      logger.error('Failed to subscribe to milestone updates', { error, tokenId, serial });
      throw error;
    }
  }

  /**
   * Get milestone statistics
   * @param tokenId - Token ID
   * @param serial - Serial number
   * @returns Promise<MilestoneStats>
   */
  async getMilestoneStats(tokenId: string, serial: string): Promise<{
    totalMilestones: number;
    completedMilestones: number;
    progressPercentage: number;
    lastMilestone?: MilestoneType;
    nextValidMilestones: MilestoneType[];
    estimatedCompletion?: string;
  }> {
    try {
      const timeline = await this.getMilestoneTimeline(tokenId, serial);
      const totalPossibleMilestones = Object.keys(MilestoneType).length;
      const completedMilestones = timeline.milestones.length;
      const progressPercentage = Math.round((completedMilestones / totalPossibleMilestones) * 100);

      // Get last milestone
      const lastMilestone = timeline.milestones.length > 0
        ? timeline.milestones[timeline.milestones.length - 1].parsedData?.data.milestone
        : undefined;

      // Calculate next valid milestones (simplified logic)
      const nextValidMilestones = this.getNextValidMilestones(lastMilestone);

      return {
        totalMilestones: totalPossibleMilestones,
        completedMilestones,
        progressPercentage,
        lastMilestone,
        nextValidMilestones
      };
    } catch (error) {
      logger.error('Failed to get milestone stats', { error, tokenId, serial });
      throw error;
    }
  }

  /**
   * Parse milestone messages from Mirror Node
   * @private
   */
  private async parseMilestoneMessages(
    messages: any[],
    tokenId: string,
    serial: string
  ): Promise<MirrorNodeMilestone[]> {
    const milestones: MirrorNodeMilestone[] = [];

    for (const message of messages) {
      try {
        const milestone = await this.parseMilestoneMessage(message, tokenId, serial);
        if (milestone) {
          milestones.push(milestone);
        }
      } catch (error) {
        logger.warn('Failed to parse milestone message', { error, message });
      }
    }

    return milestones.sort((a, b) => 
      new Date(a.consensusTimestamp).getTime() - new Date(b.consensusTimestamp).getTime()
    );
  }

  /**
   * Parse a single milestone message
   * @private
   */
  private async parseMilestoneMessage(
    message: any,
    tokenId: string,
    serial: string
  ): Promise<MirrorNodeMilestone | null> {
    try {
      // Decode base64 message
      const decodedMessage = Buffer.from(message.message, 'base64').toString('utf-8');
      const parsedData = JSON.parse(decodedMessage);

      // Check if this is a milestone event for our token
      if (
        parsedData.type === 'MILESTONE_EVENT' &&
        parsedData.data?.tokenId === tokenId &&
        parsedData.data?.serial === serial
      ) {
        return {
          consensusTimestamp: message.consensus_timestamp,
          sequenceNumber: message.sequence_number.toString(),
          topicId: message.topic_id,
          message: decodedMessage,
          runningHash: message.running_hash,
          runningHashVersion: message.running_hash_version,
          payerAccountId: message.payer_account_id,
          validStartTimestamp: message.valid_start_timestamp,
          chunkInfo: message.chunk_info,
          parsedData
        };
      }

      return null;
    } catch (error) {
      logger.debug('Message is not a valid milestone event', { error, message });
      return null;
    }
  }

  /**
   * Filter timeline based on criteria
   * @private
   */
  private filterTimeline(timeline: MilestoneTimeline, filter: MilestoneTimelineFilter): MilestoneTimeline {
    let filteredMilestones = timeline.milestones;

    if (filter.milestone) {
      filteredMilestones = filteredMilestones.filter(
        m => m.parsedData?.data.milestone === filter.milestone
      );
    }

    if (filter.agentId) {
      filteredMilestones = filteredMilestones.filter(
        m => m.parsedData?.data.agentId === filter.agentId
      );
    }

    if (filter.fromTimestamp) {
      filteredMilestones = filteredMilestones.filter(
        m => new Date(m.consensusTimestamp) >= new Date(filter.fromTimestamp!)
      );
    }

    if (filter.toTimestamp) {
      filteredMilestones = filteredMilestones.filter(
        m => new Date(m.consensusTimestamp) <= new Date(filter.toTimestamp!)
      );
    }

    return {
      ...timeline,
      milestones: filteredMilestones,
      totalCount: filteredMilestones.length
    };
  }

  /**
   * Get topic ID for a token (simplified - would need proper implementation)
   * @private
   */
  private async getTopicIdForToken(tokenId: string, serial: string): Promise<string | null> {
    try {
      // This would typically query the database for the topic ID
      // For now, we'll use a placeholder implementation
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const invoiceKey = `${tokenId}-${serial}`;
      const dealTopic = await prisma.dealTopic.findUnique({
        where: { invoiceKey }
      });
      
      return dealTopic?.topicId || null;
    } catch (error) {
      logger.error('Failed to get topic ID for token', { error, tokenId, serial });
      return null;
    }
  }

  /**
   * Get next valid milestones (simplified logic)
   * @private
   */
  private getNextValidMilestones(currentMilestone?: MilestoneType): MilestoneType[] {
    if (!currentMilestone) {
      return [MilestoneType.CREATED_ISSUED];
    }

    // Simplified state machine logic
    const transitions: Record<MilestoneType, MilestoneType[]> = {
      [MilestoneType.CREATED_ISSUED]: [MilestoneType.SHIPPED, MilestoneType.FUNDED],
      [MilestoneType.SHIPPED]: [MilestoneType.CUSTOMS_CLEARED],
      [MilestoneType.CUSTOMS_CLEARED]: [MilestoneType.DELIVERED],
      [MilestoneType.DELIVERED]: [MilestoneType.FUNDED, MilestoneType.PAID],
      [MilestoneType.FUNDED]: [MilestoneType.PAID],
      [MilestoneType.PAID]: []
    };

    return transitions[currentMilestone] || [];
  }

  /**
   * Clear milestone cache for a token
   * @param tokenId - Token ID
   * @param serial - Serial number
   */
  async clearCache(tokenId: string, serial: string): Promise<void> {
    const cacheKey = `milestone_timeline:${tokenId}:${serial}`;
    hcsCache.delete(cacheKey);
    logger.debug('Milestone cache cleared', { tokenId, serial });
  }

  /**
   * Health check for mirror node milestones service
   * @returns Promise<boolean>
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test mirror node connection
      const isHealthy = await mirrorNodeService.healthCheck();
      return isHealthy;
    } catch (error) {
      logger.error('Mirror node milestones service health check failed', { error });
      return false;
    }
  }
}

// Export singleton instance
export const mirrorNodeMilestonesService = new MirrorNodeMilestonesService();