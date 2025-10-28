import React, { useState, useEffect } from 'react';
import GlobalHeader from '../../components/ui/GlobalHeader';
import PortalSidebar from '../../components/ui/PortalSidebar';
import ProofTray from '../../components/ui/ProofTray';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import KPICard from './components/KPICard';
import DealFilters from './components/DealFilters';
import DealCard from './components/DealCard';
import PortfolioSummary from './components/PortfolioSummary';
import FundDealModal from './components/FundDealModal';
import Icon from '../../components/AppIcon';
import { useDashboardMetrics, useNFTsByToken, useRealTimeHCSMessages, useHashScanLinks } from '../../hooks/useMirrorNode';
import { invoiceApi } from '../../services/api';

interface Deal {
  id: string;
  title: string;
  description: string;
  faceValue: number;
  apr: number;
  tenor: number;
  expectedYield: number;
  raisedAmount: number;
  targetAmount: number;
  investorCount: number;
  riskScore: string;
  status: string;
  location: string;
  timeRemaining: string;
  nftId: string;
  listedDate: string;
  hashScanLink?: string;
  mirrorNodeLink?: string;
  [key: string]: any;
}

interface ProofTransaction {
  id: string;
  type: string;
  status: string;
  timestamp: string;
  amount?: string;
  description: string;
  transactionId?: string;
  hashScanLink?: string;
}

interface Filters {
  [key: string]: any;
}

