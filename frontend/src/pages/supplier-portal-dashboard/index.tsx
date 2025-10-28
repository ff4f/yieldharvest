import React, { useState, useEffect } from 'react';
import GlobalHeader from '@/components/ui/GlobalHeader';
import PortalSidebar from '@/components/ui/PortalSidebar';
import ProofTray from '@/components/ui/ProofTray';
import KPICard from './components/KPICard';
import RecentInvoicesTable from './components/RecentInvoicesTable';
import QuickActionsPanel from './components/QuickActionsPanel';
import MilestoneProgressVisualization from './components/MilestoneProgressVisualization';
import { useSupplierPortalData } from '@/hooks/useSupplierPortalData';
import { useHashScanLinks } from '@/hooks/useMirrorNode';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export default function SupplierPortalDashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Get real Mirror Node data
  const { 
    kpis, 
    recentTransactions, 
    loading, 
    error, 
    lastUpdated,
    refresh 
  } = useSupplierPortalData();

  const { generateHashScanLinks } = useHashScanLinks();

  // Force refresh handler
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refresh();
  };

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [refresh]);

  if (loading && !kpis.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading supplier dashboard...</p>
          <p className="text-sm text-gray-500 mt-2">Fetching data from Hedera Mirror Node</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

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

  // Use real Mirror Node data instead of mock data

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
            {kpis?.map((kpi, index) => (
              <KPICard
                key={index}
                title={kpi?.title}
                value={kpi?.value}
                subtitle={kpi?.description}
                icon={kpi?.icon}
                trend={kpi?.trend}
                trendValue={kpi?.change}
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
}