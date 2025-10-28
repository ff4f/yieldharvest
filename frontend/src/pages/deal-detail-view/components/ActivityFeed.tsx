import React from 'react';
import Icon from '../../../components/AppIcon';

const ActivityFeed = ({ activities }) => {
  const defaultActivities = [
    {
      id: 1,
      type: 'milestone_completed',
      title: 'Port Out Milestone Completed',
      description: 'Milestone 3 verified and 25% of funds released',
      amount: '$31,250',
      timestamp: '2025-08-25T16:30:00Z',
      txHash: '0x1a2b3c4d5e6f7890',
      user: 'Settlement Agent'
    },
    {
      id: 2,
      type: 'investment',
      title: 'New Investment',
      description: 'Investor funded this deal',
      amount: '$15,000',
      timestamp: '2025-08-25T14:15:00Z',
      txHash: '0x2b3c4d5e6f789012',
      user: 'Sarah Chen'
    },
    {
      id: 3,
      type: 'milestone_completed',
      title: 'Pickup Milestone Completed',
      description: 'Milestone 2 verified and 15% of funds released',
      amount: '$18,750',
      timestamp: '2025-08-25T12:45:00Z',
      txHash: '0x3c4d5e6f78901234',
      user: 'Settlement Agent'
    },
    {
      id: 4,
      type: 'investment',
      title: 'New Investment',
      description: 'Investor funded this deal',
      amount: '$25,000',
      timestamp: '2025-08-25T10:20:00Z',
      txHash: '0x4d5e6f7890123456',
      user: 'Michael Rodriguez'
    },
    {
      id: 5,
      type: 'milestone_completed',
      title: 'Contract Signed',
      description: 'Milestone 1 verified and 10% of funds released',
      amount: '$12,500',
      timestamp: '2025-08-24T18:30:00Z',
      txHash: '0x5e6f789012345678',
      user: 'Settlement Agent'
    }
  ];

  const displayActivities = activities?.length > 0 ? activities : defaultActivities;

  const getActivityIcon = (type) => {
    const iconMap = {
      investment: 'TrendingUp',
      milestone_completed: 'CheckCircle',
      document_uploaded: 'FileText',
      nft_minted: 'Hexagon',
      settlement: 'CreditCard'
    };
    return iconMap?.[type] || 'Activity';
  };

  const getActivityColor = (type) => {
    const colorMap = {
      investment: 'text-primary',
      milestone_completed: 'text-success',
      document_uploaded: 'text-secondary',
      nft_minted: 'text-accent',
      settlement: 'text-warning'
    };
    return colorMap?.[type] || 'text-muted-foreground';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return date?.toLocaleDateString();
  };

  const handleHashScanClick = (txHash) => {
    window.open(`https://hashscan.io/mainnet/transaction/${txHash}`, '_blank');
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {displayActivities?.map((activity, index) => (
          <div key={activity?.id} className="flex items-start space-x-4 group">
            {/* Timeline Line */}
            <div className="relative flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full bg-background border-2 border-border flex items-center justify-center ${getActivityColor(activity?.type)}`}>
                <Icon name={getActivityIcon(activity?.type)} size={16} />
              </div>
              {index < displayActivities?.length - 1 && (
                <div className="w-px h-8 bg-border mt-2" />
              )}
            </div>

            {/* Activity Content */}
            <div className="flex-1 min-w-0 pb-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-foreground text-sm">{activity?.title}</h4>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(activity?.timestamp)}
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground mb-2">
                {activity?.description}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-success">
                    {activity?.amount}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    by {activity?.user}
                  </span>
                </div>
                
                <button
                  onClick={() => handleHashScanClick(activity?.txHash)}
                  className="opacity-0 group-hover:opacity-100 transition-institutional px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/80 font-mono"
                >
                  {activity?.txHash?.slice(0, 8)}...
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* View All Button */}
      <div className="mt-6 pt-4 border-t border-border">
        <button className="w-full text-sm text-primary hover:text-primary/80 transition-institutional font-medium">
          View All Activity
        </button>
      </div>
    </div>
  );
};

export default ActivityFeed;