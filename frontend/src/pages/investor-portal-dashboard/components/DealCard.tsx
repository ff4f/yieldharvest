import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const DealCard = ({ deal, onFundDeal }) => {
  const getRiskBadgeColor = (riskScore) => {
    const riskMap = {
      'A+': 'bg-success text-success-foreground',
      'A': 'bg-success text-success-foreground',
      'B+': 'bg-warning text-warning-foreground',
      'B': 'bg-warning text-warning-foreground',
      'C+': 'bg-error text-error-foreground',
      'C': 'bg-error text-error-foreground'
    };
    return riskMap?.[riskScore] || 'bg-secondary text-secondary-foreground';
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return 'bg-success';
    if (percentage >= 50) return 'bg-warning';
    return 'bg-primary';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const fundingPercentage = (deal?.raisedAmount / deal?.targetAmount) * 100;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)] transition-institutional hover:shadow-institutional">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-foreground">{deal?.title}</h3>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskBadgeColor(deal?.riskScore)}`}>
              {deal?.riskScore}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{deal?.description}</p>
        </div>
        <div className="flex items-center space-x-1 text-muted-foreground">
          <Icon name="MapPin" size={14} />
          <span className="text-xs">{deal?.location}</span>
        </div>
      </div>
      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Face Value</p>
          <p className="text-lg font-bold text-foreground">{formatCurrency(deal?.faceValue)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">APR</p>
          <p className="text-lg font-bold text-success">{deal?.apr}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tenor</p>
          <p className="text-sm font-medium text-foreground">{deal?.tenor} days</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Expected Yield</p>
          <p className="text-sm font-medium text-success">{formatCurrency(deal?.expectedYield)}</p>
        </div>
      </div>
      {/* Funding Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Funding Progress</span>
          <span className="text-sm text-muted-foreground">
            {formatCurrency(deal?.raisedAmount)} / {formatCurrency(deal?.targetAmount)}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(fundingPercentage)}`}
            style={{ width: `${Math.min(fundingPercentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{fundingPercentage?.toFixed(1)}% funded</span>
          <span>{deal?.investorCount} investors</span>
        </div>
      </div>
      {/* Deal Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${deal?.status === 'FUNDING_OPEN' ? 'bg-success animate-pulse' : 'bg-muted'}`} />
          <span className="text-sm font-medium text-foreground">
            {deal?.status === 'FUNDING_OPEN' ? 'Open for Funding' : 'Funded'}
          </span>
        </div>
        <div className="flex items-center space-x-1 text-muted-foreground">
          <Icon name="Clock" size={14} />
          <span className="text-xs">{deal?.timeRemaining}</span>
        </div>
      </div>
      {/* Action Buttons */}
      <div className="flex space-x-3">
        <Link to={`/deal-detail-view?id=${deal?.id}`} className="flex-1">
          <Button variant="outline" fullWidth iconName="Eye" iconPosition="left">
            View Details
          </Button>
        </Link>
        <Button
          variant="default"
          onClick={() => onFundDeal(deal)}
          disabled={deal?.status !== 'FUNDING_OPEN'}
          iconName="DollarSign"
          iconPosition="left"
          className="flex-1"
        >
          Fund Deal
        </Button>
      </div>
      {/* Proof Links */}
      {(deal?.hashScanLink || deal?.mirrorNodeLink) && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center space-x-2 mb-2">
            <Icon name="Shield" size={14} className="text-blue-600" />
            <span className="text-sm font-medium text-foreground">On-Chain Verification</span>
          </div>
          <div className="flex space-x-2">
            {deal?.hashScanLink && (
              <a
                href={deal.hashScanLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-xs"
              >
                <Icon name="ExternalLink" size={12} />
                <span>HashScan</span>
              </a>
            )}
            {deal?.mirrorNodeLink && (
              <a
                href={deal.mirrorNodeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 px-2 py-1 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors text-xs"
              >
                <Icon name="Database" size={12} />
                <span>Mirror Node</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="flex items-center space-x-4 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Icon name="FileText" size={12} />
            <span>NFT #{deal?.nftId}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Icon name="Shield" size={12} />
            <span>Verified</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Listed {deal?.listedDate}
        </div>
      </div>
    </div>
  );
};

export default DealCard;