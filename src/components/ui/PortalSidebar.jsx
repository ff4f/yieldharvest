import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../AppIcon';
import Button from './Button';

const PortalSidebar = ({ isCollapsed = false, onToggle, userRole = 'supplier' }) => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev?.[sectionKey]
    }));
  };

  const getNavigationItems = () => {
    const baseItems = [
      {
        key: 'supplier',
        label: 'Supplier Portal',
        icon: 'Package',
        items: [
          {
            label: 'Dashboard',
            path: '/supplier-portal-dashboard',
            icon: 'BarChart3',
            description: 'Overview and analytics'
          },
          {
            label: 'Invoice Upload',
            path: '/invoice-upload-wizard',
            icon: 'Upload',
            description: 'Tokenize invoices'
          }
        ]
      },
      {
        key: 'investor',
        label: 'Investor Portal',
        icon: 'TrendingUp',
        items: [
          {
            label: 'Dashboard',
            path: '/investor-portal-dashboard',
            icon: 'PieChart',
            description: 'Portfolio overview'
          },
          {
            label: 'Deal Details',
            path: '/deal-detail-view',
            icon: 'FileText',
            description: 'Investment opportunities'
          }
        ]
      },
      {
        key: 'agent',
        label: 'Agent Portal',
        icon: 'Shield',
        items: [
          {
            label: 'Milestone Tracking',
            path: '/agent-portal-milestone-tracking',
            icon: 'CheckCircle',
            description: 'Settlement progress'
          }
        ]
      },
      {
        key: 'audit',
        label: 'Audit & Settlement',
        icon: 'Search',
        items: [
          {
            label: 'Settlement Dashboard',
            path: '/settlement-audit-dashboard',
            icon: 'Activity',
            description: 'Compliance and audit'
          }
        ]
      }
    ];

    return baseItems;
  };

  const isActiveItem = (path) => {
    return location?.pathname === path;
  };

  const isActiveSection = (sectionKey) => {
    const items = getNavigationItems()?.find(item => item?.key === sectionKey)?.items || [];
    return items?.some(item => location?.pathname === item?.path);
  };

  const navigationItems = getNavigationItems();

  return (
    <>
      {/* Overlay for mobile */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-16 bottom-0 z-40 bg-card border-r border-border transition-smooth
        ${isCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}
        ${isCollapsed ? 'lg:w-16' : 'w-80 lg:w-80'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            {!isCollapsed && (
              <h2 className="text-lg font-semibold text-foreground">Navigation</h2>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="lg:hidden"
            >
              <Icon name="X" size={20} />
            </Button>
          </div>

          {/* Navigation Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <nav className="space-y-2">
              {navigationItems?.map((section) => {
                const isExpanded = expandedSections?.[section?.key] ?? true;
                const isSectionActive = isActiveSection(section?.key);

                return (
                  <div key={section?.key} className="space-y-1">
                    {/* Section Header */}
                    <button
                      onClick={() => !isCollapsed && toggleSection(section?.key)}
                      className={`
                        flex items-center w-full p-3 rounded-lg text-left transition-institutional
                        ${isSectionActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}
                        ${isCollapsed ? 'justify-center' : 'justify-between'}
                      `}
                    >
                      <div className="flex items-center">
                        <Icon 
                          name={section?.icon} 
                          size={20} 
                          className={isCollapsed ? '' : 'mr-3'} 
                        />
                        {!isCollapsed && (
                          <span className="font-medium">{section?.label}</span>
                        )}
                      </div>
                      {!isCollapsed && (
                        <Icon 
                          name="ChevronDown" 
                          size={16} 
                          className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>
                    {/* Section Items */}
                    {(!isCollapsed && isExpanded) && (
                      <div className="ml-4 space-y-1">
                        {section?.items?.map((item) => {
                          const isActive = isActiveItem(item?.path);
                          
                          return (
                            <Link
                              key={item?.path}
                              to={item?.path}
                              className={`
                                flex items-center p-3 rounded-lg transition-institutional group
                                ${isActive 
                                  ? 'bg-primary text-primary-foreground shadow-sm' 
                                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }
                              `}
                            >
                              <Icon 
                                name={item?.icon} 
                                size={18} 
                                className="mr-3 flex-shrink-0" 
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{item?.label}</div>
                                <div className={`text-xs mt-0.5 ${
                                  isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                }`}>
                                  {item?.description}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                    {/* Collapsed tooltips */}
                    {isCollapsed && (
                      <div className="relative group">
                        <div className="absolute left-full top-0 ml-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-institutional opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-institutional z-50 whitespace-nowrap">
                          <div className="font-medium text-sm text-foreground">{section?.label}</div>
                          <div className="space-y-1 mt-2">
                            {section?.items?.map((item) => (
                              <Link
                                key={item?.path}
                                to={item?.path}
                                className="block text-xs text-muted-foreground hover:text-foreground transition-institutional"
                              >
                                {item?.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-border">
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
              <div className="w-8 h-8 bg-success/10 rounded-full flex items-center justify-center">
                <Icon name="Zap" size={16} className="text-success" />
              </div>
              {!isCollapsed && (
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">System Status</div>
                  <div className="text-xs text-success">All systems operational</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default PortalSidebar;