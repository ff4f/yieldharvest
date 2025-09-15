import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const PortfolioSummary = ({ portfolioData, recentActivity = [] }) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const getActivityIcon = (type) => {
    const iconMap = {
      investment: 'TrendingUp',
      settlement: 'CheckCircle',
      milestone: 'Flag',
      withdrawal: 'ArrowDownCircle'
    };
    return iconMap?.[type] || 'Activity';
  };

  const getActivityColor = (type) => {
    const colorMap = {
      investment: 'text-primary',
      settlement: 'text-success',
      milestone: 'text-warning',
      withdrawal: 'text-accent'
    };
    return colorMap?.[type] || 'text-muted-foreground';
  };

  const defaultActivity = [
    {
      id: 1,
      type: 'investment',
      title: 'Funded Cocoa Export Deal',
      amount: '$25,000',
      timestamp: '2 hours ago',
      dealId: 'DEAL-001'
    },
    {
      id: 2,
      type: 'settlement',
      title: 'Settlement Received',
      amount: '$26,875',
      timestamp: '1 day ago',
      dealId: 'DEAL-003'
    },
    {
      id: 3,
      type: 'milestone',
      title: 'Milestone Completed',
      amount: '$5,000',
      timestamp: '2 days ago',
      dealId: 'DEAL-002'
    },
    {
      id: 4,
      type: 'investment',
      title: 'Funded Coffee Export Deal',
      amount: '$15,000',
      timestamp: '3 days ago',
      dealId: 'DEAL-004'
    }
  ];

  const displayActivity = recentActivity?.length > 0 ? recentActivity : defaultActivity;

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Portfolio Overview</h3>
          <Button variant="ghost" size="sm">
            <Icon name="MoreHorizontal" size={16} />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Invested</span>
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(portfolioData?.totalInvested || 485000)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Value</span>
            <span className="text-lg font-bold text-success">
              {formatCurrency(portfolioData?.currentValue || 512750)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Returns</span>
            <div className="flex items-center space-x-1">
              <span className="text-lg font-bold text-success">
                {formatCurrency(portfolioData?.totalReturns || 27750)}
              </span>
              <div className="flex items-center text-success">
                <Icon name="TrendingUp" size={14} />
                <span className="text-sm font-medium ml-1">+5.7%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Active Investments */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Active Investments</h3>
          <span className="text-sm text-muted-foreground">
            {portfolioData?.activeDeals || 8} deals
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="Package" size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Cocoa Export #001</p>
                <p className="text-xs text-muted-foreground">75% funded</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{formatCurrency(25000)}</p>
              <p className="text-xs text-success">12.5% APR</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                <Icon name="Coffee" size={16} className="text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Coffee Export #002</p>
                <p className="text-xs text-muted-foreground">Settlement pending</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{formatCurrency(15000)}</p>
              <p className="text-xs text-success">8.7% APR</p>
            </div>
          </div>
        </div>

        <Button variant="outline" fullWidth className="mt-4">
          View All Investments
        </Button>
      </div>
      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Recent Activity</h3>
          <Button variant="ghost" size="sm">
            <Icon name="ExternalLink" size={14} />
          </Button>
        </div>

        <div className="space-y-3">
          {displayActivity?.map((activity) => (
            <div key={activity?.id} className="flex items-center space-x-3 p-3 hover:bg-muted/50 rounded-lg transition-institutional">
              <div className={`w-8 h-8 bg-muted rounded-lg flex items-center justify-center ${getActivityColor(activity?.type)}`}>
                <Icon name={getActivityIcon(activity?.type)} size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{activity?.title}</p>
                <p className="text-xs text-muted-foreground">{activity?.timestamp}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{activity?.amount}</p>
                <p className="text-xs text-muted-foreground">{activity?.dealId}</p>
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" fullWidth className="mt-4">
          View All Activity
        </Button>
      </div>
    </div>
  );
};

export default PortfolioSummary;