import { mirrorNodeApi } from './api';

export interface SettlementKPI {
  totalSettlements: number;
  totalValue: number;
  fundedPercentage: number;
  paidPercentage: number;
  averageDaysToPayment: number;
  pendingSettlements: number;
  completedSettlements: number;
  failedSettlements: number;
}

export interface SettlementSnapshot {
  kpis: SettlementKPI;
  recentSettlements: Settlement[];
  distributionBreakdown: DistributionData[];
  auditTrail: AuditEvent[];
  lastUpdated: string;
}

export interface Settlement {
  id: string;
  dealId: string;
  invoiceId: string;
  totalAmount: number;
  investorShare: number;
  operatorShare: number;
  platformShare: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  transactionId?: string;
  hashScanUrl?: string;
  mirrorNodeUrl?: string;
}

export interface DistributionData {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface AuditEvent {
  id: string;
  settlementId: string;
  eventType: 'created' | 'funded' | 'distributed' | 'completed' | 'failed';
  timestamp: string;
  details: string;
  transactionId?: string;
  verificationStatus: 'verified' | 'pending' | 'failed';
  hashScanUrl?: string;
}

class SettlementsAggregator {
  private network: string;
  private invoiceTokenId: string;
  private statusTopicId: string;

  constructor() {
    this.network = import.meta.env.VITE_HEDERA_NETWORK || 'testnet';
    this.invoiceTokenId = import.meta.env.VITE_INVOICE_TOKEN_ID || '0.0.123456';
    this.statusTopicId = import.meta.env.VITE_STATUS_TOPIC_ID || '0.0.123457';
  }

