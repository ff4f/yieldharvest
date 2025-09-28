import { ethers } from 'ethers';
import { config } from '../config/index';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

// EscrowPool contract ABI (simplified for key functions)
const ESCROW_POOL_ABI = [
  'function createEscrow(string memory invoiceId, address buyer, uint256 amount, uint256 dueDate) external payable returns (uint256)',
  'function releaseEscrow(uint256 escrowId) external',
  'function refundEscrow(uint256 escrowId) external',
  'function getEscrow(uint256 escrowId) external view returns (tuple(uint256 id, string invoiceId, address seller, address buyer, uint256 amount, uint256 dueDate, uint8 status, uint256 createdAt))',
  'function getEscrowsByInvoice(string memory invoiceId) external view returns (uint256[])',
  'function getBalance() external view returns (uint256)',
  'function owner() external view returns (address)',
  'function platformFeeRate() external view returns (uint256)',
  'function feeRecipient() external view returns (address)',
  'event EscrowCreated(uint256 indexed escrowId, string indexed invoiceId, address indexed seller, address buyer, uint256 amount)',
  'event EscrowReleased(uint256 indexed escrowId, string indexed invoiceId, address indexed seller, uint256 amount)',
  'event EscrowRefunded(uint256 indexed escrowId, string indexed invoiceId, address indexed buyer, uint256 amount)',
];

export interface EscrowData {
  id: bigint;
  invoiceId: string;
  seller: string;
  buyer: string;
  amount: bigint;
  dueDate: bigint;
  status: number; // 0: Active, 1: Released, 2: Refunded
  createdAt: bigint;
}

export interface CreateEscrowParams {
  invoiceId: string;
  buyerAddress: string;
  amount: string; // in HBAR
  dueDateTimestamp: number;
}

export interface EscrowTransaction {
  escrowId: string;
  transactionHash: string;
  blockNumber?: number;
  gasUsed?: string;
  status: 'pending' | 'confirmed' | 'failed';
}

class ContractService {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private signer?: ethers.Wallet;
  private contractAddress: string;

  constructor() {
    // Initialize provider
    const rpcUrl = config.hedera.jsonRpcUrl || 'https://testnet.hashio.io/api';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
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
   * Create a new escrow for an invoice
   */
  async createEscrow(params: CreateEscrowParams): Promise<EscrowTransaction> {
    try {
      if (!this.signer) {
        throw new Error('No signer available. Private key required for transactions.');
      }

      logger.info('Creating escrow', params);
      
      const amountWei = ethers.parseEther(params.amount);
      
      // Call contract function
      const tx = await this.contract.createEscrow(
        params.invoiceId,
        params.buyerAddress,
        amountWei,
        params.dueDateTimestamp,
        {
          value: amountWei, // Send HBAR with the transaction
          gasLimit: 500000,
        }
      );
      
      logger.info('Escrow creation transaction sent', {
        hash: tx.hash,
        invoiceId: params.invoiceId,
      });
      
      // Wait for transaction receipt
      const receipt = await tx.wait();
      
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
      
      logger.info('Escrow created successfully', {
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
   * Release escrow funds to seller
   */
  async releaseEscrow(escrowId: string): Promise<EscrowTransaction> {
    try {
      if (!this.signer) {
        throw new Error('No signer available. Private key required for transactions.');
      }

      logger.info('Releasing escrow', { escrowId });
      
      const tx = await this.contract.releaseEscrow(escrowId, {
        gasLimit: 300000,
      });
      
      const receipt = await tx.wait();
      
      logger.info('Escrow released successfully', {
        escrowId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
      });
      
      return {
        escrowId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: 'confirmed',
      };
      
    } catch (error) {
      logger.error('Failed to release escrow', {
        error: error instanceof Error ? error.message : String(error),
        escrowId,
      });
      throw error;
    }
  }

  /**
   * Refund escrow funds to buyer
   */
  async refundEscrow(escrowId: string): Promise<EscrowTransaction> {
    try {
      if (!this.signer) {
        throw new Error('No signer available. Private key required for transactions.');
      }

      logger.info('Refunding escrow', { escrowId });
      
      const tx = await this.contract.refundEscrow(escrowId, {
        gasLimit: 300000,
      });
      
      const receipt = await tx.wait();
      
      logger.info('Escrow refunded successfully', {
        escrowId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
      });
      
      return {
        escrowId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: 'confirmed',
      };
      
    } catch (error) {
      logger.error('Failed to refund escrow', {
        error: error instanceof Error ? error.message : String(error),
        escrowId,
      });
      throw error;
    }
  }

  /**
   * Get escrow details by ID
   */
  async getEscrow(escrowId: string): Promise<EscrowData | null> {
    try {
      const escrow = await this.contract.getEscrow(escrowId);
      
      return {
        id: escrow.id,
        invoiceId: escrow.invoiceId,
        seller: escrow.seller,
        buyer: escrow.buyer,
        amount: escrow.amount,
        dueDate: escrow.dueDate,
        status: escrow.status,
        createdAt: escrow.createdAt,
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
   * Get all escrow IDs for an invoice
   */
  async getEscrowsByInvoice(invoiceId: string): Promise<string[]> {
    try {
      const escrowIds = await this.contract.getEscrowsByInvoice(invoiceId);
      return escrowIds.map((id: bigint) => id.toString());
    } catch (error) {
      logger.error('Failed to get escrows by invoice', {
        error: error instanceof Error ? error.message : String(error),
        invoiceId,
      });
      return [];
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
}

export const contractService = new ContractService();
export default contractService;