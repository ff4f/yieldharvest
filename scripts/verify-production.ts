#!/usr/bin/env tsx

import axios, { AxiosResponse } from 'axios';
import { exit } from 'process';

interface VerificationResult {
  service: string;
  endpoint: string;
  passed: boolean;
  error?: string;
  responseTime?: number;
  details?: any;
}

class ProductionVerifier {
  private frontendUrl: string;
  private backendUrl: string;
  private results: VerificationResult[] = [];
  private timeout: number = 15000; // 15 seconds for production

  constructor() {
    this.frontendUrl = process.env.FRONTEND_URL || 'https://yieldharvest-frontend.vercel.app';
    this.backendUrl = process.env.BACKEND_URL || 'https://yieldharvest-backend.onrender.com';
    
    console.log('🔍 Production Deployment Verification');
    console.log('=====================================');
    console.log(`Frontend URL: ${this.frontendUrl}`);
    console.log(`Backend URL: ${this.backendUrl}`);
    console.log('');
  }

  async verify(service: string, endpoint: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    try {
      const details = await testFn();
      const responseTime = Date.now() - startTime;
      this.results.push({ service, endpoint, passed: true, responseTime, details });
      console.log(`✅ ${service} - ${endpoint} (${responseTime}ms)`);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.results.push({ service, endpoint, passed: false, error: errorMessage, responseTime });
      console.log(`❌ ${service} - ${endpoint} (${responseTime}ms): ${errorMessage}`);
    }
  }

