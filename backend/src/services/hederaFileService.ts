import {
  Client,
  PrivateKey,
  AccountId,
  FileCreateTransaction,
  FileAppendTransaction,
  FileInfoQuery,
  FileContentsQuery,
  FileDeleteTransaction,
  FileId,
  Hbar,
  TransactionResponse,
  TransactionReceipt,
  Status
} from '@hashgraph/sdk';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface FileUploadResult {
  success: boolean;
  fileId: string;
  transactionId: string;
  hash: string;
  size: number;
  hashScanUrl: string;
  mirrorNodeUrl: string;
  error?: string;
}

export interface FileInfo {
  fileId: string;
  size: number;
  expirationTime: Date;
  keys: string[];
  deleted: boolean;
}

export interface FileDownloadResult {
  success: boolean;
  content: Buffer;
  hash: string;
  size: number;
  error?: string;
}

export class HederaFileService {
  private client: Client;
  private operatorAccountId: AccountId;
  private operatorPrivateKey: PrivateKey;
  private network: string;

  constructor() {
    try {
      this.network = process.env.HEDERA_NETWORK || 'testnet';
      
      if (this.network === 'mainnet') {
        this.client = Client.forMainnet();
      } else {
        this.client = Client.forTestnet();
      }

      const accountId = process.env.HEDERA_ACCOUNT_ID;
      const privateKey = process.env.HEDERA_PRIVATE_KEY;

      if (!accountId || !privateKey) {
        throw new Error('HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY must be set');
      }

      this.operatorAccountId = AccountId.fromString(accountId);
      this.operatorPrivateKey = PrivateKey.fromString(privateKey);

      this.client.setOperator(this.operatorAccountId, this.operatorPrivateKey);

      logger.info('HederaFileService initialized', `Network: ${this.network}, Account: ${this.operatorAccountId.toString()}`);
    } catch (error) {
      logger.error('Failed to initialize HederaFileService', error);
      throw error;
    }
  }

