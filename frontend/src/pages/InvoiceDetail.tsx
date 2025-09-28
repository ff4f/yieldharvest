import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  FileText, 
  DollarSign, 
  Calendar, 
  Building, 
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Eye
} from 'lucide-react'
import { useInvoice, useUpdateInvoice } from '@/hooks/useInvoices'
import { useCreateFunding, useFundingsByInvoice, useReleaseFunding, useRefundFunding } from '@/hooks/useFunding'
import { LoadingState } from '@/components/LoadingState'
import { ErrorState } from '@/components/ErrorState'
import { InvoiceProofPill, FundingProofPill } from '@/components/ProofPill'
import { Invoice } from '@/types/api'

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { data: invoice, isLoading, error } = useInvoice(id!)
  const updateInvoiceMutation = useUpdateInvoice()
  const createFundingMutation = useCreateFunding()
  const { data: fundings } = useFundingsByInvoice(id!)
  const releaseFundingMutation = useReleaseFunding()
  const refundFundingMutation = useRefundFunding()
  const [fundingAmount, setFundingAmount] = useState('')

  const handleFundInvoice = async () => {
    if (!invoice || !fundingAmount) return
    
    createFundingMutation.mutate({
      invoiceId: invoice.id,
      amount: parseFloat(fundingAmount),
      investorId: 'current-user' // TODO: Get from auth context
    })
  }

  const handleMarkAsPaid = async () => {
    if (!invoice) return
    
    updateInvoiceMutation.mutate({
      id: invoice.id,
      data: { status: 'PAID' }
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'issued':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'funded':
        return <DollarSign className="h-4 w-4 text-blue-500" />
      case 'paid':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'issued':
        return 'bg-yellow-100 text-yellow-800'
      case 'funded':
        return 'bg-blue-100 text-blue-800'
      case 'paid':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading invoice..." />
  }

  if (error) {
    return <ErrorState error={error as Error} onRetry={() => window.location.reload()} />
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Invoice not found</h3>
        <p className="mt-2 text-muted-foreground">The invoice you're looking for doesn't exist.</p>
        <Link to="/invoices" className="mt-4 inline-block">
          <Button>Back to Invoices</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Invoices
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{invoice.supplier?.name || 'Unknown Supplier'}</h1>
            <p className="text-muted-foreground">
              {invoice.supplier?.email || 'No contact information'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {getStatusIcon(invoice.status)}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Invoice Amount</p>
                  <p className="text-lg font-semibold">
                    ${parseFloat(invoice.amount).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Funding Amount</p>
                  <p className="text-lg font-semibold">
                    ${invoice.fundings?.reduce((sum, f) => sum + parseFloat(f.amount), 0).toLocaleString() || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Funding Rate</p>
                  <p className="text-lg font-semibold">
                    {invoice.fundings?.length ? 
                      `${((invoice.fundings.reduce((sum, f) => sum + parseFloat(f.amount), 0) / parseFloat(invoice.amount)) * 100).toFixed(1)}%` : 
                      'N/A'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created Date</p>
                  <p className="text-lg font-semibold">
                    {new Date(invoice.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</span>
                </div>
              </div>
              
              {invoice.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="mt-1">{invoice.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Funding Information */}
          {invoice.status !== 'issued' && (
            <Card>
              <CardHeader>
                <CardTitle>Funding Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {invoice.fundingAmount && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Funded Amount</label>
                    <div className="flex items-center gap-2 mt-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xl font-bold text-blue-600">
                        ${invoice.fundingAmount.toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({((invoice.fundingAmount / invoice.amount) * 100).toFixed(1)}% of invoice value)
                      </span>
                    </div>
                  </div>
                )}
                
                {invoice.fundedAt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Funded Date</label>
                    <p className="mt-1">{new Date(invoice.fundedAt).toLocaleDateString()}</p>
                  </div>
                )}
                
                {invoice.paidAt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Paid Date</label>
                    <p className="mt-1">{new Date(invoice.paidAt).toLocaleDateString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.status === 'ISSUED' && (
                <Button 
                  onClick={handleFundInvoice} 
                  disabled={createFundingMutation.isPending}
                  className="w-full"
                >
                  {createFundingMutation.isPending ? 'Processing...' : 'Fund Invoice'}
                </Button>
              )}
              
              {invoice.status === 'FUNDED' && (
                <Button 
                  onClick={handleMarkAsPaid} 
                  disabled={updateInvoiceMutation.isPending}
                  className="w-full"
                >
                  {updateInvoiceMutation.isPending ? 'Processing...' : 'Mark as Paid'}
                </Button>
              )}
              
              <Button variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              
              <Button variant="outline" className="w-full">
                <Eye className="mr-2 h-4 w-4" />
                View Document
              </Button>
              
              {invoice.tokenId && (
                <a 
                  href={`https://hashscan.io/testnet/token/${invoice.tokenId}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Token Details
                  </Button>
                </a>
              )}
              
              {/* Add Proof Pills */}
              <InvoiceProofPill invoice={invoice} />
            </CardContent>
          </Card>

          {/* Hedera Information */}
          <Card>
            <CardHeader>
              <CardTitle>Blockchain Info</CardTitle>
              <CardDescription>
                Hedera network references for this invoice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.tokenId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">NFT Token ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{invoice.tokenId}</code>
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              
              {invoice.fileId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">File ID (HFS)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{invoice.fileId}</code>
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
              
              {invoice.topicId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Topic ID (HCS)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{invoice.topicId}</code>
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fundings */}
          {fundings && fundings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fundings</CardTitle>
                <CardDescription>
                  Smart contract escrow details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fundings.map((funding) => (
                  <div key={funding.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">${funding.amount}</p>
                        <p className="text-sm text-muted-foreground">
                          Status: {funding.status}
                        </p>
                        {funding.interestRate && (
                          <p className="text-sm text-muted-foreground">
                            Interest Rate: {funding.interestRate}%
                          </p>
                        )}
                        {funding.expectedReturn && (
                          <p className="text-sm text-muted-foreground">
                            Expected Return: ${funding.expectedReturn}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {funding.status === 'ACTIVE' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => releaseFundingMutation.mutate(funding.id)}
                              disabled={releaseFundingMutation.isPending}
                            >
                              Release
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => refundFundingMutation.mutate(funding.id)}
                              disabled={refundFundingMutation.isPending}
                            >
                              Refund
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Escrow Details */}
                    {funding.escrowId && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Escrow Contract ID</label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-sm bg-muted px-2 py-1 rounded">{funding.escrowId}</code>
                          <Button size="sm" variant="ghost">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Funding Proof Pills */}
                    <FundingProofPill funding={funding} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Status Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">Invoice Created</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                {invoice.fundedAt && (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Invoice Funded</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.fundedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                
                {invoice.paidAt && (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Invoice Paid</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.paidAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default InvoiceDetail