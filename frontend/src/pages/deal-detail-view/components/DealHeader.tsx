import React from 'react';


const DealHeader = ({ deal }) => {
  const getRiskBadgeColor = (score) => {
    if (score >= 8) return 'bg-success text-success-foreground';
    if (score >= 6) return 'bg-warning text-warning-foreground';
    return 'bg-error text-error-foreground';
  };

  const getRiskLabel = (score) => {
    if (score >= 8) return 'Low Risk';
    if (score >= 6) return 'Medium Risk';
    return 'High Risk';
  };

  const fundingPercentage = (deal?.raisedAmount / deal?.targetAmount) * 100;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Deal Overview */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-2xl font-semibold text-foreground">{deal?.title}</h1>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskBadgeColor(deal?.riskScore)}`}>
              {getRiskLabel(deal?.riskScore)} ({deal?.riskScore}/10)
            </div>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Face Value</p>
              <p className="text-lg font-semibold text-foreground">${deal?.faceValue?.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">APR</p>
              <p className="text-lg font-semibold text-success">{deal?.apr}%</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tenor</p>
              <p className="text-lg font-semibold text-foreground">{deal?.tenor} days</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expected Yield</p>
              <p className="text-lg font-semibold text-primary">${deal?.expectedYield?.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${deal?.status === 'FUNDING_OPEN' ? 'bg-success animate-pulse' : 'bg-muted'}`} />
          <span className="text-sm font-medium text-foreground">
            {deal?.status === 'FUNDING_OPEN' ? 'Open for Funding' : 'Fully Funded'}
          </span>
        </div>
      </div>
      {/* Funding Progress */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Funding Progress</span>
          <span className="text-sm text-muted-foreground">
            ${deal?.raisedAmount?.toLocaleString()} / ${deal?.targetAmount?.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div 
            className="bg-primary h-3 rounded-full transition-smooth"
            style={{ width: `${Math.min(fundingPercentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-muted-foreground">0%</span>
          <span className="text-xs font-medium text-primary">{fundingPercentage?.toFixed(1)}%</span>
          <span className="text-xs text-muted-foreground">100%</span>
        </div>
      </div>
    </div>
  );
};

export default DealHeader;