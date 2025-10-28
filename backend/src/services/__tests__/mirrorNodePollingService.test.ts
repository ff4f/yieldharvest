import { mirrorNodePollingService, MirrorNodePollingService } from '../mirrorNodePollingService';
import { mirrorNodeService } from '../mirrorNodeService';
import { websocketService } from '../websocketService';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../mirrorNodeService');
jest.mock('../websocketService');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

const mockMirrorNodeService = mirrorNodeService as jest.Mocked<typeof mirrorNodeService>;
const mockWebsocketService = websocketService as jest.Mocked<typeof websocketService>;

describe('MirrorNodePollingService', () => {
  let pollingService: MirrorNodePollingService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables before creating service
    process.env.MIRROR_POLLING_ENABLED = 'true';
    process.env.MIRROR_POLLING_INTERVAL = '5000';
    process.env.HEDERA_INVOICE_TOPIC_ID = '0.0.123456';
    process.env.HEDERA_INVOICE_TOKEN_ID = '0.0.789012';
    
    pollingService = new MirrorNodePollingService();
  });

  afterEach(() => {
    pollingService.stop();
    delete process.env.MIRROR_POLLING_ENABLED;
    delete process.env.MIRROR_POLLING_INTERVAL;
    delete process.env.HEDERA_INVOICE_TOPIC_ID;
    delete process.env.HEDERA_INVOICE_TOKEN_ID;
  });

  describe('initialization and configuration', () => {
    it('should initialize with correct default configuration', () => {
      const stats = pollingService.getStats();
      
      expect(stats.config.enabled).toBe(true);
      expect(stats.config.interval).toBe(5000);
      expect(stats.config.topicIds).toEqual(['0.0.123456']);
      expect(stats.config.tokenIds).toEqual(['0.0.789012']);
    });

    it('should handle disabled polling', () => {
      // Update config to disable polling
      pollingService.updateConfig({ enabled: false });
      
      pollingService.start();
      
      const stats = pollingService.getStats();
      expect(stats.isRunning).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Mirror Node polling is disabled');
    });

    it('should update configuration correctly', () => {
      pollingService.updateConfig({
        interval: 15000,
        topicIds: ['0.0.111111', '0.0.222222']
      });
      
      const stats = pollingService.getStats();
      expect(stats.config.interval).toBe(15000);
      expect(stats.config.topicIds).toEqual(['0.0.111111', '0.0.222222']);
    });
  });

  describe('polling lifecycle', () => {
    it('should start polling service', () => {
      pollingService.start();
      
      const stats = pollingService.getStats();
      expect(stats.isRunning).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Starting Mirror Node polling service',
        expect.objectContaining({
          interval: 5000,
          topicIds: ['0.0.123456'],
          tokenIds: ['0.0.789012']
        })
      );
    });

    it('should stop polling service', () => {
      pollingService.start();
      pollingService.stop();
      
      const stats = pollingService.getStats();
      expect(stats.isRunning).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Mirror Node polling service stopped');
    });

    it('should prevent multiple starts', () => {
      pollingService.start();
      pollingService.start(); // Second start
      
      expect(logger.warn).toHaveBeenCalledWith('Mirror Node polling is already running');
    });
  });

  describe('HCS message polling', () => {
    it('should poll and broadcast HCS messages', async () => {
      const mockMessages = [
        {
          consensus_timestamp: '2024-01-01T12:00:00Z',
          topic_id: '0.0.123456',
          message: Buffer.from(JSON.stringify({
            type: 'invoice',
            tokenId: '0.0.789012',
            serialNumber: '1',
            status: 'issued'
          })).toString('base64'),
          running_hash: 'hash1',
          running_hash_version: 3,
          sequence_number: 1,
          payer_account_id: '0.0.123'
        }
      ];

      const mockParsedMessages = [
        {
          tokenId: '0.0.789012',
          serialNumber: '1',
          status: 'issued' as const,
          timestamp: '2024-01-01T12:00:00Z',
          sequenceNumber: 1
        }
      ];

      mockMirrorNodeService.getHCSMessages.mockResolvedValue(mockMessages);
      mockMirrorNodeService.parseInvoiceMessages.mockReturnValue(mockParsedMessages);

      await pollingService.forcePoll();

      expect(mockMirrorNodeService.getHCSMessages).toHaveBeenCalledWith(
        '0.0.123456',
        expect.objectContaining({
          limit: 25,
          order: 'desc'
        })
      );

      expect(mockWebsocketService.broadcastMilestoneUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'hcs_message',
          data: expect.objectContaining({
            tokenId: '0.0.789012',
            serialNumber: '1',
            status: 'issued'
          }),
          dealId: '0.0.789012',
          invoiceId: '1'
        })
      );
    });

    it('should handle empty HCS messages', async () => {
      mockMirrorNodeService.getHCSMessages.mockResolvedValue([]);

      await pollingService.forcePoll();

      expect(mockWebsocketService.broadcastMilestoneUpdate).not.toHaveBeenCalled();
    });

    it('should handle HCS polling errors', async () => {
      mockMirrorNodeService.getHCSMessages.mockRejectedValue(new Error('Network error'));

      await pollingService.forcePoll();

      expect(logger.error).toHaveBeenCalledWith(
        'Error polling HCS messages for topic 0.0.123456:',
        expect.any(Error)
      );
    });
  });

  describe('NFT polling', () => {
    it('should poll and broadcast new NFTs', async () => {
      const recentTimestamp = new Date(Date.now() - 1000).toISOString(); // 1 second ago
      const mockNFTs = [
        {
          token_id: '0.0.789012',
          serial_number: 1,
          account_id: '0.0.123',
          created_timestamp: recentTimestamp,
          modified_timestamp: recentTimestamp,
          metadata: 'base64metadata'
        }
      ];

      mockMirrorNodeService.getNFTsByToken.mockResolvedValue(mockNFTs);

      await pollingService.forcePoll();

      expect(mockMirrorNodeService.getNFTsByToken).toHaveBeenCalledWith('0.0.789012', 10);

      expect(mockWebsocketService.broadcastMilestoneUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'milestone_created',
          data: expect.objectContaining({
            type: 'NFT_MINTED',
            tokenId: '0.0.789012',
            serialNumber: '1'
          }),
          dealId: '0.0.789012',
          invoiceId: '1'
        })
      );
    });

    it('should ignore old NFTs', async () => {
      const oldTimestamp = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const mockNFTs = [
        {
          token_id: '0.0.789012',
          serial_number: 1,
          account_id: '0.0.123',
          created_timestamp: oldTimestamp,
          modified_timestamp: oldTimestamp,
          metadata: 'base64metadata'
        }
      ];

      mockMirrorNodeService.getNFTsByToken.mockResolvedValue(mockNFTs);

      await pollingService.forcePoll();

      expect(mockWebsocketService.broadcastMilestoneUpdate).not.toHaveBeenCalled();
    });

    it('should handle NFT polling errors', async () => {
      mockMirrorNodeService.getNFTsByToken.mockRejectedValue(new Error('Network error'));

      await pollingService.forcePoll();

      expect(logger.error).toHaveBeenCalledWith(
        'Error polling NFT updates for token 0.0.789012:',
        expect.any(Error)
      );
    });
  });

  describe('force polling', () => {
    it('should execute force polling', async () => {
      mockMirrorNodeService.getHCSMessages.mockResolvedValue([]);
      mockMirrorNodeService.getNFTsByToken.mockResolvedValue([]);

      await pollingService.forcePoll();

      expect(logger.info).toHaveBeenCalledWith('Force polling Mirror Node...');
      expect(mockMirrorNodeService.getHCSMessages).toHaveBeenCalled();
      expect(mockMirrorNodeService.getNFTsByToken).toHaveBeenCalled();
    });

    it('should prevent concurrent force polling', async () => {
      mockMirrorNodeService.getHCSMessages.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 100))
      );
      mockMirrorNodeService.getNFTsByToken.mockResolvedValue([]);

      // Start first force poll
      const firstPoll = pollingService.forcePoll();
      
      // Try second force poll immediately
      await pollingService.forcePoll();

      expect(logger.warn).toHaveBeenCalledWith('Polling is already in progress');

      // Wait for first poll to complete
      await firstPoll;
    });
  });

  describe('statistics', () => {
    it('should provide accurate statistics', () => {
      const stats = pollingService.getStats();

      expect(stats).toEqual({
        isRunning: false,
        isPolling: false,
        config: expect.objectContaining({
          enabled: true,
          interval: 5000,
          topicIds: ['0.0.123456'],
          tokenIds: ['0.0.789012']
        }),
        lastPolledState: {}
      });
    });

    it('should track last polled state', async () => {
      const mockMessages = [
        {
          consensus_timestamp: '2024-01-01T12:00:00Z',
          topic_id: '0.0.123456',
          message: Buffer.from(JSON.stringify({
            type: 'invoice',
            tokenId: '0.0.789012',
            serialNumber: '1',
            status: 'issued'
          })).toString('base64'),
          running_hash: 'hash1',
          running_hash_version: 3,
          sequence_number: 5,
          payer_account_id: '0.0.123'
        }
      ];

      const mockParsedMessages = [
        {
          tokenId: '0.0.789012',
          serialNumber: '1',
          status: 'issued' as const,
          timestamp: '2024-01-01T12:00:00Z',
          sequenceNumber: 5
        }
      ];

      mockMirrorNodeService.getHCSMessages.mockResolvedValue(mockMessages);
      mockMirrorNodeService.parseInvoiceMessages.mockReturnValue(mockParsedMessages);

      await pollingService.forcePoll();

      const stats = pollingService.getStats();
      expect(stats.lastPolledState['0.0.123456']).toEqual({
        lastSequenceNumber: 5,
        lastTimestamp: '2024-01-01T12:00:00Z'
      });
    });
  });
});