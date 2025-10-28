import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { api } from '../../../services/api';
import { useWallet } from '../../../contexts/WalletContext';
import { walletService } from '../../../services/walletService';

interface FundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal: any;
  fundingAmount: string;
  onConfirm: (txHash: string) => void;
}

const FundingModal: React.FC<FundingModalProps> = ({ isOpen, onClose, deal, fundingAmount, onConfirm }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { isConnected, accountId } = useWallet();

  const handleConfirm = async () => {
    if (!isConnected || !accountId) {
      setErrorMessage('Please connect your wallet first');
      setStep('error');
      return;
    }

    setStep('processing');
    setIsProcessing(true);
    setErrorMessage('');
    
    try {
      // Use real API to fund the invoice with wallet integration
      const fundingRequest = {
        invoiceId: deal.id,
        amount: parseFloat(fundingAmount),
        fundingType: 'FULL' as const,
        notes: `Investment funding for ${deal.title || deal.invoiceNumber}`,
        walletAccountId: accountId
      };

      const response = await api.funding.fundInvoice(fundingRequest);
      
      // If the response includes a transaction that needs to be signed
      if (response.transactionBytes) {
        // Sign the transaction with the connected wallet
        const signedTransaction = await walletService.signTransaction(response.transactionBytes);
        
        // Submit the signed transaction back to the API
        const submitResponse = await api.funding.submitSignedTransaction({
          transactionId: response.transactionId,
          signedTransaction: signedTransaction
        });
        
        setStep('success');
        setTimeout(() => {
          onConfirm(submitResponse.transactionHash || submitResponse.id);
          onClose();
          setStep('confirm');
          setIsProcessing(false);
        }, 2000);
      } else {
        // Direct funding without wallet signature (for demo purposes)
        setStep('success');
        setTimeout(() => {
          onConfirm(response.transactionHash || response.id);
          onClose();
          setStep('confirm');
          setIsProcessing(false);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Funding failed:', error);
      setErrorMessage(error.message || 'Failed to process funding transaction');
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
          {errorMessage || 'Your investment could not be processed. Please try again.'}
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