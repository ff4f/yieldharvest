#!/usr/bin/env ts-node

import {
  Client,
  PrivateKey,
  AccountId,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  FileCreateTransaction,
  Hbar,
  TokenId,
  TopicId,
  FileId,
} from '@hashgraph/sdk';
import fs from 'fs';
import path from 'path';
import { logger } from '../src/utils/logger';

interface HederaServicesConfig {
  operatorId: string;
  operatorKey: string;
  network: 'testnet' | 'mainnet';
  treasuryId: string;
  treasuryKey: string;
}

interface ServicesSetupResult {
  nftToken: {
    tokenId: string;
    name: string;
    symbol: string;
    proofLinks: {
      hashscan: string;
      mirrorNode: string;
    };
  };
  consensusTopic: {
    topicId: string;
    description: string;
    proofLinks: {
      hashscan: string;
      mirrorNode: string;
    };
  };
  fileService: {
    templateFileId: string;
    description: string;
    proofLinks: {
      hashscan: string;
      mirrorNode: string;
    };
  };
  config: {
    invoiceNftTokenId: string;
    invoiceStatusTopicId: string;
    documentTemplateFileId: string;
    treasuryAccountId: string;
  };
}

class HederaServicesSetup {
  private client: Client;
  private operatorId: AccountId;
  private operatorKey: PrivateKey;
  private treasuryId: AccountId;
  private treasuryKey: PrivateKey;
  private config: HederaServicesConfig;

  constructor(config: HederaServicesConfig) {
    this.config = config;
    this.operatorId = AccountId.fromString(config.operatorId);
    this.operatorKey = PrivateKey.fromString(config.operatorKey);
    this.treasuryId = AccountId.fromString(config.treasuryId);
    this.treasuryKey = PrivateKey.fromString(config.treasuryKey);
    
    // Initialize Hedera client
    if (config.network === 'testnet') {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }
    
    this.client.setOperator(this.operatorId, this.operatorKey);
  }

  /**
   * Set up all Hedera services
   */
  async setupServices(): Promise<ServicesSetupResult> {
    try {
      logger.info('Starting Hedera services setup', { network: this.config.network });

      // Step 1: Create NFT token for invoices
      const nftResult = await this.createInvoiceNFTToken();
      
      // Step 2: Create consensus topic for invoice status updates
      const topicResult = await this.createInvoiceStatusTopic();
      
      // Step 3: Create file service template
      const fileResult = await this.createDocumentTemplate();
      
      // Step 4: Test services
      await this.testServices(nftResult.tokenId, topicResult.topicId, fileResult.fileId);
      
      // Step 5: Generate configuration
      const setupResult = this.generateSetupResult(nftResult, topicResult, fileResult);
      
      // Step 6: Save setup artifacts
      await this.saveSetupArtifacts(setupResult);
      
      logger.info('Hedera services setup completed successfully');
      return setupResult;
    } catch (error) {
      logger.error('Services setup failed', { error });
      throw error;
    }
  }

  /**
   * Create NFT token for invoice minting
   */
  private async createInvoiceNFTToken(): Promise<{
    tokenId: string;
    transactionId: string;
  }> {
    logger.info('Creating invoice NFT token');
    
    try {
      const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName('YieldHarvest Invoice NFT')
        .setTokenSymbol('YHINV')
        .setTokenType(TokenType.NonFungibleUnique)
        .setSupplyType(TokenSupplyType.Infinite)
        .setTreasuryAccountId(this.treasuryId)
        .setSupplyKey(this.treasuryKey)
        .setAdminKey(this.operatorKey)
        .setWipeKey(this.operatorKey)
        .setFreezeKey(this.operatorKey)
        .setPauseKey(this.operatorKey)
        .setMetadataKey(this.treasuryKey)
        .setMaxTransactionFee(Hbar.fromTinybars(200_000_000));

      const tokenCreateResponse = await tokenCreateTx.execute(this.client);
      const tokenCreateReceipt = await tokenCreateResponse.getReceipt(this.client);
      
      if (!tokenCreateReceipt.tokenId) {
        throw new Error('Failed to create NFT token');
      }
      
      const tokenId = tokenCreateReceipt.tokenId.toString();
      
      logger.info('Invoice NFT token created successfully', { tokenId });
      
      return {
        tokenId,
        transactionId: tokenCreateResponse.transactionId.toString(),
      };
    } catch (error) {
      logger.error('Failed to create NFT token', { error });
      throw error;
    }
  }

  /**
   * Create consensus topic for invoice status updates
   */
  private async createInvoiceStatusTopic(): Promise<{
    topicId: string;
    transactionId: string;
  }> {
    logger.info('Creating invoice status consensus topic');
    
    try {
      const topicCreateTx = new TopicCreateTransaction()
        .setTopicMemo('YieldHarvest Invoice Status Updates')
        .setAdminKey(this.operatorKey)
        .setSubmitKey(this.operatorKey)
        .setMaxTransactionFee(Hbar.fromTinybars(100_000_000));

      const topicCreateResponse = await topicCreateTx.execute(this.client);
      const topicCreateReceipt = await topicCreateResponse.getReceipt(this.client);
      
      if (!topicCreateReceipt.topicId) {
        throw new Error('Failed to create consensus topic');
      }
      
      const topicId = topicCreateReceipt.topicId.toString();
      
      logger.info('Invoice status topic created successfully', { topicId });
      
      return {
        topicId,
        transactionId: topicCreateResponse.transactionId.toString(),
      };
    } catch (error) {
      logger.error('Failed to create consensus topic', { error });
      throw error;
    }
  }

