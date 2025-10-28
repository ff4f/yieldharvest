import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { walletService, WalletConnection } from '../services/walletService';

interface WalletContextType {
  // Connection state
  isConnected: boolean;
  connection: WalletConnection | null;
  isConnecting: boolean;
  
  // Connection methods
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  
  // Wallet info
  accountId: string | null;
  network: string | null;
  walletType: 'hashpack' | 'blade' | null;
  
  // Balance info
  balance: {
    hbar: string;
    tokens: Array<{
      tokenId: string;
      balance: string;
      symbol: string;
    }>;
  } | null;
  
  // Utility methods
  refreshBalance: () => Promise<void>;
  getHashScanUrl: (transactionId: string) => string;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<WalletContextType['balance']>(null);

  useEffect(() => {
    // Listen for wallet connection changes
    const handleConnectionChange = (newConnection: WalletConnection | null) => {
      setConnection(newConnection);
      if (newConnection) {
        fetchBalance(newConnection.accountId);
      } else {
        setBalance(null);
      }
    };

    walletService.addListener(handleConnectionChange);

    // Check for existing connection on mount
    const existingConnection = walletService.getConnection();
    if (existingConnection) {
      setConnection(existingConnection);
      fetchBalance(existingConnection.accountId);
    }

    return () => {
      walletService.removeListener(handleConnectionChange);
    };
  }, []);

  const fetchBalance = async (accountId: string) => {
    try {
      // Fetch HBAR balance from Mirror Node
      const response = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`
      );
      
      if (response.ok) {
        const accountData = await response.json();
        const hbarBalance = (accountData.balance?.balance || 0) / 100000000; // Convert tinybars to HBAR
        
        // Fetch token balances
        const tokensResponse = await fetch(
          `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/tokens`
        );
        
        let tokens: Array<{ tokenId: string; balance: string; symbol: string }> = [];
        if (tokensResponse.ok) {
          const tokensData = await tokensResponse.json();
          tokens = tokensData.tokens?.map((token: any) => ({
            tokenId: token.token_id,
            balance: token.balance,
            symbol: token.symbol || 'Unknown'
          })) || [];
        }
        
        setBalance({
          hbar: hbarBalance.toFixed(8),
          tokens
        });
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const connect = async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    try {
      await walletService.connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await walletService.disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  };

  const refreshBalance = async () => {
    if (connection?.accountId) {
      await fetchBalance(connection.accountId);
    }
  };

  const getHashScanUrl = (transactionId: string): string => {
    const network = connection?.network || 'testnet';
    const baseUrl = network === 'mainnet' 
      ? 'https://hashscan.io/mainnet' 
      : 'https://hashscan.io/testnet';
    return `${baseUrl}/transaction/${transactionId}`;
  };

  const contextValue: WalletContextType = {
    // Connection state
    isConnected: walletService.isConnected(),
    connection,
    isConnecting,
    
    // Connection methods
    connect,
    disconnect,
    
    // Wallet info
    accountId: connection?.accountId || null,
    network: connection?.network || null,
    walletType: connection?.walletType || null,
    
    // Balance info
    balance,
    
    // Utility methods
    refreshBalance,
    getHashScanUrl,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};