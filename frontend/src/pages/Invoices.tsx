import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Search, Filter, Download, Eye, DollarSign, Loader2, AlertCircle, Activity, ExternalLink, Hash, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { InvoiceProofPill } from '@/components/ProofPill'
import { ProofBadges } from '@/components/ProofLinks'
import { useMilestoneUpdates } from '@/hooks/useWebSocket'
import { Invoice, InvoiceFilters } from '@/types/api'

const Invoices: React.FC = () => {
  const [filters, setFilters] = useState<InvoiceFilters>({
    page: 1,
    limit: 10
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [recentUpdates, setRecentUpdates] = useState<any[]>([])
  
  const { data, isLoading, error, refetch } = useInvoices(filters)
  
  // WebSocket for real-time updates
  useMilestoneUpdates(
    '', // dealId - listen to all deals
    '', // invoiceId - listen to all invoices
    (update: any) => {
      console.log('Invoice update received:', update)
      setRecentUpdates(prev => [update, ...prev.slice(0, 4)]) // Keep last 5 updates
      // Trigger refetch when invoice updates are received
      if (update.type === 'invoice_status_change' || update.type === 'invoice_minted') {
        refetch()
      }
    }
  )

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'ISSUED':
        return 'text-yellow-600 bg-yellow-100'
      case 'FUNDED':
        return 'text-blue-600 bg-blue-100'
      case 'PAID':
        return 'text-green-600 bg-green-100'
      case 'OVERDUE':
        return 'text-red-600 bg-red-100'
      case 'CANCELLED':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters(prev => ({ ...prev, page: 1 }))
    refetch()
  }
  
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status)
    setFilters(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status,
      page: 1
    }))
  }
  
  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }))
  }

  const formatCurrency = (amount: string, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(parseFloat(amount))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Calculate Mirror Node stats from enriched invoice data
  const mirrorNodeStats = React.useMemo(() => {
    if (!data?.data) return { nftCount: 0, hcsMessages: 0, filesStored: 0 }
    
    const nftCount = data.data.filter(invoice => invoice.onChainData?.nftInfo).length
    const hcsMessages = data.data.reduce((sum, invoice) => 
      sum + (invoice.onChainData?.hcsTimeline?.length || 0), 0)
    const filesStored = data.data.filter(invoice => invoice.onChainData?.fileInfo).length
    
    return { nftCount, hcsMessages, filesStored }
  }, [data?.data])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Manage and track your invoices with blockchain proof
          </p>
        </div>
        <Link to="/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </Link>
      </div>

      {/* Mirror Node Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NFTs Minted</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mirrorNodeStats.nftCount}</div>
            <p className="text-xs text-muted-foreground">
              Invoices tokenized on Hedera
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HCS Messages</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mirrorNodeStats.hcsMessages}</div>
            <p className="text-xs text-muted-foreground">
              Status updates on-chain
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Files Stored</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mirrorNodeStats.filesStored}</div>
            <p className="text-xs text-muted-foreground">
              Documents on HFS
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Updates */}
      {recentUpdates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Real-time Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentUpdates.map((update, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm">{update.message || 'Invoice updated'}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(update.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {update.transactionId && (
                    <a
                      href={`https://hashscan.io/testnet/transaction/${update.transactionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View Tx
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  data-testid="invoice-search-input"
                />
              </div>
            </form>
            
            <div className="flex gap-2">
              {['all', 'ISSUED', 'FUNDED', 'PAID', 'OVERDUE'].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusFilter(status)}
                  data-testid={`status-filter-${status.toLowerCase()}`}
                >
                  {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
          <CardDescription>
            {data?.pagination?.total ? `${data.pagination.total} total invoices` : 'Loading invoices...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading invoices...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
              <p className="text-red-600 mb-4">Failed to load invoices</p>
              <Button onClick={() => refetch()} variant="outline">
                Try Again
              </Button>
            </div>
          ) : !data?.data?.length ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No invoices found</p>
              <Link to="/invoices/new">
                <Button>Create Your First Invoice</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.data?.map((invoice: Invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors" data-testid={`invoice-card-${invoice.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <h3 className="font-semibold">
                          <Link 
                            to={`/invoices/${invoice.id}`}
                            className="text-blue-600 hover:underline font-medium"
                            data-testid={`invoice-link-${invoice.id}`}
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </h3>
                        <span className="text-muted-foreground">
                          {invoice.supplier?.name || 'Unknown Supplier'}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                        
                        {/* Proof Links Badges */}
                        {invoice.proofLinks && invoice.proofLinks.length > 0 && (
                          <ProofBadges proofLinks={invoice.proofLinks} />
                        )}
                        
                        {/* Mirror Node Indicators (fallback for legacy data) */}
                        <div className="flex items-center gap-2">
                          {invoice.onChainData?.nftInfo && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              <Hash className="h-3 w-3" />
                              NFT
                            </div>
                          )}
                          {invoice.onChainData?.fileInfo && (
                            <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                              <FileText className="h-3 w-3" />
                              HFS
                            </div>
                          )}
                          {invoice.onChainData?.hcsTimeline && invoice.onChainData.hcsTimeline.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                              <Activity className="h-3 w-3" />
                              {invoice.onChainData.hcsTimeline.length} HCS
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Due Date</p>
                          <p className="font-medium">{formatDate(invoice.dueDate)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Created</p>
                          <p className="font-medium">{formatDate(invoice.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Funding</p>
                          <p className="font-medium">
                            {invoice.fundings?.length ? 
                              `${formatCurrency(invoice.fundings.reduce((sum, f) => sum + parseFloat(f.amount), 0).toString(), invoice.currency)}` : 
                              'Not funded'
                            }
                          </p>
                        </div>
                      </div>
                      
                      {/* On-chain Data Summary */}
                      {invoice.onChainData && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-xs">
                              {invoice.onChainData.nftInfo && (
                                <div className="flex items-center gap-1">
                                  <Hash className="h-3 w-3 text-blue-600" />
                                  <span className="font-mono">{invoice.onChainData.nftInfo.tokenId}</span>
                                </div>
                              )}
                              {invoice.onChainData.fileInfo && (
                                <div className="flex items-center gap-1">
                                  <FileText className="h-3 w-3 text-green-600" />
                                  <span className="font-mono">{invoice.onChainData.fileInfo.fileId}</span>
                                </div>
                              )}
                              {invoice.topicId && (
                                <div className="flex items-center gap-1">
                                  <Activity className="h-3 w-3 text-purple-600" />
                                  <span className="font-mono">{invoice.topicId}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {invoice.onChainData.nftInfo && (
                                <a
                                  href={`https://hashscan.io/testnet/token/${invoice.onChainData.nftInfo.tokenId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  HashScan
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Link to={`/invoices/${invoice.id}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                      
                      <Button size="sm" variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                      
                      {/* Proof Pills */}
                      <InvoiceProofPill invoice={invoice} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          {data && data.pagination.total > data.pagination.limit && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total} invoices
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.pagination.page - 1)}
                  disabled={data.pagination.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.pagination.page + 1)}
                  disabled={data.pagination.page >= Math.ceil(data.pagination.total / data.pagination.limit)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Invoices