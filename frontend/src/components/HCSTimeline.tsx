import React, { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, 
  Clock, 
  DollarSign, 
  ExternalLink, 
  Activity,
  AlertCircle,
  Hash,
  Calendar
} from 'lucide-react'
import { useRealTimeHCSMessages } from '@/hooks/useMirrorNode'
import { LoadingState } from '@/components/LoadingState'
import { ErrorState } from '@/components/ErrorState'

interface HCSTimelineProps {
  invoiceId: string
  topicId?: string
  className?: string
}

interface HCSMessage {
  consensus_timestamp: string
  message: string
  sequence_number: number
  running_hash: string
  running_hash_version: number
  payer_account_id: string
}

interface InvoiceStatusMessage {
  type: 'invoice_status_change'
  invoiceId: string
  status: 'issued' | 'funded' | 'paid'
  timestamp: string
  transactionId?: string
  amount?: number
  accountId?: string
  metadata?: Record<string, any>
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
      return <Activity className="h-4 w-4 text-gray-500" />
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

const formatTimestamp = (timestamp: string) => {
  try {
    // HCS timestamps are in nanoseconds, convert to milliseconds
    const timestampMs = Math.floor(parseInt(timestamp) / 1000000)
    return new Date(timestampMs).toLocaleString()
  } catch (error) {
    return 'Invalid timestamp'
  }
}

const parseHCSMessage = (message: string): InvoiceStatusMessage | null => {
  try {
    // Decode base64 message
    const decoded = atob(message)
    return JSON.parse(decoded)
  } catch (error) {
    console.warn('Failed to parse HCS message:', error)
    return null
  }
}

export const HCSTimeline: React.FC<HCSTimelineProps> = ({ 
  invoiceId, 
  topicId = import.meta.env.VITE_HCS_TOPIC_ID || '0.0.123456',
  className = '' 
}) => {
  const { messages, loading, error, refetch } = useRealTimeHCSMessages(topicId, {
    refetchInterval: 5000, // Poll every 5 seconds
    enableCaching: true,
    cacheTTL: 10000 // Cache for 10 seconds
  })

  // Filter and parse messages for this specific invoice
  const invoiceMessages = useMemo(() => {
    if (!messages || !Array.isArray(messages)) return []

    return messages
      .map((msg: HCSMessage) => {
        const parsed = parseHCSMessage(msg.message)
        if (!parsed || parsed.invoiceId !== invoiceId) return null
        
        return {
          ...parsed,
          hcsData: {
            consensus_timestamp: msg.consensus_timestamp,
            sequence_number: msg.sequence_number,
            running_hash: msg.running_hash,
            payer_account_id: msg.payer_account_id
          }
        }
      })
      .filter(Boolean)
      .sort((a, b) => 
        parseInt(a.hcsData.consensus_timestamp) - parseInt(b.hcsData.consensus_timestamp)
      )
  }, [messages, invoiceId])

  const generateHashScanLink = (consensusTimestamp: string) => {
    // Convert nanosecond timestamp to seconds for HashScan
    const timestampSeconds = Math.floor(parseInt(consensusTimestamp) / 1000000000)
    return `https://hashscan.io/testnet/transaction/${timestampSeconds}`
  }

  const generateTopicLink = () => {
    return `https://hashscan.io/testnet/topic/${topicId}`
  }

  if (loading && invoiceMessages.length === 0) {
    return <LoadingState message="Loading HCS timeline..." />
  }

  if (error) {
    return (
      <ErrorState 
        message="Failed to load HCS timeline" 
        onRetry={refetch}
      />
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              On-Chain Status Timeline
            </CardTitle>
            <CardDescription>
              Real-time updates from Hedera Consensus Service
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {invoiceMessages.length} updates
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(generateTopicLink(), '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Topic
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {invoiceMessages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No on-chain status updates found</p>
            <p className="text-sm">Status changes will appear here once recorded to HCS</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invoiceMessages.map((msg, index) => (
              <div key={msg.hcsData.sequence_number} className="relative">
                {/* Timeline connector */}
                {index < invoiceMessages.length - 1 && (
                  <div className="absolute left-6 top-8 w-0.5 h-8 bg-border" />
                )}
                
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getStatusIcon(msg.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium capitalize">
                        Invoice {msg.status}
                      </h4>
                      <Badge 
                        variant="secondary" 
                        className={getStatusColor(msg.status)}
                      >
                        {msg.status.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>{formatTimestamp(msg.hcsData.consensus_timestamp)}</span>
                      </div>
                      
                      {msg.amount && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-3 w-3" />
                          <span>${msg.amount.toLocaleString()}</span>
                        </div>
                      )}
                      
                      {msg.accountId && (
                        <div className="flex items-center gap-2">
                          <Hash className="h-3 w-3" />
                          <span className="font-mono text-xs">{msg.accountId}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(
                          generateHashScanLink(msg.hcsData.consensus_timestamp), 
                          '_blank'
                        )}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Proof
                      </Button>
                      
                      <Badge variant="outline" className="text-xs font-mono">
                        Seq: {msg.hcsData.sequence_number}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {loading && invoiceMessages.length > 0 && (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 mr-2 animate-spin" />
            Checking for new updates...
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default HCSTimeline