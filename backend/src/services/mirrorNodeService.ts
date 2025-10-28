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

export interface AccountInfo {
  account: string;
  alias?: string;
  auto_renew_period: number;
  balance: {
    balance: number;
    timestamp: string;
    tokens: Array<{
      token_id: string;
      balance: number;
    }>;
  };
  created_timestamp: string;
  decline_reward: boolean;
  deleted: boolean;
  ethereum_nonce?: number;
  evm_address?: string;
  expiry_timestamp?: string;
  key?: {
    _type: string;
    key: string;
  };
  max_automatic_token_associations: number;
  memo: string;
  pending_reward: number;
  receiver_sig_required: boolean;
  staked_account_id?: string;
  staked_node_id?: number;
  stake_period_start?: string;
}

export interface TransactionInfo {
  bytes?: string;
  charged_tx_fee: number;
  consensus_timestamp: string;
  entity_id?: string;
  max_fee: string;
  memo_base64?: string;
  name: string;
  nft_transfers?: Array<{
    receiver_account_id: string;
    sender_account_id: string;
    serial_number: number;
    token_id: string;
  }>;
  node: string;
  nonce: number;
  parent_consensus_timestamp?: string;
  result: string;
  scheduled: boolean;
  staking_reward_transfers?: any[];
  token_transfers?: Array<{
    account: string;
    amount: number;
    token_id: string;
  }>;
  transaction_hash: string;
  transaction_id: string;
  transfers: Array<{
    account: string;
    amount: number;
    is_approval: boolean;
  }>;
  valid_duration_seconds: string;
  valid_start_timestamp: string;
}

export interface FileInfo {
  file_id: string;
  size: number;
  expiry_timestamp: string;
  deleted: boolean;
  memo?: string;
  keys?: Array<{
    _type: string;
    key: string;
  }>;
}

export interface NetworkStats {
  timestamp: string;
  tps: number;
  gas_used: number;
  active_nodes: number;
  total_transactions: number;
}

export interface DashboardMetrics {
  totalInvoices: number;
  totalFunding: number;
  activeInvestors: number;
  completedDeals: number;
  totalValueLocked: number;
  averageYield: number;
  recentTransactions: TransactionInfo[];
  networkStats: NetworkStats;
}

export class MirrorNodeService {
  private client: AxiosInstance;
  private config: MirrorNodeConfig;

