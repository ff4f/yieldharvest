import { milestonesService, MilestoneType } from '../milestonesService';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock Hedera SDK
jest.mock('@hashgraph/sdk', () => ({
  TopicMessageSubmitTransaction: jest.fn().mockImplementation(() => ({
    setTopicId: jest.fn().mockReturnThis(),
    setMessage: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({
      transactionId: 'mock-tx-id',
      getReceipt: jest.fn().mockResolvedValue({
        topicSequenceNumber: 1
      })
    })
  })),
  TopicId: {
    fromString: jest.fn().mockReturnValue('mock-topic-id')
  },
  Timestamp: {
    now: jest.fn().mockReturnValue({
      toString: jest.fn().mockReturnValue('2024-01-01T00:00:00Z')
    })
  }
}));

// Mock Prisma
const mockPrisma = {
  milestone: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn()
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma)
}));

// Mock Hedera service
const mockHederaService = {
  getClient: jest.fn().mockReturnValue({}),
  getTopicId: jest.fn().mockReturnValue('0.0.123456')
};

jest.mock('../../services/hederaService', () => ({
  hederaService: mockHederaService
}));

describe('MilestonesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('publishMilestone', () => {
    it('should publish a milestone successfully', async () => {
      const milestoneData = {
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.INVOICE_ISSUED,
        agentId: 'agent-123',
        location: 'Test Location',
        notes: 'Test notes'
      };

      const mockMilestone = {
        id: 'milestone-123',
        tokenId: '0.0.123',
        serial: '1',
        milestone: 'INVOICE_ISSUED',
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'mock-tx-id',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        createdAt: new Date()
      };

      mockPrisma.milestone.create.mockResolvedValue(mockMilestone);

      const result = await milestonesService.publishMilestone(milestoneData);

      expect(result).toEqual(mockMilestone);
      expect(mockPrisma.milestone.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenId: '0.0.123',
          serial: '1',
          milestone: 'INVOICE_ISSUED',
          topicId: '0.0.123456'
        })
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Publishing milestone to HCS',
        expect.objectContaining({
          tokenId: '0.0.123',
          serial: '1',
          milestone: 'INVOICE_ISSUED'
        })
      );
    });

    it('should handle errors when publishing milestone', async () => {
      const milestoneData = {
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.INVOICE_ISSUED
      };

      const error = new Error('HCS submission failed');
      mockPrisma.milestone.create.mockRejectedValue(error);

      await expect(milestonesService.publishMilestone(milestoneData)).rejects.toThrow(
        'HCS submission failed'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to publish milestone',
        expect.objectContaining({ error })
      );
    });
  });

  describe('getMilestones', () => {
    it('should retrieve milestones for a token', async () => {
      const mockMilestones = [
        {
          id: 'milestone-1',
          tokenId: '0.0.123',
          serial: '1',
          milestone: 'INVOICE_ISSUED',
          topicId: '0.0.123456',
          sequenceNumber: '1',
          transactionId: 'tx-1',
          consensusTimestamp: '2024-01-01T00:00:00Z',
          createdAt: new Date()
        },
        {
          id: 'milestone-2',
          tokenId: '0.0.123',
          serial: '1',
          milestone: 'INVOICE_FUNDED',
          topicId: '0.0.123456',
          sequenceNumber: '2',
          transactionId: 'tx-2',
          consensusTimestamp: '2024-01-01T01:00:00Z',
          createdAt: new Date()
        }
      ];

      mockPrisma.milestone.findMany.mockResolvedValue(mockMilestones);

      const result = await milestonesService.getMilestones('0.0.123', '1');

      expect(result).toEqual(mockMilestones);
      expect(mockPrisma.milestone.findMany).toHaveBeenCalledWith({
        where: {
          tokenId: '0.0.123',
          serial: '1'
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
    });

    it('should return empty array when no milestones found', async () => {
      mockPrisma.milestone.findMany.mockResolvedValue([]);

      const result = await milestonesService.getMilestones('0.0.999', '1');

      expect(result).toEqual([]);
    });
  });

  describe('getLatestMilestone', () => {
    it('should retrieve the latest milestone for a token', async () => {
      const mockMilestone = {
        id: 'milestone-latest',
        tokenId: '0.0.123',
        serial: '1',
        milestone: 'INVOICE_FUNDED',
        topicId: '0.0.123456',
        sequenceNumber: '2',
        transactionId: 'tx-2',
        consensusTimestamp: '2024-01-01T01:00:00Z',
        createdAt: new Date()
      };

      mockPrisma.milestone.findFirst.mockResolvedValue(mockMilestone);

      const result = await milestonesService.getLatestMilestone('0.0.123', '1');

      expect(result).toEqual(mockMilestone);
      expect(mockPrisma.milestone.findFirst).toHaveBeenCalledWith({
        where: {
          tokenId: '0.0.123',
          serial: '1'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    });

    it('should return null when no milestone found', async () => {
      mockPrisma.milestone.findFirst.mockResolvedValue(null);

      const result = await milestonesService.getLatestMilestone('0.0.999', '1');

      expect(result).toBeNull();
    });
  });

  describe('validateMilestoneTransition', () => {
    it('should allow valid milestone transitions', () => {
      // INVOICE_ISSUED -> INVOICE_FUNDED
      expect(
        milestonesService.validateMilestoneTransition(
          MilestoneType.INVOICE_ISSUED,
          MilestoneType.INVOICE_FUNDED
        )
      ).toBe(true);

      // INVOICE_FUNDED -> INVOICE_PAID
      expect(
        milestonesService.validateMilestoneTransition(
          MilestoneType.INVOICE_FUNDED,
          MilestoneType.INVOICE_PAID
        )
      ).toBe(true);
    });

    it('should reject invalid milestone transitions', () => {
      // INVOICE_PAID -> INVOICE_ISSUED (backward)
      expect(
        milestonesService.validateMilestoneTransition(
          MilestoneType.INVOICE_PAID,
          MilestoneType.INVOICE_ISSUED
        )
      ).toBe(false);

      // INVOICE_ISSUED -> INVOICE_PAID (skipping FUNDED)
      expect(
        milestonesService.validateMilestoneTransition(
          MilestoneType.INVOICE_ISSUED,
          MilestoneType.INVOICE_PAID
        )
      ).toBe(false);
    });
  });
});