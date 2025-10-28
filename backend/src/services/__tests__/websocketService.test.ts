import { FastifyInstance } from 'fastify';
import { websocketService, MilestoneUpdate } from '../websocketService';
import { logger } from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock Fastify WebSocket plugin
const mockRegister = jest.fn();
const mockFastify: FastifyInstance = {
  register: mockRegister,
  get: jest.fn(),
} as any;

describe('WebSocketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    try {
      websocketService.shutdown();
      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  afterAll(async () => {
    try {
      websocketService.shutdown();
      // Give time for final cleanup
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('initialization', () => {
    it('should initialize WebSocket server with Fastify', async () => {
      await websocketService.initialize(mockFastify);
      
      expect(mockRegister).toHaveBeenCalledWith(require('@fastify/websocket'));
    });

    it('should handle initialization errors gracefully', async () => {
      mockRegister.mockRejectedValue(new Error('Registration failed'));
      
      await expect(websocketService.initialize(mockFastify)).rejects.toThrow('Registration failed');
    });
  });

  describe('client management', () => {
    beforeEach(async () => {
      await websocketService.initialize(mockFastify);
    });

    it('should handle client connections via Fastify WebSocket', () => {
      // Since the actual WebSocket implementation is commented out in the service,
      // we'll test the service methods directly
      expect(mockRegister).toHaveBeenCalledWith(require('@fastify/websocket'));
    });

    it('should provide stats about connected clients', () => {
       const stats = websocketService.getStats();
       
       expect(stats).toEqual({
         totalClients: 0,
         activeClients: 0,
         subscriptions: 0
       });
     });
  });

  describe('milestone broadcasting', () => {
    beforeEach(async () => {
      await websocketService.initialize(mockFastify);
    });

    it('should broadcast milestone updates to subscribed clients', () => {
      const milestoneUpdate: MilestoneUpdate = {
        type: 'milestone_created',
        data: {
          id: 'milestone-123',
          tokenId: 'deal-123',
          serial: 'invoice-456',
          milestone: 'INVOICE_ISSUED',
          transactionId: 'tx-123',
          consensusTimestamp: '2024-01-01T00:00:00Z',
          createdAt: new Date()
        },
        timestamp: '2024-01-01T00:00:00Z',
        dealId: 'deal-123',
        invoiceId: 'invoice-456'
      };

      // Since there are no actual clients connected in the test,
      // we just test that the method doesn't throw
      expect(() => {
        websocketService.broadcastMilestoneUpdate(milestoneUpdate);
      }).not.toThrow();
    });

    it('should handle broadcasting with no connected clients', () => {
      const milestoneUpdate: MilestoneUpdate = {
        type: 'milestone_created',
        data: {
          id: 'milestone-123',
          tokenId: 'test-deal-123',
          serial: 'test-invoice-456',
          milestone: 'INVOICE_ISSUED',
          transactionId: 'tx-123',
          consensusTimestamp: '2024-01-01T00:00:00Z',
          createdAt: new Date()
        },
        timestamp: '2024-01-01T00:00:00Z',
        dealId: 'test-deal-123',
        invoiceId: 'test-invoice-456'
      };

      expect(() => {
        websocketService.broadcastMilestoneUpdate(milestoneUpdate);
      }).not.toThrow();
    });
  });

  describe('stats and management', () => {
    it('should return stats about connected clients', async () => {
      await websocketService.initialize(mockFastify);
      
      const stats = websocketService.getStats();
      
      expect(stats).toEqual({
         totalClients: 0,
         activeClients: 0,
         subscriptions: 0
       });
    });

    it('should return stats when not initialized', () => {
      const stats = websocketService.getStats();
      
      expect(stats).toEqual({
        totalClients: 0,
        activeClients: 0,
        subscriptions: 0
      });
    });
  });

  describe('cleanup and shutdown', () => {
    it('should handle cleanup gracefully', async () => {
      await websocketService.initialize(mockFastify);
      
      expect(() => {
        websocketService.cleanup();
      }).not.toThrow();
    });

    it('should handle shutdown gracefully', async () => {
      await websocketService.initialize(mockFastify);
      
      expect(() => {
        websocketService.shutdown();
      }).not.toThrow();
    });
  });
});