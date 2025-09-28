import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, FileText, DollarSign, Calendar, Building, CheckCircle, AlertCircle, Eye, Wallet, ExternalLink } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useCreateInvoice } from '@/hooks/useInvoices'
import { ProofPill } from '@/components/ProofPill'
import { CreateInvoiceRequest, CreateInvoiceResponse } from '@/types/api'
import { useWallet } from '@/contexts/WalletContext'

const CreateInvoice: React.FC = () => {
  const navigate = useNavigate()
  const createInvoiceMutation = useCreateInvoice()
  const { isConnected, accountId, connect } = useWallet()
  
  const [formData, setFormData] = useState<CreateInvoiceRequest>({
    invoiceNumber: '',
    supplierId: 'supplier-1', // TODO: Get from auth context
    buyerId: '',
    amount: '',
    currency: 'USD',
    dueDate: '',
    description: '',
    file: undefined
  })

  const [createdInvoice, setCreatedInvoice] = useState<CreateInvoiceResponse | null>(null)
  const [transactionResult, setTransactionResult] = useState<{ transactionId: string; hashScanUrl: string } | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFormData(prev => ({
      ...prev,
      file
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }
    
    try {
      // Create invoice through backend API (handles all Hedera operations)
      const response = await createInvoiceMutation.mutateAsync(formData)
      setCreatedInvoice(response)
      // Transaction details are included in the response
      if (response.proofs?.mintTransactionId) {
        setTransactionResult({
          transactionId: response.proofs.mintTransactionId,
          hashScanUrl: `https://hashscan.io/testnet/transaction/${response.proofs.mintTransactionId}`
        })
      }
    } catch (error) {
      console.error('Failed to create invoice:', error)
      alert('Failed to create invoice. Please try again.')
    }
  }

  const handleCreateAnother = () => {
    setCreatedInvoice(null)
    setFormData({
      invoiceNumber: '',
      supplierId: 'supplier-1',
      buyerId: '',
      amount: '',
      currency: 'USD',
      dueDate: '',
      description: '',
      file: undefined
    })
  }

  const handleViewInvoice = () => {
    if (createdInvoice) {
      navigate(`/invoices/${createdInvoice.invoice.id}`)
    }
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
            <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
            <p className="text-muted-foreground">
              Create a new invoice for factoring on the Hedera network
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {!isConnected ? (
            <button
              onClick={connect}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">
                  Connected: {accountId}
                </p>
                <p className="text-xs text-green-700">
                  Hedera Testnet
                </p>
              </div>
              <button
                className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
              >
                Connected
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
              <CardDescription>
                Enter the invoice information that will be minted as an NFT
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="invoiceNumber" className="text-sm font-medium">
                      Invoice Number *
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        id="invoiceNumber"
                        name="invoiceNumber"
                        type="text"
                        required
                        value={formData.invoiceNumber}
                        onChange={handleInputChange}
                        placeholder="INV-001"
                        disabled={createInvoiceMutation.isPending || !!createdInvoice}
                        className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="amount" className="text-sm font-medium">
                      Amount (USD) *
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        id="amount"
                        name="amount"
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={formData.amount}
                        onChange={handleInputChange}
                        placeholder="5000.00"
                        className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor="buyerId" className="text-sm font-medium">
                      Buyer ID *
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <input
                        id="buyerId"
                        name="buyerId"
                        type="text"
                        required
                        value={formData.buyerId}
                        onChange={handleInputChange}
                        placeholder="buyer-123"
                        disabled={createInvoiceMutation.isPending || !!createdInvoice}
                        className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                <div className="space-y-2">
                  <label htmlFor="currency" className="text-sm font-medium">
                    Currency *
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={formData.currency}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={createInvoiceMutation.isPending || !!createdInvoice}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="HBAR">HBAR</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="dueDate" className="text-sm font-medium">
                    Due Date *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <input
                      id="dueDate"
                      name="dueDate"
                      type="date"
                      required
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Brief description of goods/services provided..."
                    rows={4}
                    className="w-full px-4 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="file" className="text-sm font-medium">
                    Invoice Document (PDF) *
                  </label>
                  <div className="border-2 border-dashed border-input rounded-md p-6">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                      <div className="mt-4">
                        <label htmlFor="file" className="cursor-pointer">
                          <span className="text-sm font-medium text-primary hover:underline">
                            Click to upload
                          </span>
                          <span className="text-sm text-muted-foreground"> or drag and drop</span>
                        </label>
                        <input
                          id="file"
                          name="file"
                          type="file"
                          accept=".pdf"
                          required
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        PDF files only, max 10MB
                      </p>
                      {formData.file && (
                        <p className="text-sm text-green-600 mt-2">
                          Selected: {formData.file.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  {!createdInvoice ? (
                  <>
                    <Button type="submit" disabled={createInvoiceMutation.isPending} className="flex-1">
                      {createInvoiceMutation.isPending ? (
                        <>
                          <Upload className="mr-2 h-4 w-4 animate-spin" />
                          Creating Invoice...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Create Invoice
                        </>
                      )}
                    </Button>
                    <Link to="/invoices" className="flex-1">
                      <Button type="button" variant="outline" className="w-full">
                        Cancel
                      </Button>
                    </Link>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Invoice created successfully!</span>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Blockchain Proofs:</p>
                      <ProofPill
                        tokenId={createdInvoice.invoice.tokenId}
                        serialNumber={createdInvoice.invoice.serialNumber}
                        fileId={createdInvoice.invoice.fileId}
                        topicId={createdInvoice.invoice.topicId}
                        mintTransactionId={createdInvoice.proofs.mintTransactionId}
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button onClick={handleViewInvoice} className="flex-1">
                        <Eye className="mr-2 h-4 w-4" />
                        View Invoice
                      </Button>
                      <Button onClick={handleCreateAnother} variant="outline" className="flex-1">
                        Create Another
                      </Button>
                    </div>
                  </div>
                )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>How it Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Upload Invoice</h4>
                  <p className="text-sm text-muted-foreground">
                    Your invoice PDF is uploaded to Hedera File Service (HFS)
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Mint NFT</h4>
                  <p className="text-sm text-muted-foreground">
                    Invoice is minted as an NFT on Hedera Token Service (HTS)
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Track Status</h4>
                  <p className="text-sm text-muted-foreground">
                    All status changes recorded on Hedera Consensus Service (HCS)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Success Component */}
          {transactionResult && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5" />
                  Invoice Minted Successfully!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-green-800">Transaction ID:</p>
                  <div className="flex items-center gap-2 p-2 bg-white rounded border">
                    <code className="text-xs font-mono flex-1">{transactionResult.transactionId}</code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigator.clipboard.writeText(transactionResult.transactionId)}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(transactionResult.hashScanUrl, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on HashScan
                  </Button>
                  
                  {createdInvoice && (
                     <Button
                       size="sm"
                       onClick={() => navigate(`/invoices/${createdInvoice.invoice.id}`)}
                     >
                       View Invoice Details
                     </Button>
                   )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Valid invoice document (PDF)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Company information</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Invoice amount and due date</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>Connected wallet with HBAR</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default CreateInvoice