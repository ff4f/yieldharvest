import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';

const BreadcrumbNavigation = ({ customBreadcrumbs = null }) => {
  const location = useLocation();

  const getDefaultBreadcrumbs = () => {
    const pathSegments = location?.pathname?.split('/')?.filter(Boolean);
    
    const routeMap = {
      'supplier-portal-dashboard': { label: 'Supplier Dashboard', icon: 'Package' },
      'invoice-upload-wizard': { label: 'Invoice Upload', icon: 'Upload' },
      'investor-portal-dashboard': { label: 'Investor Dashboard', icon: 'TrendingUp' },
      'deal-detail-view': { label: 'Deal Details', icon: 'FileText' },
      'agent-portal-milestone-tracking': { label: 'Milestone Tracking', icon: 'CheckCircle' },
      'settlement-audit-dashboard': { label: 'Settlement & Audit', icon: 'Search' }
    };

    const breadcrumbs = [
      { label: 'Home', path: '/', icon: 'Home' }
    ];

    let currentPath = '';
    pathSegments?.forEach((segment) => {
      currentPath += `/${segment}`;
      const routeInfo = routeMap?.[segment];
      
      if (routeInfo) {
        breadcrumbs?.push({
          label: routeInfo?.label,
          path: currentPath,
          icon: routeInfo?.icon
        });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = customBreadcrumbs || getDefaultBreadcrumbs();

  if (breadcrumbs?.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
      {breadcrumbs?.map((crumb, index) => {
        const isLast = index === breadcrumbs?.length - 1;
        const isFirst = index === 0;

        return (
          <React.Fragment key={`${crumb?.path || 'breadcrumb'}-${index}`}>
            {/* Breadcrumb Item */}
            <div className="flex items-center">
              {isLast ? (
                <div className="flex items-center space-x-2 text-foreground font-medium">
                  {crumb?.icon && (
                    <Icon name={crumb?.icon} size={16} />
                  )}
                  <span>{crumb?.label}</span>
                </div>
              ) : (
                <Link
                  to={crumb?.path}
                  className="flex items-center space-x-2 hover:text-primary transition-institutional"
                >
                  {crumb?.icon && (
                    <Icon name={crumb?.icon} size={16} />
                  )}
                  <span>{crumb?.label}</span>
                </Link>
              )}
            </div>
            {/* Separator */}
            {!isLast && (
              <Icon 
                name="ChevronRight" 
                size={14} 
                className="text-muted-foreground/60" 
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default BreadcrumbNavigation;