import React from 'react';
import Icon from '../../../components/AppIcon';

const KPICard = ({ title, value, subtitle, icon, trend, trendValue, color = 'primary' }) => {
  const getColorClasses = (colorType) => {
    const colorMap = {
      primary: 'text-primary bg-primary/10',
      success: 'text-success bg-success/10',
      warning: 'text-warning bg-warning/10',
      accent: 'text-accent bg-accent/10'
    };
    return colorMap?.[colorType] || colorMap?.primary;
  };

  const getTrendColor = (trendType) => {
    return trendType === 'up' ? 'text-success' : trendType === 'down' ? 'text-error' : 'text-muted-foreground';
  };

  const getTrendIcon = (trendType) => {
    return trendType === 'up' ? 'TrendingUp' : trendType === 'down' ? 'TrendingDown' : 'Minus';
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border shadow-[0_8px_30px_rgba(0,0,0,.06)] transition-institutional hover:shadow-institutional">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
          <p className="text-3xl font-bold text-foreground mb-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className="flex items-center mt-3 space-x-1">
              <Icon 
                name={getTrendIcon(trend)} 
                size={16} 
                className={getTrendColor(trend)} 
              />
              <span className={`text-sm font-medium ${getTrendColor(trend)}`}>
                {trendValue}
              </span>
              <span className="text-sm text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getColorClasses(color)}`}>
          <Icon name={icon} size={24} />
        </div>
      </div>
    </div>
  );
};

export default KPICard;