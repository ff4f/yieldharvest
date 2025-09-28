import {
  Client,
  PrivateKey,
  AccountId,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  FileCreateTransaction,
  FileAppendTransaction,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TransferTransaction,
  Hbar,
  ScheduleCreateTransaction,
  // TransactionResponse,
  // TransactionReceipt,
} from '@hashgraph/sdk';
import crypto from 'crypto';

export interface HederaConfig {
  operatorId: string;
  operatorKey: string;
  network: string;
  mirrorNodeUrl: string;
}

export interface NFTMetadata {
  name: string;
  description: string;
  image?: string;
  properties?: Record<string, any>;
}

export interface InvoiceNFTData {
  invoiceId: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  dueDate: string;
  supplierId: string;
  buyerId: string;
  fileId?: string;
  fileHash?: string;
}

export interface HFSUploadResult {
  fileId: string;
  transactionId: string;
  fileHashSha384: string;
}

export interface HCSMessageData {
  tokenId: string;
  serialNumber: string;
  status: 'issued' | 'funded' | 'paid' | 'defaulted';
  timestamp: string;
  fileHash?: string;
  amount?: string;
  currency?: string;
}

export class HederaService {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private mirrorNodeUrl: string;

  constructor(config: HederaConfig) {
    this.operatorId = AccountId.fromString(config.operatorId);
    this.operatorKey = PrivateKey.fromString(config.operatorKey);
    this.mirrorNodeUrl = config.mirrorNodeUrl;

    // Initialize client based on network
    if (config.network === 'testnet') {
      this.client = Client.forTestnet();
    } else if (config.network === 'mainnet') {
      this.client = Client.forMainnet();
    } else {
      throw new Error(`Unsupported network: ${config.network}`);
    }

    this.client.setOperator(this.operatorId, this.operatorKey);
  }

