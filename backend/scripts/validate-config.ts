#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';
import { z } from 'zod';
import { AccountId, PrivateKey } from '@hashgraph/sdk';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Configuration schema
const ConfigSchema = z.object({
  // Hedera Configuration
  HEDERA_OPERATOR_ID: z.string().min(1, 'Hedera operator ID is required'),
  HEDERA_OPERATOR_KEY: z.string().min(1, 'Hedera operator key is required'),
  HEDERA_NETWORK: z.enum(['testnet', 'mainnet', 'previewnet']).default('testnet'),
  HEDERA_MIRROR_NODE_URL: z.string().url('Invalid Mirror Node URL'),
  
  // Database Configuration
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  
  // Server Configuration
  PORT: z.string().transform(val => parseInt(val)).pipe(z.number().min(1000).max(65535)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  
  // Contract Configuration (optional)
  INVOICE_ESCROW_CONTRACT_ID: z.string().optional(),
  FUNDING_POOL_CONTRACT_ID: z.string().optional(),
  
  // HCS Configuration (optional)
  AUDIT_TOPIC_ID: z.string().optional(),
  
  // File Upload Configuration
  MAX_FILE_SIZE: z.string().transform(val => parseInt(val)).pipe(z.number().positive()).default('10485760'), // 10MB
  UPLOAD_DIR: z.string().default('./uploads'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(val => parseInt(val)).pipe(z.number().positive()).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(val => parseInt(val)).pipe(z.number().positive()).default('900000'), // 15 minutes
});

type Config = z.infer<typeof ConfigSchema>;

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: Config;
}

class ConfigValidator {
  private validationResult: ValidationResult = {
    isValid: false,
    errors: [],
    warnings: []
  };

  /**
   * Validate all configuration
   */
  async validateAll(): Promise<ValidationResult> {
    logger.info('Starting configuration validation...');

    try {
      // Step 1: Validate environment variables
      await this.validateEnvironmentVariables();
      
      if (this.validationResult.errors.length === 0) {
        // Step 2: Validate Hedera configuration
        await this.validateHederaConfig();
        
        // Step 3: Validate database connection
        await this.validateDatabaseConfig();
        
        // Step 4: Validate file system permissions
        await this.validateFileSystemConfig();
        
        // Step 5: Validate external services
        await this.validateExternalServices();
        
        // Step 6: Validate contract deployments (if configured)
        await this.validateContractConfig();
      }
      
      this.validationResult.isValid = this.validationResult.errors.length === 0;
      
      logger.info('Configuration validation completed', {
        isValid: this.validationResult.isValid,
        errorCount: this.validationResult.errors.length,
        warningCount: this.validationResult.warnings.length
      });
      
    } catch (error) {
      this.validationResult.errors.push(`Validation failed: ${error}`);
      this.validationResult.isValid = false;
    }

    return this.validationResult;
  }

  /**
   * Validate environment variables against schema
   */
  private async validateEnvironmentVariables(): Promise<void> {
    try {
      const config = ConfigSchema.parse(process.env);
      this.validationResult.config = config;
      logger.info('✅ Environment variables validation passed');
    } catch (error) {
      if (error instanceof z.ZodError) {
        for (const issue of error.issues) {
          this.validationResult.errors.push(
            `${issue.path.join('.')}: ${issue.message}`
          );
        }
      } else {
        this.validationResult.errors.push(`Environment validation failed: ${error}`);
      }
      logger.error('❌ Environment variables validation failed');
    }
  }

  /**
   * Validate Hedera configuration
   */
  private async validateHederaConfig(): Promise<void> {
    if (!this.validationResult.config) return;
    
    try {
      // Validate operator account ID format
      const operatorId = AccountId.fromString(this.validationResult.config.HEDERA_OPERATOR_ID);
      logger.debug('Operator ID format valid', { operatorId: operatorId.toString() });
      
      // Validate operator private key format
      const operatorKey = PrivateKey.fromString(this.validationResult.config.HEDERA_OPERATOR_KEY);
      logger.debug('Operator key format valid');
      
      // Validate network configuration
      const validNetworks = ['testnet', 'mainnet', 'previewnet'];
      if (!validNetworks.includes(this.validationResult.config.HEDERA_NETWORK)) {
        this.validationResult.errors.push(
          `Invalid Hedera network: ${this.validationResult.config.HEDERA_NETWORK}`
        );
      }
      
      logger.info('✅ Hedera configuration validation passed');
    } catch (error) {
      this.validationResult.errors.push(`Hedera config validation failed: ${error}`);
      logger.error('❌ Hedera configuration validation failed');
    }
  }

  /**
   * Validate database configuration
   */
  private async validateDatabaseConfig(): Promise<void> {
    if (!this.validationResult.config) return;
    
    try {
      // Check if DATABASE_URL is properly formatted
      const dbUrl = this.validationResult.config.DATABASE_URL;
      
      if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
        this.validationResult.warnings.push(
          'Database URL should start with postgresql:// or postgres://'
        );
      }
      
      // Check if Prisma schema exists
      const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
      if (!fs.existsSync(schemaPath)) {
        this.validationResult.errors.push('Prisma schema file not found');
      }
      
      // Check if Prisma client is generated
      const clientPath = path.join(__dirname, '../node_modules/.prisma/client');
      if (!fs.existsSync(clientPath)) {
        this.validationResult.warnings.push(
          'Prisma client not generated. Run: npm run db:generate'
        );
      }
      
      logger.info('✅ Database configuration validation passed');
    } catch (error) {
      this.validationResult.errors.push(`Database config validation failed: ${error}`);
      logger.error('❌ Database configuration validation failed');
    }
  }

  /**
   * Validate file system configuration
   */
  private async validateFileSystemConfig(): Promise<void> {
    if (!this.validationResult.config) return;
    
    try {
      const uploadDir = this.validationResult.config.UPLOAD_DIR;
      
      // Check if upload directory exists, create if not
      if (!fs.existsSync(uploadDir)) {
        try {
          fs.mkdirSync(uploadDir, { recursive: true });
          logger.info(`Created upload directory: ${uploadDir}`);
        } catch (error) {
          this.validationResult.errors.push(
            `Cannot create upload directory: ${uploadDir}`
          );
          return;
        }
      }
      
      // Check write permissions
      try {
        const testFile = path.join(uploadDir, 'test-write.tmp');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (error) {
        this.validationResult.errors.push(
          `No write permission for upload directory: ${uploadDir}`
        );
      }
      
      // Validate file size limit
      const maxFileSize = this.validationResult.config.MAX_FILE_SIZE;
      if (maxFileSize > 50 * 1024 * 1024) { // 50MB
        this.validationResult.warnings.push(
          'File size limit is very high (>50MB). Consider reducing for better performance.'
        );
      }
      
      logger.info('✅ File system configuration validation passed');
    } catch (error) {
      this.validationResult.errors.push(`File system config validation failed: ${error}`);
      logger.error('❌ File system configuration validation failed');
    }
  }

  /**
   * Validate external services
   */
  private async validateExternalServices(): Promise<void> {
    if (!this.validationResult.config) return;
    
    try {
      // Test Mirror Node connectivity
      const mirrorNodeUrl = this.validationResult.config.HEDERA_MIRROR_NODE_URL;
      try {
        const response = await axios.get(`${mirrorNodeUrl}/api/v1/network/nodes`, {
          timeout: 10000
        });
        if (response.status === 200) {
          logger.info('✅ Mirror Node connectivity verified');
        } else {
          this.validationResult.warnings.push(
            `Mirror Node returned status ${response.status}`
          );
        }
      } catch (error) {
        this.validationResult.warnings.push(
          `Cannot connect to Mirror Node: ${mirrorNodeUrl}`
        );
      }
      
      logger.info('✅ External services validation completed');
    } catch (error) {
      this.validationResult.warnings.push(`External services validation failed: ${error}`);
      logger.warn('⚠️  External services validation had issues');
    }
  }

  /**
   * Validate contract configuration
   */
  private async validateContractConfig(): Promise<void> {
    if (!this.validationResult.config) return;
    
    try {
      const { INVOICE_ESCROW_CONTRACT_ID, FUNDING_POOL_CONTRACT_ID } = this.validationResult.config;
      
      if (INVOICE_ESCROW_CONTRACT_ID) {
        if (!this.isValidContractId(INVOICE_ESCROW_CONTRACT_ID)) {
          this.validationResult.errors.push(
            `Invalid Invoice Escrow contract ID format: ${INVOICE_ESCROW_CONTRACT_ID}`
          );
        }
      } else {
        this.validationResult.warnings.push(
          'Invoice Escrow contract ID not configured. Deploy contracts first.'
        );
      }
      
      if (FUNDING_POOL_CONTRACT_ID) {
        if (!this.isValidContractId(FUNDING_POOL_CONTRACT_ID)) {
          this.validationResult.errors.push(
            `Invalid Funding Pool contract ID format: ${FUNDING_POOL_CONTRACT_ID}`
          );
        }
      } else {
        this.validationResult.warnings.push(
          'Funding Pool contract ID not configured. Deploy contracts first.'
        );
      }
      
      logger.info('✅ Contract configuration validation completed');
    } catch (error) {
      this.validationResult.warnings.push(`Contract config validation failed: ${error}`);
      logger.warn('⚠️  Contract configuration validation had issues');
    }
  }

  /**
   * Validate contract ID format
   */
  private isValidContractId(contractId: string): boolean {
    // Hedera contract ID format: 0.0.xxxxx
    const contractIdRegex = /^0\.0\.[0-9]+$/;
    return contractIdRegex.test(contractId);
  }

  /**
   * Generate configuration report
   */
  generateReport(): string {
    let report = '\n=== Configuration Validation Report ===\n\n';
    
    report += `Timestamp: ${new Date().toISOString()}\n`;
    report += `Status: ${this.validationResult.isValid ? '✅ VALID' : '❌ INVALID'}\n\n`;
    
    if (this.validationResult.config) {
      report += 'Configuration Summary:\n';
      report += `  Network: ${this.validationResult.config.HEDERA_NETWORK}\n`;
      report += `  Operator ID: ${this.validationResult.config.HEDERA_OPERATOR_ID}\n`;
      report += `  Environment: ${this.validationResult.config.NODE_ENV}\n`;
      report += `  Port: ${this.validationResult.config.PORT}\n\n`;
    }
    
    if (this.validationResult.errors.length > 0) {
      report += 'Errors:\n';
      for (const error of this.validationResult.errors) {
        report += `  ❌ ${error}\n`;
      }
      report += '\n';
    }
    
    if (this.validationResult.warnings.length > 0) {
      report += 'Warnings:\n';
      for (const warning of this.validationResult.warnings) {
        report += `  ⚠️  ${warning}\n`;
      }
      report += '\n';
    }
    
    if (this.validationResult.isValid) {
      report += '🎉 Configuration is valid and ready for deployment!\n';
    } else {
      report += '🚨 Configuration has errors that must be fixed before deployment.\n';
    }
    
    return report;
  }

  /**
   * Save validation results
   */
  async saveResults(outputFile?: string): Promise<void> {
    const filename = outputFile || `config-validation-${Date.now()}.json`;
    const outputPath = path.join(__dirname, '../deployment-results', filename);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const validationData = {
      timestamp: new Date().toISOString(),
      isValid: this.validationResult.isValid,
      errors: this.validationResult.errors,
      warnings: this.validationResult.warnings,
      config: this.validationResult.config ? {
        network: this.validationResult.config.HEDERA_NETWORK,
        operatorId: this.validationResult.config.HEDERA_OPERATOR_ID,
        environment: this.validationResult.config.NODE_ENV,
        port: this.validationResult.config.PORT
      } : null
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(validationData, null, 2));
    logger.info(`Validation results saved to ${outputPath}`);
  }
}

// Main validation script
async function main() {
  try {
    const validator = new ConfigValidator();
    
    logger.info('Starting configuration validation...');
    
    const result = await validator.validateAll();
    
    // Generate and display report
    const report = validator.generateReport();
    console.log(report);
    
    // Save results
    await validator.saveResults();
    
    // Exit with appropriate code
    if (result.isValid) {
      logger.info('✅ Configuration validation passed!');
      process.exit(0);
    } else {
      logger.error('❌ Configuration validation failed!');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Configuration validation crashed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { ConfigValidator, ConfigSchema, ValidationResult };