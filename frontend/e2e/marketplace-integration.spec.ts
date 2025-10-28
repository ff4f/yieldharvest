import { test, expect } from '@playwright/test';

test.describe('Marketplace Integration', () => {
  const mockInvoices = [
    {
      id: 'invoice-1',
      invoiceNumber: 'INV-001',
      supplierName: 'Tech Solutions Ltd',
      buyerName: 'Global Corp',
      amount: 10000,
      currency: 'USD',
      dueDate: '2024-12-31',
      status: 'MINTED',
      yieldBps: 500,
      tenorDays: 30,
      nftTokenId: '0.0.789001',
      serialNumber: '1',
      createdAt: '2024-01-15T10:00:00Z'
    },
    {
      id: 'invoice-2',
      invoiceNumber: 'INV-002',
      supplierName: 'Manufacturing Inc',
      buyerName: 'Retail Chain',
      amount: 25000,
      currency: 'USD',
      dueDate: '2024-11-30',
      status: 'MINTED',
      yieldBps: 750,
      tenorDays: 45,
      nftTokenId: '0.0.789002',
      serialNumber: '1',
      createdAt: '2024-01-10T14:30:00Z'
    },
    {
      id: 'invoice-3',
      invoiceNumber: 'INV-003',
      supplierName: 'Service Provider Co',
      buyerName: 'Enterprise Ltd',
      amount: 5000,
      currency: 'USD',
      dueDate: '2025-01-15',
      status: 'FUNDED',
      yieldBps: 400,
      tenorDays: 60,
      nftTokenId: '0.0.789003',
      serialNumber: '1',
      createdAt: '2024-01-20T09:15:00Z'
    }
  ];

  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
    await page.addInitScript(() => {
      localStorage.setItem('walletConnect', JSON.stringify({
        accountId: '0.0.123456',
        network: 'testnet',
        walletType: 'hashpack'
      }));
    });

    // Mock invoices API
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockInvoices)
      });
    });

    await page.goto('/marketplace');
  });

  test('should display all invoices in marketplace', async ({ page }) => {
    // Check if all invoices are displayed
    const invoiceCards = page.locator('[data-testid="invoice-card"]');
    await expect(invoiceCards).toHaveCount(3);

    // Check specific invoice details
    const firstInvoice = invoiceCards.first();
    await expect(firstInvoice).toContainText('INV-001');
    await expect(firstInvoice).toContainText('Tech Solutions Ltd');
    await expect(firstInvoice).toContainText('$10,000');
    await expect(firstInvoice).toContainText('5.00%');
  });

  test('should filter invoices by status', async ({ page }) => {
    // Check if filter controls are available
    const statusFilter = page.locator('[data-testid="status-filter"]');
    await expect(statusFilter).toBeVisible();

    // Filter by MINTED status
    await statusFilter.selectOption('MINTED');

    // Check if only MINTED invoices are shown
    const invoiceCards = page.locator('[data-testid="invoice-card"]');
    await expect(invoiceCards).toHaveCount(2);

    // Verify the filtered invoices
    await expect(invoiceCards.first()).toContainText('INV-001');
    await expect(invoiceCards.nth(1)).toContainText('INV-002');

    // Filter by FUNDED status
    await statusFilter.selectOption('FUNDED');
    await expect(invoiceCards).toHaveCount(1);
    await expect(invoiceCards.first()).toContainText('INV-003');
  });

  test('should filter invoices by amount range', async ({ page }) => {
    // Check if amount filter controls are available
    const minAmountInput = page.locator('[data-testid="min-amount-filter"]');
    const maxAmountInput = page.locator('[data-testid="max-amount-filter"]');
    
    await expect(minAmountInput).toBeVisible();
    await expect(maxAmountInput).toBeVisible();

    // Filter by amount range (10000 - 30000)
    await minAmountInput.fill('10000');
    await maxAmountInput.fill('30000');

    // Apply filter
    const applyFilterButton = page.locator('[data-testid="apply-filters-button"]');
    await applyFilterButton.click();

    // Check if correct invoices are shown
    const invoiceCards = page.locator('[data-testid="invoice-card"]');
    await expect(invoiceCards).toHaveCount(2);
    await expect(invoiceCards.first()).toContainText('INV-001');
    await expect(invoiceCards.nth(1)).toContainText('INV-002');
  });

  test('should sort invoices by different criteria', async ({ page }) => {
    // Check if sort controls are available
    const sortSelect = page.locator('[data-testid="sort-select"]');
    await expect(sortSelect).toBeVisible();

    // Sort by amount (highest first)
    await sortSelect.selectOption('amount-desc');

    const invoiceCards = page.locator('[data-testid="invoice-card"]');
    
    // Check if invoices are sorted correctly
    await expect(invoiceCards.first()).toContainText('INV-002'); // $25,000
    await expect(invoiceCards.nth(1)).toContainText('INV-001'); // $10,000
    await expect(invoiceCards.nth(2)).toContainText('INV-003'); // $5,000

    // Sort by yield (highest first)
    await sortSelect.selectOption('yield-desc');
    
    await expect(invoiceCards.first()).toContainText('INV-002'); // 7.50%
    await expect(invoiceCards.nth(1)).toContainText('INV-001'); // 5.00%
    await expect(invoiceCards.nth(2)).toContainText('INV-003'); // 4.00%
  });

  test('should search invoices by supplier name', async ({ page }) => {
    // Check if search input is available
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();

    // Search for specific supplier
    await searchInput.fill('Tech Solutions');

    // Check if only matching invoices are shown
    const invoiceCards = page.locator('[data-testid="invoice-card"]');
    await expect(invoiceCards).toHaveCount(1);
    await expect(invoiceCards.first()).toContainText('Tech Solutions Ltd');
    await expect(invoiceCards.first()).toContainText('INV-001');
  });

  test('should open invoice details modal', async ({ page }) => {
    // Mock individual invoice API
    await page.route('**/api/invoices/invoice-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockInvoices[0],
          description: 'Software development services',
          documents: [
            {
              id: 'doc-1',
              filename: 'invoice-001.pdf',
              fileId: '0.0.555001',
              hash: 'abc123def456',
              uploadedAt: '2024-01-15T10:00:00Z'
            }
          ],
          proofs: {
            mintTransactionId: '0.0.123456@1234567890.123456789',
            fileId: '0.0.555001',
            topicSequenceNumber: 1
          }
        })
      });
    });

    // Click on invoice card to open details
    const firstInvoiceCard = page.locator('[data-testid="invoice-card"]').first();
    await firstInvoiceCard.click();

    // Check if details modal opens
    const detailsModal = page.locator('[data-testid="invoice-details-modal"]');
    await expect(detailsModal).toBeVisible();

    // Check modal content
    await expect(detailsModal).toContainText('INV-001');
    await expect(detailsModal).toContainText('Tech Solutions Ltd');
    await expect(detailsModal).toContainText('Global Corp');
    await expect(detailsModal).toContainText('Software development services');

    // Check if blockchain proofs are displayed
    const proofSection = detailsModal.locator('[data-testid="blockchain-proofs"]');
    await expect(proofSection).toBeVisible();
    await expect(proofSection).toContainText('0.0.123456@1234567890.123456789');
  });

  test('should display invoice documents and links', async ({ page }) => {
    // Mock individual invoice API with documents
    await page.route('**/api/invoices/invoice-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockInvoices[0],
          documents: [
            {
              id: 'doc-1',
              filename: 'invoice-001.pdf',
              fileId: '0.0.555001',
              hash: 'abc123def456',
              uploadedAt: '2024-01-15T10:00:00Z'
            }
          ]
        })
      });
    });

    // Open invoice details
    await page.click('[data-testid="invoice-card"]');

    const detailsModal = page.locator('[data-testid="invoice-details-modal"]');
    
    // Check if documents section is visible
    const documentsSection = detailsModal.locator('[data-testid="invoice-documents"]');
    await expect(documentsSection).toBeVisible();

    // Check document details
    await expect(documentsSection).toContainText('invoice-001.pdf');
    await expect(documentsSection).toContainText('0.0.555001');

    // Check if HFS link is available
    const hfsLink = documentsSection.locator('[data-testid="hfs-link"]');
    await expect(hfsLink).toBeVisible();
    await expect(hfsLink).toHaveAttribute('href', /.*hashscan\.io.*0\.0\.555001/);
  });

  test('should show funding button only for MINTED invoices', async ({ page }) => {
    const invoiceCards = page.locator('[data-testid="invoice-card"]');
    
    // Check first invoice (MINTED) - should have fund button
    const firstCard = invoiceCards.first();
    const firstFundButton = firstCard.locator('[data-testid="fund-button"]');
    await expect(firstFundButton).toBeVisible();
    await expect(firstFundButton).toBeEnabled();

    // Check third invoice (FUNDED) - should not have fund button or should be disabled
    const thirdCard = invoiceCards.nth(2);
    const thirdFundButton = thirdCard.locator('[data-testid="fund-button"]');
    
    // Either button doesn't exist or is disabled
    const buttonExists = await thirdFundButton.count() > 0;
    if (buttonExists) {
      await expect(thirdFundButton).toBeDisabled();
    }
  });

  test('should handle empty marketplace state', async ({ page }) => {
    // Mock empty invoices response
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });

    await page.reload();

    // Check if empty state is displayed
    const emptyState = page.locator('[data-testid="empty-marketplace"]');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No invoices available');
  });

  test('should handle marketplace loading state', async ({ page }) => {
    // Mock delayed API response
    await page.route('**/api/invoices', async route => {
      // Delay response by 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockInvoices)
      });
    });

    await page.reload();

    // Check if loading state is displayed
    const loadingIndicator = page.locator('[data-testid="marketplace-loading"]');
    await expect(loadingIndicator).toBeVisible();

    // Wait for content to load
    const invoiceCards = page.locator('[data-testid="invoice-card"]');
    await expect(invoiceCards).toHaveCount(3, { timeout: 5000 });
  });

  test('should handle marketplace API errors', async ({ page }) => {
    // Mock API error
    await page.route('**/api/invoices', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal server error'
        })
      });
    });

    await page.reload();

    // Check if error state is displayed
    const errorState = page.locator('[data-testid="marketplace-error"]');
    await expect(errorState).toBeVisible();
    await expect(errorState).toContainText('Failed to load invoices');

    // Check if retry button is available
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
  });
});