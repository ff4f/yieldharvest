import { useState, useEffect, useMemo } from 'react';
import { useHCSMessages, useAccountTransactions, useDashboardMetrics } from './useMirrorNode';
// import { apiClient } from '@/services/api'; // Removed unused import

interface SettlementRecord {
  dealId: string;
  settlementDate: string;
  totalAmount: string;
  investorShare: string;
  operatorShare: string;
  platformShare: string;
  status: 'completed' | 'pending' | 'failed';
  transactionHash: string;
  hashScanUrl?: string;
  mirrorNodeUrl?: string;
}

interface AuditTrailEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
  transactionId?: string;
  status: 'success' | 'pending' | 'failed';
  hashScanUrl?: string;
  hcsSequence?: number;
}

interface DistributionBreakdown {
  totalSettled: number;
  investorShare: number;
  operatorShare: number;
  platformShare: number;
  pendingAmount: number;
}

interface SettlementSummary {
  totalSettlements: string;
  pendingDistributions: string;
  nextSettlement: string;
  platformRevenue: string;
}

interface SettlementAuditData {
  settlements: SettlementRecord[];
  auditTrail: AuditTrailEntry[];
  distributionBreakdown: DistributionBreakdown;
  summaryCards: SettlementSummary;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useSettlementAuditData(): SettlementAuditData {
  const [auditData, setAuditData] = useState<SettlementAuditData>({
    settlements: [],
    auditTrail: [],
    distributionBreakdown: {
      totalSettled: 0,
      investorShare: 0,
      operatorShare: 0,
      platformShare: 0,
      pendingAmount: 0,
    },
    summaryCards: {
      totalSettlements: '$0',
      pendingDistributions: '$0',
      nextSettlement: 'TBD',
      platformRevenue: '$0',
    },
    loading: true,
    error: null,
    lastUpdated: null,
  });

  // Get environment variables for Hedera services
  const settlementTopicId = import.meta.env.VITE_SETTLEMENT_TOPIC_ID || '0.0.123458';
    const auditTopicId = import.meta.env.VITE_AUDIT_TOPIC_ID || '0.0.123459';
    const escrowAccountId = import.meta.env.VITE_ESCROW_ACCOUNT_ID || '0.0.123460';
    const network = import.meta.env.VITE_HEDERA_NETWORK || 'testnet';

  // Mirror Node data hooks
  const { data: dashboardMetrics, loading: metricsLoading, error: metricsError } = useDashboardMetrics({
    refetchInterval: 60000, // 1 minute
    enableCaching: true,
    cacheTTL: 120000, // 2 minutes cache
  });

  const { data: settlementMessages, loading: settlementLoading, error: settlementError } = useHCSMessages(
    settlementTopicId,
    { 
      order: 'desc',
      limit: 100,
    },
    {
      refetchInterval: 30000, // 30 seconds
      enableCaching: true,
      cacheTTL: 60000, // 1 minute cache
    }
  );

  const { data: auditMessages, loading: auditLoading, error: auditError } = useHCSMessages(
    auditTopicId,
    { 
      order: 'desc',
      limit: 200,
    },
    {
      refetchInterval: 20000, // 20 seconds
      enableCaching: true,
      cacheTTL: 45000, // 45 seconds cache
    }
  );

  const { data: escrowTransactions, loading: txLoading, error: txError } = useAccountTransactions(
    escrowAccountId,
    100,
    'desc',
    {
      refetchInterval: 45000, // 45 seconds
      enableCaching: true,
    }
  );

  // Compute derived data
  const computedData = useMemo(() => {
    const settlementMsgs = settlementMessages?.messages || [];
    const auditMsgs = auditMessages?.messages || [];
    const transactions = escrowTransactions?.transactions || [];
    // const metrics = dashboardMetrics || {}; // Removed unused variable

    // Process settlement records from HCS messages
    const settlements: SettlementRecord[] = settlementMsgs
      .map((message: any) => {
        try {
          const messageData = JSON.parse(atob(message.message));
          if (messageData.type === 'settlement') {
            return {
              dealId: messageData.dealId,
              settlementDate: message.consensus_timestamp,
              totalAmount: messageData.totalAmount || '$0',
              investorShare: messageData.investorShare || '$0',
              operatorShare: messageData.operatorShare || '$0',
              platformShare: messageData.platformShare || '$0',
              status: messageData.status || 'completed',
              transactionHash: messageData.transactionId || message.payer_account_id,
              hashScanUrl: `https://hashscan.io/${network}/topic/${settlementTopicId}/message/${message.sequence_number}`,
              mirrorNodeUrl: `https://mainnet-public.mirrornode.hedera.com/api/v1/topics/${settlementTopicId}/messages/${message.sequence_number}`,
            };
          }
        } catch (error) {
          console.warn('Failed to parse settlement message:', error);
        }
        return null;
      })
      .filter(Boolean) as SettlementRecord[];

    // Process audit trail from HCS messages and transactions
    const auditTrail: AuditTrailEntry[] = [];

    // Add audit messages
    auditMsgs.forEach((message: any) => {
      try {
        const messageData = JSON.parse(atob(message.message));
        auditTrail.push({
          id: `hcs-${message.sequence_number}`,
          timestamp: message.consensus_timestamp,
          action: messageData.action || 'Status Update',
          actor: messageData.actor || message.payer_account_id,
          details: messageData.details || messageData.description || 'Audit event recorded',
          transactionId: messageData.transactionId,
          status: messageData.status === 'failed' ? 'failed' : 'success',
          hashScanUrl: `https://hashscan.io/${network}/topic/${auditTopicId}/message/${message.sequence_number}`,
          hcsSequence: message.sequence_number,
        });
      } catch (error) {
        console.warn('Failed to parse audit message:', error);
      }
    });

    // Add transaction-based audit entries
    transactions.slice(0, 50).forEach((tx: any) => {
      auditTrail.push({
        id: `tx-${tx.transaction_id}`,
        timestamp: tx.consensus_timestamp,
        action: tx.name || 'Transaction',
        actor: tx.entity_id || 'System',
        details: `${tx.name || 'Transaction'}: ${tx.charged_tx_fee ? `Fee: ${tx.charged_tx_fee} HBAR` : 'No fee'}`,
        transactionId: tx.transaction_id,
        status: tx.result === 'SUCCESS' ? 'success' : 'failed',
        hashScanUrl: `https://hashscan.io/${network}/transaction/${tx.transaction_id}`,
      });
    });

    // Sort audit trail by timestamp (most recent first)
    auditTrail.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate distribution breakdown
    const distributionBreakdown: DistributionBreakdown = {
      totalSettled: 0,
      investorShare: 0,
      operatorShare: 0,
      platformShare: 0,
      pendingAmount: 0,
    };

    settlements.forEach(settlement => {
      const total = parseFloat(settlement.totalAmount.replace(/[$,]/g, '')) || 0;
      const investor = parseFloat(settlement.investorShare.replace(/[$,]/g, '')) || 0;
      const operator = parseFloat(settlement.operatorShare.replace(/[$,]/g, '')) || 0;
      const platform = parseFloat(settlement.platformShare.replace(/[$,]/g, '')) || 0;

      if (settlement.status === 'completed') {
        distributionBreakdown.totalSettled += total;
        distributionBreakdown.investorShare += investor;
        distributionBreakdown.operatorShare += operator;
        distributionBreakdown.platformShare += platform;
      } else if (settlement.status === 'pending') {
        distributionBreakdown.pendingAmount += total;
      }
    });

    // Calculate summary cards
    // const completedSettlements = settlements.filter(s => s.status === 'completed');
    const pendingSettlements = settlements.filter(s => s.status === 'pending');
    const nextSettlement = pendingSettlements.length > 0 
      ? new Date(pendingSettlements[0].settlementDate).toLocaleDateString()
      : 'No pending settlements';

    const summaryCards: SettlementSummary = {
      totalSettlements: `$${distributionBreakdown.totalSettled.toLocaleString()}`,
      pendingDistributions: `$${distributionBreakdown.pendingAmount.toLocaleString()}`,
      nextSettlement,
      platformRevenue: `$${distributionBreakdown.platformShare.toLocaleString()}`,
    };

    return {
      settlements: settlements.slice(0, 50), // Keep latest 50 settlements
      auditTrail: auditTrail.slice(0, 100), // Keep latest 100 audit entries
      distributionBreakdown,
      summaryCards,
    };
  }, [settlementMessages, auditMessages, escrowTransactions, dashboardMetrics, network, settlementTopicId, auditTopicId]);

  // Update state when computed data changes
  useEffect(() => {
    const loading = metricsLoading || settlementLoading || auditLoading || txLoading;
    const error = metricsError || settlementError || auditError || txError;

    setAuditData({
      ...computedData,
      loading,
      error: error ? (typeof error === 'object' && error !== null && 'message' in error ? (error as Error).message : String(error)) : null,
      lastUpdated: loading ? null : new Date(),
    });
  }, [
    computedData,
    metricsLoading,
    settlementLoading,
    auditLoading,
    txLoading,
    metricsError,
    settlementError,
    auditError,
    txError,
  ]);

  return auditData;
}

// Hook for real-time settlement notifications
export function useSettlementNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const settlementTopicId = import.meta.env.VITE_SETTLEMENT_TOPIC_ID || '0.0.123458';

