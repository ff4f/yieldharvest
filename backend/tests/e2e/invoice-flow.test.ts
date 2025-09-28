import { test, expect, Page, BrowserContext } from '@playwright/test';
import { chromium } from 'playwright';

// Test configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';

// Test data
const testInvoice = {
  buyerName: 'Test Buyer Corp',
  buyerEmail: 'buyer@testcorp.com',
  amount: 10000,
  dueDate: '2024-12-31',
  description: 'Test invoice for E2E testing',
  items: [
    {
      description: 'Test Product 1',
      quantity: 2,
      unitPrice: 3000,
      total: 6000
    },
    {
      description: 'Test Service 1',
      quantity: 1,
      unitPrice: 4000,
      total: 4000
    }
  ]
};

const testUser = {
  email: 'supplier@test.com',
  password: 'TestPassword123!',
  name: 'Test Supplier',
  role: 'supplier'
};

const testInvestor = {
  email: 'investor@test.com',
  password: 'TestPassword123!',
  name: 'Test Investor',
  role: 'investor'
};

test.describe('YieldHarvest E2E - Complete Invoice Lifecycle', () => {
  let context: BrowserContext;
  let supplierPage: Page;
  let investorPage: Page;
  let invoiceId: string;
  let transactionId: string;

  test.beforeAll(async () => {
    const browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    
    // Create two pages for supplier and investor
    supplierPage = await context.newPage();
    investorPage = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Complete invoice lifecycle from creation to payment', async () => {
    // Step 1: Supplier creates account and connects wallet
    await test.step('Supplier registration and wallet connection', async () => {
      await supplierPage.goto(FRONTEND_URL);
      
      // Navigate to registration
      await supplierPage.click('[data-testid="register-link"]');
      
      // Fill registration form
      await supplierPage.fill('[data-testid="name-input"]', testUser.name);
      await supplierPage.fill('[data-testid="email-input"]', testUser.email);
      await supplierPage.fill('[data-testid="password-input"]', testUser.password);
      await supplierPage.selectOption('[data-testid="role-select"]', testUser.role);
      
      // Submit registration
      await supplierPage.click('[data-testid="register-button"]');
      
      // Wait for redirect to dashboard
      await supplierPage.waitForURL('**/dashboard');
      
      // Connect wallet (mock HashPack connection)
      await supplierPage.click('[data-testid="connect-wallet-button"]');
      
      // Wait for wallet connection confirmation
      await expect(supplierPage.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });

    // Step 2: Create invoice with PDF upload
    await test.step('Create invoice with document upload', async () => {
      // Navigate to create invoice
      await supplierPage.click('[data-testid="create-invoice-link"]');
      
      // Fill invoice form
      await supplierPage.fill('[data-testid="buyer-name"]', testInvoice.buyerName);
      await supplierPage.fill('[data-testid="buyer-email"]', testInvoice.buyerEmail);
      await supplierPage.fill('[data-testid="amount"]', testInvoice.amount.toString());
      await supplierPage.fill('[data-testid="due-date"]', testInvoice.dueDate);
      await supplierPage.fill('[data-testid="description"]', testInvoice.description);
      
      // Add invoice items
      for (const item of testInvoice.items) {
        await supplierPage.click('[data-testid="add-item-button"]');
        const itemRow = supplierPage.locator('[data-testid="invoice-item"]').last();
        await itemRow.locator('[data-testid="item-description"]').fill(item.description);
        await itemRow.locator('[data-testid="item-quantity"]').fill(item.quantity.toString());
        await itemRow.locator('[data-testid="item-unit-price"]').fill(item.unitPrice.toString());
      }
      
      // Upload PDF document
      const fileInput = supplierPage.locator('[data-testid="pdf-upload"]');
      await fileInput.setInputFiles({
        name: 'test-invoice.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 Test invoice content')
      });
      
      // Submit invoice creation
      await supplierPage.click('[data-testid="create-invoice-button"]');
      
      // Wait for success message and capture invoice ID
      await expect(supplierPage.locator('[data-testid="success-message"]')).toBeVisible();
      
      // Extract invoice ID from URL or success message
      const url = supplierPage.url();
      invoiceId = url.split('/').pop() || '';
      
      // Verify Hedera proofs are displayed
      await expect(supplierPage.locator('[data-testid="nft-transaction-link"]')).toBeVisible();
      await expect(supplierPage.locator('[data-testid="file-id-link"]')).toBeVisible();
      await expect(supplierPage.locator('[data-testid="topic-sequence-link"]')).toBeVisible();
    });

    // Step 3: Verify invoice appears in dashboard
    await test.step('Verify invoice in supplier dashboard', async () => {
      await supplierPage.goto(`${FRONTEND_URL}/dashboard`);
      
      // Check invoice appears in list
      const invoiceRow = supplierPage.locator(`[data-testid="invoice-${invoiceId}"]`);
      await expect(invoiceRow).toBeVisible();
      await expect(invoiceRow.locator('[data-testid="invoice-status"]')).toHaveText('issued');
      await expect(invoiceRow.locator('[data-testid="invoice-amount"]')).toHaveText('$10,000.00');
    });

    // Step 4: Investor registration and wallet connection
    await test.step('Investor registration and wallet connection', async () => {
      await investorPage.goto(FRONTEND_URL);
      
      // Register investor account
      await investorPage.click('[data-testid="register-link"]');
      await investorPage.fill('[data-testid="name-input"]', testInvestor.name);
      await investorPage.fill('[data-testid="email-input"]', testInvestor.email);
      await investorPage.fill('[data-testid="password-input"]', testInvestor.password);
      await investorPage.selectOption('[data-testid="role-select"]', testInvestor.role);
      await investorPage.click('[data-testid="register-button"]');
      
      // Connect wallet
      await investorPage.waitForURL('**/dashboard');
      await investorPage.click('[data-testid="connect-wallet-button"]');
      await expect(investorPage.locator('[data-testid="wallet-connected"]')).toBeVisible();
    });

    // Step 5: Investor views and funds invoice
    await test.step('Investor funds invoice', async () => {
      // Navigate to marketplace
      await investorPage.click('[data-testid="marketplace-link"]');
      
      // Find and view the created invoice
      const invoiceCard = investorPage.locator(`[data-testid="marketplace-invoice-${invoiceId}"]`);
      await expect(invoiceCard).toBeVisible();
      await invoiceCard.click();
      
      // Review invoice details
      await expect(investorPage.locator('[data-testid="invoice-buyer"]')).toHaveText(testInvoice.buyerName);
      await expect(investorPage.locator('[data-testid="invoice-amount"]')).toHaveText('$10,000.00');
      
      // View PDF document
      await investorPage.click('[data-testid="view-document-button"]');
      await expect(investorPage.locator('[data-testid="pdf-viewer"]')).toBeVisible();
      
      // Fund the invoice
      await investorPage.click('[data-testid="fund-invoice-button"]');
      
      // Confirm funding transaction
      await investorPage.click('[data-testid="confirm-funding-button"]');
      
      // Wait for funding success
      await expect(investorPage.locator('[data-testid="funding-success"]')).toBeVisible();
      
      // Capture transaction ID
      const txElement = investorPage.locator('[data-testid="funding-transaction-id"]');
      transactionId = await txElement.textContent() || '';
    });

    // Step 6: Verify funding status updates
    await test.step('Verify invoice status updates', async () => {
      // Check supplier dashboard shows funded status
      await supplierPage.goto(`${FRONTEND_URL}/dashboard`);
      const invoiceRow = supplierPage.locator(`[data-testid="invoice-${invoiceId}"]`);
      await expect(invoiceRow.locator('[data-testid="invoice-status"]')).toHaveText('funded');
      
      // Check investor dashboard shows investment
      await investorPage.goto(`${FRONTEND_URL}/dashboard`);
      const investmentRow = investorPage.locator(`[data-testid="investment-${invoiceId}"]`);
      await expect(investmentRow).toBeVisible();
      await expect(investmentRow.locator('[data-testid="investment-status"]')).toHaveText('active');
    });

    // Step 7: Simulate buyer payment
    await test.step('Simulate buyer payment', async () => {
      // This would typically be done by the buyer, but we'll simulate it via API
      const response = await supplierPage.request.post(`${BACKEND_URL}/api/invoices/${invoiceId}/payment`, {
        data: {
          paymentAmount: testInvoice.amount,
          paymentMethod: 'bank_transfer',
          paymentReference: 'TEST_PAYMENT_REF_123'
        }
      });
      
      expect(response.ok()).toBeTruthy();
    });

    // Step 8: Verify payment completion and profit distribution
    await test.step('Verify payment completion and profit distribution', async () => {
      // Refresh supplier dashboard
      await supplierPage.reload();
      const invoiceRow = supplierPage.locator(`[data-testid="invoice-${invoiceId}"]`);
      await expect(invoiceRow.locator('[data-testid="invoice-status"]')).toHaveText('paid');
      
      // Check investor dashboard shows completed investment
      await investorPage.reload();
      const investmentRow = investorPage.locator(`[data-testid="investment-${invoiceId}"]`);
      await expect(investmentRow.locator('[data-testid="investment-status"]')).toHaveText('completed');
      
      // Verify profit calculation
      const profitElement = investmentRow.locator('[data-testid="investment-profit"]');
      await expect(profitElement).toBeVisible();
      
      // Check that all Hedera transactions are recorded
      await investorPage.click(`[data-testid="view-investment-${invoiceId}"]`);
      await expect(investorPage.locator('[data-testid="hedera-proofs"]')).toBeVisible();
      await expect(investorPage.locator('[data-testid="all-transactions-link"]')).toBeVisible();
    });

    // Step 9: Verify Mirror Node data consistency
    await test.step('Verify Mirror Node data consistency', async () => {
      // Check that invoice data can be retrieved from Mirror Node
      const response = await supplierPage.request.get(`${BACKEND_URL}/api/invoices/${invoiceId}/mirror-data`);
      expect(response.ok()).toBeTruthy();
      
      const mirrorData = await response.json();
      expect(mirrorData.nftData).toBeDefined();
      expect(mirrorData.fileData).toBeDefined();
      expect(mirrorData.topicMessages).toBeDefined();
      expect(mirrorData.topicMessages.length).toBeGreaterThan(0);
    });

    // Step 10: Verify HashScan links work
    await test.step('Verify HashScan integration', async () => {
      await supplierPage.goto(`${FRONTEND_URL}/invoices/${invoiceId}`);
      
      // Click on HashScan links and verify they open
      const nftLink = supplierPage.locator('[data-testid="nft-hashscan-link"]');
      await expect(nftLink).toHaveAttribute('href', /hashscan\.io/);
      
      const fileLink = supplierPage.locator('[data-testid="file-hashscan-link"]');
      await expect(fileLink).toHaveAttribute('href', /hashscan\.io/);
      
      const topicLink = supplierPage.locator('[data-testid="topic-hashscan-link"]');
      await expect(topicLink).toHaveAttribute('href', /hashscan\.io/);
    });
  });

  test('Error handling and edge cases', async () => {
    await test.step('Test invalid invoice creation', async () => {
      await supplierPage.goto(`${FRONTEND_URL}/create-invoice`);
      
      // Try to submit empty form
      await supplierPage.click('[data-testid="create-invoice-button"]');
      
      // Verify validation errors
      await expect(supplierPage.locator('[data-testid="validation-error"]')).toBeVisible();
    });

    await test.step('Test wallet disconnection handling', async () => {
      // Disconnect wallet
      await supplierPage.click('[data-testid="disconnect-wallet-button"]');
      
      // Try to create invoice without wallet
      await supplierPage.goto(`${FRONTEND_URL}/create-invoice`);
      await expect(supplierPage.locator('[data-testid="wallet-required-message"]')).toBeVisible();
    });

    await test.step('Test network error handling', async () => {
      // Mock network failure
      await supplierPage.route('**/api/**', route => route.abort());
      
      await supplierPage.goto(`${FRONTEND_URL}/dashboard`);
      await expect(supplierPage.locator('[data-testid="network-error"]')).toBeVisible();
    });
  });
});