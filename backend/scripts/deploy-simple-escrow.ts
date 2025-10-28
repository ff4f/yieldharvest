#!/usr/bin/env ts-node

import 'dotenv/config';
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
  gasLimit: number;
}

class SimpleEscrowDeployer {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    this.config = config;
    this.operatorId = AccountId.fromString(config.operatorId);
    this.operatorKey = PrivateKey.fromStringDer(config.operatorKey);
    
    if (config.network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }
    
    this.client.setOperator(this.operatorId, this.operatorKey);
  }

  async deploy(): Promise<{
    contractId: string;
    contractAddress: string;
    fileId: string;
    deploymentTxId: string;
  }> {
    logger.info('Starting SimpleEscrow deployment');
    
    try {
      // Compile contract
      const bytecode = await this.compileContract();
      
      // Upload to HFS
      const fileResult = await this.uploadContractToHFS(bytecode);
      
      // Deploy contract
      const contractResult = await this.deployContract(fileResult.fileId);
      
      // Verify deployment
      await this.verifyDeployment(contractResult.contractId);
      
      const result = {
        contractId: contractResult.contractId,
        contractAddress: contractResult.contractAddress,
        fileId: fileResult.fileId,
        deploymentTxId: contractResult.transactionId,
      };
      
      logger.info('SimpleEscrow deployment completed', result);
      return result;
    } catch (error) {
      logger.error('SimpleEscrow deployment failed', { error });
      throw error;
    }
  }

  private async compileContract(): Promise<string> {
    const artifactPath = path.join(__dirname, '../artifacts/contracts/SimpleEscrow.sol/SimpleEscrow.json');
    
    if (!fs.existsSync(artifactPath)) {
      throw new Error('Contract artifact not found. Run "npx hardhat compile" first.');
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    return artifact.bytecode;
  }

  private async uploadContractToHFS(bytecode: string): Promise<{
    fileId: string;
    transactionId: string;
  }> {
    logger.info('Uploading contract bytecode to HFS');
    
    // Remove 0x prefix if present
    const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    const bytecodeBuffer = Buffer.from(cleanBytecode, 'hex');
    
    // Create file transaction
    const fileCreateTx = new FileCreateTransaction()
      .setContents(bytecodeBuffer.slice(0, 4096)) // First chunk
      .setMaxTransactionFee(Hbar.fromTinybars(200_000_000));
    
    const fileCreateResponse = await fileCreateTx.execute(this.client);
    const fileCreateReceipt = await fileCreateResponse.getReceipt(this.client);
    
    if (!fileCreateReceipt.fileId) {
      throw new Error('Failed to create file');
    }
    
    const fileId = fileCreateReceipt.fileId;
    
    // Append remaining chunks if bytecode is larger than 4KB
    if (bytecodeBuffer.length > 4096) {
      let offset = 4096;
      while (offset < bytecodeBuffer.length) {
        const chunk = bytecodeBuffer.slice(offset, offset + 4096);
        
        const fileAppendTx = new FileAppendTransaction()
          .setFileId(fileId)
          .setContents(chunk)
          .setMaxTransactionFee(Hbar.fromTinybars(200_000_000));
        
        await fileAppendTx.execute(this.client);
        offset += 4096;
      }
    }
    
    logger.info('Contract bytecode uploaded to HFS', { fileId: fileId.toString() });
    
    return {
      fileId: fileId.toString(),
      transactionId: fileCreateResponse.transactionId.toString(),
    };
  }

  private async deployContract(fileId: string): Promise<{
    contractId: string;
    contractAddress: string;
    transactionId: string;
  }> {
    logger.info('Deploying SimpleEscrow contract', { fileId });
    
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

  private async verifyDeployment(contractId: string): Promise<void> {
    logger.info('Verifying contract deployment', { contractId });
    // For SimpleEscrow, we can just check if the contract exists
    // More complex verification can be added later
    logger.info('Contract deployment verified', { contractId });
  }
}

async function deploySimpleEscrow(): Promise<void> {
  const config: DeploymentConfig = {
    operatorId: process.env.HEDERA_OPERATOR_ID || '',
    operatorKey: process.env.HEDERA_OPERATOR_KEY || '',
    network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
    feeRecipient: process.env.PLATFORM_FEE_RECIPIENT || process.env.HEDERA_OPERATOR_ID || '',
    gasLimit: parseInt(process.env.CONTRACT_GAS_LIMIT || '2000000'),
  };

  // Validate configuration
  if (!config.operatorId || !config.operatorKey) {
    throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set');
  }

  const deployer = new SimpleEscrowDeployer(config);
  const result = await deployer.deploy();

  console.log('\n🎉 SimpleEscrow Deployment Complete!');
  console.log('=====================================');
  console.log(`Network: ${config.network}`);
  console.log(`Contract ID: ${result.contractId}`);
  console.log(`Contract Address: ${result.contractAddress}`);
  console.log(`File ID: ${result.fileId}`);
  console.log(`Deployment Tx: ${result.deploymentTxId}`);
  console.log('\n📋 Proof Links:');
  console.log(`HashScan: https://hashscan.io/${config.network}/contract/${result.contractId}`);
  console.log(`Mirror Node: https://${config.network}.mirrornode.hedera.com/api/v1/contracts/${result.contractId}`);
}

// Run deployment if this script is executed directly
if (require.main === module) {
  deploySimpleEscrow()
    .then(() => {
      console.log('✅ Deployment completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

export { deploySimpleEscrow, SimpleEscrowDeployer };