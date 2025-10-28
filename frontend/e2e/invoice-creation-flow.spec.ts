import { test, expect } from '@playwright/test';

test.describe('Invoice Creation and NFT Minting Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
    await page.addInitScript(() => {
      localStorage.setItem('walletConnect', JSON.stringify({
        accountId: '0.0.123456',
        network: 'testnet',
        walletType: 'hashpack'
      }));
    });

    await page.goto('/');
  });

  test('should navigate to invoice creation page', async ({ page }) => {
    // Click on create invoice button/link
    const createInvoiceButton = page.locator('[data-testid="create-invoice-button"]').first();
    await expect(createInvoiceButton).toBeVisible();
    await createInvoiceButton.click();

    // Check if we're on the invoice creation page
    await expect(page).toHaveURL(/.*\/create-invoice/);
    
    // Check if the invoice form is visible
    const invoiceForm = page.locator('[data-testid="invoice-form"]');
    await expect(invoiceForm).toBeVisible();
  });

  test('should fill out invoice form with valid data', async ({ page }) => {
    await page.goto('/create-invoice');

    // Fill out the invoice form
    await page.fill('[data-testid="invoice-number"]', 'INV-E2E-001');
    await page.fill('[data-testid="supplier-name"]', 'Test Supplier Ltd');
    await page.fill('[data-testid="supplier-email"]', 'supplier@test.com');
    await page.fill('[data-testid="buyer-name"]', 'Test Buyer Corp');
    await page.fill('[data-testid="buyer-email"]', 'buyer@test.com');
    await page.fill('[data-testid="invoice-amount"]', '10000');
    await page.selectOption('[data-testid="currency-select"]', 'USD');
    await page.fill('[data-testid="due-date"]', '2024-12-31');
    await page.fill('[data-testid="description"]', 'E2E Test Invoice');

    // Upload a test file (mock)
    const fileInput = page.locator('[data-testid="file-upload"]');
    await expect(fileInput).toBeVisible();

    // Check if form validation passes
    const submitButton = page.locator('[data-testid="submit-invoice"]');
    await expect(submitButton).toBeEnabled();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/create-invoice');

    // Try to submit without filling required fields
    const submitButton = page.locator('[data-testid="submit-invoice"]');
    await submitButton.click();

    // Check for validation errors
    const errorMessages = page.locator('[data-testid="field-error"]');
    await expect(errorMessages.first()).toBeVisible();
  });

  test('should proceed to NFT minting after invoice creation', async ({ page }) => {
    await page.goto('/create-invoice');

    // Fill out the form
    await page.fill('[data-testid="invoice-number"]', 'INV-E2E-002');
    await page.fill('[data-testid="supplier-name"]', 'Test Supplier Ltd');
    await page.fill('[data-testid="supplier-email"]', 'supplier@test.com');
    await page.fill('[data-testid="buyer-name"]', 'Test Buyer Corp');
    await page.fill('[data-testid="buyer-email"]', 'buyer@test.com');
    await page.fill('[data-testid="invoice-amount"]', '15000');
    await page.selectOption('[data-testid="currency-select"]', 'USD');
    await page.fill('[data-testid="due-date"]', '2024-12-31');
    await page.fill('[data-testid="description"]', 'E2E Test Invoice for Minting');

    // Mock API responses
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invoice: {
            id: 'test-invoice-id',
            invoiceNumber: 'INV-E2E-002',
            amount: 15000,
            status: 'CREATED'
          },
          proofs: {
            mintTransactionId: '0.0.123456@1234567890.123456789'
          }
        })
      });
    });

    await page.route('**/api/invoices/*/mint', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            tokenId: '0.0.789012',
            serialNumber: '1',
            transactionId: '0.0.123456@1234567890.123456789'
          }
        })
      });
    });

    // Submit the form
    await page.click('[data-testid="submit-invoice"]');

    // Wait for navigation to minting page
    await expect(page).toHaveURL(/.*\/mint/);

    // Check if NFT minting form is visible
    const mintingForm = page.locator('[data-testid="nft-minting-form"]');
    await expect(mintingForm).toBeVisible();
  });

  test('should display minting progress and completion', async ({ page }) => {
    await page.goto('/invoice-upload-wizard');

    // Mock wallet connection and proceed to minting
    await page.addInitScript(() => {
      // Mock form data
      (window as any).mockFormData = {
        invoiceNumber: 'INV-E2E-003',
        supplierName: 'Test Supplier',
        amount: '20000'
      };
    });

    // Mock API responses for minting
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          invoice: {
            id: 'test-invoice-id-3',
            invoiceNumber: 'INV-E2E-003',
            amount: 20000,
            status: 'CREATED'
          }
        })
      });
    });

    await page.route('**/api/invoices/*/submitMint', async route => {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            tokenId: '0.0.789013',
            serialNumber: '1',
            transactionId: '0.0.123456@1234567890.123456790'
          }
        })
      });
    });

    // Start minting process
    const startMintingButton = page.locator('[data-testid="start-minting-button"]');
    if (await startMintingButton.isVisible()) {
      await startMintingButton.click();
    }

    // Check minting progress indicators
    const progressBar = page.locator('[data-testid="minting-progress"]');
    await expect(progressBar).toBeVisible();

    // Wait for completion
    const successMessage = page.locator('[data-testid="minting-success"]');
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    // Check if transaction details are displayed
    const transactionHash = page.locator('[data-testid="transaction-hash"]');
    const nftTokenId = page.locator('[data-testid="nft-token-id"]');
    
    await expect(transactionHash).toBeVisible();
    await expect(nftTokenId).toBeVisible();
  });

  test('should handle minting errors gracefully', async ({ page }) => {
    await page.goto('/invoice-upload-wizard');

    // Mock API error response
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error'
        })
      });
    });

    // Try to start minting
    const startMintingButton = page.locator('[data-testid="start-minting-button"]');
    if (await startMintingButton.isVisible()) {
      await startMintingButton.click();
    }

    // Check if error message is displayed
    const errorMessage = page.locator('[data-testid="minting-error"]');
    await expect(errorMessage).toBeVisible();

    // Check if retry button is available
    const retryButton = page.locator('[data-testid="retry-minting-button"]');
    await expect(retryButton).toBeVisible();
  });
});