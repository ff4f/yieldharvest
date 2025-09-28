import { test, expect, Page, BrowserContext } from '@playwright/test';
import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  apiUrl: process.env.TEST_API_URL || 'http://localhost:3001',
  hederaOperatorId: process.env.HEDERA_OPERATOR_ID || '0.0.123456',
  hederaOperatorKey: process.env.HEDERA_OPERATOR_KEY || 'your-private-key',
  testTimeout: 60000,
  walletTimeout: 30000
};

// Test data
const TEST_INVOICE = {
  customerName: 'ABC Corporation',
  amount: '10000',
  currency: 'HBAR',
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  description: 'Software Development Services - Q4 2024',
  items: [
    {
      description: 'Frontend Development',
      quantity: 1,
      unitPrice: 6000,
      total: 6000
    },
    {
      description: 'Backend Development',
      quantity: 1,
      unitPrice: 4000,
      total: 4000
    }
  ]
};

const FUNDING_TERMS = {
  advanceRate: 80,
  feeRate: 3,
  fundingPeriod: 30
};

// Helper functions
class TestHelpers {
  static async waitForHederaTransaction(page: Page, timeout = 30000) {
    await page.waitForSelector('[data-testid="transaction-success"]', { timeout });
  }

  static async connectWallet(page: Page, walletType: 'hashpack' | 'blade' = 'hashpack') {
    await page.click('[data-testid="connect-wallet"]');
    await page.click(`[data-testid="connect-${walletType}"]`);
    
    // Wait for wallet connection popup and approve
    await page.waitForSelector('[data-testid="wallet-connected"]', { timeout: TEST_CONFIG.walletTimeout });
  }