  constructor(config: MirrorNodeConfig) {
    this.config = {
      timeout: 10000,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Mirror Node API error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
        });
        throw error;
      }
    );
  }

  // Get NFT information by token ID and serial number
  async getNFTInfo(tokenId: string, serialNumber: string): Promise<NFTInfo | null> {
    const cacheKey = `${CacheKeys.NFT_INFO}:${tokenId}:${serialNumber}`;
    
    try {
      // Check cache first
      const cached = await nftCache.get(cacheKey);
      if (cached) {
        return cached as NFTInfo;
      }

      const response = await this.client.get(`/api/v1/tokens/${tokenId}/nfts/${serialNumber}`);
      const nftInfo = response.data as NFTInfo;

      // Cache for 5 minutes
      await nftCache.set(cacheKey, nftInfo, 300);
      
      return nftInfo;
    } catch (error) {
      logger.error(`Failed to get NFT info for ${tokenId}/${serialNumber}:`, error);
      return null;
    }
  }

  // Get all NFTs for a token
  async getNFTsByToken(tokenId: string, limit: number = 25): Promise<NFTInfo[]> {
    try {
      const response = await this.client.get(`/api/v1/tokens/${tokenId}/nfts`, {
        params: { limit, order: 'desc' }
      });
      
      return response.data.nfts || [];
    } catch (error) {
      logger.error(`Failed to get NFTs for token ${tokenId}:`, error);
      return [];
    }
  }

  // Get HCS messages from a topic
  async getHCSMessages(
    topicId: string, 
    filters: HCSMessageFilters = {}
  ): Promise<HCSMessage[]> {
    const cacheKey = `${CacheKeys.HCS_MESSAGES}:${topicId}:${JSON.stringify(filters)}`;
    
    try {
      // Check cache first
      const cached = await hcsCache.get(cacheKey);
      if (cached) {
        return cached as HCSMessage[];
      }

      const params = {
        limit: filters.limit || 25,
        order: filters.order || 'desc',
        ...(filters.sequencenumber && { sequencenumber: filters.sequencenumber }),
        ...(filters.timestamp && { timestamp: filters.timestamp }),
      };

      const response = await this.client.get(`/api/v1/topics/${topicId}/messages`, {
        params
      });
      
      const messages = (response.data.messages || []) as HCSMessage[];
      
      // Cache for 2 minutes
      await hcsCache.set(cacheKey, messages, 120);
      
      return messages;
    } catch (error) {
      logger.error(`Failed to get HCS messages for topic ${topicId}:`, error);
      return [];
    }
  }

  // Parse invoice-related HCS messages
  parseInvoiceMessages(messages: HCSMessage[]): ParsedInvoiceMessage[] {
    const parsedMessages: (ParsedInvoiceMessage | null)[] = messages
      .map(message => {
        try {
          // Decode base64 message
          const decodedMessage = Buffer.from(message.message, 'base64').toString('utf-8');
          const data = JSON.parse(decodedMessage);
          
          // Validate message structure and status
          if (data.type === 'invoice' && 
              data.tokenId && 
              data.serialNumber && 
              data.status &&
              ['issued', 'funded', 'paid', 'defaulted'].includes(data.status)) {
            
            const parsedMessage: ParsedInvoiceMessage = {
              tokenId: String(data.tokenId),
              serialNumber: String(data.serialNumber),
              status: data.status as 'issued' | 'funded' | 'paid' | 'defaulted',
              timestamp: message.consensus_timestamp,
              sequenceNumber: message.sequence_number,
            };

            // Add optional fields if they exist
            if (data.transactionId) {
              parsedMessage.transactionId = String(data.transactionId);
            }
            if (data.amount) {
              parsedMessage.amount = String(data.amount);
            }
            if (data.currency) {
              parsedMessage.currency = data.currency;
            }
            if (data.fileHash) {
              parsedMessage.fileHash = data.fileHash;
            }

            return parsedMessage;
          }
          
          return null;
        } catch (error) {
          logger.warn(`Failed to parse HCS message ${message.sequence_number}:`, error);
          return null;
        }
      });

    return parsedMessages.filter((msg): msg is ParsedInvoiceMessage => msg !== null);
  }

  // Get account information
  async getAccountInfo(accountId: string): Promise<AccountInfo | null> {
    try {
      const response = await this.client.get(`/api/v1/accounts/${accountId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get account info for ${accountId}:`, error);
      return null;
    }
  }

  // Get account transactions
  async getAccountTransactions(
    accountId: string, 
    limit: number = 25,
    order: 'asc' | 'desc' = 'desc'
  ): Promise<TransactionInfo[]> {
    try {
      const response = await this.client.get(`/api/v1/transactions`, {
        params: {
          'account.id': accountId,
          limit,
          order
        }
      });
      
      return response.data.transactions || [];
    } catch (error) {
      logger.error(`Failed to get transactions for account ${accountId}:`, error);
      return [];
    }
  }

  // Get transaction by ID
  async getTransaction(transactionId: string): Promise<TransactionInfo | null> {
    try {
      const response = await this.client.get(`/api/v1/transactions/${transactionId}`);
      return response.data.transactions?.[0] || null;
    } catch (error) {
      logger.error(`Failed to get transaction ${transactionId}:`, error);
      return null;
    }
  }

  // Get HFS file information
  async getFileInfo(fileId: string): Promise<FileInfo | null> {
    try {
      const response = await this.client.get(`/api/v1/files/${fileId}`);
      return response.data || null;
    } catch (error) {
      logger.error(`Failed to get file info for ${fileId}:`, error);
      return null;
    }
  }

  // Get network statistics
  async getNetworkStats(): Promise<NetworkStats> {
    try {
      // Get recent transactions to calculate TPS
      const recentTxResponse = await this.client.get('/api/v1/transactions', {
        params: { limit: 100, order: 'desc' }
      });
      
      const transactions = recentTxResponse.data.transactions || [];
      
      // Calculate TPS from recent transactions
      let tps = 0;
      if (transactions.length >= 2) {
        const latest = new Date(transactions[0].consensus_timestamp).getTime();
        const earliest = new Date(transactions[transactions.length - 1].consensus_timestamp).getTime();
        const timeSpanSeconds = (latest - earliest) / 1000;
        tps = timeSpanSeconds > 0 ? Math.round(transactions.length / timeSpanSeconds) : 0;
      }

      // Get network supply info
      const supplyResponse = await this.client.get('/api/v1/network/supply');
      
      return {
        timestamp: new Date().toISOString(),
        tps,
        gas_used: 0, // Hedera doesn't use gas
        active_nodes: 39, // Hedera mainnet has 39 nodes
        total_transactions: parseInt(transactions[0]?.consensus_timestamp || '0')
      };
    } catch (error) {
      logger.error('Failed to get network stats:', error);
      return {
        timestamp: new Date().toISOString(),
        tps: 0,
        gas_used: 0,
        active_nodes: 0,
        total_transactions: 0
      };
    }
  }

  // Get comprehensive dashboard metrics
  async getDashboardMetrics(
    invoiceTopicId: string,
    invoiceTokenId: string,
    operatorAccountId: string
  ): Promise<DashboardMetrics> {
    try {
      const [
        hcsMessages,
        nfts,
        recentTransactions,
        networkStats
      ] = await Promise.all([
        this.getHCSMessages(invoiceTopicId, { limit: 100 }),
        this.getNFTsByToken(invoiceTokenId, 100),
        this.getAccountTransactions(operatorAccountId, 20),
        this.getNetworkStats()
      ]);

      // Parse invoice events from HCS messages
      const invoiceEvents = this.parseInvoiceMessages(hcsMessages);
      
      // Calculate metrics
      const totalInvoices = nfts.length;
      const fundedInvoices = invoiceEvents.filter(e => e.status === 'funded').length;
      const completedInvoices = invoiceEvents.filter(e => e.status === 'paid').length;
      
      // Calculate total funding amount from invoice events
      const totalFunding = invoiceEvents
        .filter(e => e.status === 'funded' && e.amount)
        .reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);

      // Get unique investors from funding events
      const uniqueInvestors = new Set(
        recentTransactions
          .filter(tx => tx.nft_transfers && tx.nft_transfers.length > 0)
          .map(tx => tx.nft_transfers![0].receiver_account_id)
      ).size;

      // Calculate average yield (mock calculation)
      const averageYield = completedInvoices > 0 ? 
        Math.round((completedInvoices / totalInvoices) * 15 * 100) / 100 : 0;

      return {
        totalInvoices,
        totalFunding,
        activeInvestors: uniqueInvestors,
        completedDeals: completedInvoices,
        totalValueLocked: totalFunding,
        averageYield,
        recentTransactions: recentTransactions.slice(0, 10),
        networkStats
      };
    } catch (error) {
      logger.error('Failed to get dashboard metrics:', error);
      
      // Return fallback metrics
      return {
        totalInvoices: 0,
        totalFunding: 0,
        activeInvestors: 0,
        completedDeals: 0,
        totalValueLocked: 0,
        averageYield: 0,
        recentTransactions: [],
        networkStats: {
          timestamp: new Date().toISOString(),
          tps: 0,
          gas_used: 0,
          active_nodes: 0,
          total_transactions: 0
        }
      };
    }
  }

  // Generate HashScan links for verification
  generateHashScanLinks(data: {
    transactionId?: string;
    accountId?: string;
    tokenId?: string;
    topicId?: string;
    fileId?: string;
  }) {
    const baseUrl = this.config.baseUrl.includes('testnet') 
      ? 'https://hashscan.io/testnet' 
      : 'https://hashscan.io/mainnet';

    const links: Record<string, string> = {};

    if (data.transactionId) {
      links.transaction = `${baseUrl}/transaction/${data.transactionId}`;
    }
    if (data.accountId) {
      links.account = `${baseUrl}/account/${data.accountId}`;
    }
    if (data.tokenId) {
      links.token = `${baseUrl}/token/${data.tokenId}`;
    }
    if (data.topicId) {
      links.topic = `${baseUrl}/topic/${data.topicId}`;
    }
    if (data.fileId) {
      links.file = `${baseUrl}/file/${data.fileId}`;
    }

    return links;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/api/v1/network/nodes', {
        timeout: 5000
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