  /**
   * Get comprehensive settlement snapshot with KPIs and recent data
   */
  async getSettlementSnapshot(): Promise<SettlementSnapshot> {
    try {
      // Fetch data from multiple sources in parallel
      const [
        settlementsData,
        mirrorNodeTransactions,
        hcsMessages,
        nftData
      ] = await Promise.all([
        this.fetchSettlementsFromBackend(),
        this.fetchMirrorNodeTransactions(),
        this.fetchHCSMessages(),
        this.fetchNFTData()
      ]);

      // Compute KPIs
      const kpis = this.computeKPIs(settlementsData, mirrorNodeTransactions);
      
      // Generate distribution breakdown
      const distributionBreakdown = this.computeDistributionBreakdown(settlementsData);
      
      // Create audit trail from HCS messages and transactions
      const auditTrail = this.createAuditTrail(hcsMessages, mirrorNodeTransactions);

      return {
        kpis,
        recentSettlements: settlementsData.slice(0, 10),
        distributionBreakdown,
        auditTrail: auditTrail.slice(0, 20),
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating settlement snapshot:', error);
      return this.getFallbackSnapshot();
    }
  }

  /**
   * Get paginated settlements with filters
   */
  async getSettlements(
    page: number = 1,
    limit: number = 20,
    status?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<{ settlements: Settlement[]; total: number; page: number; limit: number }> {
    try {
      const settlements = await this.fetchSettlementsFromBackend();
      
      // Apply filters
      let filteredSettlements = settlements;
      
      if (status) {
        filteredSettlements = filteredSettlements.filter(s => s.status === status);
      }
      
      if (dateFrom) {
        filteredSettlements = filteredSettlements.filter(s => 
          new Date(s.createdAt) >= new Date(dateFrom)
        );
      }
      
      if (dateTo) {
        filteredSettlements = filteredSettlements.filter(s => 
          new Date(s.createdAt) <= new Date(dateTo)
        );
      }

      // Paginate
      const startIndex = (page - 1) * limit;
      const paginatedSettlements = filteredSettlements.slice(startIndex, startIndex + limit);

      return {
        settlements: paginatedSettlements,
        total: filteredSettlements.length,
        page,
        limit
      };
    } catch (error) {
      console.error('Error fetching settlements:', error);
      return {
        settlements: [],
        total: 0,
        page,
        limit
      };
    }
  }

  /**
   * Get proof data for a specific invoice
   */
  async getInvoiceProofs(invoiceId: string): Promise<any[]> {
    try {
      const [nftData, hcsMessages, transactions] = await Promise.all([
        this.fetchNFTData(),
        this.fetchHCSMessages(),
        this.fetchMirrorNodeTransactions()
      ]);

      const proofs = [];

      // Find NFT proof
      const nft = nftData.nfts?.find((n: any) => 
        n.metadata?.invoiceId === invoiceId || n.serial_number === invoiceId
      );
      
      if (nft) {
        proofs.push({
          type: 'nft',
          label: 'Invoice NFT',
          value: `${nft.token_id}/${nft.serial_number}`,
          url: `https://hashscan.io/${this.network}/token/${nft.token_id}/${nft.serial_number}`,
          status: 'verified',
          timestamp: nft.created_timestamp
        });
      }

      // Find HCS messages related to this invoice
      const relatedMessages = hcsMessages.messages?.filter((msg: any) => {
        try {
          const messageData = JSON.parse(atob(msg.message));
          return messageData.invoiceId === invoiceId;
        } catch {
          return false;
        }
      });

      if (relatedMessages?.length > 0) {
        proofs.push({
          type: 'hcs',
          label: 'Status Updates',
          value: `${this.statusTopicId}/seq:${relatedMessages[0].sequence_number}-${relatedMessages[relatedMessages.length - 1].sequence_number}`,
          url: `https://hashscan.io/${this.network}/topic/${this.statusTopicId}`,
          status: 'verified',
          timestamp: relatedMessages[0].consensus_timestamp
        });
      }

      // Find related transactions
      const relatedTx = transactions.transactions?.find((tx: any) => 
        tx.memo_base64 && atob(tx.memo_base64).includes(invoiceId)
      );

      if (relatedTx) {
        proofs.push({
          type: 'transaction',
          label: 'Creation Transaction',
          value: relatedTx.transaction_id,
          url: `https://hashscan.io/${this.network}/transaction/${relatedTx.transaction_id}`,
          status: 'verified',
          timestamp: relatedTx.consensus_timestamp
        });
      }

      return proofs;
    } catch (error) {
      console.error('Error fetching invoice proofs:', error);
      return [];
    }
  }

  /**
   * Compute KPIs from settlements and transaction data
   */
  private computeKPIs(settlements: Settlement[], transactions: any[]): SettlementKPI {
    const totalSettlements = settlements.length;
    const totalValue = settlements.reduce((sum, s) => sum + s.totalAmount, 0);
    
    const fundedSettlements = settlements.filter(s => 
      s.status === 'completed' || s.status === 'processing'
    );
    const paidSettlements = settlements.filter(s => s.status === 'completed');
    
    const fundedPercentage = totalSettlements > 0 ? 
      (fundedSettlements.length / totalSettlements) * 100 : 0;
    const paidPercentage = totalSettlements > 0 ? 
      (paidSettlements.length / totalSettlements) * 100 : 0;

    // Calculate average days to payment
    const completedWithDates = paidSettlements.filter(s => s.completedAt);
    const averageDaysToPayment = completedWithDates.length > 0 ?
      completedWithDates.reduce((sum, s) => {
        const created = new Date(s.createdAt);
        const completed = new Date(s.completedAt!);
        const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0) / completedWithDates.length : 0;

    return {
      totalSettlements,
      totalValue,
      fundedPercentage: Math.round(fundedPercentage * 100) / 100,
      paidPercentage: Math.round(paidPercentage * 100) / 100,
      averageDaysToPayment: Math.round(averageDaysToPayment * 100) / 100,
      pendingSettlements: settlements.filter(s => s.status === 'pending').length,
      completedSettlements: paidSettlements.length,
      failedSettlements: settlements.filter(s => s.status === 'failed').length
    };
  }

  /**
   * Compute distribution breakdown for charts
   */
  private computeDistributionBreakdown(settlements: Settlement[]): DistributionData[] {
    const totalAmount = settlements.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalInvestorShare = settlements.reduce((sum, s) => sum + s.investorShare, 0);
    const totalOperatorShare = settlements.reduce((sum, s) => sum + s.operatorShare, 0);
    const totalPlatformShare = settlements.reduce((sum, s) => sum + s.platformShare, 0);

    return [
      {
        category: 'Investors',
        amount: totalInvestorShare,
        percentage: totalAmount > 0 ? (totalInvestorShare / totalAmount) * 100 : 0,
        count: settlements.length
      },
      {
        category: 'Operators',
        amount: totalOperatorShare,
        percentage: totalAmount > 0 ? (totalOperatorShare / totalAmount) * 100 : 0,
        count: settlements.length
      },
      {
        category: 'Platform',
        amount: totalPlatformShare,
        percentage: totalAmount > 0 ? (totalPlatformShare / totalAmount) * 100 : 0,
        count: settlements.length
      }
    ];
  }

  /**
   * Create audit trail from HCS messages and transactions
   */
  private createAuditTrail(hcsMessages: any, transactions: any): AuditEvent[] {
    const auditEvents: AuditEvent[] = [];

    // Process HCS messages
    hcsMessages.messages?.forEach((msg: any) => {
      try {
        const messageData = JSON.parse(atob(msg.message));
        auditEvents.push({
          id: `hcs-${msg.sequence_number}`,
          settlementId: messageData.settlementId || 'unknown',
          eventType: this.mapMessageTypeToEventType(messageData.type),
          timestamp: msg.consensus_timestamp,
          details: messageData.description || `Status update: ${messageData.status}`,
          transactionId: msg.payer_account_id,
          verificationStatus: 'verified',
          hashScanUrl: `https://hashscan.io/${this.network}/topic/${this.statusTopicId}/message/${msg.sequence_number}`
        });
      } catch (error) {
        // Skip invalid messages
      }
    });

    // Process transactions
    transactions.transactions?.forEach((tx: any) => {
      if (tx.name === 'CRYPTOTRANSFER' && tx.result === 'SUCCESS') {
        auditEvents.push({
          id: `tx-${tx.transaction_id}`,
          settlementId: 'unknown',
          eventType: 'distributed',
          timestamp: tx.consensus_timestamp,
          details: `Settlement distribution: ${tx.transfers?.length || 0} transfers`,
          transactionId: tx.transaction_id,
          verificationStatus: 'verified',
          hashScanUrl: `https://hashscan.io/${this.network}/transaction/${tx.transaction_id}`
        });
      }
    });

    // Sort by timestamp (most recent first)
    return auditEvents.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Map HCS message types to audit event types
   */
  private mapMessageTypeToEventType(messageType: string): AuditEvent['eventType'] {
    const typeMap: Record<string, AuditEvent['eventType']> = {
      'invoice_created': 'created',
      'funding_received': 'funded',
      'settlement_initiated': 'distributed',
      'settlement_completed': 'completed',
      'settlement_failed': 'failed'
    };
    return typeMap[messageType] || 'created';
  }

  /**
   * Fetch settlements from backend API
   */
  private async fetchSettlementsFromBackend(): Promise<Settlement[]> {
    try {
      // Use direct fetch since settlements endpoint is not in mirrorNodeApi
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/settlements`);
      const data = await response.json();
      return data?.settlements || this.getMockSettlements();
    } catch (error) {
      console.warn('Backend settlements not available, using mock data');
      return this.getMockSettlements();
    }
  }

  /**
   * Fetch Mirror Node transaction data
   */
  private async fetchMirrorNodeTransactions(): Promise<any> {
    try {
      const response = await fetch(
        `https://${this.network}.mirrornode.hedera.com/api/v1/transactions?limit=50&order=desc`
      );
      return await response.json();
    } catch (error) {
      console.warn('Mirror Node transactions not available');
      return { transactions: [] };
    }
  }

  /**
   * Fetch HCS messages
   */
  private async fetchHCSMessages(): Promise<any> {
    try {
      const response = await fetch(
        `https://${this.network}.mirrornode.hedera.com/api/v1/topics/${this.statusTopicId}/messages?limit=50&order=desc`
      );
      return await response.json();
    } catch (error) {
      console.warn('HCS messages not available');
      return { messages: [] };
    }
  }

  /**
   * Fetch NFT data
   */
  private async fetchNFTData(): Promise<any> {
    try {
      const response = await fetch(
        `https://${this.network}.mirrornode.hedera.com/api/v1/tokens/${this.invoiceTokenId}/nfts?limit=100`
      );
      return await response.json();
    } catch (error) {
      console.warn('NFT data not available');
      return { nfts: [] };
    }
  }

  /**
   * Get mock settlements for demo purposes
   */
  private getMockSettlements(): Settlement[] {
    return [
      {
        id: 'SETTLE-001',
        dealId: 'DEAL-2025-001',
        invoiceId: 'INV-2025-001',
        totalAmount: 125000,
        investorShare: 106250,
        operatorShare: 12500,
        platformShare: 6250,
        status: 'completed',
        createdAt: '2025-08-24T14:30:00Z',
        completedAt: '2025-08-25T16:45:00Z',
        transactionId: '0.0.123456@1234567890.123456789',
        hashScanUrl: `https://hashscan.io/${this.network}/transaction/0.0.123456@1234567890.123456789`
      },
      {
        id: 'SETTLE-002',
        dealId: 'DEAL-2025-002',
        invoiceId: 'INV-2025-002',
        totalAmount: 87500,
        investorShare: 74375,
        operatorShare: 8750,
        platformShare: 4375,
        status: 'processing',
        createdAt: '2025-08-23T16:45:00Z',
        transactionId: '0.0.123456@1234567891.123456789',
        hashScanUrl: `https://hashscan.io/${this.network}/transaction/0.0.123456@1234567891.123456789`
      }
    ];
  }

  /**
   * Get fallback snapshot when data is unavailable
   */
  private getFallbackSnapshot(): SettlementSnapshot {
    const mockSettlements = this.getMockSettlements();
    return {
      kpis: this.computeKPIs(mockSettlements, []),
      recentSettlements: mockSettlements,
      distributionBreakdown: this.computeDistributionBreakdown(mockSettlements),
      auditTrail: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

export const settlementsAggregator = new SettlementsAggregator();