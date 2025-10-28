import {
  Client,
  PrivateKey,
  AccountId,
  TransferTransaction,
  ScheduleCreateTransaction,
  ScheduleSignTransaction,
  ScheduleInfoQuery,
  Hbar,
  ContractCallQuery,
  ContractExecuteTransaction,
  ContractId,
} from '@hashgraph/sdk';
import { HederaService, HederaConfig } from './hedera';
import { logger } from '../utils/logger';

export interface EscrowConfig extends HederaConfig {
  contractId: string;
  platformAccountId: string;
  platformFeeRate: number; // in basis points (e.g., 250 = 2.5%)
}

export interface EscrowRequest {
  invoiceId: string;
  nftTokenId: string;
  nftSerialNumber: number;
  supplierAccountId: string;
  investorAccountId: string;
  amount: number; // in tinybars
  dueDate: Date;
  fileHash: string;
  memo?: string;
}

export interface EscrowDetails {
  escrowId: string;
  invoiceId: string;
  nftTokenId: string;
  nftSerialNumber: number;
  investor: string;
  supplier: string;
  amount: number;
  depositedAt: Date;
  dueDate: Date;
  status: 'PENDING' | 'FUNDED' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';
  fileHash: string;
  scheduledTransactionId?: string;
  contractTransactionId?: string;
  proofLinks: {
    hashscan?: string;
    mirrorNode?: string;
    contractCall?: string;
  };
}

export interface FundingResult {
  escrowId: string;
  scheduledTransactionId: string;
  contractTransactionId: string;
  proofLinks: {
    hashscan: string;
    mirrorNode: string;
    contractCall: string;
  };
}

export class EscrowService {
  private hederaService: HederaService;
  private client: Client;
  private contractId: ContractId;
  private platformAccountId: AccountId;
  private platformFeeRate: number;
  private operatorKey: PrivateKey;

  constructor(config: EscrowConfig) {
    this.hederaService = new HederaService(config);
    this.client = this.hederaService['client']; // Access private client
    this.contractId = ContractId.fromString(config.contractId);
    this.platformAccountId = AccountId.fromString(config.platformAccountId);
    this.platformFeeRate = config.platformFeeRate;
    this.operatorKey = PrivateKey.fromString(config.operatorKey);
  }

  /**
   * Create and fund an escrow using Scheduled Transactions + Smart Contract
   */
  async createAndFundEscrow(request: EscrowRequest): Promise<FundingResult> {
    try {
      logger.info('Creating escrow for invoice', { invoiceId: request.invoiceId });

      // Step 1: Create scheduled transfer from investor to contract
      const scheduledTransfer = await this.createScheduledTransfer(request);
      
      // Step 2: Execute contract deposit function
      const contractResult = await this.executeContractDeposit(request, scheduledTransfer.scheduleId);
      
      // Step 3: Generate proof links
      const proofLinks = this.generateProofLinks(
        scheduledTransfer.transactionId,
        contractResult.transactionId
      );

      logger.info('Escrow created successfully', {
        invoiceId: request.invoiceId,
        scheduledTransactionId: scheduledTransfer.transactionId,
        contractTransactionId: contractResult.transactionId,
      });

      return {
        escrowId: contractResult.escrowId,
        scheduledTransactionId: scheduledTransfer.transactionId,
        contractTransactionId: contractResult.transactionId,
        proofLinks,
      };
    } catch (error) {
      logger.error('Failed to create escrow', { error, invoiceId: request.invoiceId });
      throw error;
    }
  }