  const { data: hcsData } = useHCSMessages(
    settlementTopicId,
    { 
      order: 'desc',
      limit: 10,
    },
    {
      refetchInterval: 15000, // 15 seconds for notifications
    }
  );

  useEffect(() => {
    if (hcsData?.messages) {
      const newNotifications = hcsData.messages
        .map((message: any) => {
          try {
            const messageData = JSON.parse(atob(message.message));
            return {
              id: message.sequence_number,
              type: messageData.type,
              title: messageData.title || 'Settlement Update',
              message: messageData.description || `Settlement ${messageData.status}`,
              timestamp: message.consensus_timestamp,
              read: false,
              severity: messageData.status === 'failed' ? 'error' : 'info',
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      setNotifications(newNotifications);
    }
  }, [hcsData]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    markAsRead,
    clearAll,
  };
}

// Hook for generating settlement reports
export function useSettlementReports() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async (dateRange: { start: string; end: string }) => {
    setLoading(true);
    setError(null);

    try {
      // This would typically call a backend endpoint that aggregates Mirror Node data
      // For now, we'll simulate the report generation
      const report = {
        dateRange,
        totalSettlements: 15,
        totalAmount: '$125,000',
        averageSettlement: '$8,333',
        settlements: [],
        generatedAt: new Date().toISOString(),
      };

      setReportData(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return {
    reportData,
    loading,
    error,
    generateReport,
  };
}