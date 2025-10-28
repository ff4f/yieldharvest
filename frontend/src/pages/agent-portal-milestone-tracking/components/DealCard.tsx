import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import Icon from '../../../components/AppIcon';
import { Button } from '../../../components/ui/button';

interface Deal {
  id: string;
  status: string;
  currentMilestone: string;
  amount: number;
  [key: string]: any;
}

interface DealCardProps {
  deal: Deal;
  onViewDetails: (deal: Deal) => void;
}

const DealCard: React.FC<DealCardProps> = ({ deal, onViewDetails }) => {
  const getStatusColor = (status: string): string => {
    const statusMap: Record<string, string> = {
      'in_progress': 'bg-primary text-primary-foreground',
      'pending_verification': 'bg-warning text-warning-foreground',
      'completed': 'bg-success text-success-foreground',
      'on_hold': 'bg-error text-error-foreground'
    };
    return statusMap?.[status] || 'bg-secondary text-secondary-foreground';
  };

  const getMilestoneIcon = (currentMilestone: string): string => {
    const iconMap: Record<string, string> = {
      'contract_signed': 'FileSignature',
      'pickup': 'Truck',
      'port_out': 'Ship',
      'vessel_departed': 'Anchor',
      'arrived': 'MapPin',
      'customs_in': 'Shield',
      'warehouse_in': 'Warehouse',
      'delivered': 'CheckCircle'
    };
    return iconMap?.[currentMilestone] || 'Package';
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
    <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)] hover:shadow-institutional transition-smooth">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Deal #{deal?.dealId}
          </h3>
          <p className="text-sm text-muted-foreground">
            {deal?.supplierName} • {deal?.commodity}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(deal?.status)}`}>
          {deal?.status?.replace('_', ' ')?.toUpperCase()}
        </div>
      </div>
      {/* Deal Value */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-foreground">
          {formatCurrency(deal?.totalValue)}
        </div>
        <div className="text-sm text-muted-foreground">
          Total Deal Value
        </div>
      </div>
      {/* Current Milestone */}
      <div className="mb-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon 
              name={getMilestoneIcon(deal?.currentMilestone)} 
              size={16} 
              className="text-primary" 
            />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              {deal?.currentMilestoneLabel}
            </div>
            <div className="text-xs text-muted-foreground">
              {deal?.disbursementPercentage}% disbursement pending
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-smooth"
            style={{ width: `${deal?.completionPercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{deal?.completedMilestones}/8 milestones</span>
          <span>{deal?.completionPercentage}% complete</span>
        </div>
      </div>
      {/* Next Action */}
      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center space-x-2 mb-1">
          <Icon name="Clock" size={14} className="text-warning" />
          <span className="text-sm font-medium text-foreground">Next Action</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {deal?.nextAction}
        </p>
      </div>
      {/* Actions */}
      <div className="flex space-x-2">
        <Button
          variant="default"
          size="sm"
          onClick={() => onViewDetails(deal)}
          className="flex-1 flex items-center gap-2"
        >
          <Icon name="Eye" size={16} />
          View Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="px-3 flex items-center gap-2"
        >
          <Icon name="QrCode" size={16} />
          <span className="sr-only">Generate QR Code</span>
        </Button>
      </div>
      {/* Timestamp */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground">
          Last updated: {new Date(deal.lastUpdated)?.toLocaleString()}
        </div>
      </div>
    </div>
  );
};

export default DealCard;