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
import { InvoicesApi } from '../../services/invoicesApi';
import { MilestonesApi } from '../../services/milestonesApi';
import { useMilestoneUpdates } from '../../hooks/useWebSocket';

const AgentPortalMilestoneTracking = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showEscrowSidebar, setShowEscrowSidebar] = useState(true);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [milestoneSubscriptions, setMilestoneSubscriptions] = useState(new Map());
  const [realTimeUpdates, setRealTimeUpdates] = useState([]);

  // WebSocket for real-time milestone updates
  const {
    isConnected: wsConnected,
    connectionStatus,
    updates: wsUpdates,
    latestUpdate,
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe
  } = useMilestoneUpdates(
    selectedDeal?.dealId,
    selectedDeal?.tokenId,
    (update) => {
      console.log('Real-time milestone update:', update);
      setRealTimeUpdates(prev => [update, ...prev.slice(0, 19)]); // Keep last 20 updates
      
      // Update deal progress if relevant
      if (update.type === 'deal_progress' && update.dealId === selectedDeal?.dealId) {
        setDeals(prev => prev.map(deal => 
          deal.dealId === update.dealId 
            ? { ...deal, completionPercentage: update.data.progress, status: update.data.status }
            : deal
        ));
      }
      
      // Add to transactions if it's a milestone update
      if (update.type === 'milestone_created' || update.type === 'milestone_updated') {
        const hcsTransaction = {
          id: update.data.hcsMessageId || '0x' + Math.random()?.toString(16)?.substr(2, 8),
          type: 'milestone_verification',
          status: 'confirmed',
          timestamp: new Date()?.toISOString(),
          amount: `$${update.data.amount?.toLocaleString() || '0'}`,
          description: `${update.data.milestone} verified and recorded on HCS`,
          hashscanLink: `https://hashscan.io/testnet/topic/${update.data.topicId}/message/${update.data.hcsMessageId}`
        };
        setTransactions(prev => [hcsTransaction, ...prev]);
      }
    }
  );

  // Load real deals data from API
  const loadDeals = async () => {
    try {
      setLoading(true);
      const invoices = await InvoicesApi.getInvoices();
      
      // Transform invoices to deals format
      const transformedDeals = invoices.map(invoice => ({
        dealId: invoice.invoiceNumber,
        supplierName: invoice.supplierName,
        commodity: invoice.description || 'Agricultural Products',
        totalValue: invoice.amount,
        escrowBalance: invoice.amount,
        status: invoice.status === 'paid' ? 'completed' : 
                invoice.status === 'funded' ? 'in_progress' : 'pending_verification',
        currentMilestone: getCurrentMilestone(invoice),
        currentMilestoneLabel: getCurrentMilestoneLabel(invoice),
        disbursementPercentage: getDisbursementPercentage(invoice),
        completionPercentage: getCompletionPercentage(invoice),
        completedMilestones: getCompletedMilestones(invoice),
        nextAction: getNextAction(invoice),
        lastUpdated: invoice.updatedAt,
        settled: invoice.status === 'paid',
        tokenId: invoice.tokenId,
        serial: invoice.serial
      }));
      
      setDeals(transformedDeals);
      
      // Subscribe to milestone updates for each deal
      transformedDeals.forEach(deal => {
        if (deal.tokenId && deal.serial) {
          subscribeMilestoneUpdates(deal.tokenId, deal.serial, deal.dealId);
        }
      });
      
    } catch (err) {
      console.error('Error loading deals:', err);
      setError('Failed to load deals data');
    } finally {
      setLoading(false);
    }
  };

  // Helper functions to transform invoice data
  const getCurrentMilestone = (invoice) => {
    if (invoice.status === 'paid') return 'delivered';
    if (invoice.status === 'funded') return 'port_out';
    return 'contract_signed';
  };

  const getCurrentMilestoneLabel = (invoice) => {
    if (invoice.status === 'paid') return 'Delivered';
    if (invoice.status === 'funded') return 'Port Out';
    return 'Contract Signed';
  };

  const getDisbursementPercentage = (invoice) => {
    if (invoice.status === 'paid') return 0;
    if (invoice.status === 'funded') return 25;
    return 0;
  };

  const getCompletionPercentage = (invoice) => {
    if (invoice.status === 'paid') return 100;
    if (invoice.status === 'funded') return 50;
    return 25;
  };

  const getCompletedMilestones = (invoice) => {
    if (invoice.status === 'paid') {
      return ['contract_signed', 'pickup', 'port_out', 'vessel_departed', 'arrived', 'customs_in', 'warehouse_in', 'delivered'];
    }
    if (invoice.status === 'funded') {
      return ['contract_signed', 'pickup'];
    }
    return ['contract_signed'];
  };

  const getNextAction = (invoice) => {
    if (invoice.status === 'paid') return 'Execute final settlement';
    if (invoice.status === 'funded') return 'Verify port departure and generate QR code';
    return 'Awaiting funding confirmation';
  };

  // Subscribe to real-time milestone updates
  const subscribeMilestoneUpdates = (tokenId, serial, dealId) => {
    const cleanup = MilestonesApi.subscribeMilestoneUpdates(
      tokenId,
      serial,
      (milestones) => {
        // Update deal with latest milestone data
        setDeals(prevDeals => 
          prevDeals.map(deal => {
            if (deal.dealId === dealId) {
              return {
                ...deal,
                // Update based on milestone data
                lastUpdated: new Date().toISOString()
              };
            }
            return deal;
          })
        );
      }
    );
    
    setMilestoneSubscriptions(prev => new Map(prev.set(dealId, cleanup)));
  };

  // Mock fallback data for development
  const mockDeals = [
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
  ];

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

  const handleScanSuccess = async (scanResult, milestone, deal) => {
    try {
      // Create milestone on blockchain via API
      const milestoneData = {
        tokenId: deal.tokenId,
        serial: deal.serial,
        milestone: milestone.key,
        metadata: {
          scanResult,
          timestamp: new Date().toISOString(),
          agent: 'Sarah Chen',
          location: scanResult.location || 'Unknown'
        }
      };

      const createdMilestone = await MilestonesApi.createMilestone(milestoneData);
      
      // Broadcast milestone update via WebSocket
      if (wsConnected) {
        const updateMessage = {
          type: 'milestone_created',
          dealId: deal.dealId,
          tokenId: deal.tokenId,
          data: {
            milestone: milestone.key,
            amount: scanResult.amount || 0,
            hcsMessageId: createdMilestone.hcsMessageId,
            topicId: createdMilestone.topicId,
            timestamp: new Date().toISOString()
          }
        };
        // The WebSocket hook will automatically handle the broadcast
      }

      // Create HCS transaction for milestone completion
      const hcsTransaction = {
        id: createdMilestone.hcsMessageId || '0x' + Math.random()?.toString(16)?.substr(2, 8),
        type: 'milestone_verification',
        status: 'confirmed',
        timestamp: new Date()?.toISOString(),
        amount: `$${scanResult?.amount?.toLocaleString()}`,
        description: `${milestone?.label} verified and recorded on HCS`,
        hashscanLink: `https://hashscan.io/testnet/topic/${createdMilestone.topicId}/message/${createdMilestone.hcsMessageId}`
      };

      // Create HTS transaction for disbursement
      const htsTransaction = {
        id: '0x' + Math.random()?.toString(16)?.substr(2, 8),
        type: 'funding_disbursement',
        status: 'confirmed',
        timestamp: new Date()?.toISOString(),
        amount: `$${scanResult?.amount?.toLocaleString()}`,
        description: `Milestone disbursement to supplier`,
        hashscanLink: `https://hashscan.io/testnet/transaction/${createdMilestone.transactionId}`
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
    } catch (error) {
      console.error('Error creating milestone:', error);
      // Show error to user
      alert('Failed to record milestone. Please try again.');
    }
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
    // Load real deals data on component mount
    loadDeals();

    // Cleanup subscriptions on unmount
    return () => {
      milestoneSubscriptions.forEach(cleanup => cleanup());
    };
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading milestone data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Icon name="AlertCircle" size={48} className="text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Error Loading Data</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadDeals}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Use mock data if no real data available
  const displayDeals = deals.length > 0 ? deals : mockDeals;

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
                {/* WebSocket Connection Status */}
                <div className="flex items-center space-x-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${
                    wsConnected ? 'bg-success' : 'bg-destructive'
                  }`}></div>
                  <span className="text-sm text-muted-foreground">
                    {wsConnected ? 'Real-time updates active' : 'Connection lost'}
                  </span>
                  {realTimeUpdates.length > 0 && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                      {realTimeUpdates.length} updates
                    </span>
                  )}
                </div>
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
                      {displayDeals?.length}
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
                      {displayDeals?.filter(d => d?.status === 'completed')?.length}
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
                      {displayDeals?.filter(d => d?.status === 'pending_verification')?.length}
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
                      ${displayDeals?.reduce((sum, deal) => sum + deal?.escrowBalance, 0)?.toLocaleString()}
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
                  {displayDeals?.map((deal) => (
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
            deals={displayDeals}
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