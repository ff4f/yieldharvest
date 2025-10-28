import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Building, 
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import { DistributionData } from '@/services/settlementsAggregator';
import { formatCurrency, formatPercentage } from '@/lib/utils';

interface DistributionBreakdownProps {
  distributionData: DistributionData[];
  isLoading?: boolean;
}

const COLORS = {
  Investors: '#3B82F6',    // Blue
  Operators: '#10B981',    // Green
  Platform: '#8B5CF6'      // Purple
};

const CATEGORY_ICONS = {
  Investors: Users,
  Operators: Building,
  Platform: Coins
};

export const DistributionBreakdown: React.FC<DistributionBreakdownProps> = ({
  distributionData,
  isLoading = false
}) => {
  // Prepare data for charts
  const pieChartData = distributionData.map(item => ({
    name: item.category,
    value: item.percentage,
    amount: item.amount,
    count: item.count,
    color: COLORS[item.category as keyof typeof COLORS]
  }));

  const barChartData = distributionData.map(item => ({
    category: item.category,
    amount: item.amount,
    percentage: item.percentage,
    count: item.count
  }));

  // Mock trend data for demonstration
  const trendData = [
    { month: 'Jan', Investors: 75, Operators: 15, Platform: 10 },
    { month: 'Feb', Investors: 78, Operators: 14, Platform: 8 },
    { month: 'Mar', Investors: 80, Operators: 13, Platform: 7 },
    { month: 'Apr', Investors: 82, Operators: 12, Platform: 6 },
    { month: 'May', Investors: 85, Operators: 10, Platform: 5 },
    { month: 'Jun', Investors: 85, Operators: 10, Platform: 5 }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label || data.name}</p>
          <p className="text-sm text-gray-600">
            Amount: {formatCurrency(data.amount || data.value)}
          </p>
          <p className="text-sm text-gray-600">
            Percentage: {formatPercentage(data.percentage || data.value)}
          </p>
          <p className="text-sm text-gray-600">
            Count: {data.count} settlements
          </p>
        </div>
      );
    }
    return null;
  };

  const getTrendIcon = (category: string) => {
    // Mock trend calculation - in real app, compare with previous period
    const currentMonth = trendData[trendData.length - 1];
    const previousMonth = trendData[trendData.length - 2];
    
    const current = currentMonth[category as keyof typeof currentMonth] as number;
    const previous = previousMonth[category as keyof typeof previousMonth] as number;
    
    if (current > previous) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (current < previous) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-48"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {distributionData.map((item, index) => {
          const Icon = CATEGORY_ICONS[item.category as keyof typeof CATEGORY_ICONS];
          const color = COLORS[item.category as keyof typeof COLORS];
          
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Icon 
                        className="h-5 w-5" 
                        style={{ color }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.category}</h3>
                      <p className="text-sm text-gray-500">{item.count} settlements</p>
                    </div>
                  </div>
                  {getTrendIcon(item.category)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(item.amount)}
                    </span>
                    <Badge 
                      variant="secondary" 
                      className="text-xs"
                      style={{ 
                        backgroundColor: `${color}20`, 
                        color: color 
                      }}
                    >
                      {formatPercentage(item.percentage)}
                    </Badge>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${item.percentage}%`,
                        backgroundColor: color
                      }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Distribution Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Amount Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="amount" 
                  fill="#3B82F6"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Distribution Trends (6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip 
                  formatter={(value, name) => [`${value}%`, name]}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="Investors" 
                  stroke={COLORS.Investors} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Operators" 
                  stroke={COLORS.Operators} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Platform" 
                  stroke={COLORS.Platform} 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            Distribution Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Investor Share</h4>
              <p className="text-sm text-blue-700">
                Investors receive the largest portion at{' '}
                {formatPercentage(distributionData.find(d => d.category === 'Investors')?.percentage || 0)},
                reflecting their primary funding role.
              </p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Operator Fees</h4>
              <p className="text-sm text-green-700">
                Operators earn{' '}
                {formatPercentage(distributionData.find(d => d.category === 'Operators')?.percentage || 0)}{' '}
                for managing invoice processing and settlements.
              </p>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-900 mb-2">Platform Revenue</h4>
              <p className="text-sm text-purple-700">
                Platform takes{' '}
                {formatPercentage(distributionData.find(d => d.category === 'Platform')?.percentage || 0)}{' '}
                as service fees for facilitating transactions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DistributionBreakdown;