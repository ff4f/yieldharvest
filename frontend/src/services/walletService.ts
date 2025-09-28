import { HashConnect, HashConnectConnectionState, SessionData } from 'hashconnect';
import { AccountId, LedgerId } from '@hashgraph/sdk';

export type WalletType = 'hashpack' | 'blade';

export interface WalletConnection {
  accountId: string;
  publicKey?: string;
  network: 'mainnet' | 'testnet';
  isConnected: boolean;
  walletType: WalletType;
  hbarBalance?: string;
  topic?: string;
}

export interface WalletBalance {
  hbar: string;
  tokens: {
    tokenId: string;
    symbol: string;
    balance: string;
    decimals: number;
  }[];
}

export interface TransactionResult {
  transactionId: string;
  receipt?: any;
  hashScanUrl: string;
}

interface WalletEventListener {
  (event: { type: string; data?: any }): void;
}

class WalletService {
  private hashConnect: HashConnect | null = null;
  private connection: WalletConnection | null = null;
  private network: 'mainnet' | 'testnet';
  private listeners: WalletEventListener[] = [];
  private connectionState: HashConnectConnectionState = HashConnectConnectionState.Disconnected;
  private pairingData: SessionData | null = null;

  constructor(network: 'mainnet' | 'testnet' = 'testnet') {
    this.network = network;
  }

  async initialize(): Promise<void> {
    await this.initializeHashConnect();
  }

  private async initializeHashConnect(): Promise<void> {
    try {
      // Initialize with app metadata
      const appMetadata = {
        name: 'YieldHarvest',
        description: 'Invoice Factoring Platform on Hedera',
        icons: [typeof window !== 'undefined' ? `${window.location.origin}/favicon.ico` : ''],
        url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      };

      // Initialize HashConnect with v3 API
      this.hashConnect = new HashConnect(
        this.network === 'mainnet' ? LedgerId.MAINNET : LedgerId.TESTNET,
        'yieldharvest-project-id', // You'll need to get a real project ID from WalletConnect Cloud
        appMetadata,
        true // debug mode
      );

      // Set up event listeners
      this.hashConnect.connectionStatusChangeEvent.on((state) => {
        console.log('HashConnect connection status changed:', state);
        this.connectionState = state;
        this.notifyListeners({ type: 'connectionStatusChange', data: state });
      });

      this.hashConnect.pairingEvent.on((data) => {
        console.log('HashConnect pairing event:', data);
        this.pairingData = data;
        
        if (data.accountIds && data.accountIds.length > 0) {
          this.connection = {
            accountId: data.accountIds[0],
            publicKey: data.publicKey,
            network: this.network,
            isConnected: true,
            walletType: 'hashpack',
            topic: data.topic,
          };
          
          // Persist connection
          this.saveConnectionToStorage();
          
          // Fetch balance
          this.updateBalance();
          
          this.notifyListeners({ type: 'connected', data: this.connection });
        }
      });

      // Initialize HashConnect
      await this.hashConnect.init();
      
      // Check for existing connection
      await this.checkExistingConnection();
      
    } catch (error) {
      console.error('Failed to initialize HashConnect:', error);
      this.notifyListeners({ type: 'error', data: error });
    }
  }

  private async checkExistingConnection(): Promise<void> {
    try {
      const savedConnection = localStorage.getItem('yieldharvest_wallet_connection');
      const savedTopic = localStorage.getItem('yieldharvest_wallet_topic');
      
      if (savedConnection && savedTopic && this.hashConnect) {
        const connectionData = JSON.parse(savedConnection);
        
        // Try to reconnect using saved topic
        try {
          const state = await this.hashConnect.connect(savedTopic);
          
          if (state && state.accountIds && state.accountIds.length > 0) {
            this.connection = {
              ...connectionData,
              isConnected: true,
            };
            
            this.updateBalance();
            this.notifyListeners({ type: 'reconnected', data: this.connection });
            console.log('Successfully reconnected to existing wallet session');
          } else {
            // Clear invalid saved data
            this.clearStoredConnection();
          }
        } catch (error) {
          console.warn('Failed to reconnect to saved session:', error);
          this.clearStoredConnection();
        }
      }
    } catch (error) {
      console.error('Error checking existing connection:', error);
      this.clearStoredConnection();
    }
  }

  private saveConnectionToStorage(): void {
    if (this.connection) {
      localStorage.setItem('yieldharvest_wallet_connection', JSON.stringify(this.connection));
      if (this.connection.topic) {
        localStorage.setItem('yieldharvest_wallet_topic', this.connection.topic);
      }
    }
  }

