import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlobalHeader from '../../components/ui/GlobalHeader';
import PortalSidebar from '../../components/ui/PortalSidebar';
import ProofTray from '../../components/ui/ProofTray';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import DealCard from './components/DealCard';
import MilestoneProgress from './components/MilestoneProgress';
import QRScanner from './components/QRScanner';
import EscrowSidebar from './components/EscrowSidebar';
import QRGenerator from './components/QRGenerator';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

const AgentPortalMilestoneTracking = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showEscrowSidebar, setShowEscrowSidebar] = useState(true);

  // Mock deals data
  const [deals, setDeals] = useState([
    {
      dealId: 'YH-2025-001',
      supplierName: 'Green Valley Farms',
      commodity: 'Organic Cocoa Beans',
      totalValue: 125000,
      escrowBalance: 125000,
      status: 'in_progress',
      currentMilestone: 'port_out',
      currentMilestoneLabel: 'Port Out',
      disbursementPercentage: 25,
      completionPercentage: 50,
      completedMilestones: ['contract_signed', 'pickup'],
      nextAction: 'Verify port departure and generate QR code for milestone completion',
      lastUpdated: '2025-08-25T18:30:00Z',
      settled: false
    },
    {
      dealId: 'YH-2025-002',
      supplierName: 'Tropical Exports Ltd',
      commodity: 'Premium Coffee Beans',
      totalValue: 85000,
      escrowBalance: 85000,
      status: 'in_progress',
      currentMilestone: 'vessel_departed',
      currentMilestoneLabel: 'Vessel Departed',
      disbursementPercentage: 20,
      completionPercentage: 70,
      completedMilestones: ['contract_signed', 'pickup', 'port_out'],
      nextAction: 'Scan QR code to verify vessel departure',
      lastUpdated: '2025-08-25T17:45:00Z',
      settled: false
    },
    {
      dealId: 'YH-2025-003',
      supplierName: 'Mountain Spice Co',
      commodity: 'Cardamom & Spices',
      totalValue: 65000,
      escrowBalance: 65000,
      status: 'completed',
      currentMilestone: 'delivered',
      currentMilestoneLabel: 'Delivered',
      disbursementPercentage: 0,
      completionPercentage: 100,
      completedMilestones: ['contract_signed', 'pickup', 'port_out', 'vessel_departed', 'arrived', 'customs_in', 'warehouse_in', 'delivered'],
      nextAction: 'Execute final settlement',
      lastUpdated: '2025-08-25T16:20:00Z',
      settled: false
    },
    {
      dealId: 'YH-2025-004',
      supplierName: 'Coastal Fisheries',
      commodity: 'Frozen Seafood',
      totalValue: 95000,
      escrowBalance: 95000,
      status: 'pending_verification',
      currentMilestone: 'customs_in',
      currentMilestoneLabel: 'Customs In',
      disbursementPercentage: 10,
      completionPercentage: 85,
      completedMilestones: ['contract_signed', 'pickup', 'port_out', 'vessel_departed', 'arrived'],
      nextAction: 'Awaiting customs clearance documentation',
      lastUpdated: '2025-08-25T18:10:00Z',
      settled: false
    }
  ]);

  const customBreadcrumbs = [
    { label: 'Home', path: '/', icon: 'Home' },
    { label: 'Agent Portal', path: '/agent-portal-milestone-tracking', icon: 'Shield' },
    { label: 'Milestone Tracking', path: '/agent-portal-milestone-tracking', icon: 'CheckCircle' }
  ];

  const handleViewDetails = (deal) => {
    setSelectedDeal(deal);
  };

  const handleBackToList = () => {
    setSelectedDeal(null);
  };

  const handleGenerateQR = (milestone, deal) => {
    setCurrentMilestone(milestone);
    setSelectedDeal(deal);
    setShowQRGenerator(true);
  };

  const handleScanQR = (milestone, deal) => {
    setCurrentMilestone(milestone);
    setSelectedDeal(deal);
    setShowQRScanner(true);
  };

  const handleScanSuccess = (scanResult, milestone, deal) => {
    // Create HCS transaction for milestone completion
    const hcsTransaction = {
      id: '0x' + Math.random()?.toString(16)?.substr(2, 8),
      type: 'milestone_verification',
      status: 'confirmed',
      timestamp: new Date()?.toISOString(),
      amount: `$${scanResult?.amount?.toLocaleString()}`,
      description: `${milestone?.label} verified and disbursed`
    };

    // Create HTS transaction for disbursement
    const htsTransaction = {
      id: '0x' + Math.random()?.toString(16)?.substr(2, 8),
      type: 'funding_disbursement',
      status: 'confirmed',
      timestamp: new Date()?.toISOString(),
      amount: `$${scanResult?.amount?.toLocaleString()}`,
      description: `Milestone disbursement to supplier`
    };

    setTransactions(prev => [hcsTransaction, htsTransaction, ...prev]);

    // Update deal progress
    setDeals(prevDeals => 
      prevDeals?.map(d => {
        if (d?.dealId === deal?.dealId) {
          const newCompletedMilestones = [...d?.completedMilestones, milestone?.key];
          const milestones = ['contract_signed', 'pickup', 'port_out', 'vessel_departed', 'arrived', 'customs_in', 'warehouse_in', 'delivered'];
          const nextMilestoneIndex = milestones?.findIndex(m => m === milestone?.key) + 1;
          const nextMilestone = nextMilestoneIndex < milestones?.length ? milestones?.[nextMilestoneIndex] : 'delivered';
          
          return {
            ...d,
            completedMilestones: newCompletedMilestones,
            currentMilestone: nextMilestone,
            completionPercentage: Math.round((newCompletedMilestones?.length / 8) * 100),
            status: nextMilestone === 'delivered' && newCompletedMilestones?.length === 8 ? 'completed' : d?.status,
            lastUpdated: new Date()?.toISOString()
          };
        }
        return d;
      })
    );

    setShowQRScanner(false);
  };

  const handleViewSettlement = (deal) => {
    // Navigate to settlement dashboard with deal context
    window.location.href = `/settlement-audit-dashboard?deal=${deal?.dealId}`;
  };

  const handleLogout = () => {
    // Handle logout logic
    console.log('Logging out...');
  };

  useEffect(() => {
    // Initialize with some mock transactions
    const initialTransactions = [
      {
        id: '0x1a2b3c4d',
        type: 'milestone_verification',
        status: 'confirmed',
        timestamp: '2025-08-25T18:35:00Z',
        amount: '$31,250',
        description: 'Port Out milestone verified'
      },
      {
        id: '0x5e6f7g8h',
        type: 'funding_disbursement',
        status: 'confirmed',
        timestamp: '2025-08-25T18:36:00Z',
        amount: '$31,250',
        description: 'Disbursement to Green Valley Farms'
      }
    ];
    setTransactions(initialTransactions);
  }, []);

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
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole="agent"
      />
      {/* Proof Tray */}
      <ProofTray 
        isVisible={true}
        transactions={transactions}
      />
      {/* Main Content */}
      <div className={`transition-smooth ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-80'
      } pt-16`}>
        <div className={`flex ${showEscrowSidebar ? 'mr-80' : ''}`}>
          {/* Primary Content Area */}
          <div className="flex-1 p-6">
            {/* Breadcrumbs */}
            <BreadcrumbNavigation customBreadcrumbs={customBreadcrumbs} />

            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  Milestone Tracking
                </h1>
                <p className="text-muted-foreground">
                  Manage milestone verification and automated disbursements
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowEscrowSidebar(!showEscrowSidebar)}
                  iconName={showEscrowSidebar ? "PanelRightClose" : "PanelRightOpen"}
                  iconPosition="left"
                >
                  {showEscrowSidebar ? 'Hide' : 'Show'} Escrow
                </Button>
                <Link to="/settlement-audit-dashboard">
                  <Button
                    variant="default"
                    iconName="Search"
                    iconPosition="left"
                  >
                    Audit Dashboard
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Icon name="Package" size={24} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {deals?.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Active Deals</div>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                    <Icon name="CheckCircle" size={24} className="text-success" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {deals?.filter(d => d?.status === 'completed')?.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Completed</div>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                    <Icon name="Clock" size={24} className="text-warning" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      {deals?.filter(d => d?.status === 'pending_verification')?.length}
                    </div>
                    <div className="text-sm text-muted-foreground">Pending</div>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 shadow-[0_8px_30px_rgba(0,0,0,.06)]">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Icon name="Wallet" size={24} className="text-accent" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">
                      ${deals?.reduce((sum, deal) => sum + deal?.escrowBalance, 0)?.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Escrow</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content */}
            {!selectedDeal ? (
              <>
                {/* Deals Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {deals?.map((deal) => (
                    <DealCard
                      key={deal?.dealId}
                      deal={deal}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Deal Detail View */}
                <div className="mb-6">
                  <Button
                    variant="outline"
                    onClick={handleBackToList}
                    iconName="ArrowLeft"
                    iconPosition="left"
                  >
                    Back to Deals
                  </Button>
                </div>

                <MilestoneProgress
                  deal={selectedDeal}
                  onGenerateQR={handleGenerateQR}
                  onScanQR={handleScanQR}
                />
              </>
            )}
          </div>
        </div>

        {/* Escrow Sidebar */}
        {showEscrowSidebar && (
          <EscrowSidebar
            deals={deals}
            onViewSettlement={handleViewSettlement}
          />
        )}
      </div>
      {/* Modals */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScanSuccess={handleScanSuccess}
        currentMilestone={currentMilestone}
        deal={selectedDeal}
      />
      <QRGenerator
        isOpen={showQRGenerator}
        onClose={() => setShowQRGenerator(false)}
        milestone={currentMilestone}
        deal={selectedDeal}
      />
    </div>
  );
};

export default AgentPortalMilestoneTracking;