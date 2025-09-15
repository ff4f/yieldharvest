import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const FundDealModal = ({ isOpen, onClose, deal, onConfirmFunding }) => {
  const [fundingAmount, setFundingAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1); // 1: Amount, 2: Confirmation, 3: Processing

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const handleAmountChange = (e) => {
    const value = e?.target?.value?.replace(/[^0-9]/g, '');
    setFundingAmount(value);
  };

  const handleContinue = () => {
    if (step === 1 && fundingAmount && parseInt(fundingAmount) > 0) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
      setIsProcessing(true);
      
      // Simulate HTS transaction processing
      setTimeout(() => {
        setIsProcessing(false);
        onConfirmFunding({
          dealId: deal?.id,
          amount: parseInt(fundingAmount),
          transactionHash: '0x' + Math.random()?.toString(16)?.substr(2, 8)
        });
        handleClose();
      }, 3000);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFundingAmount('');
    setIsProcessing(false);
    onClose();
  };

  const remainingAmount = deal ? deal?.targetAmount - deal?.raisedAmount : 0;
  const fundingAmountNum = parseInt(fundingAmount) || 0;
  const estimatedYield = fundingAmountNum * (deal?.apr || 0) / 100 * (deal?.tenor || 0) / 365;

  if (!isOpen || !deal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-institutional max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">
            {step === 1 ? 'Fund Deal' : step === 2 ? 'Confirm Funding' : 'Processing Transaction'}
          </h2>
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isProcessing}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step 1: Amount Input */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Deal Summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-2">{deal?.title}</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">APR:</span>
                    <span className="font-medium text-success ml-2">{deal?.apr}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tenor:</span>
                    <span className="font-medium text-foreground ml-2">{deal?.tenor} days</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Remaining:</span>
                    <span className="font-medium text-foreground ml-2">{formatCurrency(remainingAmount)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Risk:</span>
                    <span className="font-medium text-foreground ml-2">{deal?.riskScore}</span>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <Input
                  label="Funding Amount"
                  type="text"
                  placeholder="Enter amount in USD"
                  value={fundingAmount ? formatCurrency(parseInt(fundingAmount)) : ''}
                  onChange={handleAmountChange}
                  description={`Minimum: $1,000 • Available: ${formatCurrency(remainingAmount)}`}
                />
              </div>

              {/* Estimated Returns */}
              {fundingAmountNum > 0 && (
                <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                  <h4 className="font-medium text-success mb-2">Estimated Returns</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Investment:</span>
                      <span className="font-medium text-foreground">{formatCurrency(fundingAmountNum)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Yield:</span>
                      <span className="font-medium text-success">{formatCurrency(estimatedYield)}</span>
                    </div>
                    <div className="flex justify-between border-t border-success/20 pt-2">
                      <span className="font-medium text-foreground">Total Return:</span>
                      <span className="font-bold text-success">{formatCurrency(fundingAmountNum + estimatedYield)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Confirmation */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="DollarSign" size={32} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Confirm Your Investment</h3>
                <p className="text-muted-foreground">Please review your investment details before proceeding</p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deal:</span>
                  <span className="font-medium text-foreground">{deal?.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Investment Amount:</span>
                  <span className="font-bold text-foreground">{formatCurrency(fundingAmountNum)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expected Yield:</span>
                  <span className="font-medium text-success">{formatCurrency(estimatedYield)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-3">
                  <span className="font-medium text-foreground">Total Expected Return:</span>
                  <span className="font-bold text-success">{formatCurrency(fundingAmountNum + estimatedYield)}</span>
                </div>
              </div>

              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Icon name="AlertTriangle" size={16} className="text-warning mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-warning mb-1">Investment Risk Notice</p>
                    <p className="text-muted-foreground">
                      This investment carries risk. Returns are not guaranteed and depend on successful deal completion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {step === 3 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Icon name="Loader" size={32} className="text-primary animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Processing Transaction</h3>
                <p className="text-muted-foreground">
                  Your investment is being processed on the Hedera network. This may take a few moments.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span>Executing HTS transfer...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 3 && (
          <div className="flex space-x-3 p-6 border-t border-border">
            <Button
              variant="outline"
              onClick={step === 1 ? handleClose : () => setStep(1)}
              fullWidth
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            <Button
              variant="default"
              onClick={handleContinue}
              disabled={step === 1 && (!fundingAmount || parseInt(fundingAmount) < 1000)}
              fullWidth
            >
              {step === 1 ? 'Continue' : 'Confirm Investment'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FundDealModal;