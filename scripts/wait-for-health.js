#!/usr/bin/env node

const http = require('http');
const https = require('https');

/**
 * Health check utility for CI pipeline
 * Waits for services to be healthy before running E2E tests
 */

const DEFAULT_TIMEOUT = 300000; // 5 minutes
const DEFAULT_INTERVAL = 2000; // 2 seconds

class HealthChecker {
  constructor(options = {}) {
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.interval = options.interval || DEFAULT_INTERVAL;
    this.verbose = options.verbose || false;
  }

  log(message) {
    if (this.verbose) {
      console.log(`[HealthCheck] ${new Date().toISOString()} - ${message}`);
    }
  }

  async checkUrl(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      
      const req = client.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async waitForService(name, url, healthPath = '/health') {
    const fullUrl = `${url}${healthPath}`;
    const startTime = Date.now();
    
    this.log(`Waiting for ${name} at ${fullUrl}`);
    
    while (Date.now() - startTime < this.timeout) {
      try {
        const response = await this.checkUrl(fullUrl);
        
        // Check if response indicates healthy service
        if (response.data.includes('ok') || response.data.includes('healthy') || response.status === 200) {
          this.log(`✅ ${name} is healthy`);
          return true;
        }
        
        throw new Error(`Service not ready: ${response.data}`);
      } catch (error) {
        this.log(`❌ ${name} not ready: ${error.message}`);
        await this.sleep(this.interval);
      }
    }
    
    throw new Error(`Timeout waiting for ${name} after ${this.timeout}ms`);
  }

  async waitForMultipleServices(services) {
    const promises = services.map(service => 
      this.waitForService(service.name, service.url, service.healthPath)
    );
    
    try {
      await Promise.all(promises);
      this.log('✅ All services are healthy');
      return true;
    } catch (error) {
      this.log(`❌ Service health check failed: ${error.message}`);
      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node wait-for-health.js [options]

Options:
  --frontend-url <url>    Frontend service URL (default: http://localhost:5173)
  --backend-url <url>     Backend service URL (default: http://localhost:3001)
  --timeout <ms>          Timeout in milliseconds (default: 300000)
  --interval <ms>         Check interval in milliseconds (default: 2000)
  --verbose               Enable verbose logging
  --help, -h              Show this help message

Examples:
  node wait-for-health.js
  node wait-for-health.js --verbose --timeout 60000
  node wait-for-health.js --frontend-url http://localhost:3000 --backend-url http://localhost:4000
`);
    process.exit(0);
  }

  const frontendUrl = getArgValue(args, '--frontend-url') || process.env.FRONTEND_URL || 'http://localhost:5173';
  const backendUrl = getArgValue(args, '--backend-url') || process.env.BACKEND_URL || 'http://localhost:3001';
  const timeout = parseInt(getArgValue(args, '--timeout') || '300000');
  const interval = parseInt(getArgValue(args, '--interval') || '2000');
  const verbose = args.includes('--verbose');

  const checker = new HealthChecker({ timeout, interval, verbose });

  const services = [
    {
      name: 'Backend API',
      url: backendUrl,
      healthPath: '/health'
    },
    {
      name: 'Frontend',
      url: frontendUrl,
      healthPath: '/'
    }
  ];

  try {
    console.log('🔍 Starting health checks...');
    await checker.waitForMultipleServices(services);
    console.log('✅ All services are ready for E2E testing!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

// Export for programmatic use
module.exports = { HealthChecker };

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}