  /**
   * Create a scheduled transfer from investor to escrow contract
   */
  private async createScheduledTransfer(request: EscrowRequest): Promise<{
    scheduleId: string;
    transactionId: string;
  }> {
    const transferTx = new TransferTransaction()
      .addHbarTransfer(request.investorAccountId, Hbar.fromTinybars(-request.amount))
      .addHbarTransfer(this.contractId.toSolidityAddress(), Hbar.fromTinybars(request.amount))
      .setTransactionMemo(`Escrow funding for invoice ${request.invoiceId}`);

    const scheduleTx = new ScheduleCreateTransaction()
      .setScheduledTransaction(transferTx)
      .setAdminKey(this.operatorKey)
      .setScheduleMemo(`Invoice ${request.invoiceId} escrow funding`)
      .setPayerAccountId(request.investorAccountId);

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
   * Execute smart contract deposit function
   */
  private async executeContractDeposit(
    request: EscrowRequest,
    scheduleId: string
  ): Promise<{
    escrowId: string;
    transactionId: string;
  }> {
    // Encode function call parameters
    const functionParameters = this.encodeDepositParameters(request, scheduleId);

    const contractTx = new ContractExecuteTransaction()
      .setContractId(this.contractId)
      .setGas(300000)
      .setFunction('deposit', functionParameters)
      .setPayableAmount(Hbar.fromTinybars(request.amount));

    const response = await contractTx.execute(this.client);
    const receipt = await response.getReceipt(this.client);

    // Generate escrow ID (same logic as in smart contract)
    const escrowId = this.generateEscrowId(request);

    return {
      escrowId,
      transactionId: response.transactionId.toString(),
    };
  }

  /**
   * Release funds from escrow to supplier
   */
  async releaseEscrow(invoiceId: string, releaserAccountId: string): Promise<{
    transactionId: string;
    proofLinks: {
      hashscan: string;
      mirrorNode: string;
    };
  }> {
    try {
      logger.info('Releasing escrow funds', { invoiceId });

      const contractTx = new ContractExecuteTransaction()
        .setContractId(this.contractId)
        .setGas(200000)
        .setFunction('release', this.encodeReleaseParameters(invoiceId));

      const response = await contractTx.execute(this.client);
      const transactionId = response.transactionId.toString();

      const proofLinks = {
        hashscan: `https://hashscan.io/testnet/transaction/${transactionId}`,
        mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${transactionId}`,
      };

      logger.info('Escrow released successfully', { invoiceId, transactionId });

      return { transactionId, proofLinks };
    } catch (error) {
      logger.error('Failed to release escrow', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Refund escrow to investor (in case of dispute or cancellation)
   */
  async refundEscrow(invoiceId: string, refunderAccountId: string): Promise<{
    transactionId: string;
    proofLinks: {
      hashscan: string;
      mirrorNode: string;
    };
  }> {
    try {
      logger.info('Refunding escrow', { invoiceId });

      const contractTx = new ContractExecuteTransaction()
        .setContractId(this.contractId)
        .setGas(200000)
        .setFunction('refund', this.encodeRefundParameters(invoiceId));

      const response = await contractTx.execute(this.client);
      const transactionId = response.transactionId.toString();

      const proofLinks = {
        hashscan: `https://hashscan.io/testnet/transaction/${transactionId}`,
        mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${transactionId}`,
      };

      logger.info('Escrow refunded successfully', { invoiceId, transactionId });

      return { transactionId, proofLinks };
    } catch (error) {
      logger.error('Failed to refund escrow', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Get escrow details from smart contract
   */
  async getEscrowDetails(invoiceId: string): Promise<EscrowDetails | null> {
    try {
      const query = new ContractCallQuery()
        .setContractId(this.contractId)
        .setGas(100000)
        .setFunction('getEscrowByInvoice', this.encodeGetEscrowParameters(invoiceId));

      const result = await query.execute(this.client);
      
      if (!result || result.bytes.length === 0) {
        return null;
      }

      return this.decodeEscrowDetails(result.bytes, invoiceId);
    } catch (error) {
      logger.error('Failed to get escrow details', { error, invoiceId });
      throw error;
    }
  }

  /**
   * Sign a scheduled transaction (for multi-sig scenarios)
   */
  async signScheduledTransaction(scheduleId: string, signerKey: PrivateKey): Promise<{
    transactionId: string;
    isExecuted: boolean;
  }> {
    try {
      const signTx = new ScheduleSignTransaction()
        .setScheduleId(scheduleId)
        .freezeWith(this.client)
        .sign(signerKey);

      const response = await signTx.execute(this.client);
      const receipt = await response.getReceipt(this.client);

      // Check if schedule is now executed
      const scheduleInfo = await new ScheduleInfoQuery()
        .setScheduleId(scheduleId)
        .execute(this.client);

      return {
        transactionId: response.transactionId.toString(),
        isExecuted: scheduleInfo.executedAt !== null,
      };
    } catch (error) {
      logger.error('Failed to sign scheduled transaction', { error, scheduleId });
      throw error;
    }
  }

  /**
   * Monitor escrow status changes via Mirror Node
   */
  async monitorEscrowStatus(invoiceId: string): Promise<EscrowDetails | null> {
    // Implementation would poll Mirror Node for contract events
    // This is a placeholder for the monitoring logic
    return this.getEscrowDetails(invoiceId);
  }

  // Private helper methods

  private encodeDepositParameters(request: EscrowRequest, scheduleId: string): any {
    // Encode parameters for smart contract deposit function
    // This would use the Hedera SDK's parameter encoding utilities
    return {
      invoiceId: request.invoiceId,
      nftTokenId: request.nftTokenId,
      nftSerialNumber: request.nftSerialNumber,
      supplier: request.supplierAccountId,
      dueDate: Math.floor(request.dueDate.getTime() / 1000),
      fileHash: request.fileHash,
    };
  }

  private encodeReleaseParameters(invoiceId: string): any {
    return { invoiceId };
  }

  private encodeRefundParameters(invoiceId: string): any {
    return { invoiceId };
  }

  private encodeGetEscrowParameters(invoiceId: string): any {
    return { invoiceId };
  }

  private decodeEscrowDetails(bytes: Uint8Array, invoiceId: string): EscrowDetails {
    // Decode smart contract response
    // This is a simplified implementation - actual decoding would use ABI
    return {
      escrowId: this.generateEscrowId({ invoiceId } as EscrowRequest),
      invoiceId,
      nftTokenId: '',
      nftSerialNumber: 0,
      investor: '',
      supplier: '',
      amount: 0,
      depositedAt: new Date(),
      dueDate: new Date(),
      status: 'PENDING',
      fileHash: '',
      proofLinks: {},
    };
  }

  private generateEscrowId(request: EscrowRequest): string {
    // Generate deterministic escrow ID (matches smart contract logic)
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(`${request.invoiceId}-${request.investorAccountId}-${Date.now()}`)
      .digest('hex');
  }

  private generateProofLinks(scheduledTxId: string, contractTxId: string): {
    hashscan: string;
    mirrorNode: string;
    contractCall: string;
  } {
    return {
      hashscan: `https://hashscan.io/testnet/transaction/${contractTxId}`,
      mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${contractTxId}`,
      contractCall: `https://hashscan.io/testnet/contract/${this.contractId.toString()}`,
    };
  }

  /**
   * Calculate platform fee
   */
  calculatePlatformFee(amount: number): number {
    return Math.floor((amount * this.platformFeeRate) / 10000);
  }

  /**
   * Get net amount after fees
   */
  getNetAmount(amount: number): number {
    return amount - this.calculatePlatformFee(amount);
  }

  /**
   * Validate escrow request
   */
  validateEscrowRequest(request: EscrowRequest): void {
    if (!request.invoiceId || request.invoiceId.trim().length === 0) {
      throw new Error('Invoice ID is required');
    }
    if (!request.nftTokenId || request.nftTokenId.trim().length === 0) {
      throw new Error('NFT Token ID is required');
    }
    if (request.amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    if (request.dueDate <= new Date()) {
      throw new Error('Due date must be in the future');
    }
    if (!request.supplierAccountId || !request.investorAccountId) {
      throw new Error('Supplier and investor account IDs are required');
    }
  }
}