const InvestorPortalDashboard: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filters>({});
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showFundModal, setShowFundModal] = useState<boolean>(false);
  const [proofTransactions, setProofTransactions] = useState<ProofTransaction[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);

  // Real-time dashboard metrics from Mirror Node
  const { data: dashboardMetrics, loading: metricsLoading, error: metricsError } = useDashboardMetrics();
  
  // Real-time HCS messages for proof tracking
  const { messages: hcsMessages } = useRealTimeHCSMessages(
    import.meta.env.VITE_HCS_TOPIC_ID || '0.0.123456'
  );

  // NFT data for deals (assuming deals are minted as NFTs)
  const { data: nftData, loading: nftLoading } = useNFTsByToken(
    import.meta.env.VITE_DEAL_TOKEN_ID || '0.0.123457',
    50
  );

  // HashScan link generator
  const { generateLinks } = useHashScanLinks();

  // Transform real dashboard metrics into KPI format
  const kpiData = React.useMemo(() => {
    if (!dashboardMetrics) {
      return [
        {
          title: "Total Value Locked",
          value: "Loading...",
          subtitle: "Fetching from Mirror Node",
          icon: "DollarSign",
          color: "primary"
        },
        {
          title: "Average APY",
          value: "Loading...",
          subtitle: "Calculating from on-chain data",
          icon: "TrendingUp",
          color: "success"
        },
        {
          title: "Active Deals",
          value: "Loading...",
          subtitle: "Counting NFTs",
          icon: "Package",
          color: "accent"
        },
        {
          title: "Network Status",
          value: "Loading...",
          subtitle: "Checking Hedera network",
          icon: "Calendar",
          color: "warning"
        }
      ];
    }

    return [
      {
        title: "Total Value Locked",
        value: `$${(dashboardMetrics.totalValueLocked / 1000000).toFixed(1)}M`,
        subtitle: `Across ${dashboardMetrics.activeDeals} active deals`,
        icon: "DollarSign",
        trend: dashboardMetrics.tvlChange >= 0 ? "up" : "down",
        trendValue: `${dashboardMetrics.tvlChange >= 0 ? '+' : ''}${dashboardMetrics.tvlChange.toFixed(1)}%`,
        color: "primary"
      },
      {
        title: "Average APY",
        value: `${dashboardMetrics.averageAPY.toFixed(1)}%`,
        subtitle: "Weighted by investment size",
        icon: "TrendingUp",
        trend: dashboardMetrics.apyChange >= 0 ? "up" : "down",
        trendValue: `${dashboardMetrics.apyChange >= 0 ? '+' : ''}${dashboardMetrics.apyChange.toFixed(1)}%`,
        color: "success"
      },
      {
        title: "Active Deals",
        value: dashboardMetrics.activeDeals.toString(),
        subtitle: `${dashboardMetrics.fundedDeals} fully funded`,
        icon: "Package",
        trend: dashboardMetrics.dealsChange >= 0 ? "up" : "down",
        trendValue: `${dashboardMetrics.dealsChange >= 0 ? '+' : ''}${dashboardMetrics.dealsChange}`,
        color: "accent"
      },
      {
        title: "Network TPS",
        value: dashboardMetrics.networkTPS.toFixed(1),
        subtitle: `${dashboardMetrics.networkStatus} network`,
        icon: "Activity",
        color: dashboardMetrics.networkStatus === 'healthy' ? "success" : "warning"
      }
    ];
  }, [dashboardMetrics]);

  // Mock deals data
  const mockDeals = [
    {
      id: 'DEAL-001',
      title: 'Premium Cocoa Export Deal',
      description: 'High-grade cocoa beans export from Ghana to Netherlands',
      faceValue: 125000,
      apr: 12.5,
      tenor: 90,
      expectedYield: 3843,
      raisedAmount: 93750,
      targetAmount: 125000,
      investorCount: 12,
      riskScore: 'A+',
      status: 'FUNDING_OPEN',
      location: 'Ghana',
      timeRemaining: '5 days left',
      nftId: '0x1a2b3c',
      listedDate: '3 days ago'
    },
    {
      id: 'DEAL-002',
      title: 'Organic Coffee Export',
      description: 'Certified organic coffee beans from Colombia',
      faceValue: 85000,
      apr: 10.8,
      tenor: 75,
      expectedYield: 1887,
      raisedAmount: 85000,
      targetAmount: 85000,
      investorCount: 8,
      riskScore: 'A',
      status: 'FUNDED',
      location: 'Colombia',
      timeRemaining: 'Funded',
      nftId: '0x2b3c4d',
      listedDate: '1 week ago'
    },
    {
      id: 'DEAL-003',
      title: 'Cashew Nuts Export Deal',
      description: 'Premium cashew nuts from Ivory Coast to USA',
      faceValue: 95000,
      apr: 13.2,
      tenor: 85,
      expectedYield: 2912,
      raisedAmount: 47500,
      targetAmount: 95000,
      investorCount: 6,
      riskScore: 'B+',
      status: 'FUNDING_OPEN',
      location: 'Ivory Coast',
      timeRemaining: '12 days left',
      nftId: '0x3c4d5e',
      listedDate: '2 days ago'
    },
    {
      id: 'DEAL-004',
      title: 'Vanilla Bean Export',
      description: 'Premium vanilla beans from Madagascar',
      faceValue: 150000,
      apr: 15.5,
      tenor: 120,
      expectedYield: 7671,
      raisedAmount: 112500,
      targetAmount: 150000,
      investorCount: 15,
      riskScore: 'B',
      status: 'FUNDING_OPEN',
      location: 'Madagascar',
      timeRemaining: '8 days left',
      nftId: '0x4d5e6f',
      listedDate: '5 days ago'
    },
    {
      id: 'DEAL-005',
      title: 'Shea Butter Export Deal',
      description: 'Raw shea butter from Burkina Faso',
      faceValue: 75000,
      apr: 9.5,
      tenor: 60,
      expectedYield: 1178,
      raisedAmount: 60000,
      targetAmount: 75000,
      investorCount: 10,
      riskScore: 'A',
      status: 'FUNDING_OPEN',
      location: 'Burkina Faso',
      timeRemaining: '15 days left',
      nftId: '0x5e6f7g',
      listedDate: '1 day ago'
    },
    {
      id: 'DEAL-006',
      title: 'Palm Oil Export',
      description: 'Sustainable palm oil from Indonesia',
      faceValue: 200000,
      apr: 11.8,
      tenor: 100,
      expectedYield: 6466,
      raisedAmount: 180000,
      targetAmount: 200000,
      investorCount: 22,
      riskScore: 'B+',
      status: 'FUNDING_OPEN',
      location: 'Indonesia',
      timeRemaining: '3 days left',
      nftId: '0x6f7g8h',
      listedDate: '6 days ago'
    }
  ];

  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);

  // Transform NFT data into deals format
  useEffect(() => {
    if (nftData?.nfts) {
      const transformedDeals = nftData.nfts.map((nft: any) => {
        const metadata = nft.metadata ? JSON.parse(atob(nft.metadata)) : {};
        return {
          id: `${nft.token_id}-${nft.serial_number}`,
          title: metadata.name || `Deal #${nft.serial_number}`,
          description: metadata.description || 'Invoice-backed trade finance deal',
          faceValue: metadata.faceValue || 100000,
          apr: metadata.apr || 10.0,
          tenor: metadata.tenor || 90,
          expectedYield: metadata.expectedYield || 0,
          raisedAmount: metadata.raisedAmount || 0,
          targetAmount: metadata.targetAmount || metadata.faceValue || 100000,
          investorCount: metadata.investorCount || 0,
          riskScore: metadata.riskScore || 'B',
          status: metadata.status || 'FUNDING_OPEN',
          location: metadata.location || 'Unknown',
          timeRemaining: metadata.timeRemaining || 'TBD',
          nftId: `${nft.token_id}.${nft.serial_number}`,
          listedDate: new Date(nft.created_timestamp).toLocaleDateString(),
          hashScanLink: `https://hashscan.io/testnet/token/${nft.token_id}/${nft.serial_number}`,
          mirrorNodeLink: `https://testnet.mirrornode.hedera.com/api/v1/tokens/${nft.token_id}/nfts/${nft.serial_number}`
        };
      });
      setDeals(transformedDeals);
    } else if (!nftLoading) {
      // Fallback to mock data if no NFT data available
      setDeals(mockDeals);
    }
  }, [nftData, nftLoading]);

  // Update proof transactions from HCS messages
  useEffect(() => {
    if (hcsMessages && hcsMessages.length > 0) {
      const proofTxs = hcsMessages.map((msg: any) => {
        const messageData = msg.message ? JSON.parse(atob(msg.message)) : {};
        return {
          id: msg.sequence_number,
          type: messageData.type || 'TRANSACTION',
          description: messageData.description || 'On-chain transaction',
          timestamp: new Date(msg.consensus_timestamp).toISOString(),
          amount: messageData.amount || '',
          status: 'completed',
          transactionId: messageData.transactionId || '',
          hashScanLink: `https://hashscan.io/testnet/transaction/${messageData.transactionId || ''}`
        };
      });
      setProofTransactions(prev => [...prev, ...proofTxs]);
    }
  }, [hcsMessages]);

  // Mock portfolio data
  const portfolioData = {
    totalInvested: 485000,
    currentValue: 512750,
    totalReturns: 27750,
    activeDeals: 8
  };

  // Mock saved searches
  const savedSearches = [
    { name: 'High APR Deals (>12%)', filters: { aprRange: '12+' } },
    { name: 'Low Risk Investments', filters: { riskScore: 'low' } },
    { name: 'Short Term (<60 days)', filters: { tenor: '60' } }
  ];

  // Filter deals based on current filters
  useEffect(() => {
    let filtered = deals;

    if (filters?.searchTerm) {
      filtered = filtered?.filter(deal => 
        deal?.title?.toLowerCase()?.includes(filters?.searchTerm?.toLowerCase()) ||
        deal?.description?.toLowerCase()?.includes(filters?.searchTerm?.toLowerCase())
      );
    }

    if (filters?.riskScore) {
      const riskMap = {
        'low': ['A+', 'A'],
        'medium': ['B+', 'B'],
        'high': ['C+', 'C']
      };
      filtered = filtered?.filter(deal => riskMap?.[filters?.riskScore]?.includes(deal?.riskScore));
    }

    if (filters?.aprRange) {
      filtered = filtered?.filter(deal => {
        const apr = deal?.apr;
        switch (filters?.aprRange) {
          case '0-5': return apr >= 0 && apr <= 5;
          case '5-10': return apr > 5 && apr <= 10;
          case '10-15': return apr > 10 && apr <= 15;
          case '15+': return apr > 15;
          default: return true;
        }
      });
    }

    if (filters?.tenor) {
      filtered = filtered?.filter(deal => {
        const tenor = deal?.tenor;
        switch (filters?.tenor) {
          case '30': return tenor <= 30;
          case '60': return tenor <= 60;
          case '90': return tenor <= 90;
          case '120': return tenor > 90;
          default: return true;
        }
      });
    }

    if (filters?.dealSize) {
      filtered = filtered?.filter(deal => {
        const size = deal?.faceValue;
        switch (filters?.dealSize) {
          case '0-50k': return size <= 50000;
          case '50k-100k': return size > 50000 && size <= 100000;
          case '100k-250k': return size > 100000 && size <= 250000;
          case '250k+': return size > 250000;
          default: return true;
        }
      });
    }

    setFilteredDeals(filtered);
  }, [filters, deals]);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleFundDeal = (deal) => {
    setSelectedDeal(deal);
    setShowFundModal(true);
  };

  const handleFundingSubmit = (fundingData: any) => {
    // Add transaction to proof tray
    const newTransaction = {
      id: fundingData?.transactionHash,
      type: 'funding_disbursement',
      status: 'confirmed',
      timestamp: new Date()?.toISOString(),
      amount: `$${fundingData?.amount?.toLocaleString()}`,
      description: `Funded ${selectedDeal?.title}`
    };

    setProofTransactions(prev => [newTransaction, ...prev]);

    // Update deal funding
    setDeals(prev => prev?.map(deal => 
      deal?.id === fundingData?.dealId 
        ? { 
            ...deal, 
            raisedAmount: deal?.raisedAmount + fundingData?.amount,
            investorCount: deal?.investorCount + 1,
            status: (deal?.raisedAmount + fundingData?.amount) >= deal?.targetAmount ? 'FUNDED' : 'FUNDING_OPEN'
          }
        : deal
    ));

    setShowFundModal(false);
    setSelectedDeal(null);
  };

  const handleLogout = () => {
    // Handle logout logic
    console.log('Logging out...');
  };

  const customBreadcrumbs = [
    { label: 'Home', path: '/', icon: 'Home' },
    { label: 'Investor Portal', path: '/investor-portal-dashboard', icon: 'TrendingUp' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Global Header */}
      <GlobalHeader 
        userRole="investor" 
        userName="Sarah Chen" 
        onLogout={handleLogout} 
      />
      {/* Sidebar */}
      <PortalSidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole="investor"
      />
      {/* Proof Tray */}
      <ProofTray 
        isVisible={true}
        transactions={proofTransactions}
      />
      {/* Main Content */}
      <main className={`pt-16 transition-smooth ${
        sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-80'
      }`}>
        <div className="p-6">
          {/* Breadcrumb Navigation */}
          <BreadcrumbNavigation customBreadcrumbs={customBreadcrumbs} />

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Investor Portal Dashboard</h1>
            <p className="text-muted-foreground">
              Discover and fund high-yield supply chain finance deals with blockchain transparency
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel - Filters */}
            <div className="lg:col-span-3">
              <DealFilters 
                onFiltersChange={handleFiltersChange}
                savedSearches={savedSearches}
              />
            </div>

            {/* Center Panel - Deal Listings */}
            <div className="lg:col-span-6">
              <div className="space-y-6">
                {/* Results Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">
                    Available Deals ({filteredDeals?.length})
                  </h2>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <span>Sort by:</span>
                    <select className="bg-background border border-border rounded-lg px-3 py-1 text-foreground">
                      <option>Highest APR</option>
                      <option>Lowest Risk</option>
                      <option>Shortest Tenor</option>
                      <option>Largest Size</option>
                    </select>
                  </div>
                </div>

                {/* Deal Cards */}
                <div className="space-y-6">
                  {filteredDeals?.map((deal) => (
                    <DealCard
                      key={deal?.id}
                      deal={deal}
                      onFundDeal={handleFundDeal}
                    />
                  ))}
                </div>

                {/* Load More */}
                {filteredDeals?.length > 0 && (
                  <div className="text-center pt-6">
                    <button className="text-primary hover:text-primary/80 font-medium transition-institutional">
                      Load More Deals
                    </button>
                  </div>
                )}

                {/* No Results */}
                {filteredDeals?.length === 0 && (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icon name="Search" size={32} className="text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No deals found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your filters to see more investment opportunities
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Portfolio Summary */}
            <div className="lg:col-span-3">
              <PortfolioSummary 
                portfolioData={portfolioData}
              />
            </div>
          </div>
        </div>
      </main>
      {/* Fund Deal Modal */}
      <FundDealModal
        isOpen={showFundModal}
        onClose={() => setShowFundModal(false)}
        deal={selectedDeal}
        onConfirmFunding={handleConfirmFunding}
      />
    </div>
  );
};

export default InvestorPortalDashboard;