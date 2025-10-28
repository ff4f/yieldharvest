import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from './AppIcon';
import Button from './ui/Button';
import Input from './ui/Input';
import { useWallet } from '@/contexts/WalletContext';
import { apiClient } from '../services/api';
import { toast } from 'react-hot-toast';

interface WalletFundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoiceNumber: string;
    amount: number;
    supplierAccountId: string;
    nftSerialNumber?: number;
  };
  onSuccess?: (result: any) => void;
}

interface FundingResult {
  funding: any;
  escrowId: string;
  transactionHash: string;
  hcsMessageId?: string;
  proofLinks: {
    transaction: string;
    contract: string;
    mirrorNode?: string;
  };
}

const WalletFundingModal: React.FC<WalletFundingModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onSuccess
}) => {
  const [fundingAmount, setFundingAmount] = useState('');
  const [step, setStep] = useState<'input' | 'confirm' | 'processing' | 'success' | 'error'>('input');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FundingResult | null>(null);
  
  const { isConnected, accountId, signTransaction } = useWallet();
  const queryClient = useQueryClient();

  // Prepare transaction mutation
  const prepareTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/fundings/wallet/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to prepare transaction');
      return response.json();
    },
  });

  // Submit transaction mutation
  const submitTransactionMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/fundings/wallet/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to submit transaction');
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data.data);
      setStep('success');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['fundings'] });
      if (onSuccess) onSuccess(data.data);
    },
    onError: (error: any) => {
      setError(error.message || 'Transaction failed');
      setStep('error');
    },
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    setFundingAmount(value);
  };

  const handleContinue = () => {
    if (step === 'input' && fundingAmount && parseFloat(fundingAmount) > 0) {
      setStep('confirm');
    }
  };

  const handleConfirm = async () => {
    if (!isConnected || !accountId) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      setStep('processing');
      setError(null);

      // Step 1: Prepare transaction
      const prepareData = {
        invoiceId: invoice.id,
        investorId: accountId, // Using wallet account as investor ID
        amount: fundingAmount,
        supplierAccountId: invoice.supplierAccountId,
        nftSerialNumber: invoice.nftSerialNumber || 1,
        walletAccountId: accountId,
      };

      const preparedTx = await prepareTransactionMutation.mutateAsync(prepareData);

      // Step 2: Sign transaction with wallet
      const signedTxBytes = await signTransaction(preparedTx.data.transactionBytes);

      // Step 3: Submit signed transaction
      const submitData = {
        ...prepareData,
        signedTransactionBytes: signedTxBytes,
      };

      await submitTransactionMutation.mutateAsync(submitData);
    } catch (error: any) {
      console.error('Funding error:', error);
      setError(error.message || 'Failed to process funding');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('input');
    setFundingAmount('');
    setError(null);
    setResult(null);
    onClose();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const fundingAmountNum = parseFloat(fundingAmount) || 0;
  const isValidAmount = fundingAmountNum > 0 && fundingAmountNum <= invoice.amount;

  if (!isOpen) return null;

  const renderInputStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="DollarSign" size={32} className="text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Fund Invoice</h3>
        <p className="text-muted-foreground">
          Enter the amount you want to invest in this invoice
        </p>
      </div>

      <div className="bg-muted/30 rounded-xl p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Invoice:</span>
          <span className="font-medium text-foreground">{invoice.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total Amount:</span>
          <span className="font-medium text-foreground">{formatCurrency(invoice.amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Your Wallet:</span>
          <span className="font-medium text-foreground text-sm">{accountId || 'Not connected'}</span>
        </div>
      </div>

      <div>
        <Input
          label="Funding Amount (HBAR)"
          type="text"
          placeholder="Enter amount"
          value={fundingAmount}
          onChange={handleAmountChange}
          description={`Maximum: ${formatCurrency(invoice.amount)}`}
          error={fundingAmount && !isValidAmount ? 'Invalid amount' : undefined}
          data-testid="funding-amount-input"
        />
      </div>

      {!isConnected && (
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Icon name="AlertTriangle" size={16} className="text-warning" />
            <span className="text-sm text-warning">Please connect your wallet to continue</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="CheckCircle" size={32} className="text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Confirm Funding</h3>
        <p className="text-muted-foreground">
          Review your funding details before proceeding
        </p>
      </div>

      <div className="bg-muted/30 rounded-xl p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Invoice:</span>
          <span className="font-medium text-foreground">{invoice.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Funding Amount:</span>
          <span className="font-bold text-foreground">{formatCurrency(fundingAmountNum)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Your Wallet:</span>
          <span className="font-medium text-foreground text-sm">{accountId}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-3">
          <span className="text-muted-foreground">Transaction Type:</span>
          <span className="font-medium text-foreground">Escrow Deposit</span>
        </div>
      </div>

      <div className="bg-info/10 border border-info/20 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Icon name="Info" size={16} className="text-info mt-0.5" />
          <div className="text-sm text-info">
            <p className="font-medium mb-1">Escrow Protection</p>
            <p>Your funds will be held in a smart contract escrow until the invoice is paid or released.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Processing Transaction</h3>
        <p className="text-muted-foreground mb-4">
          Your funding transaction is being processed on the Hedera network
        </p>
        <div className="bg-muted/30 rounded-xl p-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {prepareTransactionMutation.isPending && 'Preparing transaction...'}
              {submitTransactionMutation.isPending && 'Submitting to Hedera...'}
            </span>
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
        <h3 className="text-xl font-semibold text-foreground mb-2">Funding Successful!</h3>
        <p className="text-muted-foreground">
          Your funding of {formatCurrency(fundingAmountNum)} has been processed successfully
        </p>
      </div>
      
      {result && (
        <div className="space-y-4">
          <div className="bg-success/10 border border-success/20 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Transaction Hash:</span>
              <span className="font-mono text-xs text-foreground">{result.transactionHash.slice(0, 16)}...</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Escrow ID:</span>
              <span className="font-mono text-xs text-foreground">{result.escrowId}</span>
            </div>
            {result.hcsMessageId && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">HCS Message:</span>
                <span className="font-mono text-xs text-foreground">{result.hcsMessageId}</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col space-y-2">
            <a
              href={result.proofLinks.transaction}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Icon name="ExternalLink" size={16} />
              <span>View on HashScan</span>
            </a>
            <a
              href={result.proofLinks.contract}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Icon name="FileText" size={16} />
              <span>View Escrow Contract</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );

  const renderErrorStep = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
        <Icon name="XCircle" size={32} className="text-error" />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Transaction Failed</h3>
        <p className="text-muted-foreground mb-4">
          Your funding transaction could not be processed
        </p>
        {error && (
          <div className="bg-error/10 border border-error/20 rounded-lg p-4">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-institutional max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            {step === 'input' && 'Fund Invoice'}
            {step === 'confirm' && 'Confirm Funding'}
            {step === 'processing' && 'Processing'}
            {step === 'success' && 'Success'}
            {step === 'error' && 'Error'}
          </h2>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClose}
            disabled={step === 'processing'}
          >
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'input' && renderInputStep()}
          {step === 'confirm' && renderConfirmStep()}
          {step === 'processing' && renderProcessingStep()}
          {step === 'success' && renderSuccessStep()}
          {step === 'error' && renderErrorStep()}
        </div>

        {/* Footer */}
        {(step === 'input' || step === 'confirm' || step === 'error') && (
          <div className="flex space-x-3 p-6 border-t border-border">
            <Button
              variant="outline"
              onClick={step === 'confirm' ? () => setStep('input') : handleClose}
              fullWidth
              disabled={step === 'processing'}
            >
              {step === 'confirm' ? 'Back' : step === 'error' ? 'Close' : 'Cancel'}
            </Button>
            {step === 'input' && (
              <Button
                variant="default"
                onClick={handleContinue}
                disabled={!isConnected || !isValidAmount}
                fullWidth
                data-testid="funding-continue-button"
              >
                Continue
              </Button>
            )}
            {step === 'confirm' && (
              <Button
                variant="default"
                onClick={handleConfirm}
                disabled={!isConnected}
                fullWidth
                data-testid="funding-confirm-button"
              >
                Confirm & Sign
              </Button>
            )}
            {step === 'error' && (
              <Button
                variant="default"
                onClick={() => setStep('input')}
                fullWidth
              >
                Try Again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletFundingModal;