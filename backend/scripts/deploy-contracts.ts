#!/usr/bin/env ts-node

import { Client, ContractCreateTransaction, ContractFunctionParameters, FileCreateTransaction, FileAppendTransaction, Hbar, PrivateKey, AccountId } from '@hashgraph/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface DeploymentConfig {
  operatorId: string;
  operatorKey: string;
  network: 'testnet' | 'mainnet' | 'previewnet';
  gasLimit: number;
  initialBalance: number;
}

interface ContractDeployment {
  contractName: string;
  bytecodeFile: string;
  constructorParams?: ContractFunctionParameters;
  gasLimit?: number;
  initialBalance?: number;
}

interface DeploymentResult {
  contractName: string;
  contractId: string;
  transactionId: string;
  fileId: string;
  gasUsed: string;
  deploymentCost: string;
  timestamp: string;
}

class ContractDeployer {
  private client: Client;
  private config: DeploymentConfig;
  private deploymentResults: DeploymentResult[] = [];

  constructor(config: DeploymentConfig) {
    this.config = config;
    
    // Initialize Hedera client
    if (config.network === 'testnet') {
      this.client = Client.forTestnet();
    } else if (config.network === 'mainnet') {
      this.client = Client.forMainnet();
    } else {
      this.client = Client.forPreviewnet();
    }
    
    this.client.setOperator(
      AccountId.fromString(config.operatorId),
      PrivateKey.fromString(config.operatorKey)
    );
    
    logger.info('Contract deployer initialized', {
      network: config.network,
      operatorId: config.operatorId
    });
  }

  /**
   * Deploy a single smart contract
   */
  async deployContract(deployment: ContractDeployment): Promise<DeploymentResult> {
    try {
      logger.info(`Starting deployment of ${deployment.contractName}`);
      
      // Read bytecode file
      const bytecodeFile = path.join(__dirname, '../contracts/bytecode', deployment.bytecodeFile);
      if (!fs.existsSync(bytecodeFile)) {
        throw new Error(`Bytecode file not found: ${bytecodeFile}`);
      }
      
      const bytecode = fs.readFileSync(bytecodeFile);
      logger.info(`Loaded bytecode for ${deployment.contractName}`, {
        size: bytecode.length,
        file: deployment.bytecodeFile
      });
      
      // Step 1: Upload bytecode to Hedera File Service
      const fileId = await this.uploadBytecode(bytecode, deployment.contractName);
      logger.info(`Bytecode uploaded to HFS`, { fileId, contractName: deployment.contractName });
      
      // Step 2: Create contract
      const contractResult = await this.createContract(
        fileId,
        deployment.contractName,
        deployment.constructorParams,
        deployment.gasLimit || this.config.gasLimit,
        deployment.initialBalance || this.config.initialBalance
      );
      
      const result: DeploymentResult = {
        contractName: deployment.contractName,
        contractId: contractResult.contractId,
        transactionId: contractResult.transactionId,
        fileId,
        gasUsed: contractResult.gasUsed,
        deploymentCost: contractResult.deploymentCost,
        timestamp: new Date().toISOString()
      };
      
      this.deploymentResults.push(result);
      
      logger.info(`Successfully deployed ${deployment.contractName}`, result);
      return result;
    } catch (error) {
      logger.error(`Failed to deploy ${deployment.contractName}`, { error });
      throw error;
    }
  }

  /**
   * Upload contract bytecode to Hedera File Service
   */
  private async uploadBytecode(bytecode: Buffer, contractName: string): Promise<string> {
    try {
      // Create file transaction
      const fileCreateTx = new FileCreateTransaction()
        .setKeys([this.client.operatorPublicKey!])
        .setContents(bytecode.slice(0, 4096)) // First chunk
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(this.client);
      
      const fileCreateResponse = await fileCreateTx.execute(this.client);
      const fileCreateReceipt = await fileCreateResponse.getReceipt(this.client);
      
      if (!fileCreateReceipt.fileId) {
        throw new Error('File creation failed - no file ID returned');
      }
      
      const fileId = fileCreateReceipt.fileId.toString();
      
      // Append remaining chunks if bytecode is larger than 4KB
      if (bytecode.length > 4096) {
        let offset = 4096;
        while (offset < bytecode.length) {
          const chunk = bytecode.slice(offset, offset + 4096);
          
          const fileAppendTx = new FileAppendTransaction()
            .setFileId(fileCreateReceipt.fileId)
            .setContents(chunk)
            .setMaxTransactionFee(new Hbar(2))
            .freezeWith(this.client);
          
          await fileAppendTx.execute(this.client);
          offset += 4096;
          
          logger.debug(`Appended chunk to file`, {
            fileId,
            chunkSize: chunk.length,
            totalUploaded: offset
          });
        }
      }
      
      return fileId;
    } catch (error) {
      logger.error(`Failed to upload bytecode for ${contractName}`, { error });
      throw error;
    }
  }

