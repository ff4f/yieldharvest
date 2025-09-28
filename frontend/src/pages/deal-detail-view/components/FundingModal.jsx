import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const FundingModal = ({ isOpen, onClose, deal, fundingAmount, onConfirm }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState('confirm'); // confirm, processing, success, error

  const handleConfirm = async () => {
    setStep('processing');
    setIsProcessing(true);
    
    try {
      // Simulate HTS transaction processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock transaction hash
      const mockTxHash = '0x' + Math.random()?.toString(16)?.substr(2, 16);
      
      setStep('success');
      setTimeout(() => {
        onConfirm(mockTxHash);
        onClose();
        setStep('confirm');
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      setStep('error');
      setIsProcessing(false);
    }
  };

  const calculateYield = () => {
    const principal = parseFloat(fundingAmount);
    const rate = deal?.apr / 100;
    const time = deal?.tenor / 365;
    return principal * rate * time;
  };

  const expectedYield = calculateYield();
  const totalReturn = parseFloat(fundingAmount) + expectedYield;

  if (!isOpen) return null;

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="TrendingUp" size={32} className="text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Confirm Investment</h3>
        <p className="text-muted-foreground">
          Review your investment details before proceeding
        </p>
      </div>

      <div className="bg-muted/30 rounded-xl p-6 space-y-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Deal</span>
          <span className="font-medium text-foreground">{deal?.title}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Investment Amount</span>
          <span className="font-semibold text-foreground">${parseFloat(fundingAmount)?.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">APR</span>
          <span className="font-medium text-success">{deal?.apr}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tenor</span>
          <span className="font-medium text-foreground">{deal?.tenor} days</span>
        </div>
        <div className="border-t border-border pt-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Expected Yield</span>
            <span className="font-medium text-success">${expectedYield?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span className="font-semibold text-foreground">Total Return</span>
            <span className="font-bold text-primary">${totalReturn?.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <Icon name="AlertTriangle" size={20} className="text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-warning mb-1">Investment Risk Notice</h4>
            <p className="text-sm text-muted-foreground">
              This investment carries risk. Returns are not guaranteed and depend on successful milestone completion and settlement.
            </p>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={onClose}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          variant="default"
          size="lg"
          fullWidth
          onClick={handleConfirm}
          loading={isProcessing}
          iconName="Check"
          iconPosition="left"
        >
          Confirm Investment
        </Button>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Processing Investment</h3>
        <p className="text-muted-foreground mb-4">
          Your transaction is being processed on the Hedera network
        </p>
        <div className="bg-muted/30 rounded-xl p-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Executing HTS transfer...</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
        <Icon name="CheckCircle" size={32} className="text-success" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Investment Successful!</h3>
        <p className="text-muted-foreground">
          Your investment of ${parseFloat(fundingAmount)?.toLocaleString()} has been processed successfully
        </p>
      </div>
      <div className="bg-success/10 border border-success/20 rounded-xl p-4">
        <div className="flex items-center justify-center space-x-2">
          <Icon name="ExternalLink" size={16} className="text-success" />
          <span className="text-sm text-success font-medium">Transaction confirmed on Hedera</span>
        </div>
      </div>
    </div>
  );

  const renderErrorStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
        <Icon name="XCircle" size={32} className="text-error" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Transaction Failed</h3>
        <p className="text-muted-foreground">
          Your investment could not be processed. Please try again.
        </p>
      </div>
      <div className="flex space-x-3">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          onClick={onClose}
        >
          Close
        </Button>
        <Button
          variant="default"
          size="lg"
          fullWidth
          onClick={() => setStep('confirm')}
        >
          Try Again
        </Button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-institutional max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {step === 'confirm' && renderConfirmStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'success' && renderSuccessStep()}
          {step === 'error' && renderErrorStep()}
        </div>
      </div>
    </div>
  );
};

export default FundingModal;