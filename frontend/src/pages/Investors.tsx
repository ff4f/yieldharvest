import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  PieChart,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Star,
  Building,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEligibleInvoices } from '@/hooks/useInvoices'
import { useCreateFunding } from '@/hooks/useFunding'
import { InvoiceProofPill, FundingProofPill } from '@/components/ProofPill'
import { Invoice } from '@/types/api'

interface InvestmentStats {
  totalOpportunities: number
  totalValue: number
  averageReturn: number
  activeInvestors: number
}

const Investors: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  
  const { data: eligibleInvoices, isLoading, error, refetch } = useEligibleInvoices()
  const createFundingMutation = useCreateFunding()
  const [selectedFilter, setSelectedFilter] = useState('all')
  
  // Calculate stats from real data
  const getInvestmentStats = (): InvestmentStats => {
    if (!eligibleInvoices?.data) {
      return {
        totalOpportunities: 0,
        totalValue: 0,
        averageReturn: 0,
        activeInvestors: 0
      }
    }
    
    const invoices = eligibleInvoices.data
    const totalValue = invoices.reduce((sum, invoice) => sum + parseFloat(invoice.amount), 0)
    
    return {
      totalOpportunities: invoices.length,
      totalValue,
      averageReturn: 8.5, // This would come from historical data
      activeInvestors: 156 // This would come from user analytics
    }
  }
  
  const stats = getInvestmentStats()
  
  const handleFundInvoice = async (invoiceId: string, amount: string) => {
    try {
      await createFundingMutation.mutateAsync({ 
        invoiceId, 
        amount: parseFloat(amount),
        investorId: 'current-user' // TODO: Get from auth context
      })
      refetch() // Refresh the list after funding
    } catch (error) {
      console.error('Error funding invoice:', error)
    }
  }

  const getRiskColor = (dueDate: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysUntilDue > 60) {
      return 'bg-green-100 text-green-800' // Low risk - long term
    } else if (daysUntilDue > 30) {
      return 'bg-yellow-100 text-yellow-800' // Medium risk
    } else {
      return 'bg-red-100 text-red-800' // High risk - short term
    }
  }

  const filteredInvoices = eligibleInvoices?.data?.filter((invoice: Invoice) => {
    const matchesSearch = searchTerm === '' || 
      invoice.buyerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  }) || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading investor data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investors</h1>
          <p className="text-muted-foreground">
            Manage investor relationships and investment opportunities
          </p>
        </div>
        <Button>
          <Users className="mr-2 h-4 w-4" />
          Invite Investors
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Opportunities</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOpportunities}</div>
            <p className="text-xs text-muted-foreground">
              Available for investment
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for investment
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Investors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeInvestors}</div>
            <p className="text-xs text-muted-foreground">
              Platform participants
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Return</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.averageReturn.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Expected annual return
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Investment Opportunities */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Investment Opportunities</CardTitle>
                  <CardDescription>
                    Available invoices for factoring investment
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search opportunities..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <select
                    value={selectedFilter}
                    onChange={(e) => setSelectedFilter(e.target.value)}
                    className="px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="all">All Risk Levels</option>
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="flex items-center gap-2 p-4 border border-red-200 rounded-lg bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">Error loading opportunities</span>
                </div>
              )}
              
              <div className="space-y-4">
                {filteredInvoices.map((invoice: Invoice) => {
                  const amount = parseFloat(invoice.amount)
                  
                  return (
                    <div key={invoice.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{invoice.buyerId}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(invoice.dueDate)}`}>
                              Risk Level
                            </span>
                            <InvoiceProofPill invoice={invoice} variant="compact" />
                          </div>
                          <p className="text-sm text-muted-foreground">{invoice.invoiceNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${amount.toLocaleString()}</p>
                          <p className="text-sm text-green-600 font-medium">8.5% return</p>
                        </div>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">Invoice factoring opportunity</p>
                      
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Due: {new Date(invoice.dueDate).toLocaleDateString()}</span>
                          <span>Status: {invoice.status}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="mr-2 h-3 w-3" />
                            View Details
                          </Button>
                          <Button 
                             size="sm" 
                             onClick={() => createFundingMutation.mutate({ 
                               invoiceId: invoice.id, 
                               amount: parseFloat(invoice.amount),
                               investorId: 'current-user' // TODO: Get from auth context
                             })}
                             disabled={createFundingMutation.isPending}
                           >
                             {createFundingMutation.isPending ? (
                               <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                             ) : null}
                             Fund Invoice
                           </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                
                {filteredInvoices.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    No investment opportunities available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Investment Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Investment Summary</CardTitle>
              <CardDescription>
                Overview of investment opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Total Opportunities</p>
                    <p className="text-sm text-muted-foreground">Available for funding</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{stats.totalOpportunities}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Total Value</p>
                    <p className="text-sm text-muted-foreground">Combined invoice value</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">${stats.totalValue.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Expected Return</p>
                    <p className="text-sm text-muted-foreground">Average annual return</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">{stats.averageReturn}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Platform Metrics */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Platform Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Active Investors</span>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3 text-blue-500" />
                  <span className="font-medium">
                    {stats.activeInvestors}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg. Return Rate</span>
                <span className="font-medium">
                  {stats.averageReturn}%
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-green-600">94.2%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Platform Growth</span>
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                  <span className="font-medium text-green-600">+15.3%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Investors