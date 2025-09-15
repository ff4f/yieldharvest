import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const AuditVerificationTools = () => {
  const [merkleProof, setMerkleProof] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const quickAccessLinks = [
    {
      title: "HashScan Explorer",
      description: "View all transactions",
      icon: "ExternalLink",
      url: "https://hashscan.io/mainnet"
    },
    {
      title: "HCS Topic Browser",
      description: "Browse consensus messages",
      icon: "MessageSquare",
      url: "https://hashscan.io/mainnet/topics"
    },
    {
      title: "Network Status",
      description: "Check network health",
      icon: "Activity",
      url: "https://status.hedera.com"
    }
  ];

  const recentActivity = [
    {
      type: "settlement",
      message: "Settlement completed for DEAL-2025-001",
      timestamp: "2025-08-25T18:30:00Z",
      status: "success"
    },
    {
      type: "milestone",
      message: "Milestone 8 verified for DEAL-2025-002",
      timestamp: "2025-08-25T18:25:00Z",
      status: "success"
    },
    {
      type: "audit",
      message: "Audit trail generated for DEAL-2025-003",
      timestamp: "2025-08-25T18:20:00Z",
      status: "success"
    },
    {
      type: "funding",
      message: "Funding disbursement initiated",
      timestamp: "2025-08-25T18:15:00Z",
      status: "pending"
    }
  ];

  const handleVerifyProof = async () => {
    if (!merkleProof?.trim()) return;

    setIsVerifying(true);
    
    // Simulate verification process
    setTimeout(() => {
      const isValid = merkleProof?.startsWith('0x') && merkleProof?.length === 66;
      setVerificationResult({
        isValid,
        message: isValid 
          ? "Merkle proof verified successfully. All transactions are authentic."
          : "Invalid proof format. Please check the Merkle root hash."
      });
      setIsVerifying(false);
    }, 2000);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp)?.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActivityIcon = (type) => {
    const iconMap = {
      settlement: 'CheckCircle',
      milestone: 'Target',
      audit: 'Search',
      funding: 'ArrowDownCircle'
    };
    return iconMap?.[type] || 'Activity';
  };

  const getStatusColor = (status) => {
    const colorMap = {
      success: 'text-success',
      pending: 'text-warning',
      error: 'text-error'
    };
    return colorMap?.[status] || 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Verification Tools */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-institutional">
        <h3 className="text-lg font-semibold text-foreground mb-4">Merkle Proof Verification</h3>
        
        <div className="space-y-4">
          <Input
            label="Merkle Root Hash"
            type="text"
            placeholder="0x..."
            value={merkleProof}
            onChange={(e) => setMerkleProof(e?.target?.value)}
            description="Enter the Merkle root hash to verify audit trail integrity"
          />
          
          <Button
            onClick={handleVerifyProof}
            disabled={!merkleProof?.trim() || isVerifying}
            loading={isVerifying}
            className="w-full"
          >
            <Icon name="Shield" size={16} className="mr-2" />
            Verify Proof
          </Button>

          {verificationResult && (
            <div className={`p-4 rounded-lg border ${
              verificationResult?.isValid 
                ? 'bg-success/10 border-success text-success' :'bg-error/10 border-error text-error'
            }`}>
              <div className="flex items-center space-x-2">
                <Icon 
                  name={verificationResult?.isValid ? 'CheckCircle' : 'XCircle'} 
                  size={16} 
                />
                <span className="text-sm font-medium">{verificationResult?.message}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Quick Access */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-institutional">
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Access</h3>
        
        <div className="space-y-3">
          {quickAccessLinks?.map((link, index) => (
            <button
              key={index}
              onClick={() => window.open(link?.url, '_blank')}
              className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-institutional group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Icon name={link?.icon} size={16} className="text-primary" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-foreground">{link?.title}</div>
                  <div className="text-xs text-muted-foreground">{link?.description}</div>
                </div>
              </div>
              <Icon name="ChevronRight" size={16} className="text-muted-foreground group-hover:text-primary transition-institutional" />
            </button>
          ))}
        </div>
      </div>
      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-institutional">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
            <span>Live</span>
          </div>
        </div>
        
        <div className="space-y-3">
          {recentActivity?.map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
              <div className="w-8 h-8 bg-background rounded-lg flex items-center justify-center">
                <Icon 
                  name={getActivityIcon(activity?.type)} 
                  size={16} 
                  className={getStatusColor(activity?.status)} 
                />
              </div>
              <div className="flex-1">
                <div className="text-sm text-foreground">{activity?.message}</div>
                <div className="text-xs text-muted-foreground">
                  {formatTimestamp(activity?.timestamp)}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${
                activity?.status === 'success' ? 'bg-success' : 
                activity?.status === 'pending' ? 'bg-warning pulse-gentle' : 'bg-error'
              }`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuditVerificationTools;