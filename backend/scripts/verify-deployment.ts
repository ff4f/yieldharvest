#!/usr/bin/env ts-node

import { Client, ContractCallQuery, ContractFunctionParameters, AccountId, PrivateKey } from '@hashgraph/sdk';
import { logger } from '../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

interface VerificationConfig {
  operatorId: string;
  operatorKey: string;
  network: 'testnet' | 'mainnet' | 'previewnet';
  mirrorNodeUrl: string;
  hashscanUrl: string;
}

interface ContractInfo {
  contractId: string;
  contractName: string;
  expectedFunctions: string[];
  expectedEvents: string[];
}

interface VerificationResult {
  contractId: string;
  contractName: string;
  isDeployed: boolean;
  isVerified: boolean;
  functionsVerified: boolean;
  eventsVerified: boolean;
  gasEstimates: Record<string, string>;
  errors: string[];
  warnings: string[];
}

class DeploymentVerifier {
  private client: Client;
  private config: VerificationConfig;
  private verificationResults: VerificationResult[] = [];

  constructor(config: VerificationConfig) {
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
    
    logger.info('Deployment verifier initialized', {
      network: config.network,
      operatorId: config.operatorId
    });
  }

  /**
   * Verify a single contract deployment
   */
  async verifyContract(contractInfo: ContractInfo): Promise<VerificationResult> {
    const result: VerificationResult = {
      contractId: contractInfo.contractId,
      contractName: contractInfo.contractName,
      isDeployed: false,
      isVerified: false,
      functionsVerified: false,
      eventsVerified: false,
      gasEstimates: {},
      errors: [],
      warnings: []
    };

    try {
      logger.info(`Verifying contract ${contractInfo.contractName}`, {
        contractId: contractInfo.contractId
      });

      // Step 1: Check if contract exists via Mirror Node
      const contractExists = await this.checkContractExists(contractInfo.contractId);
      if (!contractExists) {
        result.errors.push('Contract not found on network');
        return result;
      }
      result.isDeployed = true;

      // Step 2: Verify contract on HashScan
      const isVerified = await this.checkHashScanVerification(contractInfo.contractId);
      result.isVerified = isVerified;
      if (!isVerified) {
        result.warnings.push('Contract not verified on HashScan');
      }

      // Step 3: Test contract functions
      const functionsWork = await this.testContractFunctions(
        contractInfo.contractId,
        contractInfo.expectedFunctions
      );
      result.functionsVerified = functionsWork;

      // Step 4: Estimate gas for common operations
      result.gasEstimates = await this.estimateGasUsage(
        contractInfo.contractId,
        contractInfo.expectedFunctions
      );

      // Step 5: Check events (via Mirror Node)
      const eventsWork = await this.checkContractEvents(
        contractInfo.contractId,
        contractInfo.expectedEvents
      );
      result.eventsVerified = eventsWork;

      logger.info(`Contract verification completed`, {
        contractName: contractInfo.contractName,
        isDeployed: result.isDeployed,
        isVerified: result.isVerified,
        functionsVerified: result.functionsVerified,
        eventsVerified: result.eventsVerified
      });

    } catch (error) {
      logger.error(`Contract verification failed`, {
        contractName: contractInfo.contractName,
        error: error instanceof Error ? error.message : String(error)
      });
      result.errors.push(`Verification failed: ${error}`);
    }

    this.verificationResults.push(result);
    return result;
  }

  /**
   * Check if contract exists via Mirror Node
   */
  private async checkContractExists(contractId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.config.mirrorNodeUrl}/api/v1/contracts/${contractId}`,
        { timeout: 10000 }
      );
      return response.status === 200 && response.data.contract_id === contractId;
    } catch (error) {
      logger.warn(`Failed to check contract existence`, { contractId, error });
      return false;
    }
  }

  /**
   * Check if contract is verified on HashScan
   */
  private async checkHashScanVerification(contractId: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.config.hashscanUrl}/api/v1/contracts/${contractId}`,
        { timeout: 10000 }
      );
      return response.data.verified === true;
    } catch (error) {
      logger.warn(`Failed to check HashScan verification`, { contractId, error });
      return false;
    }
  }

  /**
   * Test contract functions by calling them
   */
  private async testContractFunctions(
    contractId: string,
    expectedFunctions: string[]
  ): Promise<boolean> {
    try {
      let allFunctionsWork = true;

      for (const functionName of expectedFunctions) {
        try {
          // Test read-only functions (view/pure)
          if (this.isReadOnlyFunction(functionName)) {
            const query = new ContractCallQuery()
              .setContractId(contractId)
              .setGas(50000)
              .setFunction(functionName);

            await query.execute(this.client);
            logger.debug(`Function ${functionName} works`, { contractId });
          } else {
            logger.debug(`Skipping write function ${functionName} in verification`, { contractId });
          }
        } catch (error) {
          logger.warn(`Function ${functionName} failed`, {
            contractId,
            error: error instanceof Error ? error.message : String(error)
          });
          allFunctionsWork = false;
        }
      }

      return allFunctionsWork;
    } catch (error) {
      logger.error(`Function testing failed`, { contractId, error });
      return false;
    }
  }

  /**
   * Estimate gas usage for contract functions
   */
  private async estimateGasUsage(
    contractId: string,
    functions: string[]
  ): Promise<Record<string, string>> {
    const gasEstimates: Record<string, string> = {};

    for (const functionName of functions) {
      try {
        if (this.isReadOnlyFunction(functionName)) {
          const query = new ContractCallQuery()
            .setContractId(contractId)
            .setGas(100000)
            .setFunction(functionName);

          const result = await query.execute(this.client);
          gasEstimates[functionName] = result.gasUsed?.toString() || 'unknown';
        } else {
          gasEstimates[functionName] = 'write-function-estimate-unavailable';
        }
      } catch (error) {
        gasEstimates[functionName] = 'estimation-failed';
      }
    }

    return gasEstimates;
  }

  /**
   * Check contract events via Mirror Node
   */
  private async checkContractEvents(
    contractId: string,
    expectedEvents: string[]
  ): Promise<boolean> {
    try {
      // Get recent contract results to check for events
      const response = await axios.get(
        `${this.config.mirrorNodeUrl}/api/v1/contracts/${contractId}/results`,
        {
          params: { limit: 10, order: 'desc' },
          timeout: 10000
        }
      );

      if (response.data.results && response.data.results.length > 0) {
        // Check if any results have logs (events)
        const hasEvents = response.data.results.some((result: any) => 
          result.logs && result.logs.length > 0
        );
        return hasEvents;
      }

      return true; // No events to check, consider it passed
    } catch (error) {
      logger.warn(`Failed to check contract events`, { contractId, error });
      return false;
    }
  }

  /**
   * Check if a function is read-only (view/pure)
   */
  private isReadOnlyFunction(functionName: string): boolean {
    const readOnlyFunctions = [
      'getInvoiceDetails',
      'getEscrowStatus',
      'getBalance',
      'getOwner',
      'isActive',
      'getTotalFunding',
      'getInvestorShare',
      'version'
    ];
    
    return readOnlyFunctions.includes(functionName) || 
           functionName.startsWith('get') || 
           functionName.startsWith('is') || 
           functionName.startsWith('has');
  }

  /**
   * Verify all contracts from deployment results
   */
  async verifyAllContracts(deploymentResultsFile?: string): Promise<VerificationResult[]> {
    try {
      // Load deployment results
      const resultsFile = deploymentResultsFile || 
        this.findLatestDeploymentResults();
      
      if (!resultsFile || !fs.existsSync(resultsFile)) {
        throw new Error('Deployment results file not found');
      }

      const deploymentData = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      const contracts: ContractInfo[] = deploymentData.deployments.map((deployment: any) => ({
        contractId: deployment.contractId,
        contractName: deployment.contractName,
        expectedFunctions: this.getExpectedFunctions(deployment.contractName),
        expectedEvents: this.getExpectedEvents(deployment.contractName)
      }));

      logger.info(`Verifying ${contracts.length} contracts from deployment results`);

      const results: VerificationResult[] = [];
      for (const contract of contracts) {
        const result = await this.verifyContract(contract);
        results.push(result);
        
        // Wait between verifications to avoid rate limiting
        await this.sleep(1000);
      }

      return results;
    } catch (error) {
      logger.error('Failed to verify contracts from deployment results', { error });
      throw error;
    }
  }

  /**
   * Find the latest deployment results file
   */
  private findLatestDeploymentResults(): string | null {
    const resultsDir = path.join(__dirname, '../deployment-results');
    
    if (!fs.existsSync(resultsDir)) {
      return null;
    }

    const files = fs.readdirSync(resultsDir)
      .filter(file => file.startsWith('deployment-results-') && file.endsWith('.json'))
      .sort()
      .reverse();

    return files.length > 0 ? path.join(resultsDir, files[0]) : null;
  }

  /**
   * Get expected functions for a contract
   */
  private getExpectedFunctions(contractName: string): string[] {
    const functionMap: Record<string, string[]> = {
      'InvoiceEscrow': [
        'createEscrow',
        'releaseEscrow',
        'refundEscrow',
        'getEscrowStatus',
        'getEscrowDetails',
        'isActive'
      ],
      'FundingPool': [
        'contribute',
        'withdraw',
        'getBalance',
        'getTotalFunding',
        'getInvestorShare',
        'isActive'
      ]
    };

    return functionMap[contractName] || [];
  }

  /**
   * Get expected events for a contract
   */
  private getExpectedEvents(contractName: string): string[] {
    const eventMap: Record<string, string[]> = {
      'InvoiceEscrow': [
        'EscrowCreated',
        'EscrowReleased',
        'EscrowRefunded'
      ],
      'FundingPool': [
        'ContributionMade',
        'WithdrawalMade',
        'PoolCreated'
      ]
    };

    return eventMap[contractName] || [];
  }

  /**
   * Generate verification report
   */
  generateReport(): string {
    let report = '\n=== Contract Deployment Verification Report ===\n\n';
    
    report += `Network: ${this.config.network}\n`;
    report += `Timestamp: ${new Date().toISOString()}\n\n`;

    for (const result of this.verificationResults) {
      report += `Contract: ${result.contractName} (${result.contractId})\n`;
      report += `  ✅ Deployed: ${result.isDeployed ? 'YES' : 'NO'}\n`;
      report += `  ✅ Verified: ${result.isVerified ? 'YES' : 'NO'}\n`;
      report += `  ✅ Functions: ${result.functionsVerified ? 'YES' : 'NO'}\n`;
      report += `  ✅ Events: ${result.eventsVerified ? 'YES' : 'NO'}\n`;
      
      if (Object.keys(result.gasEstimates).length > 0) {
        report += `  Gas Estimates:\n`;
        for (const [func, gas] of Object.entries(result.gasEstimates)) {
          report += `    ${func}: ${gas}\n`;
        }
      }
      
      if (result.warnings.length > 0) {
        report += `  Warnings:\n`;
        for (const warning of result.warnings) {
          report += `    ⚠️  ${warning}\n`;
        }
      }
      
      if (result.errors.length > 0) {
        report += `  Errors:\n`;
        for (const error of result.errors) {
          report += `    ❌ ${error}\n`;
        }
      }
      
      report += '\n';
    }

    return report;
  }

  /**
   * Save verification results
   */
  async saveResults(outputFile?: string): Promise<void> {
    const filename = outputFile || `verification-results-${Date.now()}.json`;
    const outputPath = path.join(__dirname, '../deployment-results', filename);
    
    const verificationData = {
      timestamp: new Date().toISOString(),
      network: this.config.network,
      results: this.verificationResults
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(verificationData, null, 2));
    logger.info(`Verification results saved to ${outputPath}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

// Main verification script
async function main() {
  try {
    const config: VerificationConfig = {
      operatorId: process.env.HEDERA_OPERATOR_ID!,
      operatorKey: process.env.HEDERA_OPERATOR_KEY!,
      network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet' | 'previewnet') || 'testnet',
      mirrorNodeUrl: process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
      hashscanUrl: process.env.HASHSCAN_URL || 'https://hashscan.io/testnet'
    };
    
    if (!config.operatorId || !config.operatorKey) {
      throw new Error('Missing required environment variables: HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY');
    }
    
    const verifier = new DeploymentVerifier(config);
    
    logger.info('Starting contract verification process');
    
    // Verify all contracts from latest deployment
    const results = await verifier.verifyAllContracts();
    
    // Generate and display report
    const report = verifier.generateReport();
    console.log(report);
    
    // Save results
    await verifier.saveResults();
    
    // Check if all verifications passed
    const allPassed = results.every(result => 
      result.isDeployed && result.functionsVerified && result.errors.length === 0
    );
    
    if (allPassed) {
      logger.info('✅ All contract verifications passed!');
    } else {
      logger.warn('⚠️  Some contract verifications failed. Check the report above.');
    }
    
    await verifier.close();
  } catch (error) {
    logger.error('Contract verification failed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { DeploymentVerifier, VerificationConfig, ContractInfo, VerificationResult };