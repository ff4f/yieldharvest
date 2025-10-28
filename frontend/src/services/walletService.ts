import { HashConnect, HashConnectConnectionState, SessionData } from 'hashconnect';
import { LedgerId, AccountId, Transaction } from '@hashgraph/sdk';

export interface WalletConnection {
  accountId: string;
  network: string;
  walletType: 'hashpack' | 'blade';
}

export interface WalletBalance {
  hbar: string;
  tokens: Array<{
    tokenId: string;
    balance: string;
    symbol: string;
  }>;
}

class WalletService {
  private hashConnect: HashConnect | null = null;
  private connectionState: HashConnectConnectionState = HashConnectConnectionState.Disconnected;
  private sessionData: SessionData | null = null;
  private listeners: Array<(connection: WalletConnection | null) => void> = [];

  constructor() {
    this.initializeHashConnect();
  }

  private async initializeHashConnect() {
    try {
      // WalletConnect app metadata
      const appMetadata = {
        name: 'YieldHarvest',
        description: 'Invoice factoring platform on Hedera',
        icons: ['https://yieldharvest.app/icon.png'],
        url: 'https://yieldharvest.app'
      };

      // Initialize HashConnect with WalletConnect project ID
      this.hashConnect = new HashConnect(
        LedgerId.TESTNET,
        import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'your-project-id',
        appMetadata,
        true // debug mode
      );

      // Set up event listeners
      this.setupEventListeners();

      // Initialize HashConnect
      await this.hashConnect.init();

      // Check for existing connections
      this.checkExistingConnection();
    } catch (error) {
      console.error('Failed to initialize HashConnect:', error);
    }
  }

  private setupEventListeners() {
    if (!this.hashConnect) return;

    // Connection status change
    this.hashConnect.connectionStatusChangeEvent.on((state: HashConnectConnectionState) => {
      this.connectionState = state;
      console.log('Connection state changed:', state);
    });

    // Pairing event
    this.hashConnect.pairingEvent.on((sessionData: SessionData) => {
      this.sessionData = sessionData;
      console.log('Paired with wallet:', sessionData);
      
      // Persist connection data
      this.persistConnection(sessionData);
      
      // Notify listeners
      this.notifyListeners();
    });

    // Disconnection event
    this.hashConnect.disconnectionEvent.on(() => {
      this.sessionData = null;
      console.log('Disconnected from wallet');
      
      // Clear persisted data
      this.clearPersistedConnection();
      
      // Notify listeners
      this.notifyListeners();
    });
  }

  private checkExistingConnection() {
    try {
      const savedConnection = localStorage.getItem('yieldharvest_wallet_connection');
      if (savedConnection) {
        const connectionData = JSON.parse(savedConnection);
        
        // Restore session data if valid
        if (connectionData.accountIds && connectionData.accountIds.length > 0) {
          this.sessionData = {
            metadata: connectionData.metadata || {
              name: 'Unknown Wallet',
              description: '',
              url: '',
              icons: []
            },
            accountIds: connectionData.accountIds,
            network: connectionData.network || 'testnet'
          };
          this.connectionState = HashConnectConnectionState.Paired;
          this.notifyListeners();
        }
      }
    } catch (error) {
      console.error('Error checking existing connection:', error);
    }
  }

  private persistConnection(sessionData: SessionData) {
    try {
      const connectionData = {
        accountIds: sessionData.accountIds,
        network: sessionData.network,
        metadata: sessionData.metadata,
        timestamp: Date.now()
      };
      localStorage.setItem('yieldharvest_wallet_connection', JSON.stringify(connectionData));
    } catch (error) {
      console.error('Error persisting connection:', error);
    }
  }

  private clearPersistedConnection() {
    try {
      localStorage.removeItem('yieldharvest_wallet_connection');
    } catch (error) {
      console.error('Error clearing persisted connection:', error);
    }
  }

  private notifyListeners() {
    const connection = this.getConnection();
    this.listeners.forEach(listener => listener(connection));
  }

  public async connect(): Promise<WalletConnection | null> {
    try {
      if (!this.hashConnect) {
        throw new Error('HashConnect not initialized');
      }

      // Open pairing modal
      this.hashConnect.openPairingModal();
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 60000); // 60 second timeout

        const listener = (connection: WalletConnection | null) => {
          if (connection) {
            clearTimeout(timeout);
            this.removeListener(listener);
            resolve(connection);
          }
        };

        this.addListener(listener);
      });
    } catch (error) {
      console.error('Error connecting to wallet:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.hashConnect) {
        await this.hashConnect.disconnect();
      }
    } catch (error) {
      console.error('Error disconnecting from wallet:', error);
      throw error;
    }
  }

  public getConnection(): WalletConnection | null {
    if (!this.sessionData || !this.sessionData.accountIds.length) {
      return null;
    }

    return {
      accountId: this.sessionData.accountIds[0],
      network: this.sessionData.network,
      walletType: 'hashpack' // Default to hashpack
    };
  }

  public isConnected(): boolean {
    return this.connectionState === HashConnectConnectionState.Paired && 
           this.sessionData !== null &&
           this.sessionData.accountIds.length > 0;
  }

  public getConnectionState(): HashConnectConnectionState {
    return this.connectionState;
  }

  public async signTransaction(transaction: Transaction): Promise<any> {
    try {
      if (!this.hashConnect || !this.sessionData || !this.sessionData.accountIds.length) {
        throw new Error('Wallet not connected');
      }

      const accountId = this.sessionData.accountIds[0];
      const response = await this.hashConnect.sendTransaction(accountId, transaction);
      
      return response;
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw error;
    }
  }

  public addListener(listener: (connection: WalletConnection | null) => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: (connection: WalletConnection | null) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  public isWalletAvailable(): boolean {
    return this.hashConnect !== null;
  }
}

export const walletService = new WalletService();
export default walletService;