import { useState, useEffect, useMemo } from 'react';
// import { useMirrorNode } from './useMirrorNode'; // Removed unused import
import { useInvoices } from './useInvoices';
// const mirrorNodeApi = useMirrorNode(); // Removed unused variable
import { useNFTsByToken, useHCSMessages, useDashboardMetrics } from './useMirrorNode';
// import { mirrorNodeApi } from '@/services/api'; // Removed unused import

interface SupplierKPI {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  color: 'primary' | 'warning' | 'success' | 'accent';
  proof?: {
    type: 'nft' | 'hcs' | 'transaction';
    url: string;
    label: string;
  };
}

interface SupplierTransaction {
  id: string;
  type: 'invoice_tokenization' | 'funding_disbursement' | 'milestone_verification' | 'settlement';
  status: 'confirmed' | 'pending' | 'failed';
  timestamp: string;
  amount: string;
  description: string;
  hashScanUrl?: string;
  mirrorNodeUrl?: string;
}

interface SupplierPortalData {
  kpiData: SupplierKPI[];
  recentTransactions: SupplierTransaction[];
  invoiceStats: {
    total: number;
    pending: number;
    funded: number;
    completed: number;
  };
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useSupplierPortalData(supplierId?: string): SupplierPortalData {
  const [supplierData, setSupplierData] = useState<SupplierPortalData>({
    kpiData: [],
    recentTransactions: [],
    invoiceStats: { total: 0, pending: 0, funded: 0, completed: 0 },
    loading: true,
    error: null,
    lastUpdated: null,
  });

  // Get environment variables for Hedera services
  const invoiceTokenId = import.meta.env.VITE_INVOICE_TOKEN_ID || '0.0.123456';
    const statusTopicId = import.meta.env.VITE_STATUS_TOPIC_ID || '0.0.123457';
    const network = import.meta.env.VITE_HEDERA_NETWORK || 'testnet';

  // Mirror Node data hooks
  const { data: dashboardMetrics, loading: metricsLoading, error: metricsError } = useDashboardMetrics({
    refetchInterval: 30000, // 30 seconds
    enableCaching: true,
    cacheTTL: 60000, // 1 minute cache
  });

  const { data: nftData, loading: nftLoading, error: nftError } = useNFTsByToken(
    invoiceTokenId,
    100, // Get up to 100 NFTs
    {
      refetchInterval: 45000, // 45 seconds
      enableCaching: true,
    }
  );

  const { data: hcsData, loading: hcsLoading, error: hcsError } = useHCSMessages(
    statusTopicId,
    { 
      order: 'desc',
      limit: 50,
    },
    {
      refetchInterval: 15000, // 15 seconds for more frequent status updates
      enableCaching: true,
      cacheTTL: 30000, // 30 seconds cache
    }
  );

  // Backend API data
  const { data: invoicesResponse, isLoading: invoicesLoading, error: invoicesError } = useInvoices({
    supplierId,
    limit: 50,
  });

  // Compute derived data
  const computedData = useMemo(() => {
    const invoices = invoicesResponse?.data || [];
    const nfts = nftData?.nfts || [];
    const hcsMessages = hcsData?.messages || [];
    // const metrics = dashboardMetrics || {}; // Removed unused variable

    // Calculate invoice statistics
    const totalInvoices = invoices?.length || 0;
    const pendingInvoices = invoices?.filter(inv => inv.status === 'ISSUED').length || 0;
    const fundedInvoices = invoices?.filter(inv => inv.status === 'FUNDED').length || 0;
    const paidInvoices = invoices?.filter(inv => inv.status === 'PAID').length || 0;
    
    const invoiceStats = {
      total: totalInvoices,
      pending: pendingInvoices,
      funded: fundedInvoices,
      completed: paidInvoices,
    };

    // Calculate financial metrics
    // const totalInvoiceValue = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0);
    const fundedValue = invoices
      .filter(inv => inv.status === 'FUNDED' || inv.status === 'PAID')
      .reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0);
    const availableBalance = invoices
      .filter(inv => inv.status === 'PAID')
      .reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0);

    // Generate KPI data with real Mirror Node integration
    const kpiData: SupplierKPI[] = [
      {
        title: 'Total Invoices',
        value: invoiceStats.total.toString(),
        subtitle: `${nfts.length} NFTs minted`,
        icon: 'FileText',
        trend: 'up',
        trendValue: '+12%',
        color: 'primary',
        proof: {
          type: 'nft',
          url: `https://hashscan.io/${network}/token/${invoiceTokenId}`,
          label: 'View NFT Collection',
        },
      },
      {
        title: 'Active Funding',
        value: `$${fundedValue.toLocaleString()}`,
        subtitle: `${invoiceStats.funded} invoices funded`,
        icon: 'TrendingUp',
        trend: 'up',
        trendValue: '+8%',
        color: 'warning',
        proof: hcsMessages.length > 0 ? {
          type: 'hcs',
          url: `https://hashscan.io/${network}/topic/${statusTopicId}`,
          label: 'View Status Updates',
        } : undefined,
      },
      {
        title: 'Completed Deals',
        value: invoiceStats.completed.toString(),
        subtitle: 'Successfully settled',
        icon: 'CheckCircle',
        trend: 'up',
        trendValue: '+15%',
        color: 'success',
      },
      {
        title: 'Available Balance',
        value: `$${availableBalance.toLocaleString()}`,
        subtitle: 'Ready for withdrawal',
        icon: 'Wallet',
        trend: 'up',
        trendValue: '+22%',
        color: 'accent',
      },
    ];

    // Generate recent transactions from HCS messages and NFT data
    const recentTransactions: SupplierTransaction[] = [];

    // Add NFT minting transactions
    nfts.slice(0, 10).forEach((nft: any) => {
      recentTransactions.push({
        id: `nft-${nft.token_id}-${nft.serial_number}`,
        type: 'invoice_tokenization',
        status: 'confirmed',
        timestamp: nft.created_timestamp,
        amount: nft.metadata?.amount || '$0',
        description: `Invoice #${nft.metadata?.invoiceNumber || nft.serial_number} tokenized as NFT`,
        hashScanUrl: `https://hashscan.io/${network}/token/${nft.token_id}/${nft.serial_number}`,
      });
    });

    // Add HCS status messages
    hcsMessages.slice(0, 15).forEach((message: any) => {
      const messageData = JSON.parse(atob(message.message));
      recentTransactions.push({
        id: `hcs-${message.sequence_number}`,
        type: messageData.type || 'milestone_verification',
        status: 'confirmed',
        timestamp: message.consensus_timestamp,
        amount: messageData.amount || '$0',
        description: messageData.description || `Status update: ${messageData.status}`,
        hashScanUrl: `https://hashscan.io/${network}/topic/${statusTopicId}/message/${message.sequence_number}`,
      });
    });

    // Sort transactions by timestamp (most recent first)
    recentTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      kpiData,
      recentTransactions: recentTransactions.slice(0, 10), // Keep only 10 most recent
      invoiceStats,
    };
  }, [invoicesResponse, nftData, hcsData, dashboardMetrics, invoiceTokenId, statusTopicId, network]);

  // Update state when computed data changes
  useEffect(() => {
    const loading = metricsLoading || nftLoading || hcsLoading || invoicesLoading;
    const error = metricsError || nftError || hcsError || invoicesError;

    setSupplierData({
      ...computedData,
      loading,
      error: error ? (error instanceof Error ? error.message : String(error)) : null,
      lastUpdated: loading ? null : new Date(),
    });
  }, [
    computedData,
    metricsLoading,
    nftLoading,
    hcsLoading,
    invoicesLoading,
    metricsError,
    nftError,
    hcsError,
    invoicesError,
  ]);

  return supplierData;
}

// Hook for real-time supplier notifications
export function useSupplierNotifications(supplierId?: string) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const statusTopicId = import.meta.env.VITE_STATUS_TOPIC_ID || '0.0.123457';

  const { data: hcsData } = useHCSMessages(
    statusTopicId,
    { 
      order: 'desc',
      limit: 20,
    },
    {
      refetchInterval: 10000, // 10 seconds for notifications
    }
  );

  useEffect(() => {
    if (hcsData?.messages) {
      const newNotifications = hcsData.messages
        .filter((message: any) => {
          try {
            const messageData = JSON.parse(atob(message.message));
            return messageData.supplierId === supplierId;
          } catch {
            return false;
          }
        })
        .map((message: any) => {
          const messageData = JSON.parse(atob(message.message));
          return {
            id: message.sequence_number,
            type: messageData.type,
            title: messageData.title || 'Status Update',
            message: messageData.description,
            timestamp: message.consensus_timestamp,
            read: false,
          };
        });

      setNotifications(newNotifications);
    }
  }, [hcsData, supplierId]);

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