  private clearStoredConnection(): void {
    localStorage.removeItem('yieldharvest_wallet_connection');
    localStorage.removeItem('yieldharvest_wallet_topic');
  }

  private async updateBalance(): Promise<void> {
    if (!this.connection?.accountId) return;
    
    try {
      // Use Mirror Node API to get balance
      const response = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/accounts/${this.connection.accountId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const hbarBalance = (parseInt(data.balance.balance) / 100000000).toFixed(2); // Convert tinybars to HBAR
        
        if (this.connection) {
          this.connection.hbarBalance = hbarBalance;
          this.saveConnectionToStorage();
          this.notifyListeners({ type: 'balanceUpdated', data: { balance: hbarBalance } });
        }
      }
    } catch (error) {
      console.warn('Failed to fetch balance:', error);
    }
  }

  private notifyListeners(event: { type: string; data?: any }): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in wallet event listener:', error);
      }
    });
  }

  // Public methods
  async connect(): Promise<WalletConnection> {
    if (!this.hashConnect) {
      throw new Error('HashConnect not initialized');
    }

    if (this.connection?.isConnected) {
      return this.connection;
    }

    try {
      // Check for available wallet extensions
      const extensions = this.hashConnect.findLocalWallets();
      console.log('Available wallet extensions:', extensions);

      // Create pairing and connect
      const state = await this.hashConnect.connect();
      const pairingString = this.hashConnect.generatePairingString(state, this.network, false);
      
      // Store topic for reconnection
      if (state?.topic) {
        localStorage.setItem('yieldharvest_wallet_topic', state.topic);
      }

      // Connect to local wallet (HashPack extension)
      await this.hashConnect.connectToLocalWallet(pairingString);
      
      // Return a promise that resolves when pairing is complete
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Wallet connection timeout'));
        }, 30000); // 30 second timeout
        
        const listener = (event: { type: string; data?: any }) => {
          if (event.type === 'connected' && event.data) {
            clearTimeout(timeout);
            this.removeListener(listener);
            resolve(event.data);
          }
        };
        
        this.addListener(listener);
      });
      
    } catch (error) {
      console.error('Wallet connection failed:', error);
      throw new Error(`Failed to connect wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.hashConnect) {
        await this.hashConnect.disconnect();
      }
      
      this.connection = null;
      this.pairingData = null;
      this.clearStoredConnection();
      
      this.notifyListeners({ type: 'disconnected' });
      console.log('Wallet disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      throw error;
    }
  }

  async signTransaction(transactionBytes: Uint8Array): Promise<Uint8Array> {
    if (!this.hashConnect || !this.connection?.isConnected) {
      throw new Error('Wallet not connected');
    }

    if (!this.connection.topic) {
      throw new Error('No active wallet session');
    }

    try {
      const result = await this.hashConnect.sendTransaction(
        this.connection.topic,
        {
          byteArray: transactionBytes,
          metadata: {
            accountToSign: this.connection.accountId,
            returnTransaction: false,
          },
        }
      );

      if (result.success && result.signedTransaction) {
        return new Uint8Array(result.signedTransaction);
      } else {
        throw new Error(result.error || 'Transaction signing failed');
      }
    } catch (error) {
      console.error('Transaction signing failed:', error);
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async refreshBalance(): Promise<WalletConnection | null> {
    if (!this.connection) {
      return null;
    }

    await this.updateBalance();
    return this.connection;
  }

  async checkWalletAvailability(): Promise<Record<WalletType, boolean>> {
    const availability: Record<WalletType, boolean> = {
      hashpack: false,
      blade: false,
    };

    if (typeof window !== 'undefined') {
      // Check HashPack
      availability.hashpack = !!(window as any).hashpack || 
                              (this.hashConnect?.findLocalWallets()?.length || 0) > 0;
      
      // Check Blade
      availability.blade = !!(window as any).bladeWallet;
    }

    return availability;
  }

  // Event management
  addListener(listener: WalletEventListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: WalletEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Getters
  getConnection(): WalletConnection | null {
    return this.connection;
  }

  isConnected(): boolean {
    return this.connection?.isConnected || false;
  }

  getAccountId(): string | null {
    return this.connection?.accountId || null;
  }

  getNetwork(): 'mainnet' | 'testnet' {
    return this.network;
  }

  getHashScanUrl(transactionId: string): string {
    const baseUrl = this.network === 'mainnet' 
      ? 'https://hashscan.io/mainnet' 
      : 'https://hashscan.io/testnet';
    return `${baseUrl}/transaction/${transactionId}`;
  }

  getMirrorNodeUrl(): string {
    return this.network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
  }
}

// Export singleton instance
export const walletService = new WalletService('testnet');
export default walletService;