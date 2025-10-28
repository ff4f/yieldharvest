#!/usr/bin/env node

/**
 * Production Verification Script
 * Verifies that all systems are ready for production deployment
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

// Load environment variables
config();

interface VerificationResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    details?: any;
  }>;
}

class ProductionVerifier {
  private prisma: PrismaClient;
  private results: VerificationResult[] = [];
  private apiUrl: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.apiUrl = process.env.API_URL || 'http://localhost:3001';
  }

  private addResult(category: string, name: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) {
    let categoryResult = this.results.find(r => r.category === category);
    if (!categoryResult) {
      categoryResult = { category, checks: [] };
      this.results.push(categoryResult);
    }
    categoryResult.checks.push({ name, status, message, details });
  }

  async verifyEnvironmentVariables() {
    const requiredVars = [
      'DATABASE_URL',
      'JWT_SECRET',
      'HEDERA_OPERATOR_ID',
      'HEDERA_OPERATOR_KEY',
      'HEDERA_NETWORK',
      'HEDERA_MIRROR_NODE_URL'
    ];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value) {
        this.addResult('Environment', varName, 'fail', `Missing required environment variable: ${varName}`);
      } else {
        this.addResult('Environment', varName, 'pass', `Environment variable set`);
      }
    }

    // Check NODE_ENV
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === 'production') {
      this.addResult('Environment', 'NODE_ENV', 'pass', 'NODE_ENV set to production');
    } else {
      this.addResult('Environment', 'NODE_ENV', 'warning', `NODE_ENV is ${nodeEnv}, should be 'production' for production deployment`);
    }
  }

  async verifyDatabase() {
    try {
      await this.prisma.$connect();
      this.addResult('Database', 'Connection', 'pass', 'Database connection successful');

      // Check if tables exist
      const tables = await this.prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      ` as any[];

      const expectedTables = ['User', 'Invoice', 'Funding', 'Milestone'];
      const existingTables = tables.map((t: any) => t.table_name);

      for (const table of expectedTables) {
        if (existingTables.includes(table)) {
          this.addResult('Database', `Table ${table}`, 'pass', `Table ${table} exists`);
        } else {
          this.addResult('Database', `Table ${table}`, 'fail', `Table ${table} missing`);
        }
      }

    } catch (error) {
      this.addResult('Database', 'Connection', 'fail', `Database connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async verifyHederaServices() {
    try {
      // Check Hedera configuration
      const operatorId = process.env.HEDERA_OPERATOR_ID;
      const operatorKey = process.env.HEDERA_OPERATOR_KEY;
      const network = process.env.HEDERA_NETWORK;
      const mirrorNodeUrl = process.env.HEDERA_MIRROR_NODE_URL;

      if (!operatorId || !operatorKey || !network || !mirrorNodeUrl) {
        this.addResult('Hedera', 'Configuration', 'fail', 'Missing Hedera configuration');
        return;
      }

      this.addResult('Hedera', 'Configuration', 'pass', 'Hedera configuration present');

      // Test Mirror Node connectivity
      try {
        const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${operatorId}`, {
          timeout: 10000
        });
        
        if (response.ok) {
          this.addResult('Hedera', 'Mirror Node', 'pass', 'Mirror Node accessible');
        } else {
          this.addResult('Hedera', 'Mirror Node', 'warning', `Mirror Node returned status ${response.status}`);
        }
      } catch (error) {
        this.addResult('Hedera', 'Mirror Node', 'fail', `Mirror Node connection failed: ${error instanceof Error ? error.message : String(error)}`);
      }

    } catch (error) {
      this.addResult('Hedera', 'Services', 'fail', `Hedera services check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async verifyAPIEndpoints() {
    const endpoints = [
      { path: '/health', method: 'GET', expectedStatus: 200 },
      { path: '/api/docs', method: 'GET', expectedStatus: 200 },
      { path: '/api/auth/register', method: 'POST', expectedStatus: 400 }, // Should fail without body
      { path: '/api/invoices', method: 'GET', expectedStatus: 401 }, // Should require auth
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${this.apiUrl}${endpoint.path}`, {
          method: endpoint.method,
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (response.status === endpoint.expectedStatus) {
          this.addResult('API', `${endpoint.method} ${endpoint.path}`, 'pass', `Endpoint responding correctly (${response.status})`);
        } else {
          this.addResult('API', `${endpoint.method} ${endpoint.path}`, 'warning', `Unexpected status ${response.status}, expected ${endpoint.expectedStatus}`);
        }
      } catch (error) {
        this.addResult('API', `${endpoint.method} ${endpoint.path}`, 'fail', `Endpoint failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  async verifySecuritySettings() {
    // Check JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length >= 32) {
      this.addResult('Security', 'JWT Secret', 'pass', 'JWT secret has adequate length');
    } else {
      this.addResult('Security', 'JWT Secret', 'fail', 'JWT secret is too short or missing');
    }

    // Check CORS settings
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin && corsOrigin !== '*') {
      this.addResult('Security', 'CORS', 'pass', 'CORS origin configured');
    } else {
      this.addResult('Security', 'CORS', 'warning', 'CORS origin not configured or set to wildcard');
    }

    // Check rate limiting
    const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED;
    if (rateLimitEnabled === 'true') {
      this.addResult('Security', 'Rate Limiting', 'pass', 'Rate limiting enabled');
    } else {
      this.addResult('Security', 'Rate Limiting', 'warning', 'Rate limiting not enabled');
    }
  }

  async runAllChecks() {
    console.log('🔍 Starting production verification...\n');

    await this.verifyEnvironmentVariables();
    await this.verifyDatabase();
    await this.verifyHederaServices();
    await this.verifyAPIEndpoints();
    await this.verifySecuritySettings();

    await this.prisma.$disconnect();
  }

  generateReport() {
    console.log('📊 Production Verification Report');
    console.log('='.repeat(80));

    let totalChecks = 0;
    let passedChecks = 0;
    let failedChecks = 0;
    let warningChecks = 0;

    for (const result of this.results) {
      console.log(`\n📁 ${result.category}`);
      console.log('-'.repeat(40));

      for (const check of result.checks) {
        totalChecks++;
        const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
        console.log(`${icon} ${check.name}: ${check.message}`);

        if (check.status === 'pass') passedChecks++;
        else if (check.status === 'fail') failedChecks++;
        else warningChecks++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📈 Summary: ${totalChecks} total checks`);
    console.log(`✅ Passed: ${passedChecks}`);
    console.log(`❌ Failed: ${failedChecks}`);
    console.log(`⚠️  Warnings: ${warningChecks}`);

    if (failedChecks === 0) {
      console.log('\n🎉 All critical checks passed! System is ready for production.');
      return true;
    } else {
      console.log('\n🚨 Some checks failed. Please address the issues before deploying to production.');
      return false;
    }
  }
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new ProductionVerifier();
  
  verifier.runAllChecks()
    .then(() => {
      const success = verifier.generateReport();
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

export { ProductionVerifier };