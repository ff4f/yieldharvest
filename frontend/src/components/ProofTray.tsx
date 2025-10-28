import React, { useState } from 'react';
import Icon from './AppIcon';
import Button from './ui/Button';

export interface ProofTransaction {
  id: string;
  type: 'invoice_tokenization' | 'funding_disbursement' | 'milestone_verification' | 'payment_settlement' | 'escrow_release';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  amount?: string;
  description: string;
  transactionHash?: string;
  hcsMessageId?: string;
  nftTokenId?: string;
  escrowId?: string;
  contractAddress?: string;
  fileId?: string;
  topicId?: string;
  links?: {
    hashScan?: string;
    mirrorNode?: string;
    contract?: string;
    file?: string;
    topic?: string;
  };
}

interface ProofTrayProps {
  transactions: ProofTransaction[];
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

const ProofTray: React.FC<ProofTrayProps> = ({
  transactions,
  isExpanded = false,
  onToggle,
  className = ''
}) => {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);
  
  const expanded = onToggle ? isExpanded : localExpanded;
  const toggleExpanded = onToggle || (() => setLocalExpanded(!localExpanded));

  const getTypeIcon = (type: ProofTransaction['type']) => {
    switch (type) {
      case 'invoice_tokenization':
        return 'FileText';
      case 'funding_disbursement':
        return 'DollarSign';
      case 'milestone_verification':
        return 'CheckCircle';
      case 'payment_settlement':
        return 'CreditCard';
      case 'escrow_release':
        return 'Unlock';
      default:
        return 'Activity';
    }
  };

  const getTypeLabel = (type: ProofTransaction['type']) => {
    switch (type) {
      case 'invoice_tokenization':
        return 'Invoice NFT';
      case 'funding_disbursement':
        return 'Funding';
      case 'milestone_verification':
        return 'Milestone';
      case 'payment_settlement':
        return 'Payment';
      case 'escrow_release':
        return 'Escrow Release';
      default:
        return 'Transaction';
    }
  };

  const getStatusColor = (status: ProofTransaction['status']) => {
    switch (status) {
      case 'confirmed':
        return 'text-success';
      case 'pending':
        return 'text-warning';
      case 'failed':
        return 'text-error';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: ProofTransaction['status']) => {
    switch (status) {
      case 'confirmed':
        return 'CheckCircle';
      case 'pending':
        return 'Clock';
      case 'failed':
        return 'XCircle';
      default:
        return 'Circle';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const ProofPill: React.FC<{ transaction: ProofTransaction }> = ({ transaction }) => (
    <div className="flex items-center space-x-2 bg-muted/30 rounded-lg px-3 py-2">
      <div className={`w-2 h-2 rounded-full ${
        transaction.status === 'confirmed' ? 'bg-success' :
        transaction.status === 'pending' ? 'bg-warning' : 'bg-error'
      }`} />
      <Icon name={getTypeIcon(transaction.type)} size={16} className="text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{getTypeLabel(transaction.type)}</span>
      {transaction.amount && (
        <span className="text-sm text-muted-foreground">{transaction.amount}</span>
      )}
    </div>
  );

  const ProofCard: React.FC<{ transaction: ProofTransaction }> = ({ transaction }) => (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            transaction.status === 'confirmed' ? 'bg-success/10' :
            transaction.status === 'pending' ? 'bg-warning/10' : 'bg-error/10'
          }`}>
            <Icon 
              name={getTypeIcon(transaction.type)} 
              size={20} 
              className={getStatusColor(transaction.status)}
            />
          </div>
          <div>
            <h4 className="font-medium text-foreground">{getTypeLabel(transaction.type)}</h4>
            <p className="text-sm text-muted-foreground">{transaction.description}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Icon 
            name={getStatusIcon(transaction.status)} 
            size={16} 
            className={getStatusColor(transaction.status)}
          />
          <span className={`text-sm font-medium ${getStatusColor(transaction.status)}`}>
            {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Timestamp:</span>
          <span className="font-medium text-foreground ml-2">{formatTimestamp(transaction.timestamp)}</span>
        </div>
        {transaction.amount && (
          <div>
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-medium text-foreground ml-2">{transaction.amount}</span>
          </div>
        )}
        {transaction.transactionHash && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Transaction:</span>
            <span className="font-mono text-xs text-foreground ml-2">
              {transaction.transactionHash.slice(0, 16)}...
            </span>
          </div>
        )}
        {transaction.escrowId && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Escrow ID:</span>
            <span className="font-mono text-xs text-foreground ml-2">{transaction.escrowId}</span>
          </div>
        )}
        {transaction.nftTokenId && (
          <div className="col-span-2">
            <span className="text-muted-foreground">NFT Token:</span>
            <span className="font-mono text-xs text-foreground ml-2">{transaction.nftTokenId}</span>
          </div>
        )}
        {transaction.hcsMessageId && (
          <div className="col-span-2">
            <span className="text-muted-foreground">HCS Message:</span>
            <span className="font-mono text-xs text-foreground ml-2">{transaction.hcsMessageId}</span>
          </div>
        )}
      </div>

      {transaction.links && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {transaction.links.hashScan && (
            <a
              href={transaction.links.hashScan}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Icon name="ExternalLink" size={12} />
              <span>HashScan</span>
            </a>
          )}
          {transaction.links.mirrorNode && (
            <a
              href={transaction.links.mirrorNode}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Icon name="Database" size={12} />
              <span>Mirror Node</span>
            </a>
          )}
          {transaction.links.contract && (
            <a
              href={transaction.links.contract}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Icon name="FileText" size={12} />
              <span>Contract</span>
            </a>
          )}
          {transaction.links.file && (
            <a
              href={transaction.links.file}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Icon name="File" size={12} />
              <span>HFS File</span>
            </a>
          )}
          {transaction.links.topic && (
            <a
              href={transaction.links.topic}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Icon name="MessageCircle" size={12} />
              <span>HCS Topic</span>
            </a>
          )}
        </div>
      )}
    </div>
  );

  if (transactions.length === 0) {
    return (
      <div className={`bg-muted/20 border border-border rounded-lg p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-muted-foreground">
          <Icon name="Activity" size={16} />
          <span className="text-sm">No blockchain proofs available</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-2">
          <Icon name="Shield" size={20} className="text-primary" />
          <h3 className="font-semibold text-foreground">Blockchain Proofs</h3>
          <span className="bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
            {transactions.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleExpanded}
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={16} />
        </Button>
      </div>

      {/* Content */}
      <div className="p-4">
        {!expanded ? (
          // Collapsed view - show pills
          <div className="flex flex-wrap gap-2">
            {transactions.slice(0, 3).map((transaction) => (
              <ProofPill key={transaction.id} transaction={transaction} />
            ))}
            {transactions.length > 3 && (
              <div className="flex items-center space-x-2 bg-muted/30 rounded-lg px-3 py-2">
                <span className="text-sm text-muted-foreground">
                  +{transactions.length - 3} more
                </span>
              </div>
            )}
          </div>
        ) : (
          // Expanded view - show cards
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <ProofCard key={transaction.id} transaction={transaction} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="bg-info/10 border border-info/20 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Icon name="Info" size={16} className="text-info mt-0.5" />
              <div className="text-sm text-info">
                <p className="font-medium mb-1">Blockchain Verification</p>
                <p>All transactions are recorded on Hedera Hashgraph and can be independently verified using the provided links.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProofTray;