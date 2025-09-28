import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const FundingWidget = ({ deal, onFund }) => {
  const [fundingAmount, setFundingAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const calculateYield = (amount) => {
    if (!amount || isNaN(amount)) return 0;
    const principal = parseFloat(amount);
    const rate = deal?.apr / 100;
    const time = deal?.tenor / 365;
    return principal * rate * time;
  };

  const handleFundingSubmit = async () => {
    if (!fundingAmount || parseFloat(fundingAmount) < deal?.minInvestment) return;
    
    setIsLoading(true);
    try {
      await onFund(parseFloat(fundingAmount));
    } catch (error) {
      console.error('Funding failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const expectedYield = calculateYield(fundingAmount);
  const totalReturn = parseFloat(fundingAmount || 0) + expectedYield;
  const remainingAmount = deal?.targetAmount - deal?.raisedAmount;
  const maxInvestment = Math.min(deal?.maxInvestment, remainingAmount);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)] sticky top-24">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Fund This Deal</h3>
        <div className={`w-3 h-3 rounded-full ${deal?.status === 'FUNDING_OPEN' ? 'bg-success animate-pulse' : 'bg-muted'}`} />
      </div>
      {deal?.status === 'FUNDING_OPEN' ? (
        <div className="space-y-6">
          {/* Investment Amount Input */}
          <div>
            <Input
              label="Investment Amount"
              type="number"
              placeholder={`Min: $${deal?.minInvestment?.toLocaleString()}`}
              value={fundingAmount}
              onChange={(e) => setFundingAmount(e?.target?.value)}
              min={deal?.minInvestment}
              max={maxInvestment}
              description={`Available: $${remainingAmount?.toLocaleString()}`}
            />
          </div>

          {/* Yield Calculator */}
          {fundingAmount && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <h4 className="font-medium text-foreground flex items-center">
                <Icon name="Calculator" size={16} className="mr-2" />
                Expected Returns
              </h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Principal</span>
                  <span className="text-sm font-medium text-foreground">
                    ${parseFloat(fundingAmount)?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Expected Yield</span>
                  <span className="text-sm font-medium text-success">
                    ${expectedYield?.toLocaleString()}
                  </span>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-foreground">Total Return</span>
                    <span className="font-semibold text-primary">
                      ${totalReturn?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Investment Terms */}
          <div className="bg-muted/30 rounded-xl p-4">
            <h4 className="font-medium text-foreground mb-3">Investment Terms</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">APR</span>
                <span className="font-medium text-success">{deal?.apr}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenor</span>
                <span className="font-medium text-foreground">{deal?.tenor} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Settlement</span>
                <span className="font-medium text-foreground">
                  {new Date(deal.settlementDate)?.toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Fund Button */}
          <Button
            variant="default"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={!fundingAmount || parseFloat(fundingAmount) < deal?.minInvestment || parseFloat(fundingAmount) > maxInvestment}
            onClick={handleFundingSubmit}
            iconName="TrendingUp"
            iconPosition="left"
          >
            {isLoading ? 'Processing...' : 'Fund This Deal'}
          </Button>

          {/* Investment Limits */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Minimum investment: ${deal?.minInvestment?.toLocaleString()}</p>
            <p>• Maximum investment: ${maxInvestment?.toLocaleString()}</p>
            <p>• Remaining capacity: ${remainingAmount?.toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Icon name="CheckCircle" size={48} className="text-success mx-auto mb-4" />
          <h4 className="font-semibold text-foreground mb-2">Deal Fully Funded</h4>
          <p className="text-sm text-muted-foreground">
            This deal has reached its funding target and is no longer accepting investments.
          </p>
        </div>
      )}
    </div>
  );
};

export default FundingWidget;