import { 
  AccountId, 
  PrivateKey, 
  PublicKey, 
  Transaction, 
  TransactionId,
  TransactionReceipt,
  Status
} from '@hashgraph/sdk';
import { logger } from '../utils/logger';

export interface WalletConfig {
  network: 'testnet' | 'mainnet';
  mirrorNodeUrl: string;
}

export interface WalletAccount {
  accountId: string;
  publicKey: string;
  network: string;
}

export interface SignedTransaction {
  transactionId: string;
  transactionBytes: Uint8Array;
  signedBytes: Uint8Array;
}

export interface WalletProvider {
  name: 'hashpack' | 'blade';
  isConnected: boolean;
  account?: WalletAccount;
}

export interface HashPackMetadata {
  name: string;
  description: string;
  icon: string;
  url: string;
}

export interface BladeWalletConfig {
  network: 'testnet' | 'mainnet';
  dAppCode: string;
}

/**
 * Wallet Service for managing HashPack and Blade wallet integrations
 * Handles wallet connection, transaction signing, and account management
 */
export class WalletService {
  private config: WalletConfig;
  private connectedWallet?: WalletProvider;

  constructor(config: WalletConfig) {
    this.config = config;
  }

  /**
   * Initialize HashPack wallet connection
   */
  async initHashPack(metadata: HashPackMetadata): Promise<boolean> {
    try {
      // HashPack integration would be handled on the frontend
      // This service provides the backend support for transaction verification
      logger.info({
        wallet: 'hashpack',
        network: this.config.network,
      }, 'HashPack wallet initialization requested');

      return true;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        wallet: 'hashpack',
      }, 'Failed to initialize HashPack wallet');
      return false;
    }
  }

  /**
   * Initialize Blade wallet connection
   */
  async initBlade(config: BladeWalletConfig): Promise<boolean> {
    try {
      // Blade wallet integration would be handled on the frontend
      // This service provides the backend support for transaction verification
      logger.info({
        wallet: 'blade',
        network: config.network,
        dAppCode: config.dAppCode,
      }, 'Blade wallet initialization requested');

      return true;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        wallet: 'blade',
      }, 'Failed to initialize Blade wallet');
      return false;
    }
  }

  /**
   * Connect to a wallet (called from frontend after user approval)
   */
  async connectWallet(provider: WalletProvider): Promise<boolean> {
    try {
      // Validate account ID format
      if (provider.account) {
        AccountId.fromString(provider.account.accountId);
        PublicKey.fromString(provider.account.publicKey);
      }

      this.connectedWallet = provider;

      logger.info({
        wallet: provider.name,
        accountId: provider.account?.accountId,
        network: provider.account?.network,
      }, 'Wallet connected successfully');

      return true;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        wallet: provider.name,
      }, 'Failed to connect wallet');
      return false;
    }
  }

  /**
   * Disconnect current wallet
   */
  async disconnectWallet(): Promise<void> {
    if (this.connectedWallet) {
      logger.info({
        wallet: this.connectedWallet.name,
        accountId: this.connectedWallet.account?.accountId,
      }, 'Wallet disconnected');
    }

    this.connectedWallet = undefined;
  }

  /**
   * Get currently connected wallet
   */
  getConnectedWallet(): WalletProvider | undefined {
    return this.connectedWallet;
  }

  /**
   * Verify a signed transaction
   */
  async verifySignedTransaction(
    transactionBytes: Uint8Array,
    signedBytes: Uint8Array,
    expectedSignerAccountId: string
  ): Promise<boolean> {
    try {
      // Parse the transaction
      const transaction = Transaction.fromBytes(transactionBytes);
      const signedTransaction = Transaction.fromBytes(signedBytes);

      // Verify the transaction ID matches
      const originalTxId = transaction.transactionId;
      const signedTxId = signedTransaction.transactionId;

      if (!originalTxId || !signedTxId) {
        logger.error({}, 'Transaction ID missing from transaction');
        return false;
      }

      if (originalTxId.toString() !== signedTxId.toString()) {
        logger.error({
          originalTxId: originalTxId.toString(),
          signedTxId: signedTxId.toString(),
        }, 'Transaction ID mismatch');
        return false;
      }

      // Verify the signer account
      const expectedAccountId = AccountId.fromString(expectedSignerAccountId);
      if (originalTxId.accountId?.toString() !== expectedAccountId.toString()) {
        logger.error({
          expectedAccountId: expectedAccountId.toString(),
          actualAccountId: originalTxId.accountId?.toString(),
        }, 'Signer account ID mismatch');
        return false;
      }

      // Check if transaction has signatures
      const signatures = (signedTransaction as any)._signedTransactions;
      if (!signatures || signatures.size === 0) {
        logger.error({}, 'No signatures found in signed transaction');
        return false;
      }

      logger.info({
        transactionId: signedTxId.toString(),
        signerAccountId: expectedSignerAccountId,
        signatureCount: signatures.size,
      }, 'Transaction signature verified successfully');

      return true;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        expectedSignerAccountId,
      }, 'Failed to verify signed transaction');
      return false;
    }
  }

  /**
   * Prepare transaction for wallet signing
   */
  async prepareTransactionForSigning(
    transaction: Transaction,
    payerAccountId: string
  ): Promise<{
    transactionId: string;
    transactionBytes: Uint8Array;
    bodyBytes: Uint8Array;
  }> {
    try {
      // Set transaction ID if not already set
      if (!transaction.transactionId) {
        const accountId = AccountId.fromString(payerAccountId);
        transaction.setTransactionId(TransactionId.generate(accountId));
      }

      // Freeze the transaction
      transaction.freeze();

      const transactionId = transaction.transactionId!.toString();
      const transactionBytes = transaction.toBytes();
      
      // Get transaction body bytes for signing
      const bodyBytes = (transaction as any)._makeTransactionBody().toBytes();

      logger.info({
        transactionId,
        payerAccountId,
        transactionType: transaction.constructor.name,
      }, 'Transaction prepared for wallet signing');

      return {
        transactionId,
        transactionBytes,
        bodyBytes,
      };
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        payerAccountId,
      }, 'Failed to prepare transaction for signing');
      throw error;
    }
  }

  /**
   * Validate wallet account format
   */
  validateWalletAccount(account: WalletAccount): boolean {
    try {
      // Validate account ID
      AccountId.fromString(account.accountId);
      
      // Validate public key
      PublicKey.fromString(account.publicKey);
      
      // Validate network
      if (!['testnet', 'mainnet'].includes(account.network)) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        accountId: account.accountId,
      }, 'Invalid wallet account format');
      return false;
    }
  }

  /**
   * Get wallet connection status
   */
  isWalletConnected(): boolean {
    return this.connectedWallet?.isConnected ?? false;
  }

  /**
   * Get connected account ID
   */
  getConnectedAccountId(): string | undefined {
    return this.connectedWallet?.account?.accountId;
  }

  /**
   * Get supported wallet providers
   */
  getSupportedWallets(): Array<{ name: string; displayName: string; icon?: string }> {
    return [
      {
        name: 'hashpack',
        displayName: 'HashPack',
        icon: 'https://www.hashpack.app/img/logo.svg',
      },
      {
        name: 'blade',
        displayName: 'Blade Wallet',
        icon: 'https://www.bladewallet.io/img/logo.svg',
      },
    ];
  }

  /**
   * Create transaction signing request for frontend
   */
  createSigningRequest(
    transactionBytes: Uint8Array,
    accountId: string,
    description?: string
  ): {
    transactionBytes: string; // Base64 encoded
    accountId: string;
    description?: string;
    network: string;
  } {
    return {
      transactionBytes: Buffer.from(transactionBytes).toString('base64'),
      accountId,
      description,
      network: this.config.network,
    };
  }

  /**
   * Parse signed transaction response from frontend
   */
  parseSignedTransactionResponse(response: {
    transactionBytes: string; // Base64 encoded
    signedBytes: string; // Base64 encoded
    transactionId: string;
  }): SignedTransaction {
    return {
      transactionId: response.transactionId,
      transactionBytes: Buffer.from(response.transactionBytes, 'base64'),
      signedBytes: Buffer.from(response.signedBytes, 'base64'),
    };
  }
}