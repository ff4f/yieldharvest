import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const MilestoneProgressVisualization = () => {
  const activeDeals = [
    {
      id: 'INV-2025-001',
      buyer: 'Global Foods Ltd.',
      amount: '$25,000.00',
      currentMilestone: 'Port Out',
      completedMilestones: 3,
      totalMilestones: 8,
      progressPercentage: 50,
      nextMilestone: 'Vessel Departed',
      estimatedCompletion: '2025-09-15',
      milestones: [
        { name: 'Contract Signed', percentage: 10, status: 'completed', date: '2025-08-20' },
        { name: 'Pickup', percentage: 15, status: 'completed', date: '2025-08-22' },
        { name: 'Port Out', percentage: 25, status: 'completed', date: '2025-08-25' },
        { name: 'Vessel Departed', percentage: 20, status: 'current', date: null },
        { name: 'Arrived', percentage: 15, status: 'pending', date: null },
        { name: 'Customs In', percentage: 10, status: 'pending', date: null },
        { name: 'Warehouse In', percentage: 5, status: 'pending', date: null },
        { name: 'Delivered', percentage: 0, status: 'pending', date: null }
      ]
    },
    {
      id: 'INV-2025-002',
      buyer: 'Fresh Market Co.',
      amount: '$18,750.00',
      currentMilestone: 'Customs In',
      completedMilestones: 6,
      totalMilestones: 8,
      progressPercentage: 85,
      nextMilestone: 'Warehouse In',
      estimatedCompletion: '2025-09-05',
      milestones: [
        { name: 'Contract Signed', percentage: 10, status: 'completed', date: '2025-08-15' },
        { name: 'Pickup', percentage: 15, status: 'completed', date: '2025-08-16' },
        { name: 'Port Out', percentage: 25, status: 'completed', date: '2025-08-18' },
        { name: 'Vessel Departed', percentage: 20, status: 'completed', date: '2025-08-20' },
        { name: 'Arrived', percentage: 15, status: 'completed', date: '2025-08-23' },
        { name: 'Customs In', percentage: 10, status: 'completed', date: '2025-08-24' },
        { name: 'Warehouse In', percentage: 5, status: 'current', date: null },
        { name: 'Delivered', percentage: 0, status: 'pending', date: null }
      ]
    }
  ];

  const getStatusColor = (status) => {
    const statusMap = {
      completed: 'bg-success text-success-foreground',
      current: 'bg-primary text-primary-foreground pulse-gentle',
      pending: 'bg-muted text-muted-foreground'
    };
    return statusMap?.[status] || statusMap?.pending;
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      completed: 'CheckCircle',
      current: 'Clock',
      pending: 'Circle'
    };
    return iconMap?.[status] || iconMap?.pending;
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-[0_8px_30px_rgba(0,0,0,.06)]">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Active Deal Milestones</h3>
          <Link to="/agent-portal-milestone-tracking">
            <Button variant="outline" size="sm" iconName="ExternalLink" iconPosition="right">
              View All
            </Button>
          </Link>
        </div>
      </div>
      <div className="p-6 space-y-8">
        {activeDeals?.map((deal) => (
          <div key={deal?.id} className="space-y-4">
            {/* Deal Header */}
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-foreground">{deal?.id}</h4>
                <p className="text-sm text-muted-foreground">{deal?.buyer} • {deal?.amount}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  {deal?.completedMilestones}/{deal?.totalMilestones} Milestones
                </p>
                <p className="text-xs text-muted-foreground">
                  Est. completion: {deal?.estimatedCompletion}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium text-foreground">{deal?.progressPercentage}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-primary to-success rounded-full h-3 transition-smooth"
                  style={{ width: `${deal?.progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Milestone Timeline - Desktop */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-8 gap-2">
                {deal?.milestones?.map((milestone, index) => (
                  <div key={index} className="text-center">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 border-2
                      ${getStatusColor(milestone?.status)}
                      ${milestone?.status === 'completed' ? 'border-success' : 
                        milestone?.status === 'current' ? 'border-primary' : 'border-muted'}
                    `}>
                      <Icon 
                        name={getStatusIcon(milestone?.status)} 
                        size={16} 
                      />
                    </div>
                    <p className="text-xs font-medium text-foreground mb-1">
                      {milestone?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {milestone?.percentage}%
                    </p>
                    {milestone?.date && (
                      <p className="text-xs text-success mt-1">
                        {new Date(milestone.date)?.toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Milestone Timeline - Mobile */}
            <div className="lg:hidden space-y-3">
              {deal?.milestones?.filter(m => m?.status === 'completed' || m?.status === 'current')?.slice(-3)?.map((milestone, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center border-2
                    ${getStatusColor(milestone?.status)}
                    ${milestone?.status === 'completed' ? 'border-success' : 'border-primary'}
                  `}>
                    <Icon 
                      name={getStatusIcon(milestone?.status)} 
                      size={14} 
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{milestone?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {milestone?.percentage}% • {milestone?.date ? new Date(milestone.date)?.toLocaleDateString() : 'In Progress'}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Next Milestone Alert */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon name="Clock" size={16} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Next: {deal?.nextMilestone}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Awaiting QR code verification from settlement agent
                  </p>
                </div>
                <Link to="/agent-portal-milestone-tracking">
                  <Button variant="ghost" size="sm" iconName="ArrowRight">
                    Track
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MilestoneProgressVisualization;