  static async uploadTestFile(page: Page, fileName: string) {
    const testFilePath = path.join(__dirname, '../fixtures', fileName);
    
    // Create test PDF if it doesn't exist
    if (!fs.existsSync(testFilePath)) {
      const testPdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n178\n%%EOF');
      fs.writeFileSync(testFilePath, testPdfContent);
    }

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFilePath);
  }

  static async verifyOnChain(transactionId: string, type: 'nft' | 'file' | 'topic' | 'contract') {
    const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/transactions/${transactionId}`;
    
    const response = await fetch(mirrorNodeUrl);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.transactions).toBeDefined();
    expect(data.transactions.length).toBeGreaterThan(0);
    
    return data.transactions[0];
  }

  static async getInvoiceFromAPI(invoiceId: string) {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/api/invoices/${invoiceId}`);
    expect(response.status).toBe(200);
    return await response.json();
  }

  static async simulateCustomerPayment(invoiceId: string) {
    const response = await fetch(`${TEST_CONFIG.apiUrl}/api/admin/simulate-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId })
    });
    expect(response.status).toBe(200);
    return await response.json();
  }
}

// Test suite
test.describe('YieldHarvest E2E - Complete Invoice Lifecycle', () => {
  let context: BrowserContext;
  let supplierPage: Page;
  let investorPage: Page;
  let prisma: PrismaClient;
  let createdInvoiceId: string;
  let nftTokenId: string;
  let hfsFileId: string;
  let hcsTopicId: string;

  test.beforeAll(async ({ browser }) => {
    // Setup test environment
    context = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write']
    });
    
    supplierPage = await context.newPage();
    investorPage = await context.newPage();
    prisma = new PrismaClient();

    // Ensure test fixtures directory exists
    const fixturesDir = path.join(__dirname, '../fixtures');
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
  });

  test.afterAll(async () => {
    await context.close();
    await prisma.$disconnect();
  });

  test('Phase 1: Supplier creates invoice with NFT minting', async () => {
    // Navigate to application
    await supplierPage.goto(TEST_CONFIG.baseUrl);
    await supplierPage.waitForLoadState('networkidle');

    // Connect wallet as supplier
    await TestHelpers.connectWallet(supplierPage, 'hashpack');
    
    // Select supplier role
    await supplierPage.click('[data-testid="role-supplier"]');
    await expect(supplierPage.locator('[data-testid="supplier-dashboard"]')).toBeVisible();

    // Navigate to create invoice
    await supplierPage.click('[data-testid="create-invoice-btn"]');
    await expect(supplierPage.locator('[data-testid="invoice-form"]')).toBeVisible();

    // Fill invoice form
    await supplierPage.fill('[data-testid="customer-name"]', TEST_INVOICE.customerName);
    await supplierPage.fill('[data-testid="invoice-amount"]', TEST_INVOICE.amount);
    await supplierPage.selectOption('[data-testid="currency-select"]', TEST_INVOICE.currency);
    await supplierPage.fill('[data-testid="due-date"]', TEST_INVOICE.dueDate);
    await supplierPage.fill('[data-testid="description"]', TEST_INVOICE.description);

    // Add invoice items
    for (const item of TEST_INVOICE.items) {
      await supplierPage.click('[data-testid="add-item-btn"]');
      const itemRow = supplierPage.locator('[data-testid="invoice-item"]').last();
      await itemRow.locator('[data-testid="item-description"]').fill(item.description);
      await itemRow.locator('[data-testid="item-quantity"]').fill(item.quantity.toString());
      await itemRow.locator('[data-testid="item-unit-price"]').fill(item.unitPrice.toString());
    }

    // Upload invoice document
    await TestHelpers.uploadTestFile(supplierPage, 'test-invoice.pdf');
    await expect(supplierPage.locator('[data-testid="file-uploaded"]')).toBeVisible();

    // Submit invoice creation
    await supplierPage.click('[data-testid="submit-invoice"]');
    
    // Wait for Hedera transaction confirmation
    await TestHelpers.waitForHederaTransaction(supplierPage);
    
    // Verify success message and get invoice details
    await expect(supplierPage.locator('[data-testid="invoice-created-success"]')).toBeVisible();
    
    // Extract created invoice ID from URL or success message
    const invoiceIdElement = await supplierPage.locator('[data-testid="created-invoice-id"]');
    createdInvoiceId = await invoiceIdElement.textContent() || '';
    expect(createdInvoiceId).toBeTruthy();

    // Extract NFT token ID
    const nftElement = await supplierPage.locator('[data-testid="nft-token-id"]');
    nftTokenId = await nftElement.textContent() || '';
    expect(nftTokenId).toMatch(/^0\.0\.[0-9]+$/);

    // Extract HFS file ID
    const fileElement = await supplierPage.locator('[data-testid="hfs-file-id"]');
    hfsFileId = await fileElement.textContent() || '';
    expect(hfsFileId).toMatch(/^0\.0\.[0-9]+$/);

    // Extract HCS topic ID
    const topicElement = await supplierPage.locator('[data-testid="hcs-topic-id"]');
    hcsTopicId = await topicElement.textContent() || '';
    expect(hcsTopicId).toMatch(/^0\.0\.[0-9]+$/);

    // Verify HashScan links are available
    await expect(supplierPage.locator('[data-testid="hashscan-nft-link"]')).toBeVisible();
    await expect(supplierPage.locator('[data-testid="hashscan-file-link"]')).toBeVisible();
    await expect(supplierPage.locator('[data-testid="hashscan-topic-link"]')).toBeVisible();

    // Verify invoice appears in supplier dashboard
    await supplierPage.goto(`${TEST_CONFIG.baseUrl}/supplier/invoices`);
    await expect(supplierPage.locator(`[data-testid="invoice-${createdInvoiceId}"]`)).toBeVisible();
  });

  test('Phase 2: Supplier requests funding', async () => {
    // Navigate to invoice details
    await supplierPage.goto(`${TEST_CONFIG.baseUrl}/supplier/invoices/${createdInvoiceId}`);
    await expect(supplierPage.locator('[data-testid="invoice-details"]')).toBeVisible();

    // Click request funding
    await supplierPage.click('[data-testid="request-funding-btn"]');
    await expect(supplierPage.locator('[data-testid="funding-terms-form"]')).toBeVisible();

    // Set funding terms
    await supplierPage.fill('[data-testid="advance-rate"]', FUNDING_TERMS.advanceRate.toString());
    await supplierPage.fill('[data-testid="fee-rate"]', FUNDING_TERMS.feeRate.toString());
    await supplierPage.fill('[data-testid="funding-period"]', FUNDING_TERMS.fundingPeriod.toString());

    // Submit funding request
    await supplierPage.click('[data-testid="submit-funding-request"]');
    
    // Wait for transaction confirmation
    await TestHelpers.waitForHederaTransaction(supplierPage);
    
    // Verify funding request success
    await expect(supplierPage.locator('[data-testid="funding-requested-success"]')).toBeVisible();
    
    // Verify status change
    await expect(supplierPage.locator('[data-testid="invoice-status"]')).toContainText('Funding Requested');
    
    // Verify smart contract escrow creation
    const escrowElement = await supplierPage.locator('[data-testid="escrow-contract-id"]');
    const escrowContractId = await escrowElement.textContent() || '';
    expect(escrowContractId).toMatch(/^0\.0\.[0-9]+$/);
  });

  test('Phase 3: Investor provides funding', async () => {
    // Switch to investor page
    await investorPage.goto(TEST_CONFIG.baseUrl);
    await investorPage.waitForLoadState('networkidle');

    // Connect wallet as investor (different account)
    await TestHelpers.connectWallet(investorPage, 'hashpack');
    
    // Select investor role
    await investorPage.click('[data-testid="role-investor"]');
    await expect(investorPage.locator('[data-testid="investor-dashboard"]')).toBeVisible();

    // Navigate to investment opportunities
    await investorPage.click('[data-testid="investment-opportunities-btn"]');
    await expect(investorPage.locator('[data-testid="available-invoices"]')).toBeVisible();

    // Find and select the created invoice
    const invoiceCard = investorPage.locator(`[data-testid="invoice-card-${createdInvoiceId}"]`);
    await expect(invoiceCard).toBeVisible();
    await invoiceCard.click();

    // Review invoice details
    await expect(investorPage.locator('[data-testid="investment-details"]')).toBeVisible();
    await expect(investorPage.locator('[data-testid="invoice-amount"]')).toContainText(TEST_INVOICE.amount);
    await expect(investorPage.locator('[data-testid="advance-rate"]')).toContainText(FUNDING_TERMS.advanceRate.toString());

    // Provide funding
    await investorPage.click('[data-testid="fund-invoice-btn"]');
    
    // Confirm funding terms
    await expect(investorPage.locator('[data-testid="funding-confirmation"]')).toBeVisible();
    await investorPage.click('[data-testid="confirm-funding"]');
    
    // Wait for transaction confirmation
    await TestHelpers.waitForHederaTransaction(investorPage);
    
    // Verify funding success
    await expect(investorPage.locator('[data-testid="funding-success"]')).toBeVisible();
    
    // Verify investment appears in investor portfolio
    await investorPage.goto(`${TEST_CONFIG.baseUrl}/investor/portfolio`);
    await expect(investorPage.locator(`[data-testid="investment-${createdInvoiceId}"]`)).toBeVisible();
  });

  test('Phase 4: Payment processing and settlement', async () => {
    // Simulate customer payment (admin function)
    const paymentResult = await TestHelpers.simulateCustomerPayment(createdInvoiceId);
    expect(paymentResult.success).toBe(true);

    // Wait for payment processing
    await supplierPage.waitForTimeout(5000);

    // Check supplier page for payment notification
    await supplierPage.goto(`${TEST_CONFIG.baseUrl}/supplier/invoices/${createdInvoiceId}`);
    await supplierPage.reload();
    
    // Verify invoice status updated to paid
    await expect(supplierPage.locator('[data-testid="invoice-status"]')).toContainText('Paid', { timeout: 30000 });
    
    // Verify payment distribution details
    await expect(supplierPage.locator('[data-testid="payment-received"]')).toBeVisible();
    await expect(supplierPage.locator('[data-testid="settlement-details"]')).toBeVisible();

    // Check investor page for returns
    await investorPage.goto(`${TEST_CONFIG.baseUrl}/investor/portfolio`);
    await investorPage.reload();
    
    // Verify investment completed with returns
    const investmentCard = investorPage.locator(`[data-testid="investment-${createdInvoiceId}"]`);
    await expect(investmentCard.locator('[data-testid="investment-status"]')).toContainText('Completed');
    await expect(investmentCard.locator('[data-testid="returns-received"]')).toBeVisible();
  });

  test('Phase 5: On-chain verification and audit trail', async () => {
    // Verify all data is available via API
    const invoiceData = await TestHelpers.getInvoiceFromAPI(createdInvoiceId);
    expect(invoiceData.id).toBe(createdInvoiceId);
    expect(invoiceData.nftTokenId).toBe(nftTokenId);
    expect(invoiceData.hfsFileId).toBe(hfsFileId);
    expect(invoiceData.status).toBe('PAID');

    // Verify Mirror Node data availability
    const mirrorNodeUrl = `https://testnet.mirrornode.hedera.com/api/v1/tokens/${nftTokenId}`;
    const nftResponse = await fetch(mirrorNodeUrl);
    expect(nftResponse.status).toBe(200);
    
    const nftData = await nftResponse.json();
    expect(nftData.token_id).toBe(nftTokenId);
    expect(nftData.type).toBe('NON_FUNGIBLE_UNIQUE');

    // Verify HCS messages
    const hcsUrl = `https://testnet.mirrornode.hedera.com/api/v1/topics/${hcsTopicId}/messages`;
    const hcsResponse = await fetch(hcsUrl);
    expect(hcsResponse.status).toBe(200);
    
    const hcsData = await hcsResponse.json();
    expect(hcsData.messages.length).toBeGreaterThan(0);
    
    // Verify all lifecycle events are logged
    const eventTypes = hcsData.messages.map((msg: any) => {
      const decoded = Buffer.from(msg.message, 'base64').toString();
      return JSON.parse(decoded).eventType;
    });
    
    expect(eventTypes).toContain('INVOICE_CREATED');
    expect(eventTypes).toContain('FUNDING_REQUESTED');
    expect(eventTypes).toContain('FUNDING_PROVIDED');
    expect(eventTypes).toContain('PAYMENT_RECEIVED');
    expect(eventTypes).toContain('SETTLEMENT_COMPLETED');
  });

  test('Phase 6: Error handling and recovery', async () => {
    // Test wallet disconnection handling
    await supplierPage.goto(TEST_CONFIG.baseUrl);
    
    // Simulate wallet disconnection
    await supplierPage.evaluate(() => {
      // Simulate wallet disconnection
      window.dispatchEvent(new CustomEvent('wallet-disconnected'));
    });
    
    // Verify graceful handling
    await expect(supplierPage.locator('[data-testid="wallet-disconnected-notice"]')).toBeVisible();
    await expect(supplierPage.locator('[data-testid="connect-wallet"]')).toBeVisible();

    // Test transaction failure handling
    await TestHelpers.connectWallet(supplierPage);
    await supplierPage.goto(`${TEST_CONFIG.baseUrl}/supplier/invoices/create`);
    
    // Fill form with invalid data
    await supplierPage.fill('[data-testid="invoice-amount"]', '-1000');
    await supplierPage.click('[data-testid="submit-invoice"]');
    
    // Verify error handling
    await expect(supplierPage.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(supplierPage.locator('[data-testid="amount-error"]')).toContainText('must be positive');
  });

  test('Phase 7: Performance and responsiveness', async () => {
    // Test page load performance
    const startTime = Date.now();
    await supplierPage.goto(TEST_CONFIG.baseUrl);
    await supplierPage.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(5000); // Page should load within 5 seconds

    // Test mobile responsiveness
    await supplierPage.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await expect(supplierPage.locator('[data-testid="mobile-menu"]')).toBeVisible();
    
    // Test tablet responsiveness
    await supplierPage.setViewportSize({ width: 768, height: 1024 }); // iPad
    await expect(supplierPage.locator('[data-testid="tablet-layout"]')).toBeVisible();
    
    // Reset to desktop
    await supplierPage.setViewportSize({ width: 1920, height: 1080 });
  });
});

