import { useState } from 'react';
import Icon from '../AppIcon';
import { Button } from './button';
import { ProofPillGroup } from './ProofPill';
import ProofCard from './ProofCard';

type ProofType = 'hcs' | 'milestone_verification' | 'hts' | 'funding_disbursement' | 'hfs' | 'file_upload' | 'nft' | 'invoice_mint' | 'invoice_nft';

interface Transaction {
  id: string;
  type: string;
  status: 'confirmed' | 'pending' | 'failed' | 'processing';
  timestamp: string;
  amount: string;
  description: string;
  hashScanLink?: string;
  mirrorNodeLink?: string;
}

interface ProofTrayProps {
  isVisible?: boolean;
  transactions?: Transaction[];
}

const ProofTray: React.FC<ProofTrayProps> = ({ isVisible = true, transactions = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const defaultTransactions: Transaction[] = [
    {
      id: '0x1a2b3c4d',
      type: 'invoice_tokenization',
      status: 'confirmed',
      timestamp: '2025-08-25T18:35:00Z',
      amount: '$25,000',
      description: 'Invoice #INV-2025-001 tokenized',
      hashScanLink: 'https://hashscan.io/testnet/transaction/0x1a2b3c4d',
      mirrorNodeLink: 'https://testnet.mirrornode.hedera.com/api/v1/transactions/0x1a2b3c4d'
    },
    {
      id: '0x5e6f7g8h',
      type: 'funding_disbursement',
      status: 'pending',
      timestamp: '2025-08-25T18:40:00Z',
      amount: '$22,500',
      description: 'Funding disbursement to supplier',
      hashScanLink: 'https://hashscan.io/testnet/transaction/0x5e6f7g8h',
      mirrorNodeLink: 'https://testnet.mirrornode.hedera.com/api/v1/transactions/0x5e6f7g8h'
    },
    {
      id: '0x9i0j1k2l',
      type: 'milestone_verification',
      status: 'confirmed',
      timestamp: '2025-08-25T18:30:00Z',
      amount: '$5,000',
      description: 'Milestone 1 verified and released',
      hashScanLink: 'https://hashscan.io/testnet/transaction/0x9i0j1k2l',
      mirrorNodeLink: 'https://testnet.mirrornode.hedera.com/api/v1/transactions/0x9i0j1k2l'
    }
  ];

  const displayTransactions = transactions?.length > 0 ? transactions : defaultTransactions;

  const getStatusColor = (status: string): string => {
    const statusMap: Record<string, string> = {
      confirmed: 'bg-success text-success-foreground',
      pending: 'bg-warning text-warning-foreground pulse-gentle',
      failed: 'bg-error text-error-foreground',
      processing: 'bg-primary text-primary-foreground pulse-gentle'
    };
    return statusMap[status] || 'bg-secondary text-secondary-foreground';
  };

  const getTypeIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      invoice_tokenization: 'FileText',
      funding_disbursement: 'ArrowDownCircle',
      milestone_verification: 'CheckCircle',
      settlement: 'CreditCard',
      audit: 'Search'
    };
    return iconMap[type] || 'Activity';
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp)?.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleHashScanClick = (transactionId: string): void => {
    // Open HashScan explorer in new tab
    window.open(`https://hashscan.io/testnet/transaction/${transactionId}`, '_blank');
  };

  // Transform transactions to proof format
  const transformToProofs = (transactions: Transaction[]) => {
    return transactions.map(tx => {
      let mappedStatus: 'confirmed' | 'pending' | 'failed';
      if (tx.status === 'processing') {
        mappedStatus = 'pending';
      } else if (tx.status === 'confirmed' || tx.status === 'pending' || tx.status === 'failed') {
        mappedStatus = tx.status;
      } else {
        mappedStatus = 'pending'; // fallback
      }

      return {
        id: tx.id,
        type: tx.type as ProofType,
        label: getProofLabel(tx.type),
        hashscanLink: tx.hashScanLink || `https://hashscan.io/testnet/transaction/${tx.id}`,
        status: mappedStatus,
        timestamp: tx.timestamp
      };
    });
  };

  const getProofLabel = (type: string): string => {
    const labelMap: Record<string, string> = {
      invoice_tokenization: 'Invoice NFT',
      funding_disbursement: 'Disbursement',
      milestone_verification: 'Milestone',
      settlement: 'Settlement',
      audit: 'Audit'
    };
    return labelMap[type] || 'Transaction';
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

        {/* Proof Pills and Cards */}
        <div className={`transition-smooth overflow-hidden ${
          isExpanded ? 'max-h-96' : 'max-h-48'
        }`}>
          <div className="p-4 max-h-full overflow-y-auto">
            {isExpanded ? (
              // Expanded view shows detailed ProofCards
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground mb-3">Recent Transactions</h4>
                {displayTransactions.map((tx) => (
                  <ProofCard
                    key={tx.id}
                    title={tx.description || getProofLabel(tx.type)}
                    description={`${tx.amount || ''} • ${getProofLabel(tx.type)}`}
                    hashScanLink={tx.hashScanLink || `https://hashscan.io/testnet/transaction/${tx.id}`}
                    mirrorNodeLink={tx.mirrorNodeLink || `https://testnet.mirrornode.hedera.com/api/v1/transactions/${tx.id}`}
                    transactionId={tx.id}
                    timestamp={tx.timestamp}
                    status={tx.status}
                    type={tx.type}
                  />
                ))}
              </div>
            ) : (
              // Collapsed view shows ProofPills
              <ProofPillGroup
                proofs={transformToProofs(displayTransactions)}
                title="Blockchain Proofs"
                size="default"
                maxVisible={4}
                className="space-y-3"
              />
            )}
            
            {/* Additional Info */}
            {displayTransactions?.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {displayTransactions?.filter(t => t?.status === 'confirmed')?.length} confirmed,{' '}
                    {displayTransactions?.filter(t => t?.status === 'pending')?.length} pending
                  </span>
                  <button
                    onClick={() => window.open('https://hashscan.io/testnet', '_blank')}
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    View on HashScan
                  </button>
                </div>
              </div>
            )}
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