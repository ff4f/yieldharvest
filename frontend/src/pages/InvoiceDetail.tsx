import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  FileText, 
  DollarSign, 
  Calendar, 
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Eye,
  Activity,
  Shield,
  Hash
} from 'lucide-react'
import { useInvoice, useUpdateInvoice } from '@/hooks/useInvoices'
import { useCreateFunding, useFundingsByInvoice, useReleaseFunding, useRefundFunding } from '@/hooks/useFunding'
import { LoadingState } from '@/components/LoadingState'
import { ErrorState } from '@/components/ErrorState'
import { InvoiceProofPill, FundingProofPill } from '@/components/ProofPill'
import { useMilestoneUpdates } from '@/hooks/useWebSocket'
import { Invoice } from '@/types/api'
import { useWallet } from '@/contexts/WalletContext'
import transactionService from '@/services/transactionService'
import HCSTimeline from '@/components/HCSTimeline'
import WalletFundingModal from '@/components/WalletFundingModal'
import ProofTray from '@/components/ui/ProofTray'

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { data: invoice, isLoading, error } = useInvoice(id!)
  const updateInvoiceMutation = useUpdateInvoice()
  const createFundingMutation = useCreateFunding()
  const { data: fundings } = useFundingsByInvoice(id!)
  const releaseFundingMutation = useReleaseFunding()
  const refundFundingMutation = useRefundFunding()
  const [recentUpdates, setRecentUpdates] = useState<any[]>([])
  const [showFundingModal, setShowFundingModal] = useState(false)
  const { isConnected, accountId } = useWallet()
  
  // WebSocket for real-time updates specific to this invoice
  useMilestoneUpdates(
    '', // dealId - empty string instead of undefined
    id || '', // invoiceId - listen to this specific invoice, with fallback
    (update: any) => {
      console.log('Invoice detail update received:', update)
      setRecentUpdates(prev => [update, ...prev.slice(0, 9)]) // Keep last 10 updates
    }
  )

  const handleFundInvoice = () => {
    if (!isConnected || !accountId) {
      alert('Please connect your wallet to fund this invoice')
      return
    }
    setShowFundingModal(true)
  }

  const handleMarkAsPaid = async () => {
    if (!invoice || !isConnected || !accountId) {
      alert('Please connect your wallet to mark invoice as paid')
      return
    }
    
    try {
      // Use transactionService for wallet-signed payment
      await transactionService.payInvoice({
        invoiceId: invoice.id,
        payerAccountId: accountId
      })
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error)
      alert('Failed to mark invoice as paid. Please try again.')
    }
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

  // Extract Mirror Node data from the enriched invoice
  const nftInfo = invoice.onChainData?.nftInfo
  const hcsTimeline = invoice.onChainData?.hcsTimeline || []
  const fileInfo = invoice.onChainData?.fileInfo

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

      {/* Mirror Node & Blockchain Proof Section */}
      {(nftInfo || hcsTimeline.length > 0 || fileInfo) && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Blockchain Proof & Mirror Node Data
            </CardTitle>
            <CardDescription>
              Real-time data from Hedera Mirror Node showing on-chain proof of this invoice
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {nftInfo && (
                <div className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Hash className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">NFT Token</span>
                  </div>
                  <div className="text-xs font-mono text-gray-600 mb-2">{nftInfo.tokenId}</div>
                  <div className="text-xs text-gray-500 mb-2">Serial: {nftInfo.serialNumber}</div>
                  <div className="text-xs text-gray-500 mb-2">Owner: {nftInfo.accountId}</div>
                  {nftInfo.metadata && (
                    <div className="text-xs text-gray-500 mb-2">
                      Metadata: {nftInfo.metadata.substring(0, 20)}...
                    </div>
                  )}
                  <a
                    href={`https://hashscan.io/testnet/token/${nftInfo.tokenId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View on HashScan
                  </a>
                </div>
              )}
              
              {fileInfo && (
                <div className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">HFS File</span>
                  </div>
                  <div className="text-xs font-mono text-gray-600 mb-2">{fileInfo.fileId}</div>
                  {fileInfo.hash && (
                    <div className="text-xs text-gray-500 mb-2">
                      Hash: {fileInfo.hash.substring(0, 16)}...
                    </div>
                  )}
                  <a
                    href={`https://hashscan.io/testnet/file/${fileInfo.fileId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View File
                  </a>
                </div>
              )}
              
              <div className="p-4 bg-white rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">HCS Messages</span>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {hcsTimeline.length} status updates
                </div>
                {hcsTimeline.length > 0 && (
                  <div className="text-xs text-gray-500 mb-2">
                    Latest: {new Date(hcsTimeline[0].timestamp).toLocaleDateString()}
                  </div>
                )}
                {invoice.topicId && (
                  <a
                    href={`https://hashscan.io/testnet/topic/${invoice.topicId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Topic
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HCS Timeline Section */}
      {hcsTimeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-600" />
              On-Chain Status Timeline
            </CardTitle>
            <CardDescription>
              Real-time status updates from Hedera Consensus Service
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {hcsTimeline.map((update, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full" />
                    <span className="text-sm font-medium capitalize">{update.status}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(update.timestamp).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400">
                      Seq: {update.sequenceNumber}
                    </span>
                  </div>
                  {update.transactionId && (
                    <a
                      href={`https://hashscan.io/testnet/transaction/${update.transactionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Tx
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Updates Section */}
      {recentUpdates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Real-time Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recentUpdates.map((update, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{update.message || 'Invoice updated'}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(update.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {update.transactionId && (
                    <a
                      href={`https://hashscan.io/testnet/transaction/${update.transactionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Tx
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="text-lg font-semibold">
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Currency</p>
                  <p className="text-lg font-semibold">{invoice.currency}</p>
                </div>
              </div>
              
              {invoice.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="mt-1">{invoice.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Funding Details */}
          {fundings && fundings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Funding Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fundings && fundings.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Funded Amount</label>
                    <div className="flex items-center gap-2 mt-1">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xl font-bold text-blue-600">
                        ${fundings.reduce((sum: number, f: any) => sum + parseFloat(f.amount), 0).toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({((fundings.reduce((sum: number, f: any) => sum + parseFloat(f.amount), 0) / parseFloat(invoice.amount)) * 100).toFixed(1)}% of invoice value)
                      </span>
                    </div>
                  </div>
                )}
                
                {fundings && fundings.length > 0 && fundings[0].fundedAt && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Funded Date</label>
                    <p className="mt-1">{new Date(fundings[0].fundedAt).toLocaleDateString()}</p>
                  </div>
                )}
                
                {invoice.status === 'PAID' && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Paid Date</label>
                    <p className="mt-1">{new Date(invoice.updatedAt).toLocaleDateString()}</p>
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
                  data-testid="fund-invoice-button"
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
              
              {nftInfo && (
                <a 
                  href={`https://hashscan.io/testnet/token/${nftInfo.tokenId}`}
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
              {nftInfo && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">NFT Token ID</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{nftInfo.tokenId}</code>
                    <a 
                      href={`https://hashscan.io/testnet/token/${nftInfo.tokenId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
                </div>
              )}
              
              {fileInfo && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">File ID (HFS)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{fileInfo.fileId}</code>
                    <a 
                      href={`https://hashscan.io/testnet/file/${fileInfo.fileId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
                </div>
              )}
              
              {invoice.topicId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Topic ID (HCS)</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm bg-muted px-2 py-1 rounded">{invoice.topicId}</code>
                    <a 
                      href={`https://hashscan.io/testnet/topic/${invoice.topicId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
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
                {fundings.map((funding: any) => (
                  <div key={funding.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">${funding.amount}</p>
                        <p className="text-sm text-muted-foreground">
                          {funding.investor?.name || 'Unknown Investor'}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        funding.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                        funding.status === 'RELEASED' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {funding.status}
                      </span>
                    </div>
                    
                    {funding.interestRate && (
                      <div>
                        <p className="text-sm text-muted-foreground">Interest Rate</p>
                        <p className="font-medium">{funding.interestRate}%</p>
                      </div>
                    )}
                    
                    {funding.status === 'ACTIVE' && (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => releaseFundingMutation.mutate(funding.id)}
                          disabled={releaseFundingMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {releaseFundingMutation.isPending ? 'Releasing...' : 'Release Funds'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => refundFundingMutation.mutate(funding.id)}
                          disabled={refundFundingMutation.isPending}
                        >
                          {refundFundingMutation.isPending ? 'Refunding...' : 'Refund'}
                        </Button>
                      </div>
                    )}
                    
                    {funding.status === 'RELEASED' && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Funds Released</span>
                        {funding.releaseTransactionId && (
                          <a 
                            href={`https://hashscan.io/testnet/transaction/${funding.releaseTransactionId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                    
                    {/* Funding Proof Pills */}
                    <FundingProofPill funding={funding} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* HCS Timeline - Real-time on-chain status updates */}
          <HCSTimeline 
            invoiceId={invoice.id} 
            className="mb-6"
          />

          {/* Blockchain Proof Tray */}
          <ProofTray 
            transactions={[
              // Invoice tokenization proof
              ...(invoice.tokenId ? [{
                id: `invoice-${invoice.id}`,
                type: 'invoice_tokenization' as const,
                status: 'completed' as const,
                timestamp: invoice.createdAt,
                amount: invoice.amount,
                links: {
                  hashscan: `https://hashscan.io/testnet/token/${invoice.tokenId}`,
                  ...(invoice.mintTransactionId && {
                    transaction: `https://hashscan.io/testnet/transaction/${invoice.mintTransactionId}`
                  })
                }
              }] : []),
              // Funding proofs
              ...(fundings?.map(funding => ({
                id: `funding-${funding.id}`,
                type: 'funding_disbursement' as const,
                status: funding.status === 'ACTIVE' ? 'completed' as const : 'pending' as const,
                timestamp: funding.createdAt,
                amount: funding.amount,
                links: {
                  ...(funding.transactionId && {
                    transaction: `https://hashscan.io/testnet/transaction/${funding.transactionId}`,
                    hashscan: `https://hashscan.io/testnet/transaction/${funding.transactionId}`
                  }),
                  ...(funding.escrowId && {
                    contract: `https://hashscan.io/testnet/contract/${funding.escrowId}`
                  })
                }
              })) || [])
            ]}
            className="mb-6"
          />

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
                
                {fundings && fundings.length > 0 && fundings[0].fundedAt && (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Invoice Funded</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(fundings[0].fundedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
                
                {invoice.status === 'PAID' && (
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Invoice Paid</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Wallet Funding Modal */}
      <WalletFundingModal
        isOpen={showFundingModal}
        onClose={() => setShowFundingModal(false)}
        invoice={invoice}
        onSuccess={() => {
          setShowFundingModal(false)
          // Refresh data will be handled by react-query cache invalidation
        }}
      />
    </div>
  )
}

export default InvoiceDetail