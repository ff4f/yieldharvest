import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { hcsTopicsService } from './hcsTopics';
import { HcsService, MessageSubmissionResult } from './hcs.service';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// Milestone types in order
export enum MilestoneType {
  CREATED_ISSUED = 'CREATED/ISSUED',
  SHIPPED = 'SHIPPED',
  CUSTOMS_CLEARED = 'CUSTOMS_CLEARED',
  DELIVERED = 'DELIVERED',
  FUNDED = 'FUNDED',
  PAID = 'PAID'
}

// Milestone state machine - defines valid transitions
const MILESTONE_TRANSITIONS: Record<MilestoneType, MilestoneType[]> = {
  [MilestoneType.CREATED_ISSUED]: [MilestoneType.SHIPPED, MilestoneType.FUNDED],
  [MilestoneType.SHIPPED]: [MilestoneType.CUSTOMS_CLEARED],
  [MilestoneType.CUSTOMS_CLEARED]: [MilestoneType.DELIVERED],
  [MilestoneType.DELIVERED]: [MilestoneType.FUNDED, MilestoneType.PAID],
  [MilestoneType.FUNDED]: [MilestoneType.PAID],
  [MilestoneType.PAID]: [] // Terminal state
};

export interface MilestoneData {
  tokenId: string;
  serial: string;
  milestone: MilestoneType;
  fileHash?: string;
  agentId?: string;
  location?: string;
  notes?: string;
  documentUrl?: string;
  metadata?: Record<string, any>;
}

export interface MilestoneRecord {
  id: string;
  tokenId: string;
  serial: string;
  milestone: MilestoneType;
  topicId: string;
  sequenceNumber: string;
  transactionId: string;
  consensusTimestamp: string;
  fileHash?: string;
  agentId?: string;
  location?: string;
  notes?: string;
  documentUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface MilestoneValidationError {
  code: string;
  message: string;
  currentMilestone?: MilestoneType;
  attemptedMilestone: MilestoneType;
}

/**
 * Milestones Service for managing invoice milestone tracking
 * Enforces milestone ordering and publishes events to HCS
 */
export class MilestonesService {
  private hcsService: HcsService;

  constructor() {
    this.hcsService = new HcsService({
      operatorId: process.env.OPERATOR_ID!,
        operatorKey: process.env.OPERATOR_KEY!,
      network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet' | 'previewnet') || 'testnet',
      mirrorNodeUrl: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com'
    });
  }

  /**
   * Publish a milestone event to HCS
   * @param data - Milestone data
   * @returns Promise<MilestoneRecord>
   */
  async publishMilestone(data: MilestoneData): Promise<MilestoneRecord> {
    try {
      // Validate milestone transition
      await this.validateMilestoneTransition(data.tokenId, data.serial, data.milestone);

      // Get or create topic for this deal
      const invoiceKey = `${data.tokenId}-${data.serial}`;
      const topicId = await hcsTopicsService.getOrCreateDealTopic(invoiceKey);

      // Prepare normalized milestone message payload as per H.MD requirements
      const normalizedPayload = {
        tokenId: data.tokenId,
        serial: data.serial,
        milestone: data.milestone,
        ts: new Date().toISOString(),
        fileHash: data.fileHash || null
      };

      // Extended milestone message with additional context
      const milestoneMessage = {
        type: 'MILESTONE_EVENT',
        version: '1.0',
        payload: normalizedPayload,
        context: {
          agentId: data.agentId,
          location: data.location,
          notes: data.notes,
          documentUrl: data.documentUrl,
          metadata: data.metadata || {}
        }
      };

      // Submit to HCS
      const hcsResult = await this.hcsService.submitMessage(
        topicId,
        JSON.stringify(milestoneMessage)
      );

      // Store milestone record in database
      const milestoneRecord = await prisma.milestone.create({
        data: {
          tokenId: data.tokenId,
          serial: data.serial,
          milestone: data.milestone,
          topicId,
          sequenceNumber: hcsResult.sequenceNumber,
          transactionId: hcsResult.transactionId,
          consensusTimestamp: hcsResult.consensusTimestamp || new Date().toISOString(),
          fileHash: data.fileHash,
          agentId: data.agentId,
          location: data.location,
          notes: data.notes,
          documentUrl: data.documentUrl,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null
        }
      });

      logger.info('Milestone published successfully', {
        tokenId: data.tokenId,
        serial: data.serial,
        milestone: data.milestone,
        topicId,
        sequenceNumber: hcsResult.sequenceNumber,
        transactionId: hcsResult.transactionId
      });

      return {
        id: milestoneRecord.id,
        tokenId: milestoneRecord.tokenId,
        serial: milestoneRecord.serial,
        milestone: milestoneRecord.milestone as MilestoneType,
        topicId: milestoneRecord.topicId,
        sequenceNumber: milestoneRecord.sequenceNumber,
        transactionId: milestoneRecord.transactionId,
        consensusTimestamp: milestoneRecord.consensusTimestamp,
        fileHash: milestoneRecord.fileHash || undefined,
        agentId: milestoneRecord.agentId || undefined,
        location: milestoneRecord.location || undefined,
        notes: milestoneRecord.notes || undefined,
        documentUrl: milestoneRecord.documentUrl || undefined,
        metadata: milestoneRecord.metadata ? JSON.parse(milestoneRecord.metadata) : undefined,
        createdAt: milestoneRecord.createdAt
      };
    } catch (error) {
      logger.error('Failed to publish milestone', {
        error,
        tokenId: data.tokenId,
        serial: data.serial,
        milestone: data.milestone
      });
      throw error;
    }
  }

