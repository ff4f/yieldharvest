import { WebSocketServer } from 'ws';
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

// Mock WebSocket Server
jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    clients: new Set(),
    close: jest.fn()
  }))
}));

describe('WebSocketService', () => {
  let mockWss: any;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock WebSocket client
    mockClient = {
      readyState: 1, // OPEN
      send: jest.fn(),
      on: jest.fn(),
      ping: jest.fn(),
      terminate: jest.fn(),
      dealId: 'test-deal-123',
      invoiceId: 'test-invoice-456'
    };

    // Mock WebSocket Server instance
    mockWss = {
      on: jest.fn(),
      clients: new Set([mockClient]),
      close: jest.fn()
    };

    (WebSocketServer as jest.Mock).mockReturnValue(mockWss);
  });

  afterEach(() => {
    websocketService.shutdown();
  });

  describe('initialization', () => {
    it('should initialize WebSocket server on specified port', () => {
      websocketService.initialize(8080);
      
      expect(WebSocketServer).toHaveBeenCalledWith({
        port: 8080,
        perMessageDeflate: false
      });
      expect(logger.info).toHaveBeenCalledWith('WebSocket server initialized on port 8080');
    });

    it('should set up connection handler', () => {
      websocketService.initialize(8080);
      
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('client management', () => {
    beforeEach(() => {
      websocketService.initialize(8080);
    });

    it('should handle new client connections', () => {
      const connectionHandler = mockWss.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      
      connectionHandler(mockClient);
      
      expect(mockClient.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('pong', expect.any(Function));
    });

    it('should handle client subscription messages', () => {
      const connectionHandler = mockWss.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      
      connectionHandler(mockClient);
      
      const messageHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'message'
      )[1];
      
      const subscribeMessage = JSON.stringify({
        type: 'subscribe',
        dealId: 'deal-123',
        invoiceId: 'invoice-456'
      });
      
      messageHandler(Buffer.from(subscribeMessage));
      
      expect(mockClient.dealId).toBe('deal-123');
      expect(mockClient.invoiceId).toBe('invoice-456');
      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'subscribed', dealId: 'deal-123', invoiceId: 'invoice-456' })
      );
    });

    it('should handle ping messages', () => {
      const connectionHandler = mockWss.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      
      connectionHandler(mockClient);
      
      const messageHandler = mockClient.on.mock.calls.find(
        call => call[0] === 'message'
      )[1];
      
      const pingMessage = JSON.stringify({ type: 'ping' });
      messageHandler(Buffer.from(pingMessage));
      
      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'pong', timestamp: expect.any(String) })
      );
    });
  });

  describe('milestone broadcasting', () => {
    beforeEach(() => {
      websocketService.initialize(8080);
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

      websocketService.broadcastMilestoneUpdate(milestoneUpdate);

      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify(milestoneUpdate)
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Broadcasting milestone update to 1 clients',
        { type: 'milestone_created', dealId: 'deal-123', invoiceId: 'invoice-456' }
      );
    });

    it('should only send to clients subscribed to the specific deal/invoice', () => {
      const otherClient = {
        ...mockClient,
        dealId: 'other-deal',
        invoiceId: 'other-invoice',
        send: jest.fn()
      };

      mockWss.clients = new Set([mockClient, otherClient]);

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

      websocketService.broadcastMilestoneUpdate(milestoneUpdate);

      expect(mockClient.send).toHaveBeenCalledWith(
        JSON.stringify(milestoneUpdate)
      );
      expect(otherClient.send).not.toHaveBeenCalled();
    });

    it('should handle send errors gracefully', () => {
      mockClient.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

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

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send milestone update to client',
        expect.any(Error)
      );
    });
  });

  describe('health check', () => {
    it('should return healthy status when server is running', () => {
      websocketService.initialize(8080);
      
      const health = websocketService.getHealth();
      
      expect(health).toEqual({
        status: 'healthy',
        clients: 1,
        uptime: expect.any(Number)
      });
    });

    it('should return unhealthy status when server is not initialized', () => {
      const health = websocketService.getHealth();
      
      expect(health).toEqual({
        status: 'unhealthy',
        clients: 0,
        uptime: 0
      });
    });
  });

  describe('shutdown', () => {
    it('should close WebSocket server and clear intervals', () => {
      websocketService.initialize(8080);
      websocketService.shutdown();
      
      expect(mockWss.close).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('WebSocket server shut down');
    });
  });
});