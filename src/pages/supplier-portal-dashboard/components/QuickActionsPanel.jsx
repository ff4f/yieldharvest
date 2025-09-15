import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const QuickActionsPanel = () => {
  const quickActions = [
    {
      title: 'Upload New Invoice',
      description: 'Start the 3-step tokenization process',
      icon: 'Upload',
      color: 'primary',
      path: '/invoice-upload-wizard',
      isPrimary: true
    },
    {
      title: 'Document Manager',
      description: 'View and manage uploaded documents',
      icon: 'FileText',
      color: 'accent',
      path: '/supplier-portal-dashboard',
      isPrimary: false
    },
    {
      title: 'Settlement Tracking',
      description: 'Monitor milestone progress',
      icon: 'CheckCircle',
      color: 'success',
      path: '/agent-portal-milestone-tracking',
      isPrimary: false
    },
    {
      title: 'Funding Analytics',
      description: 'View detailed funding metrics',
      icon: 'BarChart3',
      color: 'warning',
      path: '/supplier-portal-dashboard',
      isPrimary: false
    }
  ];

  const recentActivity = [
    {
      id: 1,
      type: 'invoice_uploaded',
      title: 'Invoice INV-2025-003 uploaded',
      timestamp: '2 hours ago',
      icon: 'Upload',
      color: 'primary'
    },
    {
      id: 2,
      type: 'funding_received',
      title: 'Received $5,000 funding for INV-2025-001',
      timestamp: '4 hours ago',
      icon: 'ArrowDownCircle',
      color: 'success'
    },
    {
      id: 3,
      type: 'milestone_completed',
      title: 'Milestone "Contract Signed" completed',
      timestamp: '1 day ago',
      icon: 'CheckCircle',
      color: 'success'
    },
    {
      id: 4,
      type: 'document_verified',
      title: 'BoL document verified for INV-2025-002',
      timestamp: '2 days ago',
      icon: 'Shield',
      color: 'accent'
    }
  ];

  const getColorClasses = (colorType) => {
    const colorMap = {
      primary: 'text-primary bg-primary/10 border-primary/20',
      success: 'text-success bg-success/10 border-success/20',
      warning: 'text-warning bg-warning/10 border-warning/20',
      accent: 'text-accent bg-accent/10 border-accent/20'
    };
    return colorMap?.[colorType] || colorMap?.primary;
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-[0_8px_30px_rgba(0,0,0,.06)]">
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
        <div className="space-y-3">
          {quickActions?.map((action, index) => (
            <Link key={index} to={action?.path}>
              <div className={`
                p-4 rounded-xl border transition-institutional hover:shadow-card cursor-pointer
                ${action?.isPrimary 
                  ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' 
                  : 'bg-muted/30 border-border hover:bg-muted/50'
                }
              `}>
                <div className="flex items-start space-x-3">
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                    ${action?.isPrimary 
                      ? 'bg-primary-foreground/20' 
                      : getColorClasses(action?.color)
                    }
                  `}>
                    <Icon 
                      name={action?.icon} 
                      size={20} 
                      className={action?.isPrimary ? 'text-primary-foreground' : ''}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium mb-1 ${
                      action?.isPrimary ? 'text-primary-foreground' : 'text-foreground'
                    }`}>
                      {action?.title}
                    </h4>
                    <p className={`text-sm ${
                      action?.isPrimary ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    }`}>
                      {action?.description}
                    </p>
                  </div>
                  <Icon 
                    name="ChevronRight" 
                    size={16} 
                    className={`flex-shrink-0 ${
                      action?.isPrimary ? 'text-primary-foreground/60' : 'text-muted-foreground'
                    }`}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      {/* Recent Activity */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-[0_8px_30px_rgba(0,0,0,.06)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          <Button variant="ghost" size="sm" iconName="MoreHorizontal" />
        </div>
        <div className="space-y-3">
          {recentActivity?.map((activity) => (
            <div key={activity?.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/30 transition-institutional">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getColorClasses(activity?.color)}`}>
                <Icon name={activity?.icon} size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{activity?.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{activity?.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <Button variant="ghost" size="sm" fullWidth iconName="Clock">
            View All Activity
          </Button>
        </div>
      </div>
      {/* System Status */}
      <div className="bg-card rounded-2xl p-6 border border-border shadow-[0_8px_30px_rgba(0,0,0,.06)]">
        <h3 className="text-lg font-semibold text-foreground mb-4">System Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-sm text-foreground">Hedera Network</span>
            </div>
            <span className="text-xs text-success font-medium">Operational</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-sm text-foreground">HTS Service</span>
            </div>
            <span className="text-xs text-success font-medium">Operational</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
              <span className="text-sm text-foreground">HFS Storage</span>
            </div>
            <span className="text-xs text-success font-medium">Operational</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickActionsPanel;