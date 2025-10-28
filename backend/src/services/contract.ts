import { ethers } from 'ethers';
import { config } from '../config/index';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

// EscrowPool contract ABI (based on actual deployed contract)
const ESCROW_POOL_ABI = [
  'function deposit(string memory invoiceId, address supplier, uint256 nftSerialNumber) external payable',
  'function release(string memory invoiceId) external',
  'function invoiceToEscrowId(string memory invoiceId) external view returns (uint256)',
  'function escrows(uint256 escrowId) external view returns (tuple(uint256 id, string invoiceId, address investor, address supplier, uint256 amount, uint256 nftSerialNumber, uint8 status, uint256 createdAt, uint256 releasedAt))',
  'function getBalance() external view returns (uint256)',
  'function owner() external view returns (address)',
  'function platformFeeRate() external view returns (uint256)',
  'function feeRecipient() external view returns (address)',
  'function MAX_FEE_RATE() external view returns (uint256)',
  'event EscrowCreated(uint256 indexed escrowId, string indexed invoiceId, address indexed investor, address supplier, uint256 amount, uint256 nftSerialNumber)',
  'event EscrowFunded(uint256 indexed escrowId, string indexed invoiceId, address indexed investor, uint256 amount)',
  'event EscrowReleased(uint256 indexed escrowId, string indexed invoiceId, address indexed supplier, uint256 amount, uint256 platformFee)',
];

export interface EscrowData {
  id: bigint;
  invoiceId: string;
  investor: string;
  supplier: string;
  amount: bigint;
  nftSerialNumber: bigint;
  status: number; // 0: Active, 1: Released
  createdAt: bigint;
  releasedAt: bigint;
}

export interface CreateEscrowParams {
  invoiceId: string;
  supplierAddress: string;
  amount: string; // in HBAR
  nftSerialNumber: number;
}

export interface EscrowTransaction {
  escrowId: string;
  transactionHash: string;
  blockNumber?: number;
  gasUsed?: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface PreparedTransaction {
  transactionBytes: string;
  transactionId: string;
  gasLimit?: string;
  gasPrice?: string;
}

export interface EscrowTransactionData {
  invoiceId: string;
  supplierAddress: string;
  amount: string;
  nftSerialNumber: number;
  payerAccountId?: string;
}

export class ContractService {
  private provider: ethers.JsonRpcProvider;
  private contract: any;
  private signer?: ethers.Wallet;
  private contractAddress: string;

  constructor() {
    // Initialize provider with network configuration to avoid ENS issues
    const rpcUrl = config.hedera.jsonRpcUrl || 'https://testnet.hashio.io/api';
    this.provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: 296, // Hedera testnet chain ID
      name: 'hedera-testnet'
    });
    
    // Get contract address from environment or deployment file
    this.contractAddress = this.getContractAddress();
    
    // Initialize contract instance
    this.contract = new ethers.Contract(
      this.contractAddress,
      ESCROW_POOL_ABI,
      this.provider
    );
    
    // Initialize signer if private key is available
    if (config.hedera.privateKey) {
      this.signer = new ethers.Wallet(config.hedera.privateKey, this.provider);
      this.contract = this.contract.connect(this.signer);
    }
    
    logger.info('ContractService initialized', {
      contractAddress: this.contractAddress,
      rpcUrl,
      hasSigner: !!this.signer,
    });
  }

  private getContractAddress(): string {
    // First try environment variable
    if (config.hedera.escrowContractAddress) {
      return config.hedera.escrowContractAddress;
    }
    
    // Try to read from latest deployment file
    try {
      const deploymentsDir = path.join(process.cwd(), 'deployments');
      if (fs.existsSync(deploymentsDir)) {
        const files = fs.readdirSync(deploymentsDir)
          .filter(f => f.startsWith('escrow-deployment-') && f.endsWith('.json'))
          .sort()
          .reverse(); // Get latest
        
        if (files.length > 0) {
          const latestFile = path.join(deploymentsDir, files[0]);
          const deployment = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
          logger.info('Using contract address from deployment file', {
            file: files[0],
            address: deployment.contractAddress,
          });
          return deployment.contractAddress;
        }
      }
    } catch (error) {
      logger.warn('Could not read deployment file', { error: error instanceof Error ? error.message : String(error) });
    }
    
    throw new Error('Contract address not found. Please set ESCROW_CONTRACT_ADDRESS or deploy the contract.');
  }

  /**
   * Create and fund a new escrow for an invoice using deposit function
   */
  async createEscrow(params: CreateEscrowParams): Promise<EscrowTransaction> {
    try {
      if (!this.signer) {
        throw new Error('No signer available. Private key required for transactions.');
      }

      logger.info('Creating and funding escrow', params);
      
      const amountWei = ethers.parseEther(params.amount);
      
      // Call contract deposit function (creates and funds escrow in one step)
      const tx = await this.contract.deposit(
        params.invoiceId,
        params.supplierAddress,
        params.nftSerialNumber,
        {
          value: amountWei, // Send HBAR with the transaction
          gasLimit: 500000,
        }
      );
      
      logger.info('Escrow deposit transaction sent', {
        hash: tx.hash,
        invoiceId: params.invoiceId,
      });
      
      // Wait for transaction receipt
      const receipt = await tx.wait();
      
      // Check transaction status
      if (receipt.status === 0) {
        throw new Error('Transaction failed');
      }
      
      // Parse events to get escrow ID
      const escrowCreatedEvent = receipt.logs.find(
        (log: any) => {
          try {
            const parsed = this.contract.interface.parseLog(log);
            return parsed?.name === 'EscrowCreated';
          } catch {
            return false;
          }
        }
      );
      
      let escrowId = '0';
      if (escrowCreatedEvent) {
        const parsed = this.contract.interface.parseLog(escrowCreatedEvent);
        escrowId = parsed?.args.escrowId.toString() || '0';
      }
      
      logger.info('Escrow created and funded successfully', {
        escrowId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });
      
      return {
        escrowId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: 'confirmed',
      };
      
    } catch (error) {
      logger.error('Failed to create escrow', {
        error: error instanceof Error ? error.message : String(error),
        params,
      });
      throw error;
    }
  }

  /**
   * Release escrow funds to supplier by invoice ID
   */
  async releaseEscrow(invoiceId: string): Promise<EscrowTransaction> {
    try {
      if (!this.signer) {
        throw new Error('No signer available. Private key required for transactions.');
      }

      logger.info('Releasing escrow', { invoiceId });
      
      // Get escrow ID first
      const escrowId = await this.contract.invoiceToEscrowId(invoiceId);
      
      const tx = await this.contract.release(invoiceId, {
        gasLimit: 300000,
      });
      
      const receipt = await tx.wait();
      
      logger.info('Escrow released successfully', {
        escrowId: escrowId.toString(),
        invoiceId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
      });
      
      return {
        escrowId: escrowId.toString(),
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: 'confirmed',
      };
      
    } catch (error) {
      logger.error('Failed to release escrow', {
        error: error instanceof Error ? error.message : String(error),
        invoiceId,
      });
      throw error;
    }
  }

  /**
   * Get escrow details by ID
   */
  async getEscrow(escrowId: string): Promise<EscrowData | null> {
    try {
      const escrow = await this.contract.escrows(escrowId);
      
      return {
        id: escrow.id,
        invoiceId: escrow.invoiceId,
        investor: escrow.investor,
        supplier: escrow.supplier,
        amount: escrow.amount,
        nftSerialNumber: escrow.nftSerialNumber,
        status: escrow.status,
        createdAt: escrow.createdAt,
        releasedAt: escrow.releasedAt,
      };
    } catch (error) {
      logger.error('Failed to get escrow', {
        error: error instanceof Error ? error.message : String(error),
        escrowId,
      });
      return null;
    }
  }

  /**
   * Get escrow details by invoice ID
   */
  async getEscrowByInvoice(invoiceId: string): Promise<EscrowData | null> {
    try {
      const escrowId = await this.contract.invoiceToEscrowId(invoiceId);
      if (escrowId.toString() === '0') {
        return null;
      }
      return this.getEscrow(escrowId.toString());
    } catch (error) {
      logger.error('Failed to get escrow by invoice', {
        error: error instanceof Error ? error.message : String(error),
        invoiceId,
      });
      return null;
    }
  }



  /**
   * Get contract information
   */
  async getContractInfo() {
    try {
      const [owner, feeRate, feeRecipient, balance] = await Promise.all([
        this.contract.owner(),
        this.contract.platformFeeRate(),
        this.contract.feeRecipient(),
        this.contract.getBalance(),
      ]);
      
      return {
        address: this.contractAddress,
        owner,
        platformFeeRate: feeRate.toString(),
        feeRecipient,
        balance: ethers.formatEther(balance),
        network: await this.provider.getNetwork(),
      };
    } catch (error) {
      logger.error('Failed to get contract info', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get HashScan URL for transaction
   */
  getHashScanUrl(txHash: string): string {
    const network = config.hedera.network === 'mainnet' ? 'mainnet' : 'testnet';
    return `https://hashscan.io/${network}/transaction/${txHash}`;
  }

  /**
   * Get HashScan URL for contract
   */
  getContractHashScanUrl(): string {
    const network = config.hedera.network === 'mainnet' ? 'mainnet' : 'testnet';
    return `https://hashscan.io/${network}/contract/${this.contractAddress}`;
  }

  /**
   * Prepare escrow transaction for wallet signing
   */
  async prepareEscrowTransaction(data: EscrowTransactionData): Promise<PreparedTransaction> {
    try {
      logger.info('Preparing escrow transaction for wallet signing', data);
      
      if (!this.contract) {
        throw new Error('Contract not initialized');
      }
      
      // Convert amount to wei (assuming HBAR to wei conversion)
      const amountInWei = ethers.parseEther(data.amount);
      
      // Get current timestamp and add 30 days for due date
      const dueDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      
      // Prepare the transaction data
      const txData = this.contract.interface.encodeFunctionData('deposit', [
        data.invoiceId,
        data.supplierAddress,
        dueDate,
        data.nftSerialNumber
      ]);
      
      // Create transaction object
      const transaction = {
        to: this.contractAddress,
        data: txData,
        value: amountInWei,
        gasLimit: '300000', // Estimated gas limit
      };
      
      // If payer account is specified, use it for transaction preparation
      if (data.payerAccountId) {
        // For Hedera, we need to prepare the transaction differently
        // This is a simplified version - in production, you'd use Hedera SDK
        const transactionId = `${data.payerAccountId}@${Math.floor(Date.now() / 1000)}.${Math.floor(Math.random() * 999999999)}`;
        
        return {
          transactionBytes: JSON.stringify(transaction), // Simplified - should be actual transaction bytes
          transactionId,
          gasLimit: transaction.gasLimit,
        };
      }
      
      // Fallback to ethers transaction preparation
      const populatedTx = await this.contract.deposit.populateTransaction(
        data.invoiceId,
        data.supplierAddress,
        dueDate,
        data.nftSerialNumber,
        { value: amountInWei }
      );
      
      const transactionId = `prepared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        transactionBytes: JSON.stringify(populatedTx),
        transactionId,
        gasLimit: populatedTx.gasLimit?.toString(),
      };
    } catch (error) {
      logger.error('Failed to prepare escrow transaction', { error: error instanceof Error ? error.message : String(error), data });
      throw error;
    }
  }
}

export const contractService = new ContractService();
export default contractService;