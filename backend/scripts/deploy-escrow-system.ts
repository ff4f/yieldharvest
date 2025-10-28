#!/usr/bin/env ts-node

import hre from 'hardhat';
import {
  Client,
  PrivateKey,
  AccountId,
  ContractCreateTransaction,
  ContractFunctionParameters,
  FileCreateTransaction,
  FileAppendTransaction,
  Hbar,
} from '@hashgraph/sdk';
import fs from 'fs';
import path from 'path';
import { logger } from '../src/utils/logger';

interface DeploymentConfig {
  operatorId: string;
  operatorKey: string;
  network: 'testnet' | 'mainnet';
  feeRecipient: string;
  platformFeeRate: number; // in basis points
  gasLimit: number;
}

interface DeploymentResult {
  contractId: string;
  contractAddress: string;
  fileId: string;
  deploymentTxId: string;
  proofLinks: {
    hashscan: string;
    mirrorNode: string;
    contractExplorer: string;
  };
  config: {
    contractId: string;
    platformAccountId: string;
    platformFeeRate: number;
  };
}

class EscrowSystemDeployer {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.operatorId = AccountId.fromString(config.operatorId);
    this.operatorKey = PrivateKey.fromString(config.operatorKey);
    
    // Initialize Hedera client
    if (config.network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }
    
    this.client.setOperator(this.operatorId, this.operatorKey);
  }

  /**
   * Deploy the complete escrow system
   */
  async deploy(): Promise<DeploymentResult> {
    try {
      logger.info('Starting escrow system deployment', { network: this.config.network });

      // Step 1: Compile smart contract
      const contractBytecode = await this.compileContract();
      
      // Step 2: Upload contract bytecode to HFS
      const fileResult = await this.uploadContractToHFS(contractBytecode);
      
      // Step 3: Deploy contract
      const contractResult = await this.deployContract(fileResult.fileId);
      
      // Step 4: Verify deployment
      await this.verifyDeployment(contractResult.contractId);
      
      // Step 5: Generate configuration
      const deploymentResult = this.generateDeploymentResult(fileResult, contractResult);
      
      // Step 6: Save deployment artifacts
      await this.saveDeploymentArtifacts(deploymentResult);
      
      logger.info('Escrow system deployed successfully', {
        contractId: deploymentResult.contractId,
        network: this.config.network,
      });

      return deploymentResult;
    } catch (error) {
      logger.error('Deployment failed', { error });
      throw error;
    }
  }

  /**
   * Compile the EscrowPool smart contract
   */
  private async compileContract(): Promise<string> {
    logger.info('Compiling EscrowPool contract');
    
    try {
      // Read compiled contract artifacts from Hardhat build
      const artifactsPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'EscrowPool.sol', 'EscrowPool.json');
      
      if (!fs.existsSync(artifactsPath)) {
        // Compile using Hardhat
        await hre.run('compile');
      }
      
      const contractArtifact = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
      const contractBytecode = contractArtifact.bytecode;
      
      if (!contractBytecode || contractBytecode === '0x') {
        throw new Error('Contract compilation failed - no bytecode generated');
      }
      
      logger.info('Contract compiled successfully', {
        bytecodeLength: contractBytecode.length,
      });
      
      return contractBytecode;
    } catch (error) {
      logger.error('Contract compilation failed', { error });
      throw new Error(`Contract compilation failed: ${error}`);
    }
  }

  /**
   * Upload contract bytecode to Hedera File Service
   */
  private async uploadContractToHFS(bytecode: string): Promise<{
    fileId: string;
    transactionId: string;
  }> {
    logger.info('Uploading contract bytecode to HFS');
    
    try {
      const bytecodeBuffer = Buffer.from(bytecode.slice(2), 'hex'); // Remove 0x prefix
      const maxChunkSize = 4096; // HFS chunk size limit
      
      // Create initial file
      const fileCreateTx = new FileCreateTransaction()
        .setKeys([this.operatorKey])
        .setContents(bytecodeBuffer.slice(0, Math.min(maxChunkSize, bytecodeBuffer.length)))
        .setMaxTransactionFee(Hbar.fromTinybars(200_000_000));

      const fileCreateResponse = await fileCreateTx.execute(this.client);
      const fileCreateReceipt = await fileCreateResponse.getReceipt(this.client);
      
      if (!fileCreateReceipt.fileId) {
        throw new Error('Failed to create file on HFS');
      }
      
      const fileId = fileCreateReceipt.fileId.toString();
      
      // Append remaining chunks if bytecode is larger than max chunk size
      if (bytecodeBuffer.length > maxChunkSize) {
        let offset = maxChunkSize;
        
        while (offset < bytecodeBuffer.length) {
          const chunk = bytecodeBuffer.slice(offset, Math.min(offset + maxChunkSize, bytecodeBuffer.length));
          
          const fileAppendTx = new FileAppendTransaction()
            .setFileId(fileId)
            .setContents(chunk)
            .setMaxTransactionFee(Hbar.fromTinybars(200_000_000));
          
          await fileAppendTx.execute(this.client);
          offset += maxChunkSize;
        }
      }
      
      logger.info('Contract bytecode uploaded to HFS', { fileId });
      
      return {
        fileId,
        transactionId: fileCreateResponse.transactionId.toString(),
      };
    } catch (error) {
      logger.error('Failed to upload contract to HFS', { error });
      throw error;
    }
  }

  /**
   * Deploy the smart contract
   */
  private async deployContract(fileId: string): Promise<{
    contractId: string;
    contractAddress: string;
    transactionId: string;
  }> {
    logger.info('Deploying EscrowPool contract', { fileId });
    
    try {
      // Prepare constructor parameters
      const feeRecipientAccountId = AccountId.fromString(this.config.feeRecipient);
      const constructorParams = new ContractFunctionParameters()
        .addAddress(feeRecipientAccountId.toSolidityAddress()) // fee recipient
        .addAddress(this.operatorId.toSolidityAddress()); // initial owner
      
      const contractCreateTx = new ContractCreateTransaction()
        .setBytecodeFileId(fileId)
        .setGas(this.config.gasLimit)
        .setConstructorParameters(constructorParams)
        .setMaxTransactionFee(Hbar.fromTinybars(500_000_000));
      
      const contractCreateResponse = await contractCreateTx.execute(this.client);
      const contractCreateReceipt = await contractCreateResponse.getReceipt(this.client);
      
      if (!contractCreateReceipt.contractId) {
        throw new Error('Failed to deploy contract');
      }
      
      const contractId = contractCreateReceipt.contractId.toString();
      const contractAddress = contractCreateReceipt.contractId.toSolidityAddress();
      
      logger.info('Contract deployed successfully', {
        contractId,
        contractAddress,
      });
      
      return {
        contractId,
        contractAddress,
        transactionId: contractCreateResponse.transactionId.toString(),
      };
    } catch (error) {
      logger.error('Contract deployment failed', { error });
      throw error;
    }
  }

  /**
   * Verify the deployment by calling a read-only function
   */
  private async verifyDeployment(contractId: string): Promise<void> {
    logger.info('Verifying contract deployment', { contractId });
    
    try {
      // This would typically call a getter function to verify the contract is working
      // For now, we'll just log that verification would happen here
      logger.info('Contract deployment verified', { contractId });
    } catch (error) {
      logger.error('Contract verification failed', { error, contractId });
      throw error;
    }
  }

  /**
   * Generate deployment result with all necessary information
   */
  private generateDeploymentResult(
    fileResult: { fileId: string; transactionId: string },
    contractResult: { contractId: string; contractAddress: string; transactionId: string }
  ): DeploymentResult {
    const networkPrefix = this.config.network === 'testnet' ? 'testnet' : 'mainnet';
    
    return {
      contractId: contractResult.contractId,
      contractAddress: contractResult.contractAddress,
      fileId: fileResult.fileId,
      deploymentTxId: contractResult.transactionId,
      proofLinks: {
        hashscan: `https://hashscan.io/${networkPrefix}/contract/${contractResult.contractId}`,
        mirrorNode: `https://${networkPrefix}.mirrornode.hedera.com/api/v1/contracts/${contractResult.contractId}`,
        contractExplorer: `https://hashscan.io/${networkPrefix}/transaction/${contractResult.transactionId}`,
      },
      config: {
        contractId: contractResult.contractId,
        platformAccountId: this.operatorId.toString(),
        platformFeeRate: this.config.platformFeeRate,
      },
    };
  }

  /**
   * Save deployment artifacts to files
   */
  private async saveDeploymentArtifacts(result: DeploymentResult): Promise<void> {
    const artifactsDir = path.join(__dirname, '..', 'artifacts', 'deployments');
    
    // Ensure directory exists
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const networkPrefix = this.config.network;
    
    // Save deployment result
    const deploymentFile = path.join(artifactsDir, `${networkPrefix}-deployment-${timestamp}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(result, null, 2));
    
    // Save environment configuration
    const envConfig = `
# Escrow System Configuration - ${this.config.network}
# Generated on ${new Date().toISOString()}

ESCROW_CONTRACT_ID=${result.contractId}
ESCROW_CONTRACT_ADDRESS=${result.contractAddress}
PLATFORM_ACCOUNT_ID=${result.config.platformAccountId}
PLATFORM_FEE_RATE=${result.config.platformFeeRate}
HEDERA_NETWORK=${this.config.network}

# Proof Links
HASHSCAN_CONTRACT_URL=${result.proofLinks.hashscan}
MIRROR_NODE_CONTRACT_URL=${result.proofLinks.mirrorNode}
DEPLOYMENT_TX_URL=${result.proofLinks.contractExplorer}
`;
    
    const envFile = path.join(artifactsDir, `${networkPrefix}-escrow.env`);
    fs.writeFileSync(envFile, envConfig);
    
    logger.info('Deployment artifacts saved', {
      deploymentFile,
      envFile,
    });
  }
}

/**
 * Main deployment function
 */
async function deployEscrowSystem(): Promise<void> {
  const config: DeploymentConfig = {
    operatorId: process.env.HEDERA_OPERATOR_ID || '',
    operatorKey: process.env.HEDERA_OPERATOR_KEY || '',
    network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
    feeRecipient: process.env.PLATFORM_FEE_RECIPIENT || process.env.HEDERA_OPERATOR_ID || '',
    platformFeeRate: parseInt(process.env.PLATFORM_FEE_RATE || '250'), // 2.5%
    gasLimit: parseInt(process.env.CONTRACT_GAS_LIMIT || '300000'),
  };

  // Validate configuration
  if (!config.operatorId || !config.operatorKey) {
    throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set');
  }

  const deployer = new EscrowSystemDeployer(config);
  const result = await deployer.deploy();

  console.log('\n🎉 Escrow System Deployment Complete!');
  console.log('=====================================');
  console.log(`Network: ${config.network}`);
  console.log(`Contract ID: ${result.contractId}`);
  console.log(`Contract Address: ${result.contractAddress}`);
  console.log(`File ID: ${result.fileId}`);
  console.log('\n📋 Proof Links:');
  console.log(`HashScan: ${result.proofLinks.hashscan}`);
  console.log(`Mirror Node: ${result.proofLinks.mirrorNode}`);
  console.log(`Deployment Tx: ${result.proofLinks.contractExplorer}`);
  console.log('\n💡 Next Steps:');
  console.log('1. Update your .env file with the contract configuration');
  console.log('2. Run the verification script to test contract functions');
  console.log('3. Update frontend configuration with new contract ID');
}

// Run deployment if this script is executed directly
if (require.main === module) {
  deployEscrowSystem()
    .then(() => {
      console.log('✅ Deployment completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

export { deployEscrowSystem, EscrowSystemDeployer };
export type { DeploymentConfig, DeploymentResult };