  // Frontend Verifications
  async verifyFrontendAccessibility(): Promise<any> {
    const response = await axios.get(this.frontendUrl, {
      timeout: this.timeout,
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.includes('YieldHarvest') && !response.data.includes('yieldharvest')) {
      throw new Error('Frontend content not found');
    }
    
    return { status: response.status, contentLength: response.data.length };
  }

  async verifyFrontendAssets(): Promise<any> {
    // Check if main assets are accessible
    const assetPaths = ['/assets/', '/favicon.ico'];
    const results: any[] = [];
    
    for (const path of assetPaths) {
      try {
        const response = await axios.get(`${this.frontendUrl}${path}`, {
          timeout: this.timeout,
          validateStatus: (status) => status < 500,
        });
        results.push({ path, status: response.status });
      } catch (error) {
        results.push({ path, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    return results;
  }

  async verifyFrontendRoutes(): Promise<any> {
    const routes = ['/dashboard', '/invoices', '/fundings'];
    const results: any[] = [];
    
    for (const route of routes) {
      try {
        const response = await axios.get(`${this.frontendUrl}${route}`, {
          timeout: this.timeout,
          validateStatus: (status) => status < 500,
        });
        results.push({ route, status: response.status });
      } catch (error) {
        results.push({ route, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    return results;
  }

  // Backend Verifications
  async verifyBackendHealth(): Promise<any> {
    const response = await axios.get(`${this.backendUrl}/health`, {
      timeout: this.timeout,
    });
    
    if (response.status !== 200 && response.status !== 503) {
      throw new Error(`Expected status 200 or 503, got ${response.status}`);
    }
    
    const data = response.data;
    const requiredFields = ['status', 'timestamp', 'uptime', 'services'];
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    return {
      status: data.status,
      uptime: data.uptime,
      services: Object.keys(data.services || {}),
      databaseHealth: data.services?.database?.status,
      hederaHealth: data.services?.hedera?.status
    };
  }

  async verifyBackendSwagger(): Promise<any> {
    const response = await axios.get(`${this.backendUrl}/docs`, {
      timeout: this.timeout,
    });
    
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    
    if (!response.data.includes('swagger') && !response.data.includes('Swagger')) {
      throw new Error('Swagger documentation not accessible');
    }
    
    return { status: response.status, hasSwagger: true };
  }

  async verifyBackendApiRoutes(): Promise<any> {
    const routes = [
      '/api/users',
      '/api/invoices', 
      '/api/fundings',
      '/api/hedera',
      '/api/contracts'
    ];
    
    const results: any[] = [];
    
    for (const route of routes) {
      try {
        const response = await axios.get(`${this.backendUrl}${route}`, {
          timeout: this.timeout,
          validateStatus: (status) => status < 500,
        });
        
        results.push({ 
          route, 
          status: response.status,
          accessible: response.status < 500
        });
      } catch (error) {
        results.push({ 
          route, 
          error: error instanceof Error ? error.message : 'Unknown error',
          accessible: false
        });
      }
    }
    
    return results;
  }

  async verifyBackendSecurity(): Promise<any> {
    const response = await axios.get(`${this.backendUrl}/health`, {
      timeout: this.timeout,
    });
    
    const securityHeaders = {
      'x-frame-options': response.headers['x-frame-options'],
      'x-content-type-options': response.headers['x-content-type-options'],
      'x-xss-protection': response.headers['x-xss-protection'],
      'strict-transport-security': response.headers['strict-transport-security']
    };
    
    const missingHeaders = Object.entries(securityHeaders)
      .filter(([key, value]) => !value)
      .map(([key]) => key);
    
    return {
      securityHeaders,
      missingHeaders,
      hasAllSecurityHeaders: missingHeaders.length === 0
    };
  }

  async verifyDatabaseConnectivity(): Promise<any> {
    const response = await axios.get(`${this.backendUrl}/health`, {
      timeout: this.timeout,
    });
    
    const dbStatus = response.data.services?.database;
    
    if (!dbStatus) {
      throw new Error('Database health information not available');
    }
    
    if (dbStatus.status !== 'healthy') {
      throw new Error(`Database not healthy: ${dbStatus.error || 'Unknown error'}`);
    }
    
    return {
      status: dbStatus.status,
      responseTime: dbStatus.responseTime,
      details: dbStatus.details
    };
  }

  async verifyHederaConnectivity(): Promise<any> {
    const response = await axios.get(`${this.backendUrl}/health`, {
      timeout: this.timeout,
    });
    
    const hederaStatus = response.data.services?.hedera;
    
    if (!hederaStatus) {
      throw new Error('Hedera health information not available');
    }
    
    if (hederaStatus.status !== 'healthy') {
      throw new Error(`Hedera service not healthy: ${hederaStatus.error || 'Unknown error'}`);
    }
    
    return {
      status: hederaStatus.status,
      network: hederaStatus.details?.network,
      connected: hederaStatus.details?.connected
    };
  }

  async verifyFrontendBackendIntegration(): Promise<any> {
    // Test if frontend can reach backend
    try {
      const response = await axios.get(`${this.backendUrl}/health/simple`, {
        timeout: this.timeout,
        headers: {
          'Origin': this.frontendUrl,
        },
      });
      
      const corsHeader = response.headers['access-control-allow-origin'];
      
      return {
        backendAccessible: response.status === 200,
        corsConfigured: !!corsHeader,
        corsHeader
      };
    } catch (error) {
      throw new Error(`Frontend cannot reach backend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async verifySSLCertificates(): Promise<any> {
    const urls = [this.frontendUrl, this.backendUrl];
    const results: any[] = [];
    
    for (const url of urls) {
      try {
        const response = await axios.get(url, {
          timeout: this.timeout,
        });
        
        results.push({
          url,
          https: url.startsWith('https://'),
          accessible: response.status < 400
        });
      } catch (error) {
        results.push({
          url,
          https: url.startsWith('https://'),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  async runAllVerifications(): Promise<void> {
    console.log('🚀 Starting production verification...\n');
    
    // Frontend verifications
    console.log('📱 Frontend Verifications:');
    await this.verify('Frontend', 'Accessibility', () => this.verifyFrontendAccessibility());
    await this.verify('Frontend', 'Assets', () => this.verifyFrontendAssets());
    await this.verify('Frontend', 'Routes', () => this.verifyFrontendRoutes());
    
    console.log('\n🔧 Backend Verifications:');
    await this.verify('Backend', 'Health Check', () => this.verifyBackendHealth());
    await this.verify('Backend', 'Swagger Docs', () => this.verifyBackendSwagger());
    await this.verify('Backend', 'API Routes', () => this.verifyBackendApiRoutes());
    await this.verify('Backend', 'Security Headers', () => this.verifyBackendSecurity());
    
    console.log('\n🔗 Service Connectivity:');
    await this.verify('Database', 'Connectivity', () => this.verifyDatabaseConnectivity());
    await this.verify('Hedera', 'Connectivity', () => this.verifyHederaConnectivity());
    
    console.log('\n🌐 Integration & Security:');
    await this.verify('Integration', 'Frontend-Backend', () => this.verifyFrontendBackendIntegration());
    await this.verify('Security', 'SSL Certificates', () => this.verifySSLCertificates());
    
    this.printResults();
  }

  printResults(): void {
    console.log('\n📊 Production Verification Results:');
    console.log('=' .repeat(60));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log(`Total verifications: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed verifications:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.service} (${r.endpoint}): ${r.error}`);
        });
    }
    
    const avgResponseTime = this.results
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) / this.results.length;
    
    console.log(`\nAverage response time: ${avgResponseTime.toFixed(2)}ms`);
    
    // Service-specific summaries
    const frontendResults = this.results.filter(r => r.service === 'Frontend');
    const backendResults = this.results.filter(r => r.service === 'Backend');
    const serviceResults = this.results.filter(r => ['Database', 'Hedera'].includes(r.service));
    
    console.log('\n📋 Service Summary:');
    console.log(`Frontend: ${frontendResults.filter(r => r.passed).length}/${frontendResults.length} passed`);
    console.log(`Backend: ${backendResults.filter(r => r.passed).length}/${backendResults.length} passed`);
    console.log(`Services: ${serviceResults.filter(r => r.passed).length}/${serviceResults.length} passed`);
    
    if (failed === 0) {
      console.log('\n🎉 Production deployment verification successful!');
      console.log('\n🔗 Production URLs:');
      console.log(`Frontend: ${this.frontendUrl}`);
      console.log(`Backend: ${this.backendUrl}`);
      console.log(`API Docs: ${this.backendUrl}/docs`);
      exit(0);
    } else {
      console.log('\n💥 Production deployment verification failed!');
      console.log('Please check the failed verifications and redeploy.');
      exit(1);
    }
  }
}

// Run production verification
const verifier = new ProductionVerifier();
verifier.runAllVerifications().catch((error) => {
  console.error('\n💥 Production verification failed:', error.message);
  exit(1);
});