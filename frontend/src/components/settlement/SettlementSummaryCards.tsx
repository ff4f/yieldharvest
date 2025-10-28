import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  Calendar,
  BarChart3
} from 'lucide-react';
import { SettlementKPI } from '@/services/settlementsAggregator';
import { formatCurrency, formatPercentage } from '@/lib/utils';

interface SettlementSummaryCardsProps {
  kpis: SettlementKPI;
  isLoading?: boolean;
}

export const SettlementSummaryCards: React.FC<SettlementSummaryCardsProps> = ({
  kpis,
  isLoading = false
}) => {
  const cards = [
    {
      title: 'Total Settlements',
      value: kpis.totalSettlements.toLocaleString(),
      icon: BarChart3,
      description: 'All-time settlements processed',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      trend: null
    },
    {
      title: 'Total Value',
      value: formatCurrency(kpis.totalValue),
      icon: DollarSign,
      description: 'Total settlement amount',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      trend: null
    },
    {
      title: 'Funding Rate',
      value: formatPercentage(kpis.fundedPercentage),
      icon: TrendingUp,
      description: 'Invoices successfully funded',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      progress: kpis.fundedPercentage,
      trend: kpis.fundedPercentage >= 80 ? 'positive' : kpis.fundedPercentage >= 60 ? 'neutral' : 'negative'
    },
    {
      title: 'Payment Rate',
      value: formatPercentage(kpis.paidPercentage),
      icon: CheckCircle,
      description: 'Settlements completed',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      progress: kpis.paidPercentage,
      trend: kpis.paidPercentage >= 90 ? 'positive' : kpis.paidPercentage >= 70 ? 'neutral' : 'negative'
    },
    {
      title: 'Avg. Payment Time',
      value: `${kpis.averageDaysToPayment.toFixed(1)} days`,
      icon: Clock,
      description: 'Average time to settlement',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      trend: kpis.averageDaysToPayment <= 7 ? 'positive' : kpis.averageDaysToPayment <= 14 ? 'neutral' : 'negative'
    },
    {
      title: 'Pending Settlements',
      value: kpis.pendingSettlements.toLocaleString(),
      icon: AlertCircle,
      description: 'Awaiting processing',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      trend: kpis.pendingSettlements === 0 ? 'positive' : kpis.pendingSettlements <= 5 ? 'neutral' : 'negative'
    }
  ];

  const statusCards = [
    {
      title: 'Completed',
      value: kpis.completedSettlements,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      badgeColor: 'bg-green-100 text-green-800'
    },
    {
      title: 'Pending',
      value: kpis.pendingSettlements,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      badgeColor: 'bg-yellow-100 text-yellow-800'
    },
    {
      title: 'Failed',
      value: kpis.failedSettlements,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      badgeColor: 'bg-red-100 text-red-800'
    }
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-24"></div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-32"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getTrendBadge = (trend: string | null) => {
    if (!trend) return null;
    
    const trendConfig = {
      positive: { color: 'bg-green-100 text-green-800', label: 'Good' },
      neutral: { color: 'bg-yellow-100 text-yellow-800', label: 'Fair' },
      negative: { color: 'bg-red-100 text-red-800', label: 'Poor' }
    };

    const config = trendConfig[trend as keyof typeof trendConfig];
    if (!config) return null;

    return (
      <Badge variant="secondary" className={`${config.color} text-xs`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl font-bold text-gray-900">
                    {card.value}
                  </div>
                  {getTrendBadge(card.trend)}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {card.description}
                </p>
                {card.progress !== undefined && (
                  <div className="space-y-1">
                    <Progress 
                      value={card.progress} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Status Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-full md:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Settlement Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {statusCards.map((statusCard, index) => {
                const StatusIcon = statusCard.icon;
                return (
                  <div key={index} className="flex items-center space-x-3 p-4 rounded-lg border">
                    <div className={`p-2 rounded-lg ${statusCard.bgColor}`}>
                      <StatusIcon className={`h-5 w-5 ${statusCard.color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-600">
                          {statusCard.title}
                        </p>
                        <Badge className={statusCard.badgeColor}>
                          {statusCard.value}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {statusCard.title.toLowerCase()} settlements
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Performance Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Funding Performance</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Success Rate</span>
                  <span className="font-medium">{formatPercentage(kpis.fundedPercentage)}</span>
                </div>
                <Progress value={kpis.fundedPercentage} className="h-2" />
                <p className="text-xs text-gray-500">
                  {kpis.fundedPercentage >= 80 
                    ? 'Excellent funding performance' 
                    : kpis.fundedPercentage >= 60 
                    ? 'Good funding performance' 
                    : 'Needs improvement'
                  }
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Payment Performance</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Completion Rate</span>
                  <span className="font-medium">{formatPercentage(kpis.paidPercentage)}</span>
                </div>
                <Progress value={kpis.paidPercentage} className="h-2" />
                <p className="text-xs text-gray-500">
                  Average {kpis.averageDaysToPayment.toFixed(1)} days to complete
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettlementSummaryCards;