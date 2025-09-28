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


const InvestorPortalDashboard = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filters, setFilters] = useState({});
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [showFundModal, setShowFundModal] = useState(false);
  const [proofTransactions, setProofTransactions] = useState([]);

  // Mock KPI data
  const kpiData = [
    {
      title: "Total Value Locked",
      value: "$2.4M",
      subtitle: "Across 24 active deals",
      icon: "DollarSign",
      trend: "up",
      trendValue: "+12.5%",
      color: "primary"
    },
    {
      title: "Average APY",
      value: "11.2%",
      subtitle: "Weighted by investment size",
      icon: "TrendingUp",
      trend: "up",
      trendValue: "+0.8%",
      color: "success"
    },
    {
      title: "Active Deals",
      value: "24",
      subtitle: "8 fully funded",
      icon: "Package",
      trend: "up",
      trendValue: "+3",
      color: "accent"
    },
    {
      title: "Next Settlement",
      value: "Aug 28",
      subtitle: "$125K expected",
      icon: "Calendar",
      color: "warning"
    }
  ];

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

  const [deals, setDeals] = useState(mockDeals);
  const [filteredDeals, setFilteredDeals] = useState(mockDeals);

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

  const handleConfirmFunding = (fundingData) => {
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