import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { logger } from '../utils/logger';

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
}

interface MilestoneUpdate {
  type: 'milestone_created' | 'milestone_updated' | 'deal_progress' | 'hcs_message';
  data: any;
  timestamp: string;
  dealId?: string;
  invoiceId?: string;
}

class WebSocketService {
  private clients: Map<string, WebSocketClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPingInterval();
    this.startCleanupInterval();
  }

  /**
   * Initialize WebSocket server with Fastify
   */
  async initialize(fastify: FastifyInstance) {
    try {
      await fastify.register(require('@fastify/websocket'));
      
      const self = this;
      
      // WebSocket route for real-time updates
      fastify.register(async function (fastify: FastifyInstance) {
        fastify.get('/ws/milestones', { websocket: true }, (connection: any, req: any) => {
          const clientId = self.generateClientId();
          const client: WebSocketClient = {
            id: clientId,
            ws: connection.socket,
            subscriptions: new Set(),
            lastPing: Date.now()
          };

          self.clients.set(clientId, client);
          logger.info(`WebSocket client connected: ${clientId}`);

          // Send welcome message
          self.sendToClient(clientId, {
            type: 'connection',
            data: { clientId, status: 'connected' },
            timestamp: new Date().toISOString()
          });

          // Handle incoming messages
          connection.socket.on('message', (message: any) => {
            try {
              const data = JSON.parse(message.toString());
              self.handleClientMessage(clientId, data);
            } catch (error) {
              logger.error('Invalid WebSocket message:', error);
            }
          });

          // Handle client disconnect
          connection.socket.on('close', () => {
            self.clients.delete(clientId);
            logger.info(`WebSocket client disconnected: ${clientId}`);
          });

          // Handle errors
          connection.socket.on('error', (error: any) => {
            logger.error(`WebSocket error for client ${clientId}:`, error);
            self.clients.delete(clientId);
          });
        });
      });

      logger.info('WebSocket service initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket service:', error);
      throw error;
    }
  }

  /**
   * Handle incoming client messages
   */
  private handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.dealId) {
          client.subscriptions.add(`deal:${message.dealId}`);
          logger.info(`Client ${clientId} subscribed to deal:${message.dealId}`);
        }
        if (message.invoiceId) {
          client.subscriptions.add(`invoice:${message.invoiceId}`);
          logger.info(`Client ${clientId} subscribed to invoice:${message.invoiceId}`);
        }
        break;

      case 'unsubscribe':
        if (message.dealId) {
          client.subscriptions.delete(`deal:${message.dealId}`);
        }
        if (message.invoiceId) {
          client.subscriptions.delete(`invoice:${message.invoiceId}`);
        }
        break;

      case 'ping':
        client.lastPing = Date.now();
        this.sendToClient(clientId, {
          type: 'pong',
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString()
        });
        break;

      default:
        logger.warn(`Unknown message type from client ${clientId}:`, message.type);
    }
  }

  /**
   * Broadcast milestone update to subscribed clients
   */
  broadcastMilestoneUpdate(update: MilestoneUpdate) {
    const relevantClients = this.getRelevantClients(update);
    
    relevantClients.forEach(client => {
      this.sendToClient(client.id, update);
    });

    logger.info(`Broadcasted ${update.type} to ${relevantClients.length} clients`);
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error(`Failed to send message to client ${clientId}:`, error);
      this.clients.delete(clientId);
      return false;
    }
  }

  /**
   * Get clients relevant to an update
   */
  private getRelevantClients(update: MilestoneUpdate): WebSocketClient[] {
    const relevantClients: WebSocketClient[] = [];

    this.clients.forEach(client => {
      // Check if client is subscribed to this update
      if (update.dealId && client.subscriptions.has(`deal:${update.dealId}`)) {
        relevantClients.push(client);
      } else if (update.invoiceId && client.subscriptions.has(`invoice:${update.invoiceId}`)) {
        relevantClients.push(client);
      } else if (client.subscriptions.size === 0) {
        // Send to clients with no specific subscriptions (global updates)
        relevantClients.push(client);
      }
    });

    return relevantClients;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.ping();
          } catch (error) {
            logger.error(`Failed to ping client ${clientId}:`, error);
            this.clients.delete(clientId);
          }
        } else {
          this.clients.delete(clientId);
        }
      });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Start cleanup interval for stale connections
   */
  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000; // 1 minute

      this.clients.forEach((client, clientId) => {
        if (now - client.lastPing > staleThreshold) {
          logger.info(`Removing stale client: ${clientId}`);
          try {
            client.ws.close();
          } catch (error) {
            // Ignore close errors
          }
          this.clients.delete(clientId);
        }
      });
    }, 60000); // Cleanup every minute
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      activeClients: Array.from(this.clients.values()).filter(
        client => client.ws.readyState === WebSocket.OPEN
      ).length,
      subscriptions: Array.from(this.clients.values()).reduce(
        (total, client) => total + client.subscriptions.size,
        0
      )
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.clients.forEach((client, clientId) => {
      try {
        client.ws.close();
      } catch (error) {
        // Ignore close errors
      }
    });
    this.clients.clear();

    logger.info('WebSocket service cleaned up');
  }

  /**
   * Shutdown the WebSocket service
   */
  shutdown(): void {
    this.cleanup();
    logger.info('WebSocket service shut down');
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export { WebSocketService };
export type { MilestoneUpdate };