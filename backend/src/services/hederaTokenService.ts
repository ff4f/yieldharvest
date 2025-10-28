import {
  Client,
  PrivateKey,
  AccountId,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenNftInfoQuery,
  TransferTransaction,
  TokenAssociateTransaction,
  Hbar,
  TokenId,
  NftId,
  TransactionResponse,
  TransactionReceipt,
  Status
} from '@hashgraph/sdk';
import { logger } from '../utils/logger';

export interface InvoiceNFTMetadata {
  invoiceId: string;
  supplierId: string;
  buyerId: string;
  amount: number;
  currency: string;
  dueDate: string;
  issueDate: string;
  status: 'issued' | 'funded' | 'paid';
  description: string;
  documentHash?: string;
  fileId?: string;
}

export interface NFTMintResult {
  success: boolean;
  tokenId: string;
  serialNumber: number;
  transactionId: string;
  hashScanUrl: string;
  mirrorNodeUrl: string;
  metadata: InvoiceNFTMetadata;
  error?: string;
}

export interface TokenCreationResult {
  success: boolean;
  tokenId: string;
  transactionId: string;
  hashScanUrl: string;
  mirrorNodeUrl: string;
  error?: string;
}

export class HederaTokenService {
  private client: Client;
  private operatorAccountId: AccountId;
  private operatorPrivateKey: PrivateKey;
  private network: string;
  private invoiceTokenId?: TokenId;

  constructor() {
    this.network = process.env.HEDERA_NETWORK || 'testnet';
    
    // Initialize client based on network
    if (this.network === 'mainnet') {
      this.client = Client.forMainnet();
    } else if (this.network === 'previewnet') {
      this.client = Client.forPreviewnet();
    } else {
      this.client = Client.forTestnet();
    }

    // Set operator account
    const operatorId = process.env.HEDERA_OPERATOR_ID;
    const operatorKey = process.env.HEDERA_OPERATOR_KEY;

    if (!operatorId || !operatorKey) {
      throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set');
    }

    this.operatorAccountId = AccountId.fromString(operatorId);
    this.operatorPrivateKey = PrivateKey.fromString(operatorKey);
    
    this.client.setOperator(this.operatorAccountId, this.operatorPrivateKey);

    // Set existing token ID if provided
    if (process.env.INVOICE_TOKEN_ID) {
      this.invoiceTokenId = TokenId.fromString(process.env.INVOICE_TOKEN_ID);
    }

    logger.info({ network: this.network }, `HederaTokenService initialized for ${this.network}`);
  }

