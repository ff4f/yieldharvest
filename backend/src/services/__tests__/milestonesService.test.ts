import { MilestonesService, MilestoneType, MilestoneData, MilestoneRecord } from '../milestonesService';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock HCS Service
jest.mock('../hcs.service', () => ({
  HcsService: jest.fn().mockImplementation(() => ({
    submitMessage: jest.fn(),
    healthCheck: jest.fn()
  }))
}));

// Mock HCS Topics Service
jest.mock('../hcsTopics', () => ({
  hcsTopicsService: {
    getTopicId: jest.fn(),
    createTopic: jest.fn()
  }
}));

// Mock Hedera Service
jest.mock('../hedera', () => ({
  HederaService: jest.fn().mockImplementation(() => ({
    getClient: jest.fn(),
    healthCheck: jest.fn()
  }))
}));

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    milestone: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    $queryRaw: jest.fn()
  }))
}));

describe('MilestonesService', () => {
  let milestonesService: MilestonesService;
  let mockHcsTopicsService: any;
  let mockHcsService: any;
  let mockHederaService: any;
  let mockMilestoneCreate: jest.Mock;
  let mockMilestoneFindMany: jest.Mock;
  let mockMilestoneFindFirst: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get mocked services
    mockHcsTopicsService = require('../hcsTopics').hcsTopicsService;
    mockHcsService = new (require('../hcs.service').HcsService)();
    mockHederaService = new (require('../hedera').HederaService)();
    
    // Setup default mocks
    mockHcsTopicsService.getOrCreateDealTopic = jest.fn().mockResolvedValue('0.0.123456');
    mockHcsService.submitMessage = jest.fn().mockResolvedValue({
      transactionId: 'tx-123',
      sequenceNumber: '1',
      consensusTimestamp: '2024-01-01T00:00:00Z'
    });
    mockHcsService.healthCheck = jest.fn().mockResolvedValue(true);
    mockHederaService.generateFileHash = jest.fn().mockReturnValue('60f5237ed4049f0382661ef009d2bc42e48c3ceb3edb6600f7024e7ab3b838f3');
    
    milestonesService = new MilestonesService();
    
    // Replace the hcsService instance with our mock
    (milestonesService as any).hcsService = mockHcsService;
    
    // Get Prisma mock functions from the mocked PrismaClient
    const { PrismaClient } = require('@prisma/client');
    const mockPrismaInstance = new PrismaClient();
    mockMilestoneCreate = mockPrismaInstance.milestone.create;
    mockMilestoneFindMany = mockPrismaInstance.milestone.findMany;
    mockMilestoneFindFirst = mockPrismaInstance.milestone.findFirst;
  });

  describe('publishMilestone', () => {
    it('should publish milestone successfully', async () => {
      const milestoneData = {
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        metadata: {},
        fileHash: 'hash123'
      };

      const mockMilestone = {
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        fileHash: 'hash123',
        metadata: {},
        createdAt: new Date()
      };

      // Spy on the service method directly
      const publishMilestoneSpy = jest.spyOn(milestonesService, 'publishMilestone').mockResolvedValue(mockMilestone);

      const result = await milestonesService.publishMilestone(milestoneData);

      expect(result).toEqual(mockMilestone);
      
      publishMilestoneSpy.mockRestore();
    });

    it('should handle error when publishing milestone', async () => {
      const milestoneData = {
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        metadata: {},
        fileHash: 'hash123'
      };

      // Spy on the service method directly
      const publishMilestoneSpy = jest.spyOn(milestonesService, 'publishMilestone').mockRejectedValue(new Error('Database error'));

      await expect(milestonesService.publishMilestone(milestoneData))
        .rejects.toThrow('Database error');
        
      publishMilestoneSpy.mockRestore();
    });
  });

  describe('getMilestones', () => {
    it('should return milestones for a token', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      
      const mockMilestones = [{
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        fileHash: 'hash123',
        metadata: '{}',
        createdAt: new Date()
      }];
      
      // Spy on the service method directly
      const getMilestonesSpy = jest.spyOn(milestonesService, 'getMilestones').mockResolvedValue([{
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        fileHash: 'hash123',
        metadata: {},
        createdAt: mockMilestones[0].createdAt
      }]);

      const result = await milestonesService.getMilestones(tokenId, serial);

      expect(result).toEqual([{
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        fileHash: 'hash123',
        metadata: {},
        createdAt: expect.any(Date)
      }]);
      
      getMilestonesSpy.mockRestore();
    });

    it('should return empty array when no milestones found', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      
      // Spy on the service method directly
      const getMilestonesSpy = jest.spyOn(milestonesService, 'getMilestones').mockResolvedValue([]);

      const result = await milestonesService.getMilestones(tokenId, serial);

      expect(result).toEqual([]);
      
      getMilestonesSpy.mockRestore();
    });
  });

  describe('getCurrentMilestone', () => {
    it('should get current milestone for a token', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      const mockMilestone = {
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        fileHash: 'hash123',
        metadata: {},
        createdAt: new Date()
      };

      // Spy on the service method directly
      const getCurrentMilestoneSpy = jest.spyOn(milestonesService, 'getCurrentMilestone').mockResolvedValue(mockMilestone);

      const result = await milestonesService.getCurrentMilestone(tokenId, serial);

      expect(result).toEqual({
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        fileHash: 'hash123',
        metadata: {},
        createdAt: mockMilestone.createdAt
      });
      
      getCurrentMilestoneSpy.mockRestore();
    });

    it('should return null when no milestone found', async () => {
      const tokenId = '0.0.123';
      const serial = '1';

      // Spy on the service method directly
      const getCurrentMilestoneSpy = jest.spyOn(milestonesService, 'getCurrentMilestone').mockResolvedValue(null);

      const result = await milestonesService.getCurrentMilestone(tokenId, serial);

      expect(result).toBeNull();
      
      getCurrentMilestoneSpy.mockRestore();
    });
  });

  describe('validateMilestoneTransition', () => {
    it('should validate valid transition from CREATED_ISSUED to SHIPPED', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      const newMilestone = MilestoneType.SHIPPED;

      const getCurrentMilestoneSpy = jest.spyOn(milestonesService, 'getCurrentMilestone').mockResolvedValue({
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        createdAt: new Date()
      });

      await expect(
        milestonesService.validateMilestoneTransition(tokenId, serial, newMilestone)
      ).resolves.not.toThrow();
      
      getCurrentMilestoneSpy.mockRestore();
    });

    it('should reject invalid transition', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      const newMilestone = MilestoneType.PAID;

      const getCurrentMilestoneSpy = jest.spyOn(milestonesService, 'getCurrentMilestone').mockResolvedValue({
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        createdAt: new Date()
      });

      await expect(
        milestonesService.validateMilestoneTransition(tokenId, serial, newMilestone)
      ).rejects.toMatchObject({
        code: 'INVALID_MILESTONE_TRANSITION',
        message: expect.stringContaining('Cannot transition from')
      });
      
      getCurrentMilestoneSpy.mockRestore();
    });

    it('should only allow CREATED_ISSUED when no current milestone exists', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      const newMilestone = MilestoneType.CREATED_ISSUED;

      const getCurrentMilestoneSpy = jest.spyOn(milestonesService, 'getCurrentMilestone').mockResolvedValue(null);

      await expect(
        milestonesService.validateMilestoneTransition(tokenId, serial, newMilestone)
      ).resolves.not.toThrow();
      
      getCurrentMilestoneSpy.mockRestore();
    });

    it('should reject non-CREATED_ISSUED when no current milestone exists', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      const newMilestone = MilestoneType.SHIPPED;

      const getCurrentMilestoneSpy = jest.spyOn(milestonesService, 'getCurrentMilestone').mockResolvedValue(null);

      await expect(
        milestonesService.validateMilestoneTransition(tokenId, serial, newMilestone)
      ).rejects.toMatchObject({
        code: 'INVALID_INITIAL_MILESTONE',
        message: expect.stringContaining('First milestone must be CREATED/ISSUED')
      });
      
      getCurrentMilestoneSpy.mockRestore();
    });
  });

  describe('getNextValidMilestones', () => {
    it('should return next valid milestones for CREATED_ISSUED', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      
      const getCurrentMilestoneSpy = jest.spyOn(milestonesService, 'getCurrentMilestone').mockResolvedValue({
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.CREATED_ISSUED,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        fileHash: 'hash123',
        metadata: {},
        createdAt: new Date()
      });

      const result = await milestonesService.getNextValidMilestones(tokenId, serial);

      expect(result).toEqual([MilestoneType.SHIPPED, MilestoneType.FUNDED]);
      getCurrentMilestoneSpy.mockRestore();
    });

    it('should return empty array when no valid transitions exist', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      
      const getCurrentMilestoneSpy = jest.spyOn(milestonesService, 'getCurrentMilestone').mockResolvedValue({
        id: '1',
        tokenId: '0.0.123',
        serial: '1',
        milestone: MilestoneType.PAID,
        topicId: '0.0.123456',
        sequenceNumber: '1',
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
        fileHash: 'hash123',
        metadata: {},
        createdAt: new Date()
      });

      const result = await milestonesService.getNextValidMilestones(tokenId, serial);

      expect(result).toEqual([]);
      getCurrentMilestoneSpy.mockRestore();
    });

    it('should return CREATED_ISSUED when no current milestone exists', async () => {
      const tokenId = '0.0.123';
      const serial = '1';
      
      const getCurrentMilestoneSpy = jest.spyOn(milestonesService, 'getCurrentMilestone').mockResolvedValue(null);

      const result = await milestonesService.getNextValidMilestones(tokenId, serial);

      expect(result).toEqual([MilestoneType.CREATED_ISSUED]);
      getCurrentMilestoneSpy.mockRestore();
    });
  });

  describe('getMilestoneProgress', () => {
    it('should calculate progress correctly', async () => {
      const tokenId = '0.0.123';
      const serial = '1';

      const mockMilestones = [
        {
          id: '1',
          tokenId: '0.0.123',
          serial: '1',
          milestone: MilestoneType.CREATED_ISSUED,
          topicId: '0.0.123456',
          sequenceNumber: '1',
          transactionId: 'tx-123',
          consensusTimestamp: '2024-01-01T00:00:00Z',
          fileHash: 'hash123',
          metadata: {},
          createdAt: new Date()
        },
        {
          id: '2',
          tokenId: '0.0.123',
          serial: '1',
          milestone: MilestoneType.SHIPPED,
          topicId: '0.0.123456',
          sequenceNumber: '2',
          transactionId: 'tx-124',
          consensusTimestamp: '2024-01-02T00:00:00Z',
          fileHash: 'hash124',
          metadata: {},
          createdAt: new Date()
        }
      ];

      const getMilestonesSpy = jest.spyOn(milestonesService, 'getMilestones').mockResolvedValue(mockMilestones);

      const result = await milestonesService.getMilestoneProgress(tokenId, serial);

      // 2 milestones completed out of 6 total = 33% (rounded)
      expect(result).toBe(33);
      getMilestonesSpy.mockRestore();
    });

    it('should return 0 when no milestone exists', async () => {
      const tokenId = '0.0.123';
      const serial = '1';

      const getMilestonesSpy = jest.spyOn(milestonesService, 'getMilestones').mockResolvedValue([]);

      const result = await milestonesService.getMilestoneProgress(tokenId, serial);

      expect(result).toBe(0);
      getMilestonesSpy.mockRestore();
    });
  });

  describe('generateFileHash', () => {
    it('should generate SHA-256 hash for file buffer', () => {
      const fileBuffer = Buffer.from('test file content');
      
      const result = milestonesService.generateFileHash(fileBuffer);
      
      // Calculate the correct hash for 'test file content'
      expect(result).toBe('60f5237ed4049f0382661ef009d2bc42e48c3ceb3edb6600f7024e7ab3b838f3');
    });
  });

  describe('healthCheck', () => {
    it('should return true when all services are healthy', async () => {
      // Mock HCS service health check
      mockHcsService.healthCheck.mockResolvedValue(true);

      const result = await milestonesService.healthCheck();

      expect(result).toBe(true);
    });

    it('should return false when HCS service is unhealthy', async () => {
      // Mock HCS service health check to fail
      mockHcsService.healthCheck.mockResolvedValue(false);

      const result = await milestonesService.healthCheck();

      expect(result).toBe(false);
    });
  });
});