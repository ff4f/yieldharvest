import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { HashConnect, HashConnectConnectionState, SessionData } from 'hashconnect';
import { LedgerId } from '@hashgraph/sdk';

interface WalletContextType {
  isConnected: boolean;
  accountId: string | null;
  connect: () => void;
  disconnect: () => void;
  hashConnect: HashConnect | null;
  pairingData: SessionData | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  children: ReactNode;
}

const appMetadata = {
  name: "YieldHarvest",
  description: "Invoice factoring platform on Hedera",
  icons: ["https://yieldharvest.app/icon.png"],
  url: "https://yieldharvest.app"
};

// TODO: Replace with your own WalletConnect Project ID
const WC_PROJECT_ID = "3fcc6bba6f1de962d911bb5b5c3dba68";

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [hashConnect, setHashConnect] = useState<HashConnect | null>(null);
  const [pairingData, setPairingData] = useState<SessionData | null>(null);

  useEffect(() => {
    const initHashConnect = async () => {
      if (!WC_PROJECT_ID || WC_PROJECT_ID === 'YOUR_WALLETCONNECT_PROJECT_ID') {
        console.error("Please replace YOUR_WALLETCONNECT_PROJECT_ID with your own WalletConnect Project ID.");
        return;
      }
      
      const hc = new HashConnect(LedgerId.TESTNET, WC_PROJECT_ID, appMetadata, true);
      setHashConnect(hc);

      hc.pairingEvent.on((newPairing) => {
        console.log('Pairing event:', newPairing);
        setPairingData(newPairing);
        setIsConnected(true);
        if (newPairing.accountIds && newPairing.accountIds.length > 0) {
          setAccountId(newPairing.accountIds[0]);
        }
      });

      hc.disconnectionEvent.on(() => {
        console.log('Disconnection event');
        disconnect();
      });

      await hc.init();

      const savedPairings = hc.getSavedPairings();
      if (savedPairings.length > 0) {
        const pairing = savedPairings[0];
        setPairingData(pairing);
        setIsConnected(true);
        if (pairing.accountIds && pairing.accountIds.length > 0) {
          setAccountId(pairing.accountIds[0]);
        }
      }
    };

    initHashConnect().catch(console.error);
  }, []);

  const connect = () => {
    if (hashConnect) {
      hashConnect.openPairingModal();
    } else {
      console.error('HashConnect not initialized');
    }
  };

  const disconnect = () => {
    if (hashConnect && pairingData) {
      hashConnect.disconnect();
    }
    setPairingData(null);
    setIsConnected(false);
    setAccountId(null);
  };

  const value: WalletContextType = {
    isConnected,
    accountId,
    connect,
    disconnect,
    hashConnect,
    pairingData
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};