  /**
   * Create NFT token for invoices (one-time setup)
   */
  async createInvoiceNFTToken(
    tokenName: string = 'YieldHarvest Invoice NFT',
    tokenSymbol: string = 'YHINV'
  ): Promise<TokenCreationResult> {
    try {
      logger.info({}, 'Creating invoice NFT token...');

      const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName(tokenName)
        .setTokenSymbol(tokenSymbol)
        .setTokenType(TokenType.NonFungibleUnique)
        .setSupplyType(TokenSupplyType.Infinite)
        .setInitialSupply(0)
        .setTreasuryAccountId(this.operatorAccountId)
        .setSupplyKey(this.operatorPrivateKey)
        .setAdminKey(this.operatorPrivateKey)
        .setMetadataKey(this.operatorPrivateKey)
        .setMaxTransactionFee(new Hbar(20))
        .freezeWith(this.client);

      const tokenCreateSign = await tokenCreateTx.sign(this.operatorPrivateKey);
      const tokenCreateSubmit = await tokenCreateSign.execute(this.client);
      const tokenCreateReceipt = await tokenCreateSubmit.getReceipt(this.client);

      if (tokenCreateReceipt.status !== Status.Success) {
        throw new Error(`Token creation failed: ${tokenCreateReceipt.status}`);
      }

      const tokenId = tokenCreateReceipt.tokenId!;
      const transactionId = tokenCreateSubmit.transactionId.toString();

      logger.info({ tokenId }, `Invoice NFT token created: ${tokenId}`);

      return {
        success: true,
        tokenId: tokenId.toString(),
        transactionId,
        hashScanUrl: this.getHashScanUrl('transaction', transactionId),
        mirrorNodeUrl: this.getMirrorNodeUrl('transaction', transactionId)
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error creating invoice NFT token');
      return {
        success: false,
        tokenId: '',
        transactionId: '',
        hashScanUrl: '',
        mirrorNodeUrl: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Mint NFT for a specific invoice
   */
  async mintInvoiceNFT(metadata: InvoiceNFTMetadata): Promise<NFTMintResult> {
    try {
      if (!this.invoiceTokenId) {
        throw new Error('Invoice token ID not set. Create token first.');
      }

      logger.info({ invoiceId: metadata.invoiceId }, `Minting NFT for invoice: ${metadata.invoiceId}`);

      // Create metadata JSON
      const nftMetadata = {
        name: `Invoice #${metadata.invoiceId}`,
        description: metadata.description,
        image: `https://yieldharvest.app/api/invoices/${metadata.invoiceId}/image`,
        attributes: [
          { trait_type: 'Invoice ID', value: metadata.invoiceId },
          { trait_type: 'Supplier ID', value: metadata.supplierId },
          { trait_type: 'Buyer ID', value: metadata.buyerId },
          { trait_type: 'Amount', value: metadata.amount.toString() },
          { trait_type: 'Currency', value: metadata.currency },
          { trait_type: 'Due Date', value: metadata.dueDate },
          { trait_type: 'Issue Date', value: metadata.issueDate },
          { trait_type: 'Status', value: metadata.status },
          ...(metadata.documentHash ? [{ trait_type: 'Document Hash', value: metadata.documentHash }] : []),
          ...(metadata.fileId ? [{ trait_type: 'File ID', value: metadata.fileId }] : [])
        ],
        external_url: `https://yieldharvest.app/invoices/${metadata.invoiceId}`,
        created_at: new Date().toISOString()
      };

      // Convert metadata to bytes
      const metadataBytes = Buffer.from(JSON.stringify(nftMetadata), 'utf8');

      // Mint NFT
      const mintTx = new TokenMintTransaction()
        .setTokenId(this.invoiceTokenId)
        .setMetadata([metadataBytes])
        .setMaxTransactionFee(new Hbar(10))
        .freezeWith(this.client);

      const mintTxSign = await mintTx.sign(this.operatorPrivateKey);
      const mintTxSubmit = await mintTxSign.execute(this.client);
      const mintReceipt = await mintTxSubmit.getReceipt(this.client);

      if (mintReceipt.status !== Status.Success) {
        throw new Error(`NFT minting failed: ${mintReceipt.status}`);
      }

      const serialNumber = mintReceipt.serials[0].toNumber();
      const transactionId = mintTxSubmit.transactionId.toString();

      logger.info({ tokenId: this.invoiceTokenId, serialNumber }, `NFT minted successfully: ${this.invoiceTokenId}/${serialNumber}`);

      return {
        success: true,
        tokenId: this.invoiceTokenId.toString(),
        serialNumber,
        transactionId,
        hashScanUrl: this.getHashScanUrl('transaction', transactionId),
        mirrorNodeUrl: this.getMirrorNodeUrl('transaction', transactionId),
        metadata
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error minting invoice NFT');
      return {
        success: false,
        tokenId: this.invoiceTokenId?.toString() || '',
        serialNumber: 0,
        transactionId: '',
        hashScanUrl: '',
        mirrorNodeUrl: '',
        metadata,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Transfer NFT to another account
   */
  async transferInvoiceNFT(
    tokenId: string,
    serialNumber: number,
    fromAccountId: string,
    toAccountId: string,
    fromPrivateKey?: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const nftId = new NftId(TokenId.fromString(tokenId), serialNumber);
      const fromAccount = AccountId.fromString(fromAccountId);
      const toAccount = AccountId.fromString(toAccountId);

      // Use provided private key or operator key
      const signingKey = fromPrivateKey 
        ? PrivateKey.fromString(fromPrivateKey)
        : this.operatorPrivateKey;

      // Associate token with receiver account if needed
      try {
        const associateTx = new TokenAssociateTransaction()
          .setAccountId(toAccount)
          .setTokenIds([TokenId.fromString(tokenId)])
          .setMaxTransactionFee(new Hbar(5))
          .freezeWith(this.client);

        const associateSign = await associateTx.sign(signingKey);
        await associateSign.execute(this.client);
      } catch (error) {
        // Token might already be associated, continue
        logger.warn({ error }, 'Token association warning (might already be associated)');
      }

      // Transfer NFT
      const transferTx = new TransferTransaction()
        .addNftTransfer(nftId, fromAccount, toAccount)
        .setMaxTransactionFee(new Hbar(5))
        .freezeWith(this.client);

      const transferSign = await transferTx.sign(signingKey);
      const transferSubmit = await transferSign.execute(this.client);
      const transferReceipt = await transferSubmit.getReceipt(this.client);

      if (transferReceipt.status !== Status.Success) {
        throw new Error(`NFT transfer failed: ${transferReceipt.status}`);
      }

      const transactionId = transferSubmit.transactionId.toString();
      logger.info({ nftId, fromAccount, toAccount }, `NFT transferred successfully: ${nftId} from ${fromAccount} to ${toAccount}`);

      return {
        success: true,
        transactionId
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error transferring invoice NFT');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get NFT information
   */
  async getNFTInfo(tokenId: string, serialNumber: number): Promise<any> {
    try {
      const nftId = new NftId(TokenId.fromString(tokenId), serialNumber);
      const nftInfos = await new TokenNftInfoQuery()
        .setNftId(nftId)
        .execute(this.client);

      // TokenNftInfoQuery returns an array, get the first item
      const nftInfo = nftInfos[0];
      if (!nftInfo) {
        throw new Error('NFT not found');
      }

      return {
        tokenId: nftInfo.nftId.tokenId.toString(),
        serialNumber: nftInfo.nftId.serial.toNumber(),
        accountId: nftInfo.accountId?.toString(),
        creationTime: nftInfo.creationTime,
        metadata: nftInfo.metadata ? JSON.parse(Buffer.from(nftInfo.metadata).toString('utf8')) : null,
        ledgerId: nftInfo.ledgerId?.toString() || 'unknown'
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Error getting NFT info');
      throw error;
    }
  }

  /**
   * Set invoice token ID (if token already exists)
   */
  setInvoiceTokenId(tokenId: string): void {
    this.invoiceTokenId = TokenId.fromString(tokenId);
    logger.info({ tokenId }, `Invoice token ID set to: ${tokenId}`);
  }

  /**
   * Get HashScan URL for transaction or token
   */
  private getHashScanUrl(type: 'transaction' | 'token' | 'nft', id: string): string {
    const baseUrl = this.network === 'mainnet' 
      ? 'https://hashscan.io/mainnet'
      : `https://hashscan.io/${this.network}`;

    switch (type) {
      case 'transaction':
        return `${baseUrl}/transaction/${id}`;
      case 'token':
        return `${baseUrl}/token/${id}`;
      case 'nft':
        return `${baseUrl}/token/${id}`;
      default:
        return baseUrl;
    }
  }

  /**
   * Get Mirror Node URL for transaction or token
   */
  private getMirrorNodeUrl(type: 'transaction' | 'token' | 'nft', id: string): string {
    const baseUrl = this.network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com/api/v1'
      : `https://${this.network}.mirrornode.hedera.com/api/v1`;

    switch (type) {
      case 'transaction':
        return `${baseUrl}/transactions/${id}`;
      case 'token':
        return `${baseUrl}/tokens/${id}`;
      case 'nft':
        return `${baseUrl}/tokens/${id}/nfts`;
      default:
        return baseUrl;
    }
  }

  /**
   * Close client connection
   */
  async close(): Promise<void> {
    await this.client.close();
    logger.info({}, 'Hedera client connection closed');
  }
}

// Export singleton instance
export const hederaTokenService = new HederaTokenService();