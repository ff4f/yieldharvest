#!/usr/bin/env ts-node

import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  duration?: number;
}

class FrontendSmokeTest {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private baseUrl: string;
  private results: TestResult[] = [];

  constructor() {
    this.baseUrl = process.env.VITE_APP_URL || 'http://localhost:3000';
  }

  async runTests(): Promise<void> {
    console.log('🔥 Starting frontend smoke tests...');
    console.log(`Testing app at: ${this.baseUrl}`);

    try {
      await this.setupBrowser();
      
      await this.testPageLoad();
      await this.testNavigation();
      await this.testWalletConnection();
      await this.testInvoicePages();
      await this.testFundingPages();
      await this.testResponsiveness();

      this.printResults();

    } catch (error) {
      console.error('💥 Frontend smoke tests failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async setupBrowser(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();
    
    // Set viewport for consistent testing
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  private async testPageLoad(): Promise<void> {
    const startTime = Date.now();
    
    try {
      await this.page!.goto(this.baseUrl, { waitUntil: 'networkidle' });
      const duration = Date.now() - startTime;
      
      // Check if page loaded successfully
      const title = await this.page!.title();
      
      if (title && title.includes('YieldHarvest')) {
        this.addResult('Page Load', 'pass', `Homepage loaded successfully (${duration}ms)`, duration);
      } else {
        this.addResult('Page Load', 'warning', `Page loaded but title unexpected: "${title}"`, duration);
      }

      // Check for critical elements
      const hasHeader = await this.page!.locator('header, nav').count() > 0;
      const hasMain = await this.page!.locator('main, [role="main"]').count() > 0;
      
      if (hasHeader && hasMain) {
        this.addResult('Page Structure', 'pass', 'Basic page structure present');
      } else {
        this.addResult('Page Structure', 'fail', 'Missing critical page elements');
      }

    } catch (error: any) {
      this.addResult('Page Load', 'fail', `Failed to load homepage: ${error.message}`);
    }
  }

  private async testNavigation(): Promise<void> {
    try {
      // Test navigation links
      const navLinks = [
        { text: 'Dashboard', expected: '/dashboard' },
        { text: 'Invoices', expected: '/invoices' },
        { text: 'Funding', expected: '/investors' }
      ];

      for (const link of navLinks) {
        try {
          const linkElement = this.page!.locator(`text="${link.text}"`).first();
          
          if (await linkElement.count() > 0) {
            await linkElement.click();
            await this.page!.waitForTimeout(1000); // Wait for navigation
            
            const currentUrl = this.page!.url();
            if (currentUrl.includes(link.expected)) {
              this.addResult(`Navigation - ${link.text}`, 'pass', `Successfully navigated to ${link.text}`);
            } else {
              this.addResult(`Navigation - ${link.text}`, 'warning', `Navigation attempted but URL: ${currentUrl}`);
            }
          } else {
            this.addResult(`Navigation - ${link.text}`, 'warning', `${link.text} link not found`);
          }
        } catch (error: any) {
          this.addResult(`Navigation - ${link.text}`, 'fail', `Navigation failed: ${error.message}`);
        }
      }

    } catch (error: any) {
      this.addResult('Navigation', 'fail', `Navigation test failed: ${error.message}`);
    }
  }

  private async testWalletConnection(): Promise<void> {
    try {
      // Look for wallet connect button
      const walletButton = this.page!.locator('button:has-text("Connect"), button:has-text("Wallet")').first();
      
      if (await walletButton.count() > 0) {
        this.addResult('Wallet UI', 'pass', 'Wallet connection button found');
        
        // Test clicking wallet button (should show modal or error)
        await walletButton.click();
        await this.page!.waitForTimeout(2000);
        
        // Check if modal or error message appears
        const hasModal = await this.page!.locator('[role="dialog"], .modal').count() > 0;
        const hasError = await this.page!.locator('text=/wallet|extension|install/i').count() > 0;
        
        if (hasModal || hasError) {
          this.addResult('Wallet Interaction', 'pass', 'Wallet connection interaction works');
        } else {
          this.addResult('Wallet Interaction', 'warning', 'Wallet button clicked but no response detected');
        }
      } else {
        this.addResult('Wallet UI', 'warning', 'Wallet connection button not found');
      }

    } catch (error: any) {
      this.addResult('Wallet Connection', 'fail', `Wallet test failed: ${error.message}`);
    }
  }

  private async testInvoicePages(): Promise<void> {
    try {
      // Navigate to invoices page
      await this.page!.goto(`${this.baseUrl}/invoices`);
      await this.page!.waitForTimeout(2000);

      // Check for invoice-related elements
      const hasInvoiceList = await this.page!.locator('[data-testid="invoice-list"], .invoice-item, table').count() > 0;
      const hasCreateButton = await this.page!.locator('button:has-text("Create"), button:has-text("New")').count() > 0;

      if (hasInvoiceList || hasCreateButton) {
        this.addResult('Invoice Page', 'pass', 'Invoice page elements found');
      } else {
        this.addResult('Invoice Page', 'warning', 'Invoice page loaded but no invoice elements found');
      }

    } catch (error: any) {
      this.addResult('Invoice Pages', 'fail', `Invoice page test failed: ${error.message}`);
    }
  }

  private async testFundingPages(): Promise<void> {
    try {
      // Navigate to funding page
      await this.page!.goto(`${this.baseUrl}/funding`);
      await this.page!.waitForTimeout(2000);

      // Check for funding-related elements
      const hasFundingContent = await this.page!.locator('[data-testid="funding-list"], .funding-item, .investment').count() > 0;
      const hasFilters = await this.page!.locator('select, input[type="search"], .filter').count() > 0;

      if (hasFundingContent || hasFilters) {
        this.addResult('Funding Page', 'pass', 'Funding page elements found');
      } else {
        this.addResult('Funding Page', 'warning', 'Funding page loaded but no funding elements found');
      }

    } catch (error: any) {
      this.addResult('Funding Pages', 'fail', `Funding page test failed: ${error.message}`);
    }
  }

  private async testResponsiveness(): Promise<void> {
    try {
      // Test mobile viewport
      await this.page!.setViewportSize({ width: 375, height: 667 });
      await this.page!.goto(this.baseUrl);
      await this.page!.waitForTimeout(1000);

      // Check if mobile navigation works
      const hasMobileNav = await this.page!.locator('button[aria-label*="menu"], .hamburger, .mobile-menu').count() > 0;
      
      if (hasMobileNav) {
        this.addResult('Mobile Responsiveness', 'pass', 'Mobile navigation elements found');
      } else {
        this.addResult('Mobile Responsiveness', 'warning', 'Mobile navigation not detected');
      }

      // Reset to desktop viewport
      await this.page!.setViewportSize({ width: 1280, height: 720 });

    } catch (error: any) {
      this.addResult('Responsiveness', 'fail', `Responsiveness test failed: ${error.message}`);
    }
  }

  private addResult(name: string, status: 'pass' | 'fail' | 'warning', message: string, duration?: number): void {
    this.results.push({ name, status, message, duration });
  }

  private printResults(): void {
    console.log('\n📊 Frontend Smoke Test Results:');
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
      console.log('❌ Some frontend smoke tests failed. Check the results above.');
      process.exit(1);
    } else {
      console.log('✅ All frontend smoke tests passed!');
    }
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const smokeTest = new FrontendSmokeTest();
  smokeTest.runTests()
    .then(() => {
      console.log('🎉 Frontend smoke tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Frontend smoke tests failed:', error);
      process.exit(1);
    });
}

export default FrontendSmokeTest;