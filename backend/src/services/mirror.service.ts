import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';

export interface MirrorNodeConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

export interface MirrorNodeTransaction {
  transaction_id: string;
  consensus_timestamp: string;
  valid_start_timestamp: string;
  charged_tx_fee: number;
  memo_base64?: string;
  result: string;
  name: string;
  node: string;
  scheduled: boolean;
  transaction_hash: string;
  valid_duration_seconds: number;
  max_fee: string;
  transfers?: Array<{
    account: string;
    amount: number;
  }>;
  token_transfers?: Array<{
    token_id: string;
    account: string;
    amount: number;
  }>;
  nft_transfers?: Array<{
    token_id: string;
    sender_account_id: string;
    receiver_account_id: string;
    serial_number: number;
  }>;
}

export interface MirrorNodeNFT {
  token_id: string;
  serial_number: number;
  account_id: string;
  created_timestamp: string;
  deleted: boolean;
  metadata?: string;
  modified_timestamp: string;
}

export interface MirrorNodeToken {
  token_id: string;
  symbol: string;
  name: string;
  type: string;
  supply_type: string;
  initial_supply: string;
  max_supply: string;
  treasury_account_id: string;
  created_timestamp: string;
  modified_timestamp: string;
  deleted: boolean;
  memo?: string;
  freeze_default: boolean;
  supply_key?: {
    _type: string;
    key: string;
  };
  admin_key?: {
    _type: string;
    key: string;
  };
}

export interface MirrorNodeTopicMessage {
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
}

export interface MirrorNodeTopic {
  topic_id: string;
  memo?: string;
  running_hash: string;
  running_hash_version: number;
  sequence_number: number;
  created_timestamp: string;
  modified_timestamp: string;
  deleted: boolean;
  admin_key?: {
    _type: string;
    key: string;
  };
  submit_key?: {
    _type: string;
    key: string;
  };
}

export interface MirrorNodeFile {
  file_id: string;
  size: number;
  created_timestamp: string;
  modified_timestamp: string;
  deleted: boolean;
  memo?: string;
  keys?: Array<{
    _type: string;
    key: string;
  }>;
}

export class MirrorNodeService {
  private client: AxiosInstance;
  private config: MirrorNodeConfig;

