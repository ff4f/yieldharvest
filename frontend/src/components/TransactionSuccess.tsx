import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle, ExternalLink, Copy, Eye } from 'lucide-react'
import { ProofPill } from './ProofPill'

export interface TransactionResult {
  transactionId: string
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  hashScanUrl: string
  receipt?: {
    tokenId?: string
    serialNumber?: string
    fileId?: string
    topicId?: string
  }
}

interface TransactionSuccessProps {
  result: TransactionResult
  title: string
  description: string
  onViewDetails?: () => void
  onCreateAnother?: () => void
}

export const TransactionSuccess: React.FC<TransactionSuccessProps> = ({
  result,
  title,
  description,
  onViewDetails,
  onCreateAnother
}) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'text-green-600'
      case 'PENDING':
        return 'text-yellow-600'
      case 'FAILED':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <CardTitle className="text-2xl font-bold text-green-700">
          {title}
        </CardTitle>
        <CardDescription className="text-lg">
          {description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Transaction Status */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700">Transaction Status</p>
            <p className={`text-lg font-semibold ${getStatusColor(result.status)}`}>
              {result.status}
            </p>
          </div>
          <div className="space-y-2">
            <ProofPill
              mintTransactionId={result.transactionId}
              variant="default"
            />
          </div>
        </div>

        {/* Transaction ID */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Transaction ID</label>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <code className="flex-1 text-sm font-mono text-gray-800 break-all">
              {result.transactionId}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(result.transactionId)}
              className="shrink-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Receipt Details */}
        {result.receipt && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Blockchain Proofs</h3>
            
            {result.receipt.tokenId && result.receipt.serialNumber && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-700">NFT Minted</p>
                  <p className="text-sm text-blue-600">
                    Token: {result.receipt.tokenId} | Serial: {result.receipt.serialNumber}
                  </p>
                </div>
                <ProofPill
                  tokenId={result.receipt.tokenId}
                  serialNumber={parseInt(result.receipt.serialNumber)}
                  variant="default"
                />
              </div>
            )}

            {result.receipt.fileId && (
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-purple-700">File Uploaded</p>
                  <p className="text-sm text-purple-600">File ID: {result.receipt.fileId}</p>
                </div>
                <ProofPill
                  fileId={result.receipt.fileId}
                  variant="compact"
                />
              </div>
            )}

            {result.receipt.topicId && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-green-700">Status Logged</p>
                  <p className="text-sm text-green-600">Topic ID: {result.receipt.topicId}</p>
                </div>
                <ProofPill
                  topicId={result.receipt.topicId}
                  variant="compact"
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 pt-4">
          {onViewDetails && (
            <Button onClick={onViewDetails} className="flex-1">
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Button>
          )}
          {onCreateAnother && (
            <Button variant="outline" onClick={onCreateAnother} className="flex-1">
              Create Another
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => window.open(result.hashScanUrl, '_blank')}
            className="shrink-0"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            HashScan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default TransactionSuccess