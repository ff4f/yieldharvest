import React, { useState } from 'react';
import GlobalHeader from '../../components/ui/GlobalHeader';
import PortalSidebar from '../../components/ui/PortalSidebar';
import ProofTray from '../../components/ui/ProofTray';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import SettlementSummaryCards from './components/SettlementSummaryCards';
import DistributionBreakdown from './components/DistributionBreakdown';
import SettlementsTable from './components/SettlementsTable';
import AuditTrailTable from './components/AuditTrailTable';
import AuditVerificationTools from './components/AuditVerificationTools';
import Icon from '../../components/AppIcon';

const SettlementAuditDashboard = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('settlements');

  const handleLogout = () => {
    // Handle logout logic
    console.log('User logged out');
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const proofTrayTransactions = [
    {
      id: '0x1a2b3c4d',
      type: 'settlement',
      status: 'confirmed',
      timestamp: '2025-08-25T18:35:00Z',
      amount: '$125,000',
      description: 'Settlement executed for DEAL-2025-001'
    },
    {
      id: '0x5e6f7g8h',
      type: 'audit',
      status: 'confirmed',
      timestamp: '2025-08-25T18:30:00Z',
      amount: '$0',
      description: 'Audit trail anchored to HCS'
    },
    {
      id: '0x9i0j1k2l',
      type: 'milestone_verification',
      status: 'pending',
      timestamp: '2025-08-25T18:25:00Z',
      amount: '$15,625',
      description: 'Final milestone disbursement processing'
    }
  ];

  const customBreadcrumbs = [
    { label: 'Home', path: '/', icon: 'Home' },
    { label: 'Settlement & Audit Dashboard', path: '/settlement-audit-dashboard', icon: 'Search' }
  ];

  const tabs = [
    {
      id: 'settlements',
      label: 'Settlements',
      icon: 'CheckCircle',
      count: 24
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: 'Shield',
      count: 18
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Global Header */}
      <GlobalHeader 
        userRole="agent"
        userName="Sarah Chen"
        onLogout={handleLogout}
      />
      {/* Sidebar */}
      <PortalSidebar 
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
        userRole="agent"
      />
      {/* Proof Tray */}
      <ProofTray 
        isVisible={true}
        transactions={proofTrayTransactions}
      />
      {/* Main Content */}
      <main className={`transition-smooth pt-16 ${
        isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-80'
      }`}>
        <div className="p-6 max-w-7xl mx-auto">
          {/* Breadcrumb Navigation */}
          <BreadcrumbNavigation customBreadcrumbs={customBreadcrumbs} />

          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settlement & Audit Dashboard</h1>
              <p className="text-muted-foreground mt-2">
                Comprehensive oversight of completed deals and blockchain audit trails
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 px-3 py-1 bg-success/10 text-success rounded-full text-sm font-medium">
                <Icon name="CheckCircle" size={16} />
                <span>All Systems Operational</span>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <SettlementSummaryCards />

          {/* Distribution Breakdown */}
          <DistributionBreakdown />

          {/* Tabbed Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Content Area */}
            <div className="lg:col-span-3">
              {/* Tab Navigation */}
              <div className="flex items-center space-x-1 mb-6 bg-muted p-1 rounded-lg w-fit">
                {tabs?.map((tab) => (
                  <button
                    key={tab?.id}
                    onClick={() => setActiveTab(tab?.id)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-institutional ${
                      activeTab === tab?.id
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    }`}
                  >
                    <Icon name={tab?.icon} size={16} />
                    <span>{tab?.label}</span>
                    <div className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      activeTab === tab?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                      {tab?.count}
                    </div>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="space-y-6">
                {activeTab === 'settlements' && <SettlementsTable />}
                {activeTab === 'audit' && <AuditTrailTable />}
              </div>
            </div>

            {/* Right Sidebar - Verification Tools */}
            <div className="lg:col-span-1">
              <AuditVerificationTools />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettlementAuditDashboard;