import React, { useState, useEffect } from 'react';
import GlobalHeader from '../../components/ui/GlobalHeader';
import PortalSidebar from '../../components/ui/PortalSidebar';
import ProofTray from '../../components/ui/ProofTray';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import KPICard from './components/KPICard';
import RecentInvoicesTable from './components/RecentInvoicesTable';
import QuickActionsPanel from './components/QuickActionsPanel';
import MilestoneProgressVisualization from './components/MilestoneProgressVisualization';

const SupplierPortalDashboard = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    // Handle logout logic
    console.log('User logged out');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Mock blockchain transactions for ProofTray
  const recentTransactions = [
    {
      id: '0x1a2b3c4d5e6f',
      type: 'invoice_tokenization',
      status: 'confirmed',
      timestamp: '2025-08-25T18:35:00Z',
      amount: '$25,000',
      description: 'Invoice #INV-2025-001 tokenized as NFT'
    },
    {
      id: '0x7g8h9i0j1k2l',
      type: 'funding_disbursement',
      status: 'pending',
      timestamp: '2025-08-25T18:40:00Z',
      amount: '$5,000',
      description: 'Milestone funding disbursement'
    },
    {
      id: '0x3m4n5o6p7q8r',
      type: 'milestone_verification',
      status: 'confirmed',
      timestamp: '2025-08-25T18:30:00Z',
      amount: '$2,500',
      description: 'Port Out milestone verified'
    }
  ];

  // KPI data
  const kpiData = [
    {
      title: 'Total Invoices',
      value: '24',
      subtitle: 'Uploaded this month',
      icon: 'FileText',
      trend: 'up',
      trendValue: '+12%',
      color: 'primary'
    },
    {
      title: 'Active Funding',
      value: '$125,750',
      subtitle: 'Currently seeking funding',
      icon: 'TrendingUp',
      trend: 'up',
      trendValue: '+8%',
      color: 'warning'
    },
    {
      title: 'Completed Deals',
      value: '18',
      subtitle: 'Successfully funded',
      icon: 'CheckCircle',
      trend: 'up',
      trendValue: '+15%',
      color: 'success'
    },
    {
      title: 'Available Balance',
      value: '$89,250',
      subtitle: 'Ready for withdrawal',
      icon: 'Wallet',
      trend: 'up',
      trendValue: '+22%',
      color: 'accent'
    }
  ];

  const customBreadcrumbs = [
    { label: 'Home', path: '/', icon: 'Home' },
    { label: 'Supplier Portal', path: '/supplier-portal-dashboard', icon: 'Package' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Global Header */}
      <GlobalHeader 
        userRole="supplier" 
        userName="John Martinez" 
        onLogout={handleLogout}
      />
      {/* Sidebar */}
      <PortalSidebar 
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
        userRole="supplier"
      />
      {/* ProofTray */}
      <ProofTray 
        isVisible={true}
        transactions={recentTransactions}
      />
      {/* Main Content */}
      <main className={`
        pt-16 transition-smooth min-h-screen
        ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-80'}
      `}>
        <div className="p-6 max-w-7xl mx-auto">
          {/* Breadcrumb Navigation */}
          <BreadcrumbNavigation customBreadcrumbs={customBreadcrumbs} />

          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Supplier Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                  Manage your invoice tokenization and track funding progress
                </p>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-sm text-muted-foreground">
                  Last updated: {currentTime?.toLocaleTimeString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentTime?.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
            {kpiData?.map((kpi, index) => (
              <KPICard
                key={index}
                title={kpi?.title}
                value={kpi?.value}
                subtitle={kpi?.subtitle}
                icon={kpi?.icon}
                trend={kpi?.trend}
                trendValue={kpi?.trendValue}
                color={kpi?.color}
              />
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 mb-8">
            {/* Recent Invoices Table */}
            <div className="xl:col-span-3">
              <RecentInvoicesTable />
            </div>

            {/* Quick Actions Panel */}
            <div className="xl:col-span-1">
              <QuickActionsPanel />
            </div>
          </div>

          {/* Milestone Progress Visualization */}
          <div className="mb-8">
            <MilestoneProgressVisualization />
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <p>
                © {new Date()?.getFullYear()} YieldHarvest. All rights reserved.
              </p>
              <div className="flex items-center space-x-4">
                <span>Powered by Hedera Network</span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                  <span>System Operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SupplierPortalDashboard;