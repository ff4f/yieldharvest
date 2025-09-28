import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { nftCache, hcsCache, CacheKeys } from './cacheService';

export interface MirrorNodeConfig {
  baseUrl: string;
  timeout?: number;
}

export interface NFTInfo {
  token_id: string;
  serial_number: number;
  account_id: string;
  created_timestamp: string;
  modified_timestamp: string;
  metadata?: string;
  spender?: string;
}

export interface NFTsResponse {
  nfts: NFTInfo[];
  links: {
    next?: string;
  };
}

export interface HCSMessage {
  consensus_timestamp: string;
  topic_id: string;
  message: string;
  running_hash: string;
  running_hash_version: number;
  sequence_number: number;
  chunk_info?: {
    initial_transaction_id: string;
    number: number;
    total: number;
  };
  payer_account_id: string;
}

export interface HCSMessagesResponse {
  messages: HCSMessage[];
  links: {
    next?: string;
  };
}

export interface HCSMessageFilters {
  sequencenumber?: string;
  timestamp?: string;
  limit?: number;
  order?: 'asc' | 'desc';
}

export interface ParsedInvoiceMessage {
  tokenId: string;
  serialNumber: string;
  status: 'issued' | 'funded' | 'paid' | 'defaulted';
  timestamp: string;
  transactionId?: string;
  amount?: string;
  currency?: string;
  fileHash?: string;
  sequenceNumber: number;
}

export class MirrorNodeService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(config: MirrorNodeConfig) {
    this.baseUrl = config.baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`Mirror Node API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Mirror Node API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`Mirror Node API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Mirror Node API Response Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get NFTs by token ID with optional pagination
   * @param tokenId - The token ID to fetch NFTs for
   * @param limit - Maximum number of NFTs to return (default: 100)
   * @param order - Sort order (asc or desc, default: desc)
   * @returns Promise<NFTsResponse>
   */
  async getNftsByTokenId(
    tokenId: string,
    limit: number = 100,
    order: 'asc' | 'desc' = 'desc'
  ): Promise<NFTsResponse> {
    const cacheKey = CacheKeys.nftsByToken(tokenId, limit, order);
    
    return nftCache.getOrSet(cacheKey, async () => {
      try {
        const response = await this.client.get(`/api/v1/tokens/${tokenId}/nfts`, {
          params: {
            limit,
            order,
          },
        });

        return response.data;
      } catch (error) {
        logger.error(`Failed to fetch NFTs for token ${tokenId}:`, error);
        throw new Error(`Failed to fetch NFTs for token ${tokenId}: ${error}`);
      }
    });
  }

  /**
   * Get specific NFT by token ID and serial number
   * @param tokenId - The token ID
   * @param serialNumber - The serial number
   * @returns Promise<NFTInfo>
   */
  async getNftBySerial(tokenId: string, serialNumber: number): Promise<NFTInfo> {
    const cacheKey = CacheKeys.nftBySerial(tokenId, serialNumber);
    
    return nftCache.getOrSet(cacheKey, async () => {
      try {
        const response = await this.client.get(`/api/v1/tokens/${tokenId}/nfts/${serialNumber}`);
        return response.data;
      } catch (error) {
        logger.error(`Failed to fetch NFT ${tokenId}/${serialNumber}:`, error);
        throw new Error(`Failed to fetch NFT ${tokenId}/${serialNumber}: ${error}`);
      }
    });
  }

  /**
   * Get HCS messages from a topic with optional filters
   * @param topicId - The topic ID to fetch messages from
   * @param filters - Optional filters for the messages
   * @returns Promise<HCSMessagesResponse>
   */
  async getHcsMessages(
    topicId: string,
    filters: HCSMessageFilters = {}
  ): Promise<HCSMessagesResponse> {
    const limit = filters.limit || 100;
    const order = filters.order || 'desc';
    const cacheKey = CacheKeys.hcsMessages(topicId, limit, order);
    
    return hcsCache.getOrSet(cacheKey, async () => {
      try {
        const params: any = {
          limit,
          order,
        };

        if (filters.sequencenumber) {
          params.sequencenumber = filters.sequencenumber;
        }

        if (filters.timestamp) {
          params.timestamp = filters.timestamp;
        }

        const response = await this.client.get(`/api/v1/topics/${topicId}/messages`, {
          params,
        });

        return response.data;
      } catch (error) {
        logger.error(`Failed to fetch HCS messages for topic ${topicId}:`, error);
        throw new Error(`Failed to fetch HCS messages for topic ${topicId}: ${error}`);
      }
    });
  }

  /**
   * Parse HCS message content to extract invoice status updates
   * @param message - The HCS message to parse
   * @returns ParsedInvoiceMessage | null
   */
  parseInvoiceMessage(message: HCSMessage): ParsedInvoiceMessage | null {
    try {
      // Decode base64 message content
      const decodedMessage = Buffer.from(message.message, 'base64').toString('utf-8');
      
      // Try to parse as JSON
      const messageData = JSON.parse(decodedMessage);

      // Validate required fields
      if (!messageData.tokenId || !messageData.serialNumber || !messageData.status) {
        logger.warn('Invalid invoice message format:', messageData);
        return null;
      }

      return {
        tokenId: messageData.tokenId,
        serialNumber: messageData.serialNumber,
        status: messageData.status,
        timestamp: message.consensus_timestamp,
        transactionId: messageData.transactionId,
        amount: messageData.amount,
        currency: messageData.currency,
        fileHash: messageData.fileHash,
        sequenceNumber: message.sequence_number,
      };
    } catch (error) {
      logger.warn('Failed to parse HCS message:', {
        sequenceNumber: message.sequence_number,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get parsed invoice messages for a specific token
   * @param topicId - The topic ID
   * @param tokenId - Filter messages for this token ID
   * @param limit - Maximum number of messages to fetch
   * @returns Promise<ParsedInvoiceMessage[]>
   */
  async getInvoiceMessages(
    topicId: string,
    tokenId?: string,
    limit: number = 100
  ): Promise<ParsedInvoiceMessage[]> {
    try {
      const response = await this.getHcsMessages(topicId, { limit, order: 'asc' });
      
      const parsedMessages = response.messages
        .map(msg => this.parseInvoiceMessage(msg))
        .filter((msg): msg is ParsedInvoiceMessage => msg !== null);

      // Filter by tokenId if provided
      if (tokenId) {
        return parsedMessages.filter(msg => msg.tokenId === tokenId);
      }

      return parsedMessages;
    } catch (error) {
      logger.error(`Failed to get invoice messages for topic ${topicId}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction details by transaction ID
   * @param transactionId - The transaction ID
   * @returns Promise<any>
   */
  async getTransaction(transactionId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/v1/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch transaction ${transactionId}:`, error);
      throw new Error(`Failed to fetch transaction ${transactionId}: ${error}`);
    }
  }

  /**
   * Get file info by file ID
   * @param fileId - The file ID
   * @returns Promise<any>
   */
  async getFileInfo(fileId: string): Promise<any> {
    try {
      const response = await this.client.get(`/api/v1/files/${fileId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch file info ${fileId}:`, error);
      throw new Error(`Failed to fetch file info ${fileId}: ${error}`);
    }
  }

  /**
   * Health check for Mirror Node API
   * @returns Promise<boolean>
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/network/nodes', {
        params: { limit: 1 },
      });
      return response.status === 200;
    } catch (error) {
      logger.error('Mirror Node health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const mirrorNodeService = new MirrorNodeService({
  baseUrl: process.env['MIRROR_NODE_URL'] || 'https://testnet.mirrornode.hedera.com',
  timeout: 15000,
});