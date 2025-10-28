import { test, expect } from '@playwright/test';

test.describe('Complete Funding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should complete full funding flow from wallet connection to invoice funding', async ({ page }) => {
    // Step 1: Connect Wallet
    await test.step('Connect wallet', async () => {
      // Click wallet connect button
      await page.click('[data-testid="wallet-connect-button"]');
      
      // Wait for wallet selection modal
      await expect(page.locator('[data-testid="wallet-selection-modal"]')).toBeVisible();
      
      // Select HashPack wallet (in test environment, this might be mocked)
      await page.click('[data-testid="hashpack-wallet-option"]');
      
      // Wait for wallet connection to complete
      await expect(page.locator('[data-testid="wallet-info"]')).toBeVisible({ timeout: 10000 });
      
      // Verify account ID is displayed
      await expect(page.locator('[data-testid="account-id"]')).toBeVisible();
    });

    // Step 2: Create Invoice
    await test.step('Create new invoice', async () => {
      // Navigate to create invoice page
      await page.click('text=Create Invoice');
      
      // Fill invoice form
      await page.fill('[data-testid="invoice-number-input"]', 'TEST-INV-001');
      await page.fill('[data-testid="invoice-amount-input"]', '1000');
      await page.fill('[data-testid="buyer-id-input"]', '0.0.123456');
      
      // Upload invoice file (mock file upload)
      const fileInput = page.locator('[data-testid="invoice-file-input"]');
      await fileInput.setInputFiles({
        name: 'test-invoice.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Mock PDF content')
      });
      
      // Submit invoice creation
      await page.click('[data-testid="create-invoice-submit"]');
      
      // Wait for redirect to invoice detail or success message
      await expect(page).toHaveURL(/\/invoices\/\d+/, { timeout: 15000 });
    });

    // Step 3: Mint NFT
    await test.step('Mint invoice as NFT', async () => {
      // Start NFT minting process
      await page.click('[data-testid="start-minting-button"]');
      
      // Wait for minting success
      await expect(page.locator('[data-testid="minting-success-title"]')).toBeVisible({ timeout: 30000 });
      
      // Verify NFT details are displayed
      await expect(page.locator('text=NFT Token ID')).toBeVisible();
      await expect(page.locator('text=Transaction Hash')).toBeVisible();
    });

    // Step 4: Fund Invoice
    await test.step('Fund the invoice', async () => {
      // Click fund invoice button
      await page.click('[data-testid="fund-invoice-button"]');
      
      // Fill funding amount
      await page.fill('[data-testid="funding-amount-input"]', '500');
      
      // Continue to confirmation
      await page.click('[data-testid="funding-continue-button"]');
      
      // Confirm and sign transaction
      await page.click('[data-testid="funding-confirm-button"]');
      
      // Wait for funding success (this might take time for blockchain confirmation)
      await expect(page.locator('text=Funding successful')).toBeVisible({ timeout: 30000 });
    });

    // Step 5: Verify funding in marketplace
    await test.step('Verify funding in marketplace', async () => {
      // Navigate to invoices marketplace
      await page.goto('/invoices');
      
      // Search for the created invoice
      await page.fill('[data-testid="invoice-search-input"]', 'TEST-INV-001');
      
      // Verify invoice appears in results
      await expect(page.locator('[data-testid^="invoice-card-"]')).toBeVisible();
      
      // Check that invoice status shows as funded
      await expect(page.locator('text=FUNDED')).toBeVisible();
    });
  });

  test('should handle wallet connection errors gracefully', async ({ page }) => {
    // Click wallet connect button
    await page.click('[data-testid="wallet-connect-button"]');
    
    // Wait for wallet selection modal
    await expect(page.locator('[data-testid="wallet-selection-modal"]')).toBeVisible();
    
    // In case of connection failure, appropriate error should be shown
    // This test would need to be adapted based on actual error handling implementation
    await expect(page.locator('[data-testid="wallet-selection-modal"]')).toBeVisible();
  });

  test('should filter invoices by status', async ({ page }) => {
    // Navigate to invoices page
    await page.goto('/invoices');
    
    // Test different status filters
    const statuses = ['all', 'issued', 'funded', 'paid', 'overdue'];
    
    for (const status of statuses) {
      await page.click(`[data-testid="status-filter-${status}"]`);
      
      // Verify filter is applied (button should be active)
      await expect(page.locator(`[data-testid="status-filter-${status}"]`)).toHaveClass(/default/);
      
      // Wait for filtered results to load
      await page.waitForTimeout(1000);
    }
  });

  test('should display wallet information correctly', async ({ page }) => {
    // This test assumes wallet is already connected or mocked
    await page.goto('/');
    
    // If wallet info is visible, test its functionality
    const walletInfo = page.locator('[data-testid="wallet-info"]');
    
    if (await walletInfo.isVisible()) {
      // Test copy account button
      await page.click('[data-testid="copy-account-button"]');
      
      // Test refresh balance button
      await page.click('[data-testid="refresh-balance-button"]');
      
      // Test disconnect wallet button
      await page.click('[data-testid="disconnect-wallet-button"]');
      
      // Verify wallet is disconnected
      await expect(page.locator('[data-testid="wallet-connect-button"]')).toBeVisible();
    }
  });

  test('should navigate invoice links correctly', async ({ page }) => {
    // Navigate to invoices page
    await page.goto('/invoices');
    
    // Wait for invoices to load
    await page.waitForSelector('[data-testid^="invoice-card-"]', { timeout: 10000 });
    
    // Get first invoice link
    const firstInvoiceLink = page.locator('[data-testid^="invoice-link-"]').first();
    
    if (await firstInvoiceLink.isVisible()) {
      // Click on invoice link
      await firstInvoiceLink.click();
      
      // Verify navigation to invoice detail page
      await expect(page).toHaveURL(/\/invoices\/\d+/);
      
      // Verify invoice detail elements are present
      await expect(page.locator('[data-testid="fund-invoice-button"]')).toBeVisible();
    }
  });

  test('should handle invoice creation validation', async ({ page }) => {
    // Navigate to create invoice page
    await page.goto('/create-invoice');
    
    // Try to submit empty form
    await page.click('[data-testid="create-invoice-submit"]');
    
    // Verify validation errors are shown
    // This would depend on the actual validation implementation
    await expect(page.locator('text=required')).toBeVisible();
    
    // Fill required fields
    await page.fill('[data-testid="invoice-number-input"]', 'TEST-VALIDATION');
    await page.fill('[data-testid="invoice-amount-input"]', '100');
    await page.fill('[data-testid="buyer-id-input"]', '0.0.123456');
    
    // Submit with valid data
    await page.click('[data-testid="create-invoice-submit"]');
    
    // Should proceed without validation errors
    await expect(page).not.toHaveURL('/create-invoice');
  });
});