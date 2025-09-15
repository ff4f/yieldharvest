import React, { useState, useEffect } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const NFTMintingForm = ({ formData, documents, onComplete, onPrevious }) => {
  const [mintingStatus, setMintingStatus] = useState('idle'); // idle, minting, completed, error
  const [transactionHash, setTransactionHash] = useState('');
  const [nftTokenId, setNftTokenId] = useState('');
  const [mintingProgress, setMintingProgress] = useState(0);

  const mintingSteps = [
    { id: 1, label: 'Preparing metadata', status: 'pending' },
    { id: 2, label: 'Creating HTS token', status: 'pending' },
    { id: 3, label: 'Minting NFT', status: 'pending' },
    { id: 4, label: 'Updating registry', status: 'pending' }
  ];

  const [stepStatuses, setStepStatuses] = useState(
    mintingSteps?.reduce((acc, step) => ({ ...acc, [step?.id]: 'pending' }), {})
  );

  const simulateMinting = async () => {
    setMintingStatus('minting');
    
    const steps = [1, 2, 3, 4];
    for (let i = 0; i < steps?.length; i++) {
      const stepId = steps?.[i];
      
      // Update step to processing
      setStepStatuses(prev => ({ ...prev, [stepId]: 'processing' }));
      setMintingProgress((i + 0.5) * 25);
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
      
      // Complete step
      setStepStatuses(prev => ({ ...prev, [stepId]: 'completed' }));
      setMintingProgress((i + 1) * 25);
    }

    // Generate mock transaction data
    const mockTxHash = `0x${Math.random()?.toString(16)?.substr(2, 64)}`;
    const mockTokenId = `0.0.${Math.floor(Math.random() * 1000000)}`;
    
    setTransactionHash(mockTxHash);
    setNftTokenId(mockTokenId);
    setMintingStatus('completed');
  };

  const calculateExpectedYield = () => {
    const faceValue = formData?.faceValue || 0;
    const apr = formData?.apr || 0;
    const tenor = parseInt(formData?.tenor) || 30;
    
    return (faceValue * (apr / 100) * (tenor / 365))?.toFixed(2);
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return <Icon name="CheckCircle" size={16} className="text-success" />;
      case 'processing':
        return <Icon name="Loader2" size={16} className="text-primary animate-spin" />;
      default:
        return <Icon name="Circle" size={16} className="text-muted-foreground" />;
    }
  };

  const ProofPill = ({ type, hash, label }) => {
    const getTypeColor = (type) => {
      switch (type) {
        case 'HTS':
          return 'bg-primary text-primary-foreground';
        case 'HCS':
          return 'bg-accent text-accent-foreground';
        default:
          return 'bg-muted text-muted-foreground';
      }
    };

    return (
      <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-mono ${getTypeColor(type)}`}>
        <Icon name="Zap" size={12} className="mr-1" />
        <span className="mr-2">{type}</span>
        <span className="truncate max-w-24">{hash?.slice(0, 8)}...{hash?.slice(-8)}</span>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-2">NFT Minting</h2>
        <p className="text-muted-foreground">Tokenize your invoice as an NFT on Hedera Token Service</p>
      </div>
      {/* Invoice Summary */}
      <div className="bg-muted/30 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
          <Icon name="FileText" size={20} className="mr-2 text-primary" />
          Invoice Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Invoice Number</p>
            <p className="font-medium text-foreground">{formData?.invoiceNumber}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Face Value</p>
            <p className="font-medium text-foreground">${formData?.faceValue?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">APR</p>
            <p className="font-medium text-foreground">{formData?.apr}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expected Yield</p>
            <p className="font-medium text-success">${calculateExpectedYield()}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-2">Attached Documents</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(documents)?.map(([key, doc]) => (
              <div key={key} className="flex items-center space-x-2 bg-background px-3 py-1 rounded-full">
                <Icon name="FileText" size={14} className="text-muted-foreground" />
                <span className="text-sm text-foreground">{doc?.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Minting Process */}
      {mintingStatus === 'idle' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="Coins" size={32} className="text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Ready to Mint NFT</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Your invoice will be tokenized as an NFT on Hedera Token Service, making it available for funding.
          </p>
          <Button
            variant="default"
            size="lg"
            onClick={simulateMinting}
            iconName="Zap"
            iconPosition="left"
            className="px-8"
          >
            Start Minting Process
          </Button>
        </div>
      )}
      {mintingStatus === 'minting' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-foreground mb-2">Minting in Progress</h3>
            <p className="text-muted-foreground">Please wait while we tokenize your invoice...</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">Overall Progress</span>
              <span className="text-muted-foreground">{Math.round(mintingProgress)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3">
              <div 
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${mintingProgress}%` }}
              />
            </div>
          </div>

          {/* Step Progress */}
          <div className="space-y-3">
            {mintingSteps?.map((step) => (
              <div key={step?.id} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                {getStepIcon(stepStatuses?.[step?.id])}
                <span className={`flex-1 ${
                  stepStatuses?.[step?.id] === 'completed' ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step?.label}
                </span>
                {stepStatuses?.[step?.id] === 'processing' && (
                  <span className="text-xs text-primary font-medium">Processing...</span>
                )}
                {stepStatuses?.[step?.id] === 'completed' && (
                  <span className="text-xs text-success font-medium">Complete</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {mintingStatus === 'completed' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckCircle" size={32} className="text-success" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">NFT Successfully Minted!</h3>
            <p className="text-muted-foreground">Your invoice has been tokenized and is now available for funding.</p>
          </div>

          {/* Transaction Details */}
          <div className="bg-muted/30 rounded-lg p-6">
            <h4 className="font-medium text-foreground mb-4">Transaction Details</h4>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">NFT Token ID:</span>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-sm text-foreground">{nftTokenId}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard?.writeText(nftTokenId)}
                  >
                    <Icon name="Copy" size={14} />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Transaction Hash:</span>
                <div className="flex items-center space-x-2">
                  <ProofPill type="HTS" hash={transactionHash} label="Transaction Hash" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`https://hashscan.io/mainnet/transaction/${transactionHash}`, '_blank')}
                  >
                    <Icon name="ExternalLink" size={14} />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Minted At:</span>
                <span className="text-sm text-foreground">
                  {new Date()?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
            <h4 className="font-medium text-foreground mb-2 flex items-center">
              <Icon name="Info" size={16} className="mr-2 text-primary" />
              What's Next?
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Your invoice NFT is now listed for investor funding</li>
              <li>• You'll receive notifications when funding milestones are reached</li>
              <li>• Track your deal progress in the Supplier Dashboard</li>
              <li>• Funds will be disbursed based on milestone completion</li>
            </ul>
          </div>
        </div>
      )}
      {/* Action Buttons */}
      <div className="flex justify-between mt-8 pt-6 border-t border-border">
        {mintingStatus !== 'minting' && (
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={mintingStatus === 'minting'}
            iconName="ArrowLeft"
            iconPosition="left"
          >
            Previous
          </Button>
        )}
        
        {mintingStatus === 'completed' && (
          <Button
            variant="default"
            onClick={onComplete}
            iconName="BarChart3"
            iconPosition="right"
            className="px-8 ml-auto"
          >
            View Dashboard
          </Button>
        )}
      </div>
    </div>
  );
};

export default NFTMintingForm;