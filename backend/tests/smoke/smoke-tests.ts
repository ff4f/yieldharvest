#!/usr/bin/env tsx

import axios, { AxiosResponse } from 'axios';
import { exit } from 'process';

interface SmokeTestResult {
  name: string;
  passed: boolean;
  error?: string;
  responseTime?: number;
}

class SmokeTestRunner {
  private baseUrl: string;
  private results: SmokeTestResult[] = [];
  private timeout: number = 10000; // 10 seconds

  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    console.log(`🔥 Running smoke tests against: ${this.baseUrl}`);
  }

  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      const responseTime = Date.now() - startTime;
      this.results.push({ name, passed: true, responseTime });
      console.log(`✅ ${name} (${responseTime}ms)`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.results.push({ name, passed: false, error: errorMessage, responseTime });
      console.log(`❌ ${name} (${responseTime}ms): ${errorMessage}`);
    }
  }

  async testHealthEndpoint(): Promise<void> {
    const response = await axios.get(`${this.baseUrl}/health/simple`, {
      timeout: this.timeout,
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (response.data.status !== 'healthy') {
      throw new Error(`Expected healthy status, got ${response.data.status}`);
    }
  }

  async testDetailedHealthEndpoint(): Promise<void> {
    const response = await axios.get(`${this.baseUrl}/health`, {
      timeout: this.timeout,
    });
    
    if (response.status !== 200 && response.status !== 503) {
      throw new Error(`Expected status 200 or 503, got ${response.status}`);
    }
    
    const requiredFields = ['status', 'timestamp', 'uptime', 'services'];
    for (const field of requiredFields) {
      if (!(field in response.data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Check critical services
    const services = response.data.services;
    if (!services.database || !services.hedera) {
      throw new Error('Missing critical service health information');
    }
  }

  async testSwaggerDocs(): Promise<void> {
    const response = await axios.get(`${this.baseUrl}/docs`, {
      timeout: this.timeout,
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.includes('swagger') && !response.data.includes('Swagger')) {
      throw new Error('Swagger documentation not found');
    }
  }

  async testApiRoutes(): Promise<void> {
    // Test that API routes are accessible (should return 401 for protected routes)
    const routes = [
      '/api/users',
      '/api/invoices',
      '/api/fundings',
      '/api/hedera',
      '/api/contracts'
    ];
    
    for (const route of routes) {
      try {
        const response = await axios.get(`${this.baseUrl}${route}`, {
          timeout: this.timeout,
          validateStatus: (status) => status < 500, // Accept any status < 500
        });
        
        // Routes should be accessible (even if they return 401/403)
        if (response.status >= 500) {
          throw new Error(`Route ${route} returned server error: ${response.status}`);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to ${route}`);
        }
        throw error;
      }
    }
  }

  async testCorsHeaders(): Promise<void> {
    const response = await axios.options(`${this.baseUrl}/health`, {
      timeout: this.timeout,
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      },
    });
    
    const corsHeader = response.headers['access-control-allow-origin'];
    if (!corsHeader) {
      throw new Error('CORS headers not configured');
    }
  }

  async testRateLimiting(): Promise<void> {
    // Make multiple rapid requests to test rate limiting
    const requests = Array(5).fill(null).map(() => 
      axios.get(`${this.baseUrl}/health/simple`, {
        timeout: this.timeout,
        validateStatus: (status) => status < 500,
      })
    );
    
    const responses = await Promise.all(requests);
    
    // All requests should succeed or be rate limited (429)
    for (const response of responses) {
      if (response.status !== 200 && response.status !== 429) {
        throw new Error(`Unexpected status during rate limit test: ${response.status}`);
      }
    }
  }

  async testSecurityHeaders(): Promise<void> {
    const response = await axios.get(`${this.baseUrl}/health`, {
      timeout: this.timeout,
    });
    
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection'
    ];
    
    for (const header of securityHeaders) {
      if (!response.headers[header]) {
        throw new Error(`Missing security header: ${header}`);
      }
    }
  }

  async testDatabaseConnectivity(): Promise<void> {
    const response = await axios.get(`${this.baseUrl}/health`, {
      timeout: this.timeout,
    });
    
    if (response.data.services?.database?.status !== 'healthy') {
      throw new Error(`Database not healthy: ${response.data.services?.database?.error || 'Unknown error'}`);
    }
  }

  async testHederaConnectivity(): Promise<void> {
    const response = await axios.get(`${this.baseUrl}/health`, {
      timeout: this.timeout,
    });
    
    if (response.data.services?.hedera?.status !== 'healthy') {
      throw new Error(`Hedera service not healthy: ${response.data.services?.hedera?.error || 'Unknown error'}`);
    }
  }

  async runAllTests(): Promise<void> {
    console.log('\n🚀 Starting smoke tests...\n');
    
    // Core functionality tests
    await this.runTest('Health endpoint', () => this.testHealthEndpoint());
    await this.runTest('Detailed health endpoint', () => this.testDetailedHealthEndpoint());
    await this.runTest('Swagger documentation', () => this.testSwaggerDocs());
    await this.runTest('API routes accessibility', () => this.testApiRoutes());
    
    // Security and configuration tests
    await this.runTest('CORS headers', () => this.testCorsHeaders());
    await this.runTest('Rate limiting', () => this.testRateLimiting());
    await this.runTest('Security headers', () => this.testSecurityHeaders());
    
    // Service connectivity tests
    await this.runTest('Database connectivity', () => this.testDatabaseConnectivity());
    await this.runTest('Hedera connectivity', () => this.testHederaConnectivity());
    
    this.printResults();
  }

  printResults(): void {
    console.log('\n📊 Smoke Test Results:');
    console.log('=' .repeat(50));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log(`Total tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    }
    
    const avgResponseTime = this.results
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) / this.results.length;
    
    console.log(`\nAverage response time: ${avgResponseTime.toFixed(2)}ms`);
    
    if (failed === 0) {
      console.log('\n🎉 All smoke tests passed!');
      exit(0);
    } else {
      console.log('\n💥 Some smoke tests failed!');
      exit(1);
    }
  }
}

// Run smoke tests
const runner = new SmokeTestRunner();
runner.runAllTests().catch((error) => {
  console.error('\n💥 Smoke test runner failed:', error.message);
  exit(1);
});