  /**
   * Create document template file
   */
  private async createDocumentTemplate(): Promise<{
    fileId: string;
    transactionId: string;
  }> {
    logger.info('Creating document template file');
    
    try {
      // Create a sample invoice template
      const templateContent = JSON.stringify({
        template: 'YieldHarvest Invoice Template',
        version: '1.0',
        fields: {
          invoiceNumber: 'string',
          supplierName: 'string',
          buyerName: 'string',
          amount: 'number',
          currency: 'string',
          dueDate: 'date',
          description: 'string',
          terms: 'string',
        },
        metadata: {
          createdBy: 'YieldHarvest Platform',
          createdAt: new Date().toISOString(),
          purpose: 'Invoice NFT Template',
        },
      }, null, 2);

      const fileCreateTx = new FileCreateTransaction()
        .setKeys([this.operatorKey])
        .setContents(templateContent)
        .setFileMemo('YieldHarvest Invoice Template')
        .setMaxTransactionFee(Hbar.fromTinybars(100_000_000));

      const fileCreateResponse = await fileCreateTx.execute(this.client);
      const fileCreateReceipt = await fileCreateResponse.getReceipt(this.client);
      
      if (!fileCreateReceipt.fileId) {
        throw new Error('Failed to create template file');
      }
      
      const fileId = fileCreateReceipt.fileId.toString();
      
      logger.info('Document template file created successfully', { fileId });
      
      return {
        fileId,
        transactionId: fileCreateResponse.transactionId.toString(),
      };
    } catch (error) {
      logger.error('Failed to create template file', { error });
      throw error;
    }
  }

  /**
   * Test the created services
   */
  private async testServices(tokenId: string, topicId: string, fileId: string): Promise<void> {
    logger.info('Testing created services');
    
    try {
      // Test 1: Mint a test NFT
      await this.testNFTMinting(tokenId);
      
      // Test 2: Submit a test message to topic
      await this.testTopicMessage(topicId);
      
      logger.info('All service tests passed');
    } catch (error) {
      logger.error('Service testing failed', { error });
      throw error;
    }
  }

  /**
   * Test NFT minting
   */
  private async testNFTMinting(tokenId: string): Promise<void> {
    try {
      const testMetadata = JSON.stringify({
        name: 'Test Invoice NFT',
        description: 'Test invoice for service verification',
        invoiceNumber: 'TEST-001',
        amount: 1000,
        currency: 'USD',
        createdAt: new Date().toISOString(),
      });

      const mintTx = new TokenMintTransaction()
        .setTokenId(tokenId)
        .setMetadata([Buffer.from(testMetadata)])
        .setMaxTransactionFee(Hbar.fromTinybars(100_000_000))
        .freezeWith(this.client);

      const mintTxSigned = await mintTx.sign(this.treasuryKey);
      const mintResponse = await mintTxSigned.execute(this.client);
      const mintReceipt = await mintResponse.getReceipt(this.client);
      
      if (mintReceipt.status.toString() === 'SUCCESS') {
        logger.info('✅ NFT minting test passed', {
          tokenId,
          serialNumbers: mintReceipt.serials?.map(s => s.toString()),
        });
      } else {
        throw new Error(`NFT minting failed: ${mintReceipt.status}`);
      }
    } catch (error) {
      logger.error('❌ NFT minting test failed', { error });
      throw error;
    }
  }

  /**
   * Test topic message submission
   */
  private async testTopicMessage(topicId: string): Promise<void> {
    try {
      const testMessage = JSON.stringify({
        type: 'invoice_status_update',
        invoiceId: 'TEST-001',
        status: 'issued',
        timestamp: new Date().toISOString(),
        metadata: {
          test: true,
          purpose: 'service_verification',
        },
      });

      const messageTx = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(testMessage)
        .setMaxTransactionFee(Hbar.fromTinybars(50_000_000));

      const messageResponse = await messageTx.execute(this.client);
      const messageReceipt = await messageResponse.getReceipt(this.client);
      
      if (messageReceipt.status.toString() === 'SUCCESS') {
        logger.info('✅ Topic message test passed', {
          topicId,
          transactionId: messageResponse.transactionId.toString(),
        });
      } else {
        throw new Error(`Topic message failed: ${messageReceipt.status}`);
      }
    } catch (error) {
      logger.error('❌ Topic message test failed', { error });
      throw error;
    }
  }

