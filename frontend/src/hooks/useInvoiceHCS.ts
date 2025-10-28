import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRealTimeHCSMessages } from './useMirrorNode'

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

interface HCSMessage {
  consensus_timestamp: string
  message: string
  sequence_number: number
  running_hash: string
  running_hash_version: number
  payer_account_id: string
}

interface ParsedInvoiceMessage extends InvoiceStatusMessage {
  hcsData: {
    consensus_timestamp: string
    sequence_number: number
    running_hash: string
    payer_account_id: string
  }
}

interface UseInvoiceHCSOptions {
  enabled?: boolean
  refetchInterval?: number
  topicId?: string
}

interface UseInvoiceHCSReturn {
  messages: ParsedInvoiceMessage[]
  loading: boolean
  error: string | null
  refetch: () => void
  clearMessages: () => void
  latestStatus: string | null
  messageCount: number
  lastUpdated: Date | null
}

const parseHCSMessage = (message: string): InvoiceStatusMessage | null => {
  try {
    // Decode base64 message
    const decoded = atob(message)
    const parsed = JSON.parse(decoded)
    
    // Validate message structure
    if (
      parsed.type === 'invoice_status_change' &&
      parsed.invoiceId &&
      parsed.status &&
      parsed.timestamp
    ) {
      return parsed
    }
    
    return null
  } catch (error) {
    console.warn('Failed to parse HCS message:', error)
    return null
  }
}

const formatTimestamp = (timestamp: string): Date | null => {
  try {
    // HCS timestamps are in nanoseconds, convert to milliseconds
    const timestampMs = Math.floor(parseInt(timestamp) / 1000000)
    return new Date(timestampMs)
  } catch (error) {
    console.warn('Failed to format timestamp:', error)
    return null
  }
}

export function useInvoiceHCS(
  invoiceId: string,
  options: UseInvoiceHCSOptions = {}
): UseInvoiceHCSReturn {
  const {
    enabled = true,
    refetchInterval = 5000,
    topicId = import.meta.env.VITE_HCS_TOPIC_ID || '0.0.123456'
  } = options

  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Fetch real-time HCS messages
  const { 
    messages: rawMessages, 
    loading, 
    error, 
    refetch, 
    clearMessages: clearRawMessages 
  } = useRealTimeHCSMessages(topicId, {
    enabled,
    refetchInterval,
    enableCaching: true,
    cacheTTL: 10000 // Cache for 10 seconds
  })

  // Filter and parse messages for this specific invoice
  const messages = useMemo(() => {
    if (!rawMessages || !Array.isArray(rawMessages) || !invoiceId) {
      return []
    }

    const parsed = rawMessages
      .map((msg: HCSMessage) => {
        const parsedMessage = parseHCSMessage(msg.message)
        if (!parsedMessage || parsedMessage.invoiceId !== invoiceId) {
          return null
        }
        
        return {
          ...parsedMessage,
          hcsData: {
            consensus_timestamp: msg.consensus_timestamp,
            sequence_number: msg.sequence_number,
            running_hash: msg.running_hash,
            payer_account_id: msg.payer_account_id
          }
        } as ParsedInvoiceMessage
      })
      .filter(Boolean)
      .sort((a, b) => 
        parseInt(a.hcsData.consensus_timestamp) - parseInt(b.hcsData.consensus_timestamp)
      )

    return parsed
  }, [rawMessages, invoiceId])

  // Get the latest status from messages
  const latestStatus = useMemo(() => {
    if (messages.length === 0) return null
    return messages[messages.length - 1].status
  }, [messages])

  // Update lastUpdated when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const latest = messages[messages.length - 1]
      const timestamp = formatTimestamp(latest.hcsData.consensus_timestamp)
      if (timestamp) {
        setLastUpdated(timestamp)
      }
    }
  }, [messages])

  const clearMessages = useCallback(() => {
    clearRawMessages()
    setLastUpdated(null)
  }, [clearRawMessages])

  return {
    messages,
    loading,
    error,
    refetch,
    clearMessages,
    latestStatus,
    messageCount: messages.length,
    lastUpdated
  }
}

// Hook for submitting invoice status changes to HCS
export function useSubmitInvoiceStatus() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitStatus = useCallback(async (
    invoiceId: string,
    status: 'issued' | 'funded' | 'paid',
    metadata?: {
      amount?: number
      accountId?: string
      transactionId?: string
      [key: string]: any
    }
  ) => {
    setLoading(true)
    setError(null)

    try {
      const message: InvoiceStatusMessage = {
        type: 'invoice_status_change',
        invoiceId,
        status,
        timestamp: new Date().toISOString(),
        ...metadata
      }

      // Submit to backend API which will handle HCS submission
      const response = await fetch('/api/hcs/submit-invoice-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message)
      })

      if (!response.ok) {
        throw new Error(`Failed to submit status: ${response.statusText}`)
      }

      const result = await response.json()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit status'
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    submitStatus,
    loading,
    error,
    clearError: () => setError(null)
  }
}

// Hook for generating HashScan links for HCS messages
export function useHCSProofLinks() {
  const generateTransactionLink = useCallback((consensusTimestamp: string) => {
    try {
      // Convert nanosecond timestamp to seconds for HashScan
      const timestampSeconds = Math.floor(parseInt(consensusTimestamp) / 1000000000)
      return `https://hashscan.io/testnet/transaction/${timestampSeconds}`
    } catch (error) {
      console.warn('Failed to generate transaction link:', error)
      return null
    }
  }, [])

  const generateTopicLink = useCallback((topicId: string) => {
    return `https://hashscan.io/testnet/topic/${topicId}`
  }, [])

  const generateAccountLink = useCallback((accountId: string) => {
    return `https://hashscan.io/testnet/account/${accountId}`
  }, [])

  return {
    generateTransactionLink,
    generateTopicLink,
    generateAccountLink
  }
}

export default useInvoiceHCS