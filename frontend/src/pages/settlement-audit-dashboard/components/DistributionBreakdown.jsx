import React from 'react';
import Icon from '../../../components/AppIcon';

const DistributionBreakdown = () => {
  const distributionData = [
    {
      recipient: "Investors",
      percentage: 85,
      amount: "$212,500",
      color: "bg-primary",
      icon: "TrendingUp"
    },
    {
      recipient: "Operators",
      percentage: 10,
      amount: "$25,000",
      color: "bg-accent",
      icon: "Settings"
    },
    {
      recipient: "Platform",
      percentage: 5,
      amount: "$12,500",
      color: "bg-secondary",
      icon: "Zap"
    }
  ];

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-institutional mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Settlement Distribution (85/10/5)</h3>
        <div className="text-sm text-muted-foreground">Next Settlement: $250,000</div>
      </div>
      <div className="space-y-4">
        {distributionData?.map((item, index) => (
          <div key={index} className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
              <Icon name={item?.icon} size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{item?.recipient}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-foreground">{item?.amount}</span>
                  <span className="text-xs text-muted-foreground">({item?.percentage}%)</span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className={`${item?.color} h-2 rounded-full transition-smooth`}
                  style={{ width: `${item?.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Icon name="Info" size={16} />
          <span>Automated settlement execution occurs every 48 hours for completed deals</span>
        </div>
      </div>
    </div>
  );
};

export default DistributionBreakdown;