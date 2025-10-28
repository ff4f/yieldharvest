import React from 'react';
import Icon from '../../../components/AppIcon';
import { Button } from '../../../components/ui/button';

interface Deal {
  id: string;
  currentMilestone: string;
  [key: string]: any;
}

interface MilestoneProgressProps {
  deal: Deal;
  onGenerateQR: (milestone: Milestone, deal: Deal) => void;
  onScanQR: (milestone: Milestone, deal: Deal) => void;
}

interface Milestone {
  key: string;
  label: string;
  percentage: number;
  icon: string;
  description: string;
  completedAt?: string;
}

const MilestoneProgress: React.FC<MilestoneProgressProps> = ({ deal, onGenerateQR, onScanQR }) => {
  const milestones = [
    { 
      key: 'contract_signed', 
      label: 'Contract Signed', 
      percentage: 10, 
      icon: 'FileSignature',
      description: 'Initial contract execution and agreement'
    },
    { 
      key: 'pickup', 
      label: 'Pickup', 
      percentage: 15, 
      icon: 'Truck',
      description: 'Goods collected from supplier location'
    },
    { 
      key: 'port_out', 
      label: 'Port Out', 
      percentage: 25, 
      icon: 'Ship',
      description: 'Departure from origin port'
    },
    { 
      key: 'vessel_departed', 
      label: 'Vessel Departed', 
      percentage: 20, 
      icon: 'Anchor',
      description: 'Ship departed with cargo'
    },
    { 
      key: 'arrived', 
      label: 'Arrived', 
      percentage: 15, 
      icon: 'MapPin',
      description: 'Arrived at destination port'
    },
    { 
      key: 'customs_in', 
      label: 'Customs In', 
      percentage: 10, 
      icon: 'Shield',
      description: 'Customs clearance completed'
    },
    { 
      key: 'warehouse_in', 
      label: 'Warehouse In', 
      percentage: 5, 
      icon: 'Warehouse',
      description: 'Goods received at warehouse'
    },
    { 
      key: 'delivered', 
      label: 'Delivered', 
      percentage: 0, 
      icon: 'CheckCircle',
      description: 'Final delivery completed'
    }
  ];

  const getMilestoneStatus = (milestone: Milestone): string => {
    const completedMilestones = deal?.completedMilestones || [];
    const currentMilestone = deal?.currentMilestone;
    
    if (completedMilestones?.includes(milestone?.key)) {
      return 'completed';
    } else if (milestone?.key === currentMilestone) {
      return 'current';
    } else {
      return 'pending';
    }
  };

  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      completed: 'bg-success text-success-foreground',
      current: 'bg-primary text-primary-foreground',
      pending: 'bg-muted text-muted-foreground'
    };
    return colorMap?.[status] || 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status: string): string => {
    const iconMap: Record<string, string> = {
      completed: 'CheckCircle',
      current: 'Clock',
      pending: 'Circle'
    };
    return iconMap?.[status] || 'Circle';
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          Milestone Progress - Deal #{deal?.dealId}
        </h3>
        <div className="text-sm text-muted-foreground">
          {deal?.completedMilestones?.length || 0}/8 completed
        </div>
      </div>
      {/* Progress Overview */}
      <div className="mb-6 p-4 bg-muted/30 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-foreground">Overall Progress</span>
          <span className="text-sm text-muted-foreground">{deal?.completionPercentage}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div 
            className="bg-primary h-3 rounded-full transition-smooth"
            style={{ width: `${deal?.completionPercentage}%` }}
          />
        </div>
      </div>
      {/* Milestone List */}
      <div className="space-y-4">
        {milestones?.map((milestone: Milestone, index: number) => {
          const status = getMilestoneStatus(milestone);
          const disbursementAmount = (deal?.totalValue * milestone?.percentage) / 100;
          
          return (
            <div 
              key={milestone?.key}
              className={`p-4 rounded-lg border transition-smooth ${
                status === 'current' ?'border-primary bg-primary/5' :'border-border bg-background'
              }`}
            >
              <div className="flex items-center justify-between">
                {/* Milestone Info */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(status)}`}>
                      <Icon 
                        name={status === 'completed' ? 'CheckCircle' : milestone?.icon} 
                        size={20} 
                      />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {milestone?.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {milestone?.description}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Disbursement & Actions */}
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">
                      {formatCurrency(disbursementAmount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {milestone?.percentage}% disbursement
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {status === 'current' && (
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onGenerateQR(milestone, deal)}
                        className="flex items-center gap-2"
                      >
                        <Icon name="QrCode" size={16} />
                        Generate QR
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onScanQR(milestone, deal)}
                        className="flex items-center gap-2"
                      >
                        <Icon name="Camera" size={16} />
                        Scan QR
                      </Button>
                    </div>
                  )}

                  {status === 'completed' && (
                    <div className="flex items-center space-x-2 text-success">
                      <Icon name="CheckCircle" size={16} />
                      <span className="text-sm font-medium">Completed</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Completion Timestamp */}
              {status === 'completed' && milestone?.completedAt && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    Completed: {new Date(milestone.completedAt)?.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MilestoneProgress;