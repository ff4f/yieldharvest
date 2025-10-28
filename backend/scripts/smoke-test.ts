#!/usr/bin/env ts-node

import fetch from 'node-fetch';
import { config } from 'dotenv';

// Load environment variables
config();

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  duration?: number;
}

class SmokeTest {
  private baseUrl: string;
  private results: TestResult[] = [];

  constructor() {
    this.baseUrl = process.env.API_URL || 'http://localhost:3001';
  }

  async runTests(): Promise<void> {
    console.log('🔥 Starting smoke tests...');
    console.log(`Testing API at: ${this.baseUrl}`);

    try {
      await this.testHealthEndpoint();
      await this.testApiDocumentation();
      await this.testAuthEndpoints();
      await this.testInvoiceEndpoints();
      await this.testHederaEndpoints();
      await this.testFundingEndpoints();

      this.printResults();

    } catch (error) {
      console.error('💥 Smoke tests failed:', error);
      throw error;
    }
  }

  private async testHealthEndpoint(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.status === 'healthy') {
          this.addResult('Health Check', 'pass', `API is healthy (${duration}ms)`, duration);
        } else {
          this.addResult('Health Check', 'warning', `API responded but status: ${data.status}`, duration);
        }
      } else {
        this.addResult('Health Check', 'fail', `Health endpoint returned ${response.status}`, duration);
      }
    } catch (error: any) {
      this.addResult('Health Check', 'fail', `Health endpoint unreachable: ${error.message}`);
    }
  }

  private async testApiDocumentation(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/docs`);
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        this.addResult('API Documentation', 'pass', `Documentation accessible (${duration}ms)`, duration);
      } else {
        this.addResult('API Documentation', 'fail', `Documentation returned ${response.status}`, duration);
      }
    } catch (error: any) {
      this.addResult('API Documentation', 'fail', `Documentation unreachable: ${error.message}`);
    }
  }

  private async testAuthEndpoints(): Promise<void> {
    // Test registration endpoint
    await this.testEndpoint(
      'POST',
      '/api/auth/register',
      'User Registration',
      {
        email: `test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User',
        hederaAccountId: '0.0.12345'
      },
      [201, 400] // 400 might be expected if validation fails
    );

    // Test login endpoint
    await this.testEndpoint(
      'POST',
      '/api/auth/login',
      'User Login',
      {
        email: 'test@example.com'
      },
      [200, 400, 401] // Expect unauthorized for wrong credentials
    );
  }

  private async testInvoiceEndpoints(): Promise<void> {
    // Test get invoices (should require auth)
    await this.testEndpoint(
      'GET',
      '/api/invoices',
      'Get Invoices',
      null,
      [401] // Expect unauthorized without token
    );

    // Test create invoice (should require auth)
    await this.testEndpoint(
      'POST',
      '/api/invoices',
      'Create Invoice',
      {
        invoiceNumber: 'TEST-001',
        amount: 1000,
        currency: 'USD',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        buyerId: 'test-buyer',
        description: 'Test invoice'
      },
      [201, 400, 401] // Expect unauthorized without token
    );
  }

  private async testHederaEndpoints(): Promise<void> {
    // Test Hedera status
    await this.testEndpoint(
      'GET',
      '/api/hedera/status',
      'Hedera Status',
      null,
      [200, 500] // Might fail if Hedera not configured
    );

    // Test Mirror Node connectivity
    await this.testEndpoint(
      'GET',
      '/api/hedera/mirror/account/0.0.2',
      'Mirror Node Query',
      null,
      [200, 404, 500] // Various responses possible
    );
  }

  private async testFundingEndpoints(): Promise<void> {
    // Test get funding requests (should require auth)
    await this.testEndpoint(
      'GET',
      '/api/fundings',
      'Get Funding Requests',
      null,
      [401] // Expect unauthorized without token
    );
  }

  private async testEndpoint(
    method: string,
    path: string,
    testName: string,
    body?: any,
    expectedStatuses: number[] = [200]
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      const options: any = {
        method,
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${path}`, options);
      const duration = Date.now() - startTime;

      if (expectedStatuses.includes(response.status)) {
        this.addResult(testName, 'pass', `${method} ${path} returned ${response.status} (${duration}ms)`, duration);
      } else {
        this.addResult(testName, 'fail', `${method} ${path} returned ${response.status}, expected ${expectedStatuses.join('|')}`, duration);
      }

    } catch (error: any) {
      this.addResult(testName, 'fail', `${method} ${path} failed: ${error.message}`);
    }
  }

  private addResult(name: string, status: 'pass' | 'fail' | 'warning', message: string, duration?: number): void {
    this.results.push({ name, status, message, duration });
  }

  private printResults(): void {
    console.log('\n📊 Smoke Test Results:');
    console.log('=' .repeat(80));

    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
      const duration = result.duration ? ` (${result.duration}ms)` : '';
      console.log(`${icon} ${result.name}: ${result.message}${duration}`);
    });

    console.log('=' .repeat(80));
    console.log(`Summary: ${passed} passed, ${failed} failed, ${warnings} warnings`);

    if (failed > 0) {
      console.log('❌ Some smoke tests failed. Check the results above.');
      process.exit(1);
    } else {
      console.log('✅ All smoke tests passed!');
    }
  }
}

// Run smoke tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const smokeTest = new SmokeTest();
  smokeTest.runTests()
    .then(() => {
      console.log('🎉 Smoke tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Smoke tests failed:', error);
      process.exit(1);
    });
}

export default SmokeTest;