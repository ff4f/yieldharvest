import React from 'react';
import Icon from '../../../components/AppIcon';

const SettlementSummaryCards = () => {
  const summaryData = [
    {
      title: "Total Settlements",
      value: "$2,847,500",
      change: "+12.5%",
      changeType: "positive",
      icon: "CheckCircle",
      description: "Completed this month"
    },
    {
      title: "Pending Distributions",
      value: "$156,250",
      change: "3 deals",
      changeType: "neutral",
      icon: "Clock",
      description: "Awaiting settlement"
    },
    {
      title: "Next Settlement",
      value: "Aug 26, 2025",
      change: "2 days",
      changeType: "neutral",
      icon: "Calendar",
      description: "Scheduled distribution"
    },
    {
      title: "Platform Revenue",
      value: "$14,237",
      change: "+8.3%",
      changeType: "positive",
      icon: "TrendingUp",
      description: "5% platform fee"
    }
  ];

  const getChangeColor = (type) => {
    switch (type) {
      case 'positive':
        return 'text-success';
      case 'negative':
        return 'text-error';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {summaryData?.map((item, index) => (
        <div key={index} className="bg-card border border-border rounded-2xl p-6 shadow-institutional">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name={item?.icon} size={24} className="text-primary" />
            </div>
            <div className={`text-sm font-medium ${getChangeColor(item?.changeType)}`}>
              {item?.change}
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-foreground">{item?.value}</h3>
            <p className="text-sm font-medium text-foreground">{item?.title}</p>
            <p className="text-xs text-muted-foreground">{item?.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SettlementSummaryCards;