  /**
   * Create contract from uploaded bytecode
   */
  private async createContract(
    fileId: string,
    contractName: string,
    constructorParams?: ContractFunctionParameters,
    gasLimit: number = 100000,
    initialBalance: number = 0
  ): Promise<{
    contractId: string;
    transactionId: string;
    gasUsed: string;
    deploymentCost: string;
  }> {
    try {
      const contractCreateTx = new ContractCreateTransaction()
        .setBytecodeFileId(fileId)
        .setGas(gasLimit)
        .setInitialBalance(new Hbar(initialBalance))
        .setMaxTransactionFee(new Hbar(20));
      
      if (constructorParams) {
        contractCreateTx.setConstructorParameters(constructorParams);
      }
      
      const contractCreateResponse = await contractCreateTx.execute(this.client);
      const contractCreateReceipt = await contractCreateResponse.getReceipt(this.client);
      
      if (!contractCreateReceipt.contractId) {
        throw new Error('Contract creation failed - no contract ID returned');
      }
      
      // Get transaction record for gas usage
      const record = await contractCreateResponse.getRecord(this.client);
      
      return {
        contractId: contractCreateReceipt.contractId.toString(),
        transactionId: contractCreateResponse.transactionId.toString(),
        gasUsed: record.contractFunctionResult?.gasUsed?.toString() || '0',
        deploymentCost: record.transactionFee.toString()
      };
    } catch (error) {
      logger.error(`Failed to create contract ${contractName}`, { error });
      throw error;
    }
  }

  /**
   * Deploy multiple contracts in sequence
   */
  async deployAll(deployments: ContractDeployment[]): Promise<DeploymentResult[]> {
    const results: DeploymentResult[] = [];
    
    for (const deployment of deployments) {
      try {
        const result = await this.deployContract(deployment);
        results.push(result);
        
        // Wait between deployments to avoid rate limiting
        await this.sleep(2000);
      } catch (error) {
        logger.error(`Deployment failed for ${deployment.contractName}`, { error });
        throw error;
      }
    }
    
    return results;
  }

  /**
   * Save deployment results to file
   */
  async saveDeploymentResults(outputFile?: string): Promise<void> {
    const filename = outputFile || `deployment-results-${Date.now()}.json`;
    const outputPath = path.join(__dirname, '../deployment-results', filename);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const deploymentData = {
      timestamp: new Date().toISOString(),
      network: this.config.network,
      operatorId: this.config.operatorId,
      deployments: this.deploymentResults
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(deploymentData, null, 2));
    logger.info(`Deployment results saved to ${outputPath}`);
  }

  /**
   * Generate environment variables for deployed contracts
   */
  generateEnvVars(): string {
    let envVars = '\n# Deployed Contract Addresses\n';
    
    for (const result of this.deploymentResults) {
      const envName = `${result.contractName.toUpperCase()}_CONTRACT_ID`;
      envVars += `${envName}=${result.contractId}\n`;
    }
    
    return envVars;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

// Main deployment script
async function main() {
  try {
    const config: DeploymentConfig = {
      operatorId: process.env.HEDERA_OPERATOR_ID!,
      operatorKey: process.env.HEDERA_OPERATOR_KEY!,
      network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet' | 'previewnet') || 'testnet',
      gasLimit: parseInt(process.env.CONTRACT_GAS_LIMIT || '100000'),
      initialBalance: parseFloat(process.env.CONTRACT_INITIAL_BALANCE || '0')
    };
    
    if (!config.operatorId || !config.operatorKey) {
      throw new Error('Missing required environment variables: HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY');
    }
    
    const deployer = new ContractDeployer(config);
    
    // Define contracts to deploy
    const deployments: ContractDeployment[] = [
      {
        contractName: 'InvoiceEscrow',
        bytecodeFile: 'InvoiceEscrow.bin',
        gasLimit: 150000,
        initialBalance: 0
      },
      {
        contractName: 'FundingPool',
        bytecodeFile: 'FundingPool.bin',
        gasLimit: 120000,
        initialBalance: 0
      }
    ];
    
    logger.info('Starting contract deployment process', {
      network: config.network,
      contractCount: deployments.length
    });
    
    // Deploy all contracts
    const results = await deployer.deployAll(deployments);
    
    // Save results
    await deployer.saveDeploymentResults();
    
    // Generate environment variables
    const envVars = deployer.generateEnvVars();
    console.log('\n=== Environment Variables ===');
    console.log(envVars);
    
    // Summary
    console.log('\n=== Deployment Summary ===');
    for (const result of results) {
      console.log(`${result.contractName}: ${result.contractId}`);
      console.log(`  Transaction: ${result.transactionId}`);
      console.log(`  Gas Used: ${result.gasUsed}`);
      console.log(`  Cost: ${result.deploymentCost}`);
      console.log('');
    }
    
    await deployer.close();
    logger.info('Contract deployment completed successfully');
  } catch (error) {
    logger.error('Contract deployment failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ContractDeployer, DeploymentConfig, ContractDeployment, DeploymentResult };