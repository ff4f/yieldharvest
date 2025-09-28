import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SettlementsTable = () => {
  const [sortField, setSortField] = useState('settlementDate');
  const [sortDirection, setSortDirection] = useState('desc');

  const settlementsData = [
    {
      dealId: "DEAL-2025-001",
      settlementDate: "2025-08-24T14:30:00Z",
      totalAmount: "$125,000",
      investorShare: "$106,250",
      operatorShare: "$12,500",
      platformShare: "$6,250",
      status: "completed",
      transactionHash: "0x1a2b3c4d5e6f7g8h"
    },
    {
      dealId: "DEAL-2025-002",
      settlementDate: "2025-08-23T16:45:00Z",
      totalAmount: "$87,500",
      investorShare: "$74,375",
      operatorShare: "$8,750",
      platformShare: "$4,375",
      status: "completed",
      transactionHash: "0x2b3c4d5e6f7g8h9i"
    },
    {
      dealId: "DEAL-2025-003",
      settlementDate: "2025-08-22T11:20:00Z",
      totalAmount: "$200,000",
      investorShare: "$170,000",
      operatorShare: "$20,000",
      platformShare: "$10,000",
      status: "completed",
      transactionHash: "0x3c4d5e6f7g8h9i0j"
    },
    {
      dealId: "DEAL-2025-004",
      settlementDate: "2025-08-21T09:15:00Z",
      totalAmount: "$156,250",
      investorShare: "$132,812",
      operatorShare: "$15,625",
      platformShare: "$7,813",
      status: "pending",
      transactionHash: "0x4d5e6f7g8h9i0j1k"
    }
  ];

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: {
        color: 'bg-success text-success-foreground',
        icon: 'CheckCircle'
      },
      pending: {
        color: 'bg-warning text-warning-foreground',
        icon: 'Clock'
      },
      failed: {
        color: 'bg-error text-error-foreground',
        icon: 'XCircle'
      }
    };

    const config = statusConfig?.[status] || statusConfig?.pending;

    return (
      <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}>
        <Icon name={config?.icon} size={12} />
        <span className="capitalize">{status}</span>
      </div>
    );
  };

  const handleHashScanClick = (hash) => {
    window.open(`https://hashscan.io/mainnet/transaction/${hash}`, '_blank');
  };

  const handleExportCSV = () => {
    const csvContent = [
      ['Deal ID', 'Settlement Date', 'Total Amount', 'Investor Share', 'Operator Share', 'Platform Share', 'Status', 'Transaction Hash'],
      ...settlementsData?.map(row => [
        row?.dealId,
        formatDate(row?.settlementDate),
        row?.totalAmount,
        row?.investorShare,
        row?.operatorShare,
        row?.platformShare,
        row?.status,
        row?.transactionHash
      ])
    ]?.map(row => row?.join(','))?.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL?.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlements-${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
    a?.click();
    window.URL?.revokeObjectURL(url);
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-institutional">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Settlement History</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Icon name="Download" size={16} className="mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm">
              <Icon name="Filter" size={16} className="mr-2" />
              Filter
            </Button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium text-foreground">
                <button 
                  onClick={() => handleSort('dealId')}
                  className="flex items-center space-x-1 hover:text-primary transition-institutional"
                >
                  <span>Deal ID</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 font-medium text-foreground">
                <button 
                  onClick={() => handleSort('settlementDate')}
                  className="flex items-center space-x-1 hover:text-primary transition-institutional"
                >
                  <span>Settlement Date</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 font-medium text-foreground">Total Amount</th>
              <th className="text-left p-4 font-medium text-foreground">Distribution</th>
              <th className="text-left p-4 font-medium text-foreground">Status</th>
              <th className="text-left p-4 font-medium text-foreground">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {settlementsData?.map((settlement, index) => (
              <tr key={index} className="border-b border-border hover:bg-muted/30 transition-institutional">
                <td className="p-4">
                  <div className="font-medium text-foreground">{settlement?.dealId}</div>
                </td>
                <td className="p-4">
                  <div className="text-sm text-foreground">{formatDate(settlement?.settlementDate)}</div>
                </td>
                <td className="p-4">
                  <div className="font-medium text-foreground">{settlement?.totalAmount}</div>
                </td>
                <td className="p-4">
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Investors:</span>
                      <span className="text-foreground font-medium">{settlement?.investorShare}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Operators:</span>
                      <span className="text-foreground font-medium">{settlement?.operatorShare}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform:</span>
                      <span className="text-foreground font-medium">{settlement?.platformShare}</span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  {getStatusBadge(settlement?.status)}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleHashScanClick(settlement?.transactionHash)}
                    className="flex items-center space-x-1 text-primary hover:text-primary/80 transition-institutional"
                  >
                    <span className="font-mono text-sm">{settlement?.transactionHash?.slice(0, 10)}...</span>
                    <Icon name="ExternalLink" size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SettlementsTable;