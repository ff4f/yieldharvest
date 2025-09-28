import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import walletService, { WalletConnection, TransactionResult } from '../services/walletService'

interface WalletContextType {
  isConnected: boolean
  connection: WalletConnection | null
  isConnecting: boolean
  error: string | null
  connectWallet: () => Promise<void>
  disconnectWallet: () => Promise<void>
  signTransaction: (transactionBytes: Uint8Array) => Promise<Uint8Array>
  getHashScanUrl: (transactionId: string) => string
  refreshBalance: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

interface WalletProviderProps {
  children: ReactNode
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [connection, setConnection] = useState<WalletConnection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check for existing wallet connection on mount
  useEffect(() => {
    initializeWallet()
  }, [])

  const initializeWallet = async () => {
    try {
      await walletService.initialize()
      const existingConnection = walletService.getConnection()
      if (existingConnection && existingConnection.isConnected) {
        setConnection(existingConnection)
        setIsConnected(true)
      }
    } catch (error) {
      console.error('Error initializing wallet:', error)
      setError('Failed to initialize wallet service')
    }
  }

  const connectWallet = async () => {
    setIsConnecting(true)
    setError(null)

    try {
      const walletConnection = await walletService.connect()
      setConnection(walletConnection)
      setIsConnected(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet')
      console.error('Wallet connection error:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = async () => {
    try {
      await walletService.disconnect()
      setConnection(null)
      setIsConnected(false)
      setError(null)
    } catch (err) {
      console.error('Wallet disconnection error:', err)
    }
  }

  const signTransaction = async (transactionBytes: Uint8Array): Promise<Uint8Array> => {
    if (!connection) {
      throw new Error('No wallet connected')
    }
    
    return await walletService.signTransaction(transactionBytes)
  }

  const getHashScanUrl = (transactionId: string): string => {
    return walletService.getHashScanUrl(transactionId)
  }

  const refreshBalance = async () => {
    if (!connection) return
    
    try {
      const updatedConnection = await walletService.refreshBalance()
      setConnection(updatedConnection)
    } catch (err) {
      console.error('Error refreshing balance:', err)
    }
  }

  const value: WalletContextType = {
    isConnected,
    connection,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    signTransaction,
    getHashScanUrl,
    refreshBalance
  }

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

// Wallet connection component for easy integration
export const WalletConnect: React.FC = () => {
  const { isConnected, connection, isConnecting, error, connectWallet, disconnectWallet } = useWallet()

  if (isConnected && connection) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">
            Connected: {connection.accountId}
          </p>
          <p className="text-xs text-green-700">
            Balance: {connection.hbarBalance || '0'} HBAR
          </p>
        </div>
        <button
          onClick={disconnectWallet}
          className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isConnecting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></div>
            Connecting...
          </>
        ) : (
          'Connect Wallet'
        )}
      </button>
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Supports HashPack and Blade wallets
        </p>
        <div className="flex items-center justify-center gap-4 mt-2">
          <a 
            href="https://www.hashpack.app/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Get HashPack
          </a>
          <a 
            href="https://www.bladewallet.io/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Get Blade
          </a>
        </div>
      </div>
    </div>
  )
}

export default WalletProvider