  /**
   * Generate setup result
   */
  private generateSetupResult(
    nftResult: { tokenId: string; transactionId: string },
    topicResult: { topicId: string; transactionId: string },
    fileResult: { fileId: string; transactionId: string }
  ): ServicesSetupResult {
    const networkPrefix = this.config.network === 'testnet' ? 'testnet' : 'mainnet';
    
    return {
      nftToken: {
        tokenId: nftResult.tokenId,
        name: 'YieldHarvest Invoice NFT',
        symbol: 'YHINV',
        proofLinks: {
          hashscan: `https://hashscan.io/${networkPrefix}/token/${nftResult.tokenId}`,
          mirrorNode: `https://${networkPrefix}.mirrornode.hedera.com/api/v1/tokens/${nftResult.tokenId}`,
        },
      },
      consensusTopic: {
        topicId: topicResult.topicId,
        description: 'YieldHarvest Invoice Status Updates',
        proofLinks: {
          hashscan: `https://hashscan.io/${networkPrefix}/topic/${topicResult.topicId}`,
          mirrorNode: `https://${networkPrefix}.mirrornode.hedera.com/api/v1/topics/${topicResult.topicId}`,
        },
      },
      fileService: {
        templateFileId: fileResult.fileId,
        description: 'YieldHarvest Invoice Template',
        proofLinks: {
          hashscan: `https://hashscan.io/${networkPrefix}/file/${fileResult.fileId}`,
          mirrorNode: `https://${networkPrefix}.mirrornode.hedera.com/api/v1/files/${fileResult.fileId}`,
        },
      },
      config: {
        invoiceNftTokenId: nftResult.tokenId,
        invoiceStatusTopicId: topicResult.topicId,
        documentTemplateFileId: fileResult.fileId,
        treasuryAccountId: this.treasuryId.toString(),
      },
    };
  }

  /**
   * Save setup artifacts
   */
  private async saveSetupArtifacts(result: ServicesSetupResult): Promise<void> {
    const artifactsDir = path.join(__dirname, '..', 'artifacts', 'services');
    
    // Ensure directory exists
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const networkPrefix = this.config.network;
    
    // Save services result
    const servicesFile = path.join(artifactsDir, `${networkPrefix}-services-${timestamp}.json`);
    fs.writeFileSync(servicesFile, JSON.stringify(result, null, 2));
    
    // Save environment configuration
    const envConfig = `
# Hedera Services Configuration - ${this.config.network}
# Generated on ${new Date().toISOString()}

INVOICE_NFT_TOKEN_ID=${result.config.invoiceNftTokenId}
INVOICE_STATUS_TOPIC_ID=${result.config.invoiceStatusTopicId}
DOCUMENT_TEMPLATE_FILE_ID=${result.config.documentTemplateFileId}
TREASURY_ACCOUNT_ID=${result.config.treasuryAccountId}
HEDERA_NETWORK=${this.config.network}

# Proof Links
NFT_TOKEN_HASHSCAN=${result.nftToken.proofLinks.hashscan}
TOPIC_HASHSCAN=${result.consensusTopic.proofLinks.hashscan}
FILE_HASHSCAN=${result.fileService.proofLinks.hashscan}
`;
    
    const envFile = path.join(artifactsDir, `${networkPrefix}-services.env`);
    fs.writeFileSync(envFile, envConfig);
    
    logger.info('Setup artifacts saved', {
      servicesFile,
      envFile,
    });
  }
}

/**
 * Main setup function
 */
async function setupHederaServices(): Promise<void> {
  const config: HederaServicesConfig = {
    operatorId: process.env.HEDERA_OPERATOR_ID || '',
    operatorKey: process.env.HEDERA_OPERATOR_KEY || '',
    network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
    treasuryId: process.env.TREASURY_ACCOUNT_ID || process.env.HEDERA_OPERATOR_ID || '',
    treasuryKey: process.env.TREASURY_PRIVATE_KEY || process.env.HEDERA_OPERATOR_KEY || '',
  };

  // Validate configuration
  if (!config.operatorId || !config.operatorKey) {
    throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set');
  }

  const setup = new HederaServicesSetup(config);
  const result = await setup.setupServices();

  console.log('\n🎉 Hedera Services Setup Complete!');
  console.log('==================================');
  console.log(`Network: ${config.network}`);
  console.log('\n📋 Created Services:');
  console.log(`NFT Token ID: ${result.nftToken.tokenId}`);
  console.log(`Topic ID: ${result.consensusTopic.topicId}`);
  console.log(`Template File ID: ${result.fileService.templateFileId}`);
  console.log('\n🔗 Proof Links:');
  console.log(`NFT Token: ${result.nftToken.proofLinks.hashscan}`);
  console.log(`Consensus Topic: ${result.consensusTopic.proofLinks.hashscan}`);
  console.log(`File Service: ${result.fileService.proofLinks.hashscan}`);
  console.log('\n💡 Next Steps:');
  console.log('1. Update your .env file with the service configuration');
  console.log('2. Test the services with your application');
  console.log('3. Deploy the escrow contract system');
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupHederaServices()
    .then(() => {
      console.log('✅ Services setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Services setup failed:', error);
      process.exit(1);
    });
}

export { setupHederaServices, HederaServicesSetup };
export type { HederaServicesConfig, ServicesSetupResult };