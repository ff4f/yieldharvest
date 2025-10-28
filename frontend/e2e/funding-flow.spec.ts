import { test, expect } from '@playwright/test';

test.describe('Invoice Funding Flow', () => {
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

  test('should display marketplace with available invoices', async ({ page }) => {
    // Mock API response for invoices
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-001',
            supplierName: 'Supplier A',
            amount: 10000,
            currency: 'USD',
            dueDate: '2024-12-31',
            status: 'MINTED',
            yieldBps: 500,
            tenorDays: 30,
            nftTokenId: '0.0.789001',
            serialNumber: '1'
          },
          {
            id: 'invoice-2',
            invoiceNumber: 'INV-002',
            supplierName: 'Supplier B',
            amount: 15000,
            currency: 'USD',
            dueDate: '2024-12-31',
            status: 'MINTED',
            yieldBps: 750,
            tenorDays: 45,
            nftTokenId: '0.0.789002',
            serialNumber: '1'
          }
        ])
      });
    });

    // Navigate to marketplace
    await page.goto('/marketplace');

    // Check if invoices are displayed
    const invoiceCards = page.locator('[data-testid="invoice-card"]');
    await expect(invoiceCards).toHaveCount(2);

    // Check invoice details
    const firstInvoice = invoiceCards.first();
    await expect(firstInvoice).toContainText('INV-001');
    await expect(firstInvoice).toContainText('$10,000');
    await expect(firstInvoice).toContainText('5.00%');
  });

  test('should open funding modal when fund button is clicked', async ({ page }) => {
    // Mock API response
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-001',
            supplierName: 'Supplier A',
            amount: 10000,
            currency: 'USD',
            status: 'MINTED',
            yieldBps: 500,
            tenorDays: 30
          }
        ])
      });
    });

    await page.goto('/marketplace');

    // Click fund button on first invoice
    const fundButton = page.locator('[data-testid="fund-button"]').first();
    await expect(fundButton).toBeVisible();
    await fundButton.click();

    // Check if funding modal opens
    const fundingModal = page.locator('[data-testid="funding-modal"]');
    await expect(fundingModal).toBeVisible();

    // Check modal content
    await expect(fundingModal).toContainText('Fund Invoice');
    await expect(fundingModal).toContainText('INV-001');
    await expect(fundingModal).toContainText('$10,000');
  });

  test('should display funding calculation details', async ({ page }) => {
    // Mock API responses
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-001',
            supplierName: 'Supplier A',
            amount: 10000,
            currency: 'USD',
            status: 'MINTED',
            yieldBps: 500,
            tenorDays: 30
          }
        ])
      });
    });

    await page.goto('/marketplace');
    
    // Open funding modal
    await page.click('[data-testid="fund-button"]');

    const modal = page.locator('[data-testid="funding-modal"]');
    
    // Check funding calculation details
    await expect(modal.locator('[data-testid="invoice-amount"]')).toContainText('$10,000');
    await expect(modal.locator('[data-testid="yield-rate"]')).toContainText('5.00%');
    await expect(modal.locator('[data-testid="tenor-days"]')).toContainText('30 days');
    
    // Check if expected return is calculated and displayed
    const expectedReturn = modal.locator('[data-testid="expected-return"]');
    await expect(expectedReturn).toBeVisible();
  });

  test('should handle funding transaction flow', async ({ page }) => {
    // Mock invoice API
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-001',
            supplierName: 'Supplier A',
            amount: 10000,
            currency: 'USD',
            status: 'MINTED',
            yieldBps: 500,
            tenorDays: 30
          }
        ])
      });
    });

    // Mock funding API
    await page.route('**/api/funding/fund', async route => {
      const request = route.request();
      const postData = request.postDataJSON();
      
      if (postData.step === 'prepare') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transactionBytes: 'mock-transaction-bytes',
            escrowAccountId: '0.0.999999'
          })
        });
      } else if (postData.step === 'submit') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            transactionId: '0.0.123456@1234567890.123456789',
            escrowId: 'escrow-123'
          })
        });
      }
    });

    await page.goto('/marketplace');
    
    // Open funding modal and confirm funding
    await page.click('[data-testid="fund-button"]');
    
    const modal = page.locator('[data-testid="funding-modal"]');
    const confirmButton = modal.locator('[data-testid="confirm-funding-button"]');
    
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Check if processing state is shown
    const processingIndicator = modal.locator('[data-testid="funding-processing"]');
    await expect(processingIndicator).toBeVisible();

    // Wait for success state
    const successMessage = modal.locator('[data-testid="funding-success"]');
    await expect(successMessage).toBeVisible({ timeout: 10000 });

    // Check if transaction details are displayed
    const transactionHash = modal.locator('[data-testid="transaction-hash"]');
    await expect(transactionHash).toBeVisible();
    await expect(transactionHash).toContainText('0.0.123456@1234567890.123456789');
  });

  test('should handle funding errors gracefully', async ({ page }) => {
    // Mock invoice API
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-001',
            supplierName: 'Supplier A',
            amount: 10000,
            currency: 'USD',
            status: 'MINTED'
          }
        ])
      });
    });

    // Mock funding API error
    await page.route('**/api/funding/fund', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Funding failed: Insufficient balance'
        })
      });
    });

    await page.goto('/marketplace');
    
    // Open funding modal and try to fund
    await page.click('[data-testid="fund-button"]');
    await page.click('[data-testid="confirm-funding-button"]');

    // Check if error message is displayed
    const errorMessage = page.locator('[data-testid="funding-error"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('Funding failed');

    // Check if retry button is available
    const retryButton = page.locator('[data-testid="retry-funding-button"]');
    await expect(retryButton).toBeVisible();
  });

  test('should require wallet connection for funding', async ({ page }) => {
    // Clear wallet connection
    await page.addInitScript(() => {
      localStorage.removeItem('walletConnect');
    });

    // Mock invoice API
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-001',
            supplierName: 'Supplier A',
            amount: 10000,
            currency: 'USD',
            status: 'MINTED'
          }
        ])
      });
    });

    await page.goto('/marketplace');
    
    // Try to fund without wallet connection
    await page.click('[data-testid="fund-button"]');

    // Check if wallet connection prompt is shown
    const connectPrompt = page.locator('[data-testid="connect-wallet-prompt"]');
    await expect(connectPrompt).toBeVisible();
    await expect(connectPrompt).toContainText('Connect your wallet');
  });

  test('should update invoice status after successful funding', async ({ page }) => {
    // Mock initial invoice list
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'invoice-1',
            invoiceNumber: 'INV-001',
            supplierName: 'Supplier A',
            amount: 10000,
            currency: 'USD',
            status: 'MINTED',
            yieldBps: 500,
            tenorDays: 30
          }
        ])
      });
    });

    // Mock successful funding
    await page.route('**/api/funding/fund', async route => {
      const request = route.request();
      const postData = request.postDataJSON();
      
      if (postData.step === 'prepare') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            transactionBytes: 'mock-transaction-bytes'
          })
        });
      } else if (postData.step === 'submit') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            transactionId: '0.0.123456@1234567890.123456789'
          })
        });
      }
    });

    await page.goto('/marketplace');
    
    // Complete funding flow
    await page.click('[data-testid="fund-button"]');
    await page.click('[data-testid="confirm-funding-button"]');
    
    // Wait for success
    const successMessage = page.locator('[data-testid="funding-success"]');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
    
    // Close modal
    await page.click('[data-testid="close-modal-button"]');
    
    // Check if invoice status is updated in the list
    const invoiceCard = page.locator('[data-testid="invoice-card"]').first();
    await expect(invoiceCard).toContainText('FUNDED');
  });
});