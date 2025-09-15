import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import GlobalHeader from '../../components/ui/GlobalHeader';
import PortalSidebar from '../../components/ui/PortalSidebar';
import ProofTray from '../../components/ui/ProofTray';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import DealHeader from './components/DealHeader';
import DealTabs from './components/DealTabs';
import FundingWidget from './components/FundingWidget';
import ActivityFeed from './components/ActivityFeed';
import FundingModal from './components/FundingModal';

const DealDetailView = () => {
  const { dealId } = useParams();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [deal, setDeal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFundingModalOpen, setIsFundingModalOpen] = useState(false);
  const [fundingAmount, setFundingAmount] = useState('');

  // Mock deal data
  const mockDeal = {
    id: dealId || 'DEAL-2025-001',
    title: 'Premium Cocoa Beans Export - Ghana',
    faceValue: 125000,
    apr: 12.5,
    tenor: 90,
    riskScore: 8.2,
    expectedYield: 3906,
    raisedAmount: 87500,
    targetAmount: 125000,
    status: 'FUNDING_OPEN',
    minInvestment: 5000,
    maxInvestment: 50000,
    invoiceNumber: 'INV-2025-001',
    issueDate: '2025-08-20T00:00:00Z',
    dueDate: '2025-11-18T00:00:00Z',
    settlementDate: '2025-11-20T00:00:00Z',
    buyer: 'European Chocolate Manufacturing Ltd.',
    collateral: 'Invoice + Bill of Lading',
    supplier: {
      name: 'Ghana Premium Cocoa Exports Ltd.',
      location: 'Accra, Ghana',
      industry: 'Agricultural Exports',
      creditRating: 'A-'
    },
    nft: {
      tokenId: '0.0.123456',
      serialNumber: '1',
      mintTxId: '0x1a2b3c4d5e6f789012345678901234567890abcdef1234567890abcdef123456',
      metadataUri: 'hfs://0.0.789012/metadata.json',
      metadata: {
        name: 'Invoice NFT - INV-2025-001',
        description: 'Tokenized invoice for premium cocoa beans export',
        image: 'hfs://0.0.789012/invoice-image.jpg',
        attributes: [
          { trait_type: 'Face Value', value: '$125,000' },
          { trait_type: 'APR', value: '12.5%' },
          { trait_type: 'Tenor', value: '90 days' },
          { trait_type: 'Supplier', value: 'Ghana Premium Cocoa Exports Ltd.' }
        ]
      }
    }
  };

  // Mock activity data for ActivityFeed
  const mockActivities = [
    {
      id: '1',
      type: 'investment',
      timestamp: '2025-08-25T18:35:00Z',
      user: 'Sarah Chen',
      amount: '$15,000',
      description: 'New investment received'
    },
    {
      id: '2',
      type: 'milestone',
      timestamp: '2025-08-25T17:20:00Z',
      user: 'System',
      description: 'Port Out milestone verified'
    }
  ];

  const mockTransactions = [
    {
      id: '0x1a2b3c4d',
      type: 'investment',
      status: 'confirmed',
      timestamp: '2025-08-25T18:35:00Z',
      amount: '$15,000',
      description: 'Investment in cocoa export deal'
    },
    {
      id: '0x5e6f7g8h',
      type: 'milestone_verification',
      status: 'confirmed',
      timestamp: '2025-08-25T17:20:00Z',
      amount: '$31,250',
      description: 'Port Out milestone verified'
    }
  ];

  useEffect(() => {
    // Simulate API call to fetch deal data
    const fetchDeal = async () => {
      setIsLoading(true);
      try {
        // Mock API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDeal(mockDeal);
      } catch (error) {
        console.error('Failed to fetch deal:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeal();
  }, [dealId]);

  const handleFunding = async (amount) => {
    setFundingAmount(amount?.toString());
    setIsFundingModalOpen(true);
  };

  const handleFundingConfirm = (txHash) => {
    // Update deal state with new funding
    setDeal(prev => ({
      ...prev,
      raisedAmount: prev?.raisedAmount + parseFloat(fundingAmount),
      status: (prev?.raisedAmount + parseFloat(fundingAmount)) >= prev?.targetAmount ? 'FUNDED' : 'FUNDING_OPEN'
    }));
    
    setFundingAmount('');
    setIsFundingModalOpen(false);
  };

  const handleLogout = () => {
    // Handle logout logic here
    console.log('User logged out');
  };

  const customBreadcrumbs = [
    { label: 'Home', path: '/', icon: 'Home' },
    { label: 'Investor Portal', path: '/investor-portal-dashboard', icon: 'TrendingUp' },
    { label: 'Deal Details', path: '/deal-detail-view', icon: 'FileText' },
    { label: deal?.id || 'Loading...', path: `/deal-detail-view/${dealId}`, icon: 'Hash' }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <GlobalHeader userRole="investor" userName="Sarah Chen" onLogout={handleLogout} />
        <PortalSidebar 
          isCollapsed={isSidebarCollapsed} 
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          userRole="investor"
        />
        
        <main className={`pt-16 transition-smooth ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-80'}`}>
          <div className="p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Loading deal details...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-background">
        <GlobalHeader userRole="investor" userName="Sarah Chen" onLogout={handleLogout} />
        <PortalSidebar 
          isCollapsed={isSidebarCollapsed} 
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          userRole="investor"
        />
        
        <main className={`pt-16 transition-smooth ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-80'}`}>
          <div className="p-6">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-foreground mb-2">Deal Not Found</h2>
              <p className="text-muted-foreground">The requested deal could not be found.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GlobalHeader userRole="investor" userName="Sarah Chen" onLogout={handleLogout} />
      <PortalSidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        userRole="investor"
      />
      <ProofTray transactions={mockTransactions} />
      
      <main className={`pt-16 transition-smooth ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-80'}`}>
        <div className="p-6">
          <BreadcrumbNavigation customBreadcrumbs={customBreadcrumbs} />
          
          {/* Deal Header */}
          <div className="mb-8">
            <DealHeader deal={deal} />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Main Content - 8 columns */}
            <div className="xl:col-span-8 space-y-8">
              <DealTabs deal={deal} />
            </div>

            {/* Sidebar - 4 columns */}
            <div className="xl:col-span-4 space-y-6">
              <FundingWidget deal={deal} onFund={handleFunding} />
              <ActivityFeed activities={mockActivities} />
            </div>
          </div>
        </div>
      </main>

      {/* Funding Modal */}
      <FundingModal
        isOpen={isFundingModalOpen}
        onClose={() => setIsFundingModalOpen(false)}
        deal={deal}
        fundingAmount={fundingAmount}
        onConfirm={handleFundingConfirm}
      />
    </div>
  );
};

export default DealDetailView;