// Additional test suites for specific scenarios
test.describe('YieldHarvest E2E - Edge Cases', () => {
  test('Large file upload handling', async ({ page }) => {
    // Test with maximum allowed file size
    await page.goto(TEST_CONFIG.baseUrl);
    await TestHelpers.connectWallet(page);
    
    // Create large test file (just under limit)
    const largeFilePath = path.join(__dirname, '../fixtures/large-invoice.pdf');
    const largeFileContent = Buffer.alloc(10 * 1024 * 1024 - 1000); // ~10MB
    fs.writeFileSync(largeFilePath, largeFileContent);
    
    await page.goto(`${TEST_CONFIG.baseUrl}/supplier/invoices/create`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(largeFilePath);
    
    // Should show upload progress
    await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-uploaded"]')).toBeVisible({ timeout: 30000 });
    
    // Cleanup
    fs.unlinkSync(largeFilePath);
  });

  test('Concurrent user operations', async ({ browser }) => {
    // Test multiple users creating invoices simultaneously
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ]);
    
    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    
    // All users create invoices simultaneously
    const createInvoicePromises = pages.map(async (page, index) => {
      await page.goto(TEST_CONFIG.baseUrl);
      await TestHelpers.connectWallet(page);
      await page.click('[data-testid="role-supplier"]');
      await page.click('[data-testid="create-invoice-btn"]');
      
      await page.fill('[data-testid="customer-name"]', `Customer ${index + 1}`);
      await page.fill('[data-testid="invoice-amount"]', `${(index + 1) * 1000}`);
      await page.fill('[data-testid="due-date"]', TEST_INVOICE.dueDate);
      await page.fill('[data-testid="description"]', `Test Invoice ${index + 1}`);
      
      await TestHelpers.uploadTestFile(page, 'test-invoice.pdf');
      await page.click('[data-testid="submit-invoice"]');
      
      return TestHelpers.waitForHederaTransaction(page);
    });
    
    // All should complete successfully
    await Promise.all(createInvoicePromises);
    
    // Cleanup
    await Promise.all(contexts.map(ctx => ctx.close()));
  });

  test('Network interruption recovery', async ({ page }) => {
    await page.goto(TEST_CONFIG.baseUrl);
    await TestHelpers.connectWallet(page);
    
    // Simulate network interruption during transaction
    await page.route('**/api/**', route => {
      // Simulate network timeout
      setTimeout(() => route.continue(), 5000);
    });
    
    await page.click('[data-testid="role-supplier"]');
    await page.click('[data-testid="create-invoice-btn"]');
    
    // Should show loading state and retry mechanism
    await expect(page.locator('[data-testid="transaction-pending"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-transaction"]')).toBeVisible({ timeout: 10000 });
  });
});