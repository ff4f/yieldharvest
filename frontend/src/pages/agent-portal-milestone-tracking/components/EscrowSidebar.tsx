import React from 'react';
import Icon from '../../../components/AppIcon';
import { Button } from '../../../components/ui/button';

interface Deal {
  id: string;
  status: string;
  escrowBalance?: number;
  settled?: boolean;
  [key: string]: any;
}

interface EscrowSidebarProps {
  deals: Deal[];
  onViewSettlement: (deal: Deal) => void;
}

const EscrowSidebar: React.FC<EscrowSidebarProps> = ({ deals, onViewSettlement }) => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  const calculateTotalEscrow = (): number => {
    return deals?.reduce((total, deal) => total + (deal?.escrowBalance || 0), 0);
  };

  const getPendingSettlements = (): Deal[] => {
    return deals?.filter(deal => deal?.status === 'completed' && !deal?.settled);
  };

  const getActiveDeals = () => {
    return deals?.filter(deal => deal?.status === 'in_progress');
  };

  return (
    <div className="w-80 bg-card border-l border-border p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Escrow Management
        </h3>
        <p className="text-sm text-muted-foreground">
          Track balances and settlements
        </p>
      </div>
      {/* Total Escrow Balance */}
      <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name="Wallet" size={20} className="text-primary" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Escrow</div>
            <div className="text-xl font-bold text-foreground">
              {formatCurrency(calculateTotalEscrow())}
            </div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Across {deals?.length} active deals
        </div>
      </div>
      {/* Active Deals Summary */}
      <div className="mb-6">
        <h4 className="font-medium text-foreground mb-3">Active Deals</h4>
        <div className="space-y-3">
          {getActiveDeals()?.slice(0, 3)?.map((deal) => (
            <div key={deal?.dealId} className="p-3 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm font-medium text-foreground">
                  Deal #{deal?.dealId}
                </div>
                <div className="text-xs text-muted-foreground">
                  {deal?.completionPercentage}%
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                <div 
                  className="bg-primary h-1.5 rounded-full transition-smooth"
                  style={{ width: `${deal?.completionPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Escrow:</span>
                <span className="text-foreground font-medium">
                  {formatCurrency(deal?.escrowBalance || 0)}
                </span>
              </div>
            </div>
          ))}
          
          {getActiveDeals()?.length > 3 && (
            <div className="text-center">
              <Button variant="ghost" size="sm">
                View All ({getActiveDeals()?.length - 3} more)
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Pending Settlements */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-foreground">Pending Settlements</h4>
          <div className="w-6 h-6 bg-warning/10 text-warning rounded-full flex items-center justify-center text-xs font-medium">
            {getPendingSettlements()?.length}
          </div>
        </div>
        
        {getPendingSettlements()?.length > 0 ? (
          <div className="space-y-3">
            {getPendingSettlements()?.map((deal) => (
              <div key={deal?.dealId} className="p-3 bg-warning/5 border border-warning/20 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm font-medium text-foreground">
                    Deal #{deal?.dealId}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Icon name="Clock" size={12} className="text-warning" />
                    <span className="text-xs text-warning">Ready</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  All milestones completed
                </div>
                <div className="flex justify-between text-xs mb-3">
                  <span className="text-muted-foreground">Settlement Amount:</span>
                  <span className="text-foreground font-medium">
                    {formatCurrency(deal?.escrowBalance || 0)}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewSettlement(deal)}
                  className="w-full flex items-center gap-2"
                >
                  <Icon name="CreditCard" size={16} />
                  Execute Settlement
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Icon name="CheckCircle" size={32} className="text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No pending settlements
            </p>
          </div>
        )}
      </div>
      {/* Settlement Distribution */}
      <div className="mb-6 p-4 bg-muted/30 rounded-lg">
        <h4 className="font-medium text-foreground mb-3">Settlement Split</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Investor:</span>
            <span className="text-foreground">85%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Operator:</span>
            <span className="text-foreground">10%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform:</span>
            <span className="text-foreground">5%</span>
          </div>
        </div>
      </div>
      {/* System Status */}
      <div className="p-4 bg-success/5 border border-success/20 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
          <span className="text-sm font-medium text-foreground">System Status</span>
        </div>
        <div className="text-xs text-success">
          All escrow systems operational
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Last sync: {new Date()?.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default EscrowSidebar;