  constructor(config: MirrorNodeConfig) {
    this.config = {
      timeout: 10000,
      retries: 3,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug({
          url: config.url,
          method: config.method,
          params: config.params,
        }, 'Mirror Node API Request');
        return config;
      },
      (error) => {
        logger.error({ error: error.message }, 'Mirror Node API Request Error');
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug({
          url: response.config.url,
          status: response.status,
          dataLength: JSON.stringify(response.data).length,
        }, 'Mirror Node API Response');
        return response;
      },
      (error) => {
        logger.error({
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data,
        }, 'Mirror Node API Response Error');
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get transaction details by transaction ID
   */
  async getTransaction(transactionId: string): Promise<MirrorNodeTransaction | null> {
    try {
      const response: AxiosResponse<{ transactions: MirrorNodeTransaction[] }> = 
        await this.client.get(`/api/v1/transactions/${transactionId}`);
      
      return response.data.transactions?.[0] || null;
    } catch (error) {
      logger.error({
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get transaction from Mirror Node');
      return null;
    }
  }

  /**
   * Get NFT information by token ID and serial number
   */
  async getNFT(tokenId: string, serialNumber: string): Promise<MirrorNodeNFT | null> {
    try {
      const response: AxiosResponse<MirrorNodeNFT> = 
        await this.client.get(`/api/v1/tokens/${tokenId}/nfts/${serialNumber}`);
      
      return response.data;
    } catch (error) {
      logger.error({
        tokenId,
        serialNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get NFT from Mirror Node');
      return null;
    }
  }

  /**
   * Get all NFTs for a token
   */
  async getTokenNFTs(tokenId: string, limit = 25): Promise<MirrorNodeNFT[]> {
    try {
      const response: AxiosResponse<{ nfts: MirrorNodeNFT[] }> = 
        await this.client.get(`/api/v1/tokens/${tokenId}/nfts`, {
          params: { limit },
        });
      
      return response.data.nfts || [];
    } catch (error) {
      logger.error({
        tokenId,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get token NFTs from Mirror Node');
      return [];
    }
  }

  /**
   * Get token information
   */
  async getToken(tokenId: string): Promise<MirrorNodeToken | null> {
    try {
      const response: AxiosResponse<MirrorNodeToken> = 
        await this.client.get(`/api/v1/tokens/${tokenId}`);
      
      return response.data;
    } catch (error) {
      logger.error({
        tokenId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get token from Mirror Node');
      return null;
    }
  }

  /**
   * Get topic messages
   */
  async getTopicMessages(
    topicId: string, 
    options: { limit?: number; sequenceNumber?: number } = {}
  ): Promise<MirrorNodeTopicMessage[]> {
    try {
      const params: any = {
        limit: options.limit || 25,
      };

      if (options.sequenceNumber) {
        params.sequencenumber = `gte:${options.sequenceNumber}`;
      }

      const response: AxiosResponse<{ messages: MirrorNodeTopicMessage[] }> = 
        await this.client.get(`/api/v1/topics/${topicId}/messages`, { params });
      
      return response.data.messages || [];
    } catch (error) {
      logger.error({
        topicId,
        options,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get topic messages from Mirror Node');
      return [];
    }
  }

  /**
   * Get topic information
   */
  async getTopic(topicId: string): Promise<MirrorNodeTopic | null> {
    try {
      const response: AxiosResponse<MirrorNodeTopic> = 
        await this.client.get(`/api/v1/topics/${topicId}`);
      
      return response.data;
    } catch (error) {
      logger.error({
        topicId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get topic from Mirror Node');
      return null;
    }
  }

  /**
   * Get file information
   */
  async getFile(fileId: string): Promise<MirrorNodeFile | null> {
    try {
      const response: AxiosResponse<MirrorNodeFile> = 
        await this.client.get(`/api/v1/files/${fileId}`);
      
      return response.data;
    } catch (error) {
      logger.error({
        fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get file from Mirror Node');
      return null;
    }
  }

  /**
   * Get account transactions
   */
  async getAccountTransactions(
    accountId: string, 
    options: { limit?: number; transactionType?: string } = {}
  ): Promise<MirrorNodeTransaction[]> {
    try {
      const params: any = {
        limit: options.limit || 25,
        'account.id': accountId,
      };

      if (options.transactionType) {
        params.transactiontype = options.transactionType;
      }

      const response: AxiosResponse<{ transactions: MirrorNodeTransaction[] }> = 
        await this.client.get('/api/v1/transactions', { params });
      
      return response.data.transactions || [];
    } catch (error) {
      logger.error({
        accountId,
        options,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get account transactions from Mirror Node');
      return [];
    }
  }

  /**
   * Search transactions by criteria
   */
  async searchTransactions(criteria: {
    accountId?: string;
    tokenId?: string;
    transactionType?: string;
    timestamp?: string;
    limit?: number;
  }): Promise<MirrorNodeTransaction[]> {
    try {
      const params: any = {
        limit: criteria.limit || 25,
      };

      if (criteria.accountId) {
        params['account.id'] = criteria.accountId;
      }

      if (criteria.tokenId) {
        params['token.id'] = criteria.tokenId;
      }

      if (criteria.transactionType) {
        params.transactiontype = criteria.transactionType;
      }

      if (criteria.timestamp) {
        params.timestamp = criteria.timestamp;
      }

      const response: AxiosResponse<{ transactions: MirrorNodeTransaction[] }> = 
        await this.client.get('/api/v1/transactions', { params });
      
      return response.data.transactions || [];
    } catch (error) {
      logger.error({
        criteria,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to search transactions from Mirror Node');
      return [];
    }
  }

  /**
   * Get network status and information
   */
  async getNetworkStatus(): Promise<any> {
    try {
      const response = await this.client.get('/api/v1/network/nodes');
      return response.data;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get network status from Mirror Node');
      return null;
    }
  }

  /**
   * Health check for Mirror Node service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/network/nodes', {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Mirror Node health check failed');
      return false;
    }
  }
}