  /**
   * Upload a file to Hedera File Service
   */
  async uploadFile(
    content: Buffer,
    filename: string,
    memo?: string
  ): Promise<FileUploadResult> {
    try {
      logger.info(`Uploading file to HFS: ${filename}, size: ${content.length}`);

      // Calculate file hash
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      // Create file transaction
      const fileCreateTx = new FileCreateTransaction()
        .setKeys([this.operatorPrivateKey.publicKey])
        .setContents(content.slice(0, 1024)) // First chunk (max 1024 bytes)
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(this.client);

      if (memo) {
        fileCreateTx.setFileMemo(memo);
      }

      const fileCreateSign = await fileCreateTx.sign(this.operatorPrivateKey);
      const fileCreateSubmit = await fileCreateSign.execute(this.client);
      const fileCreateReceipt = await fileCreateSubmit.getReceipt(this.client);

      if (fileCreateReceipt.status !== Status.Success) {
        throw new Error(`File creation failed: ${fileCreateReceipt.status.toString()}`);
      }

      const fileId = fileCreateReceipt.fileId!;
      logger.info(`File created successfully: ${fileId.toString()}`);

      // Append remaining content if file is larger than 1024 bytes
      if (content.length > 1024) {
        let offset = 1024;
        while (offset < content.length) {
          const chunk = content.slice(offset, offset + 1024);
          
          const fileAppendTx = new FileAppendTransaction()
            .setFileId(fileId)
            .setContents(chunk)
            .setMaxTransactionFee(new Hbar(2))
            .freezeWith(this.client);

          const fileAppendSign = await fileAppendTx.sign(this.operatorPrivateKey);
          const fileAppendSubmit = await fileAppendSign.execute(this.client);
          const fileAppendReceipt = await fileAppendSubmit.getReceipt(this.client);

          if (fileAppendReceipt.status !== Status.Success) {
            throw new Error(`File append failed: ${fileAppendReceipt.status.toString()}`);
          }

          offset += 1024;
        }
        logger.info(`File content appended successfully: ${fileId.toString()}`);
      }

      const result: FileUploadResult = {
        success: true,
        fileId: fileId.toString(),
        transactionId: fileCreateSubmit.transactionId.toString(),
        hash,
        size: content.length,
        hashScanUrl: this.getHashScanUrl('file', fileId.toString()),
        mirrorNodeUrl: this.getMirrorNodeUrl('file', fileId.toString())
      };

      logger.info('File uploaded successfully to HFS', result);
      return result;

    } catch (error) {
      logger.error(`Failed to upload file to HFS: ${filename}`, error);
      return {
        success: false,
        fileId: '',
        transactionId: '',
        hash: '',
        size: 0,
        hashScanUrl: '',
        mirrorNodeUrl: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Download a file from Hedera File Service
   */
  async downloadFile(fileId: string): Promise<FileDownloadResult> {
    try {
      logger.info(`Downloading file from HFS: ${fileId}`);

      const fileContentsQuery = new FileContentsQuery()
        .setFileId(FileId.fromString(fileId));

      const contents = await fileContentsQuery.execute(this.client);
      const hash = crypto.createHash('sha256').update(contents).digest('hex');

      logger.info(`File downloaded successfully from HFS: ${fileId}, size: ${contents.length}, hash: ${hash}`);

      return {
        success: true,
        content: contents,
        hash,
        size: contents.length
      };

    } catch (error) {
      logger.error(`Failed to download file from HFS: ${fileId}`, error);
      return {
        success: false,
        content: Buffer.alloc(0),
        hash: '',
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get file information from Hedera File Service
   */
  async getFileInfo(fileId: string): Promise<FileInfo | null> {
    try {
      logger.info(`Getting file info from HFS: ${fileId}`);

      const fileInfoQuery = new FileInfoQuery()
        .setFileId(FileId.fromString(fileId));

      const fileInfo = await fileInfoQuery.execute(this.client);

      const result: FileInfo = {
        fileId: fileInfo.fileId.toString(),
        size: fileInfo.size.toNumber(),
        expirationTime: fileInfo.expirationTime,
        keys: fileInfo.keys.map((key: any) => key.toString()),
        deleted: fileInfo.isDeleted
      };

      logger.info({ result }, 'File info retrieved successfully');
      return result;

    } catch (error) {
      logger.error({ fileId, error }, `Failed to get file info from HFS: ${fileId}`);
      return null;
    }
  }

  /**
   * Delete a file from Hedera File Service
   */
  async deleteFile(fileId: string): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      logger.info(`Deleting file from HFS: ${fileId}`);

      const fileDeleteTx = new FileDeleteTransaction()
        .setFileId(FileId.fromString(fileId))
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(this.client);

      const fileDeleteSign = await fileDeleteTx.sign(this.operatorPrivateKey);
      const fileDeleteSubmit = await fileDeleteSign.execute(this.client);
      const fileDeleteReceipt = await fileDeleteSubmit.getReceipt(this.client);

      if (fileDeleteReceipt.status !== Status.Success) {
        throw new Error(`File deletion failed: ${fileDeleteReceipt.status.toString()}`);
      }

      logger.info(`File deleted successfully from HFS: ${fileId}, transactionId: ${fileDeleteSubmit.transactionId.toString()}`);

      return {
        success: true,
        transactionId: fileDeleteSubmit.transactionId.toString()
      };

    } catch (error) {
      logger.error({ fileId, error }, `Failed to delete file from HFS: ${fileId}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Upload invoice PDF to HFS
   */
  async uploadInvoicePDF(
    pdfBuffer: Buffer,
    invoiceId: string,
    supplierId: string
  ): Promise<FileUploadResult> {
    const filename = `invoice-${invoiceId}-${supplierId}.pdf`;
    const memo = `YieldHarvest Invoice PDF - ID: ${invoiceId}`;
    
    return this.uploadFile(pdfBuffer, filename, memo);
  }

  /**
   * Generate HashScan URL for file
   */
  private getHashScanUrl(type: 'file' | 'transaction', id: string): string {
    const baseUrl = this.network === 'mainnet' 
      ? 'https://hashscan.io/mainnet' 
      : 'https://hashscan.io/testnet';
    
    if (type === 'file') {
      return `${baseUrl}/file/${id}`;
    } else {
      return `${baseUrl}/transaction/${id}`;
    }
  }

  /**
   * Generate Mirror Node URL for file
   */
  private getMirrorNodeUrl(type: 'file' | 'transaction', id: string): string {
    const baseUrl = this.network === 'mainnet'
      ? 'https://mainnet.mirrornode.hedera.com/api/v1'
      : 'https://testnet.mirrornode.hedera.com/api/v1';
    
    if (type === 'file') {
      return `${baseUrl}/files/${id}`;
    } else {
      return `${baseUrl}/transactions/${id}`;
    }
  }

  /**
   * Close the Hedera client
   */
  async close(): Promise<void> {
    await this.client.close();
    logger.info('HederaFileService client closed');
  }
}

export const hederaFileService = new HederaFileService();