  /**
   * Validate milestone transition according to state machine
   * @param tokenId - Token ID
   * @param serial - Serial number
   * @param newMilestone - New milestone to validate
   * @throws MilestoneValidationError if transition is invalid
   */
  async validateMilestoneTransition(
    tokenId: string,
    serial: string,
    newMilestone: MilestoneType
  ): Promise<void> {
    try {
      // Get current milestone for this token
      const currentMilestone = await this.getCurrentMilestone(tokenId, serial);

      // If no current milestone, only CREATED_ISSUED is allowed
      if (!currentMilestone) {
        if (newMilestone !== MilestoneType.CREATED_ISSUED) {
          throw {
            code: 'INVALID_INITIAL_MILESTONE',
            message: `First milestone must be ${MilestoneType.CREATED_ISSUED}, got ${newMilestone}`,
            attemptedMilestone: newMilestone
          } as MilestoneValidationError;
        }
        return;
      }

      // Check if milestone already exists
      if (currentMilestone.milestone === newMilestone) {
        throw {
          code: 'MILESTONE_ALREADY_EXISTS',
          message: `Milestone ${newMilestone} already recorded for ${tokenId}-${serial}`,
          currentMilestone: currentMilestone.milestone,
          attemptedMilestone: newMilestone
        } as MilestoneValidationError;
      }

      // Check if transition is valid
      const validTransitions = MILESTONE_TRANSITIONS[currentMilestone.milestone];
      if (!validTransitions.includes(newMilestone)) {
        throw {
          code: 'INVALID_MILESTONE_TRANSITION',
          message: `Cannot transition from ${currentMilestone.milestone} to ${newMilestone}. Valid transitions: ${validTransitions.join(', ')}`,
          currentMilestone: currentMilestone.milestone,
          attemptedMilestone: newMilestone
        } as MilestoneValidationError;
      }

      logger.debug('Milestone transition validated', {
        tokenId,
        serial,
        from: currentMilestone.milestone,
        to: newMilestone
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        throw error; // Re-throw validation errors
      }
      logger.error('Error validating milestone transition', { error, tokenId, serial, newMilestone });
      throw new Error(`Milestone validation failed: ${error}`);
    }
  }

  /**
   * Get current milestone for a token
   * @param tokenId - Token ID
   * @param serial - Serial number
   * @returns Promise<MilestoneRecord | null>
   */
  async getCurrentMilestone(tokenId: string, serial: string): Promise<MilestoneRecord | null> {
    try {
      const milestone = await prisma.milestone.findFirst({
        where: {
          tokenId,
          serial
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!milestone) {
        return null;
      }

      return {
        id: milestone.id,
        tokenId: milestone.tokenId,
        serial: milestone.serial,
        milestone: milestone.milestone as MilestoneType,
        topicId: milestone.topicId,
        sequenceNumber: milestone.sequenceNumber,
        transactionId: milestone.transactionId,
        consensusTimestamp: milestone.consensusTimestamp,
        fileHash: milestone.fileHash || undefined,
        agentId: milestone.agentId || undefined,
        location: milestone.location || undefined,
        notes: milestone.notes || undefined,
        documentUrl: milestone.documentUrl || undefined,
        metadata: milestone.metadata ? JSON.parse(milestone.metadata) : undefined,
        createdAt: milestone.createdAt
      };
    } catch (error) {
      logger.error('Failed to get current milestone', { error, tokenId, serial });
      throw error;
    }
  }

  /**
   * Get all milestones for a token
   * @param tokenId - Token ID
   * @param serial - Serial number
   * @returns Promise<MilestoneRecord[]>
   */
  async getMilestones(tokenId: string, serial: string): Promise<MilestoneRecord[]> {
    try {
      const milestones = await prisma.milestone.findMany({
        where: {
          tokenId,
          serial
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      return milestones.map(milestone => ({
        id: milestone.id,
        tokenId: milestone.tokenId,
        serial: milestone.serial,
        milestone: milestone.milestone as MilestoneType,
        topicId: milestone.topicId,
        sequenceNumber: milestone.sequenceNumber,
        transactionId: milestone.transactionId,
        consensusTimestamp: milestone.consensusTimestamp,
        fileHash: milestone.fileHash || undefined,
        agentId: milestone.agentId || undefined,
        location: milestone.location || undefined,
        notes: milestone.notes || undefined,
        documentUrl: milestone.documentUrl || undefined,
        metadata: milestone.metadata ? JSON.parse(milestone.metadata) : undefined,
        createdAt: milestone.createdAt
      }));
    } catch (error) {
      logger.error('Failed to get milestones', { error, tokenId, serial });
      throw error;
    }
  }

  /**
   * Get milestone progress percentage
   * @param tokenId - Token ID
   * @param serial - Serial number
   * @returns Promise<number> - Progress percentage (0-100)
   */
  async getMilestoneProgress(tokenId: string, serial: string): Promise<number> {
    try {
      const milestones = await this.getMilestones(tokenId, serial);
      const totalMilestones = Object.keys(MilestoneType).length;
      const completedMilestones = milestones.length;
      
      return Math.round((completedMilestones / totalMilestones) * 100);
    } catch (error) {
      logger.error('Failed to get milestone progress', { error, tokenId, serial });
      return 0;
    }
  }

  /**
   * Get next valid milestones for a token
   * @param tokenId - Token ID
   * @param serial - Serial number
   * @returns Promise<MilestoneType[]>
   */
  async getNextValidMilestones(tokenId: string, serial: string): Promise<MilestoneType[]> {
    try {
      const currentMilestone = await this.getCurrentMilestone(tokenId, serial);
      
      if (!currentMilestone) {
        return [MilestoneType.CREATED_ISSUED];
      }
      
      return MILESTONE_TRANSITIONS[currentMilestone.milestone] || [];
    } catch (error) {
      logger.error('Failed to get next valid milestones', { error, tokenId, serial });
      return [];
    }
  }

  /**
   * Generate file hash for milestone documents
   * @param fileBuffer - File buffer
   * @returns string - SHA256 hash
   */
  generateFileHash(fileBuffer: Buffer): string {
    return createHash('sha256').update(fileBuffer).digest('hex');
  }

  /**
   * Health check for milestones service
   * @returns Promise<boolean>
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      
      // Test HCS service
      const hcsHealthy = await this.hcsService.healthCheck();
      
      return hcsHealthy;
    } catch (error) {
      logger.error('Milestones service health check failed', { error });
      return false;
    }
  }

  /**
   * Close the milestones service and cleanup resources
   */
  async close(): Promise<void> {
    try {
      await this.hcsService.close();
      logger.info('Milestones service closed');
    } catch (error) {
      logger.error('Error closing milestones service', { error });
    }
  }
}

// Export singleton instance
export const milestonesService = new MilestonesService();