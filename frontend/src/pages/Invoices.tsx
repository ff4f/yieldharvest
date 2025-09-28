import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Search, Filter, Download, Eye, DollarSign, Loader2, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { InvoiceProofPill } from '@/components/ProofPill'
import { Invoice, InvoiceFilters } from '@/types/api'

const Invoices: React.FC = () => {
  const [filters, setFilters] = useState<InvoiceFilters>({
    page: 1,
    limit: 10
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  
  const { data, isLoading, error, refetch } = useInvoices(filters)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Manage your invoice factoring portfolio
          </p>
        </div>
        <Link to="/invoices/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </Link>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>Filter & Search</CardTitle>
          <CardDescription>
            Find specific invoices quickly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by company, invoice number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            {data?.pagination?.total || 0} invoices total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Invoice #</th>
                  <th className="text-left py-3 px-4 font-medium">Company</th>
                  <th className="text-left py-3 px-4 font-medium">Amount</th>
                  <th className="text-left py-3 px-4 font-medium">Due Date</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">NFT ID</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                      <div className="mt-2">Loading invoices...</div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-red-600">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <div>Error loading invoices. Please try again.</div>
                      <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-4">
                        Retry
                      </Button>
                    </td>
                  </tr>
                ) : data?.data?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      <div>No invoices found.</div>
                      <Link to="/invoices/create">
                        <Button className="mt-4">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Your First Invoice
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ) : (
                  data?.data?.map((invoice: Invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{invoice.invoiceNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        Created {formatDate(invoice.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{invoice.buyerId}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{formatCurrency(invoice.amount, invoice.currency)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium">{formatDate(invoice.dueDate)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {invoice.tokenId ? (
                        <div>
                          <div className="text-sm font-mono">{invoice.tokenId}</div>
                          <a 
                            href={`https://hashscan.io/testnet/token/${invoice.tokenId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View on HashScan
                          </a>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not minted</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Link to={`/invoices/${invoice.id}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {invoice.status === 'ISSUED' && (
                          <Button variant="outline" size="sm">
                            <DollarSign className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {data && data.pagination && (
            <div className="flex items-center justify-between pt-6 px-6 pb-6">
              <p className="text-sm text-muted-foreground">
                Showing {data.data.length} of {data.pagination.total} invoices
              </p>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={data.pagination.page <= 1}
                  onClick={() => handlePageChange(data.pagination.page - 1)}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={data.pagination.page >= data.pagination.totalPages}
                  onClick={() => handlePageChange(data.pagination.page + 1)}
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