  async isConnected(): Promise<boolean> {
    try {
      // Simple ping to check connection
      await this.client.ping(this.operatorId);
      return true;
    } catch (error) {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.client.close();
  }

  /**
   * Create NFT token for invoices
   */
  async createInvoiceNFTToken(
    name: string,
    symbol: string,
    memo?: string
  ): Promise<{ tokenId: string; transactionId: string }> {
    const transaction = new TokenCreateTransaction()
      .setTokenName(name)
      .setTokenSymbol(symbol)
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(10000) // Max 10k invoices
      .setTreasuryAccountId(this.operatorId)
      .setSupplyKey(this.operatorKey)
      .setAdminKey(this.operatorKey)
      .setFreezeDefault(false);

    if (memo) {
      transaction.setTokenMemo(memo);
    }

    const response = await transaction.execute(this.client);
    const receipt = await response.getReceipt(this.client);
    
    if (!receipt.tokenId) {
      throw new Error('Failed to create NFT token');
    }

    return {
      tokenId: receipt.tokenId.toString(),
      transactionId: response.transactionId.toString(),
    };
  }

  /**
   * Mint NFT for a specific invoice
   */
  async mintInvoiceNFT(
    tokenId: string,
    metadata: InvoiceNFTData
  ): Promise<{ serialNumber: string; transactionId: string }> {
    const metadataBytes = Buffer.from(JSON.stringify(metadata));
    
    const transaction = new TokenMintTransaction()
      .setTokenId(tokenId)
      .setMetadata([metadataBytes]);

    const response = await transaction.execute(this.client);
    const receipt = await response.getReceipt(this.client);
    
    if (!receipt.serials || receipt.serials.length === 0) {
      throw new Error('Failed to mint NFT');
    }

    return {
      serialNumber: receipt.serials[0]!.toString(),
      transactionId: response.transactionId.toString(),
    };
  }

  /**
   * Upload PDF file to Hedera File Service with validation and SHA-384 hashing
   */
  async uploadPdfToHfs(
    fileBuffer: Buffer,
    mimeType: string,
    filename?: string
  ): Promise<HFSUploadResult> {
    // Validate file type
    if (mimeType !== 'application/pdf') {
      throw new Error('Only PDF files are allowed');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (fileBuffer.length > maxSize) {
      throw new Error(`File size exceeds maximum allowed size of ${maxSize} bytes`);
    }

    // Validate PDF header
    if (!fileBuffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      throw new Error('Invalid PDF file format');
    }

    try {
      // Calculate SHA-384 hash
      const fileHashSha384 = crypto.createHash('sha384').update(fileBuffer).digest('hex');

      // Create file on Hedera File Service
      const fileCreateTx = new FileCreateTransaction()
        .setContents(fileBuffer)
        .setKeys([this.operatorKey]);

      if (filename) {
        fileCreateTx.setFileMemo(`YH-Invoice-PDF: ${filename}`);
      }

      const response = await fileCreateTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);
      const fileId = receipt.fileId!.toString();

      return {
        fileId,
        transactionId: response.transactionId.toString(),
        fileHashSha384,
      };
    } catch (error) {
      throw new Error(`Failed to upload PDF to HFS: ${error}`);
    }
  }

  /**
   * Upload file to Hedera File Service (HFS)
   */
  async uploadFile(
    fileContent: Buffer,
    memo?: string
  ): Promise<{ fileId: string; transactionId: string; hash: string }> {
    // Create file
    const fileCreateTx = new FileCreateTransaction()
      .setContents(fileContent.slice(0, 1024)) // First chunk
      .setKeys([this.operatorKey]);

    if (memo) {
      fileCreateTx.setFileMemo(memo);
    }

    const fileCreateResponse = await fileCreateTx.execute(this.client);
    const fileCreateReceipt = await fileCreateResponse.getReceipt(this.client);
    
    if (!fileCreateReceipt.fileId) {
      throw new Error('Failed to create file');
    }

    const fileId = fileCreateReceipt.fileId;

    // Append remaining content if file is larger than 1024 bytes
    if (fileContent.length > 1024) {
      const remainingContent = fileContent.slice(1024);
      const chunks = [];
      
      for (let i = 0; i < remainingContent.length; i += 1024) {
        chunks.push(remainingContent.slice(i, i + 1024));
      }

      for (const chunk of chunks) {
        const fileAppendTx = new FileAppendTransaction()
          .setFileId(fileId)
          .setContents(chunk);
        
        await fileAppendTx.execute(this.client);
      }
    }

    // Calculate hash
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(fileContent).digest('hex');

    return {
      fileId: fileId.toString(),
      transactionId: fileCreateResponse.transactionId.toString(),
      hash,
    };
  }

  /**
   * Create topic for consensus messages
   */
  async createTopic(
    memo?: string
  ): Promise<{ topicId: string; transactionId: string }> {
    const transaction = new TopicCreateTransaction()
      .setAdminKey(this.operatorKey)
      .setSubmitKey(this.operatorKey);

    if (memo) {
      transaction.setTopicMemo(memo);
    }

    const response = await transaction.execute(this.client);
    const receipt = await response.getReceipt(this.client);
    
    if (!receipt.topicId) {
      throw new Error('Failed to create topic');
    }

    return {
      topicId: receipt.topicId.toString(),
      transactionId: response.transactionId.toString(),
    };
  }

  /**
   * Submit message to HCS topic
   */
  async submitTopicMessage(
    topicId: string,
    message: string | object
  ): Promise<{ transactionId: string; sequenceNumber: string }> {
    try {
      const messageString = typeof message === 'string' ? message : JSON.stringify(message);
      
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(messageString);

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return {
        transactionId: response.transactionId.toString(),
        sequenceNumber: receipt.topicSequenceNumber?.toString() || '0',
      };
    } catch (error) {
      throw new Error(`Failed to submit topic message: ${error}`);
    }
  }

  /**
   * Submit invoice status message to HCS topic
   */
  async submitInvoiceStatusMessage(
    topicId: string,
    messageData: HCSMessageData
  ): Promise<{ transactionId: string; sequenceNumber: string }> {
    try {
      // Create structured message with timestamp
      const message = {
        ...messageData,
        timestamp: new Date().toISOString(),
        version: '1.0',
        type: 'invoice_status_update'
      };
      
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(JSON.stringify(message));

      const response = await transaction.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      return {
        transactionId: response.transactionId.toString(),
        sequenceNumber: receipt.topicSequenceNumber?.toString() || '0',
      };
    } catch (error) {
      throw new Error(`Failed to submit invoice status message: ${error}`);
    }
  }

  /**
   * Create scheduled transaction for funding
   */
  async createScheduledTransfer(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    memo?: string
  ): Promise<{ scheduleId: string; transactionId: string }> {
    const transferTx = new TransferTransaction()
      .addHbarTransfer(fromAccountId, Hbar.fromTinybars(-amount))
      .addHbarTransfer(toAccountId, Hbar.fromTinybars(amount));

    if (memo) {
      transferTx.setTransactionMemo(memo);
    }

    const scheduleTx = new ScheduleCreateTransaction()
      .setScheduledTransaction(transferTx)
      .setAdminKey(this.operatorKey);

    const response = await scheduleTx.execute(this.client);
    const receipt = await response.getReceipt(this.client);
    
    if (!receipt.scheduleId) {
      throw new Error('Failed to create scheduled transaction');
    }

    return {
      scheduleId: receipt.scheduleId.toString(),
      transactionId: response.transactionId.toString(),
    };
  }

  /**
   * Get transaction details from Mirror Node
   */
  async getTransactionDetails(transactionId: string): Promise<any> {
    const response = await fetch(
      `${this.mirrorNodeUrl}/api/v1/transactions/${transactionId}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch transaction details: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Get topic messages from Mirror Node
   */
  async getTopicMessages(topicId: string, limit = 10): Promise<any> {
    const response = await fetch(
      `${this.mirrorNodeUrl}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch topic messages: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Get NFT information from Mirror Node
   */
  async getNFTInfo(tokenId: string, serialNumber: string): Promise<any> {
    const response = await fetch(
      `${this.mirrorNodeUrl}/api/v1/tokens/${tokenId}/nfts/${serialNumber}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch NFT info: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Get file contents from Mirror Node
   */
  async getFileContents(fileId: string): Promise<any> {
    const response = await fetch(
      `${this.mirrorNodeUrl}/api/v1/files/${fileId}`
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file contents: ${response.statusText}`);
    }
    
    return response.json();
  }
}