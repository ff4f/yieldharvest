import React, { useState } from 'react';
import Icon from '../AppIcon';
import Button from './Button';

const ProofTray = ({ isVisible = true, transactions = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const defaultTransactions = [
    {
      id: '0x1a2b3c4d',
      type: 'invoice_tokenization',
      status: 'confirmed',
      timestamp: '2025-08-25T18:35:00Z',
      amount: '$25,000',
      description: 'Invoice #INV-2025-001 tokenized'
    },
    {
      id: '0x5e6f7g8h',
      type: 'funding_disbursement',
      status: 'pending',
      timestamp: '2025-08-25T18:40:00Z',
      amount: '$22,500',
      description: 'Funding disbursement to supplier'
    },
    {
      id: '0x9i0j1k2l',
      type: 'milestone_verification',
      status: 'confirmed',
      timestamp: '2025-08-25T18:30:00Z',
      amount: '$5,000',
      description: 'Milestone 1 verified and released'
    }
  ];

  const displayTransactions = transactions?.length > 0 ? transactions : defaultTransactions;

  const getStatusColor = (status) => {
    const statusMap = {
      confirmed: 'bg-success text-success-foreground',
      pending: 'bg-warning text-warning-foreground pulse-gentle',
      failed: 'bg-error text-error-foreground',
      processing: 'bg-primary text-primary-foreground pulse-gentle'
    };
    return statusMap?.[status] || 'bg-secondary text-secondary-foreground';
  };

  const getTypeIcon = (type) => {
    const iconMap = {
      invoice_tokenization: 'FileText',
      funding_disbursement: 'ArrowDownCircle',
      milestone_verification: 'CheckCircle',
      settlement: 'CreditCard',
      audit: 'Search'
    };
    return iconMap?.[type] || 'Activity';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp)?.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleHashScanClick = (transactionId) => {
    // Open HashScan explorer in new tab
    window.open(`https://hashscan.io/mainnet/transaction/${transactionId}`, '_blank');
  };

  if (!isVisible || isMinimized) {
    return (
      <div className="fixed top-20 right-4 z-45">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMinimized(false)}
          className="bg-card shadow-institutional"
        >
          <Icon name="Activity" size={16} className="mr-2" />
          <span className="hidden sm:inline">Proof Tray</span>
          <div className="ml-2 w-5 h-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
            {displayTransactions?.filter(t => t?.status === 'pending')?.length}
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed top-20 right-4 z-45 w-80 sm:w-96">
      <div className="bg-card border border-border rounded-lg shadow-institutional">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Icon name="Activity" size={20} className="text-primary" />
            <h3 className="font-semibold text-foreground">Proof Tray</h3>
            <div className="w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-medium">
              {displayTransactions?.length}
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Icon 
                name={isExpanded ? "ChevronUp" : "ChevronDown"} 
                size={16} 
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
            >
              <Icon name="Minus" size={16} />
            </Button>
          </div>
        </div>

        {/* Transaction List */}
        <div className={`transition-smooth overflow-hidden ${
          isExpanded ? 'max-h-96' : 'max-h-48'
        }`}>
          <div className="p-2 space-y-2 max-h-full overflow-y-auto">
            {displayTransactions?.map((transaction) => (
              <div
                key={transaction?.id}
                className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-institutional group"
              >
                {/* Status Indicator */}
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusColor(transaction?.status)}`} />
                
                {/* Transaction Icon */}
                <div className="w-8 h-8 bg-background rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon 
                    name={getTypeIcon(transaction?.type)} 
                    size={16} 
                    className="text-muted-foreground" 
                  />
                </div>

                {/* Transaction Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">
                      {transaction?.description}
                    </p>
                    <span className="text-xs text-muted-foreground ml-2">
                      {formatTimestamp(transaction?.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-success font-mono">
                      {transaction?.amount}
                    </p>
                    <button
                      onClick={() => handleHashScanClick(transaction?.id)}
                      className="text-xs text-primary hover:text-primary/80 transition-institutional font-mono"
                    >
                      {transaction?.id?.slice(0, 10)}...
                    </button>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleHashScanClick(transaction?.id)}
                  className="opacity-0 group-hover:opacity-100 transition-institutional flex-shrink-0"
                >
                  <Icon name="ExternalLink" size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Real-time blockchain verification</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProofTray;