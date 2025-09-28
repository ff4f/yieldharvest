import { test, expect } from '@playwright/test';

// Type declarations for window extensions
declare global {
  interface Window {
    hashconnect?: {
      init: () => Promise<void>;
      connectToLocalWallet: () => Promise<{
        accountIds: string[];
        network: string;
      }>;
      sendTransaction: (transaction: any) => Promise<{
        response: {
          transactionId: string;
          status: string;
        };
      }>;
    };
    mockHederaResponses: {
      nftMint: any;
      fileUpload: any;
      hcsMessage: any;
      escrowFunding: any;
    };
  }
}

// Mock wallet for testing
const mockWallet = {
  accountId: '0.0.123456',
  publicKey: '302a300506032b6570032100...',
  isConnected: true,
  network: 'testnet'
};

// Mock Hedera transaction responses
const mockTransactions = {
  nftMint: {
    transactionId: '0.0.123456@1640995200.123456789',
    tokenId: '0.0.789012',
    serialNumber: 1,
    status: 'SUCCESS'
  },
  fileUpload: {
    transactionId: '0.0.123456@1640995201.123456789',
    fileId: '0.0.345678',
    status: 'SUCCESS'
  },
  hcsMessage: {
    transactionId: '0.0.123456@1640995202.123456789',
    topicId: '0.0.567890',
    sequenceNumber: 1,
    status: 'SUCCESS'
  },
  escrowFunding: {
    transactionHash: '0xe2e123abc456def789012345678901234567890123456789012345678901234567',
    contractId: '0.0.999888',
    escrowId: 1,
    status: 'SUCCESS'
  }
};

test.describe('YieldHarvest Complete Invoice Lifecycle E2E', () => {
  let invoiceId: string;
  let nftTokenId: string;
  let fileId: string;
  let topicId: string;
  
  test.beforeEach(async ({ page }) => {
    // Mock HashPack wallet integration
    await page.addInitScript(() => {
      // Mock HashConnect
      window.hashconnect = {
        init: () => Promise.resolve(),
        connectToLocalWallet: () => Promise.resolve({
          accountIds: ['0.0.123456'],
          network: 'testnet'
        }),
        sendTransaction: (transaction) => Promise.resolve({
          response: {
            transactionId: '0.0.123456@1640995200.123456789',
            status: 'SUCCESS'
          }
        })
      };
      
      // Mock Hedera SDK responses
      window.mockHederaResponses = {
        nftMint: mockTransactions.nftMint,
        fileUpload: mockTransactions.fileUpload,
        hcsMessage: mockTransactions.hcsMessage,
        escrowFunding: mockTransactions.escrowFunding
      };
    });
    
    // Navigate to the frontend application
    await page.goto('http://localhost:3000');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('Phase 1: Supplier connects wallet and creates invoice with NFT minting', async ({ page }) => {
    // Step 1: Connect HashPack wallet
    await page.click('[data-testid="connect-wallet-btn"]');
    await page.click('[data-testid="hashpack-option"]');
    
    // Wait for wallet connection
    await expect(page.locator('[data-testid="wallet-connected"]')).toBeVisible();
    await expect(page.locator('[data-testid="account-id"]')).toContainText('0.0.123456');
    
    // Step 2: Navigate to create invoice
    await page.click('[data-testid="create-invoice-btn"]');
    await expect(page.locator('h1')).toContainText('Create Invoice');
    
    // Step 3: Fill invoice form
    await page.fill('[data-testid="buyer-name"]', 'TechCorp Solutions');
    await page.fill('[data-testid="buyer-email"]', 'buyer@techcorp.com');
    await page.fill('[data-testid="amount"]', '15000');
    await page.fill('[data-testid="description"]', 'Enterprise Software Development - Phase 1');
    await page.fill('[data-testid="due-date"]', '2024-12-31');
    
    // Step 4: Upload invoice PDF
    const fileInput = page.locator('[data-testid="file-upload"]');
    await fileInput.setInputFiles({
      name: 'test-invoice.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('Mock PDF content for testing')
    });
    
    // Wait for file upload to complete
    await expect(page.locator('[data-testid="file-uploaded"]')).toBeVisible();
    
    // Step 5: Submit invoice (triggers NFT minting)
    await page.click('[data-testid="submit-invoice-btn"]');
    
    // Wait for NFT minting transaction
    await expect(page.locator('[data-testid="minting-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="nft-minted"]')).toBeVisible({ timeout: 30000 });
    
    // Verify NFT details are displayed
    await expect(page.locator('[data-testid="nft-token-id"]')).toContainText('0.0.789012');
    await expect(page.locator('[data-testid="nft-serial"]')).toContainText('1');
    
    // Store invoice ID for next test
    const invoiceIdElement = page.locator('[data-testid="invoice-id"]');
    invoiceId = await invoiceIdElement.textContent() || '';
    
    // Verify HashScan links are displayed
    await expect(page.locator('[data-testid="hashscan-nft-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="hashscan-file-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="hashscan-topic-link"]')).toBeVisible();
    
    console.log('Phase 1 completed: Invoice created with NFT minting');
  });

  test('Phase 2: Buyer funds invoice via smart contract escrow', async ({ page }) => {
    // Step 1: Switch to buyer wallet (simulate different user)
     await page.addInitScript(() => {
       window.hashconnect = {
         init: () => Promise.resolve(),
         sendTransaction: (transaction) => Promise.resolve({
           response: {
             transactionId: '0.0.654321@1640995200.123456789',
             status: 'SUCCESS'
           }
         }),
         connectToLocalWallet: () => Promise.resolve({
           accountIds: ['0.0.654321'], // Different buyer account
           network: 'testnet'
         })
       };
     });
    
    // Connect buyer wallet
    await page.click('[data-testid="connect-wallet-btn"]');
    await page.click('[data-testid="hashpack-option"]');
    await expect(page.locator('[data-testid="account-id"]')).toContainText('0.0.654321');
    
    // Step 2: Navigate to marketplace/invoices
    await page.click('[data-testid="marketplace-nav"]');
    await expect(page.locator('h1')).toContainText('Invoice Marketplace');
    
    // Step 3: Find and select the created invoice
    const targetInvoice = page.locator('[data-testid="invoice-card"]').filter({ hasText: 'TechCorp Solutions' }).first();
    await expect(targetInvoice).toBeVisible();
    await targetInvoice.click();
    
    // Step 4: Review invoice details
    await expect(page.locator('[data-testid="invoice-amount"]')).toContainText('$15,000.00');
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText('ISSUED');
    await expect(page.locator('[data-testid="nft-token-id"]')).toContainText('0.0.789012');
    
    // Step 5: Enter funding amount
    await page.click('[data-testid="fund-invoice-btn"]');
    await page.fill('[data-testid="funding-amount"]', '12000');
    
    // Verify funding calculations
    await expect(page.locator('[data-testid="funding-percentage"]')).toContainText('80%');
    await expect(page.locator('[data-testid="expected-return"]')).toContainText('$12,300.00');
    
    // Step 6: Review escrow contract terms
    await expect(page.locator('[data-testid="escrow-contract-address"]')).toContainText('0.0.999888');
    await expect(page.locator('[data-testid="escrow-terms"]')).toBeVisible();
    
    // Step 7: Confirm funding transaction
    await page.click('[data-testid="confirm-funding-btn"]');
    
    // Wait for escrow funding transaction
    await expect(page.locator('[data-testid="funding-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="funding-confirmed"]')).toBeVisible({ timeout: 30000 });
    
    // Verify funding transaction details
    await expect(page.locator('[data-testid="escrow-tx-hash"]')).toContainText('0xe2e123abc');
    await expect(page.locator('[data-testid="escrow-id"]')).toContainText('1');
    
    // Verify invoice status updated
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText('FUNDED');
    
    // Verify HashScan escrow link
    await expect(page.locator('[data-testid="hashscan-escrow-link"]')).toBeVisible();
    
    console.log('Phase 2 completed: Invoice funded via smart contract escrow');
  });

  test('Phase 3: Supplier releases funds after payment confirmation', async ({ page }) => {
    // Step 1: Switch back to supplier wallet
     await page.addInitScript(() => {
       window.hashconnect = {
         init: () => Promise.resolve(),
         sendTransaction: (transaction) => Promise.resolve({
           response: {
             transactionId: '0.0.123456@1640995203.123456789',
             status: 'SUCCESS'
           }
         }),
         connectToLocalWallet: () => Promise.resolve({
           accountIds: ['0.0.123456'], // Original supplier account
           network: 'testnet'
         })
       };
     });
    
    // Connect supplier wallet
    await page.click('[data-testid="connect-wallet-btn"]');
    await page.click('[data-testid="hashpack-option"]');
    await expect(page.locator('[data-testid="account-id"]')).toContainText('0.0.123456');
    
    // Step 2: Navigate to supplier dashboard
    await page.click('[data-testid="dashboard-nav"]');
    await expect(page.locator('h1')).toContainText('Supplier Dashboard');
    
    // Step 3: Find funded invoice
    const fundedInvoice = page.locator('[data-testid="invoice-row"]').filter({ hasText: 'FUNDED' }).first();
    await expect(fundedInvoice).toBeVisible();
    await fundedInvoice.click();
    
    // Step 4: Verify invoice is funded and ready for payment
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText('FUNDED');
    await expect(page.locator('[data-testid="funding-amount"]')).toContainText('$12,000.00');
    await expect(page.locator('[data-testid="escrow-balance"]')).toContainText('$12,000.00');
    
    // Step 5: Mark invoice as paid (simulate external payment)
    await page.click('[data-testid="mark-paid-btn"]');
    await page.fill('[data-testid="payment-reference"]', 'WIRE-TRANSFER-REF-789456');
    await page.fill('[data-testid="payment-date"]', '2024-01-15');
    
    // Step 6: Confirm payment received
    await page.click('[data-testid="confirm-payment-btn"]');
    
    // Wait for HCS status update
    await expect(page.locator('[data-testid="hcs-update-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="payment-confirmed"]')).toBeVisible({ timeout: 30000 });
    
    // Step 7: Release escrow funds
    await page.click('[data-testid="release-funds-btn"]');
    
    // Confirm fund release
    await expect(page.locator('[data-testid="release-confirmation"]')).toBeVisible();
    await page.click('[data-testid="confirm-release-btn"]');
    
    // Wait for escrow release transaction
    await expect(page.locator('[data-testid="release-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="funds-released"]')).toBeVisible({ timeout: 30000 });
    
    // Verify final invoice status
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText('PAID');
    
    // Verify all proof links are available
    await expect(page.locator('[data-testid="hashscan-nft-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="hashscan-file-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="hashscan-topic-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="hashscan-escrow-link"]')).toBeVisible();
    
    console.log('Phase 3 completed: Funds released after payment confirmation');
  });

  test('End-to-End: Complete invoice lifecycle verification', async ({ page }) => {
    // Verify all transactions are recorded on Hedera
    await page.goto('http://localhost:3000/admin/transactions');
    
    // Check transaction history
    await expect(page.locator('[data-testid="nft-mint-tx"]')).toContainText('0.0.123456@1640995200.123456789');
    await expect(page.locator('[data-testid="file-upload-tx"]')).toContainText('0.0.123456@1640995201.123456789');
    await expect(page.locator('[data-testid="hcs-message-tx"]')).toContainText('0.0.123456@1640995202.123456789');
    await expect(page.locator('[data-testid="escrow-funding-tx"]')).toContainText('0xe2e123abc456def789012345678901234567890123456789012345678901234567');
    
    // Verify Mirror Node data integration
    await expect(page.locator('[data-testid="mirror-node-status"]')).toContainText('Connected');
    await expect(page.locator('[data-testid="total-transactions"]')).toContainText('4');
    
    console.log('End-to-End verification completed: All transactions recorded on Hedera testnet');
    
    // Verify invoice status updated
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText('FUNDED');
    
    // Check funding details
    await expect(page.locator('[data-testid="funded-amount"]')).toContainText('$800.00');
    await expect(page.locator('[data-testid="funding-percentage"]')).toContainText('80%');
    
    // Verify Hedera transaction links
    await expect(page.locator('[data-testid="funding-tx-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="hcs-funding-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="contract-link"]')).toBeVisible();
    
    // Verify FundingProofPill displays correctly
    const fundingProofPill = page.locator('[data-testid="funding-proof-pill"]');
    await expect(fundingProofPill).toBeVisible();
    
    // Check escrow contract link
    const contractLink = page.locator('[data-testid="escrow-contract-link"]');
    await expect(contractLink).toHaveAttribute('href', /hashscan\.io\/testnet\/contract/);
  });

  test('should process invoice payment and release escrow funds', async ({ page }) => {
    // Navigate to funded invoice
    await page.click('[data-testid="invoices-nav"]');
    
    const fundedInvoice = page.locator('[data-testid="invoice-row"]').filter({ hasText: 'FUNDED' }).first();
    await fundedInvoice.click();
    
    // Connect supplier wallet
    await page.click('[data-testid="connect-wallet-btn"]');
    await page.click('[data-testid="hashpack-option"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    // Click pay button (supplier action)
    await page.click('[data-testid="pay-invoice-btn"]');
    
    // Confirm payment received
    await page.check('[data-testid="payment-confirmation"]');
    await page.fill('[data-testid="payment-reference"]', 'BANK-REF-123456');
    
    // Submit payment confirmation
    await page.click('[data-testid="confirm-payment"]');
    
    // Wait for payment confirmation
    await expect(page.locator('[data-testid="payment-status"]')).toContainText('Payment confirmed', { timeout: 30000 });
    
    // Verify invoice status updated
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText('PAID');
    
    // Check payment details
    await expect(page.locator('[data-testid="payment-amount"]')).toContainText('$1,000.00');
    await expect(page.locator('[data-testid="payment-date"]')).toBeVisible();
    
    // Verify escrow release transaction
    await expect(page.locator('[data-testid="release-tx-link"]')).toBeVisible();
    
    // Verify all Hedera links are present
    await expect(page.locator('[data-testid="payment-tx-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="hcs-payment-link"]')).toBeVisible();
    
    // Check complete audit trail
    const auditTrail = page.locator('[data-testid="audit-trail"]');
    await expect(auditTrail).toContainText('Invoice Created');
    await expect(auditTrail).toContainText('Invoice Funded');
    await expect(auditTrail).toContainText('Payment Confirmed');
    await expect(auditTrail).toContainText('Funds Released');
  });

  test('should handle funding errors gracefully', async ({ page }) => {
    // Connect wallet
    await page.click('[data-testid="connect-wallet-btn"]');
    await page.click('[data-testid="hashpack-option"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    // Navigate to invoice
    await page.click('[data-testid="invoices-nav"]');
    const invoice = page.locator('[data-testid="invoice-row"]').first();
    await invoice.click();
    
    // Try to fund with insufficient amount
    await page.click('[data-testid="fund-invoice-btn"]');
    await page.fill('[data-testid="funding-amount"]', '10');
    
    // Should show validation error
    await expect(page.locator('[data-testid="funding-error"]')).toContainText('Minimum funding amount');
    
    // Try to fund with excessive amount
    await page.fill('[data-testid="funding-amount"]', '50000');
    await expect(page.locator('[data-testid="funding-error"]')).toContainText('Cannot exceed invoice amount');
    
    // Test wallet disconnection during funding
    await page.fill('[data-testid="funding-amount"]', '800');
    
    // Mock wallet disconnection
     await page.evaluate(() => {
       if (window.hashconnect) {
         window.hashconnect = {
           ...window.hashconnect,
           connectToLocalWallet: () => Promise.reject(new Error('Wallet disconnected'))
         };
       }
     });
    
    await page.click('[data-testid="confirm-funding"]');
    
    // Should show wallet error
    await expect(page.locator('[data-testid="wallet-error"]')).toContainText('Wallet connection lost');
    
    // Should provide retry option
    await expect(page.locator('[data-testid="retry-connection"]')).toBeVisible();
  });

  test('Mirror Node Integration: Real-time data verification', async ({ page }) => {
    // Navigate to analytics dashboard
    await page.click('[data-testid="analytics-nav"]');
    await expect(page.locator('h1')).toContainText('Analytics Dashboard');
    
    // Verify Mirror Node connection status
    await expect(page.locator('[data-testid="mirror-node-status"]')).toContainText('Connected');
    
    // Check real-time Hedera metrics (not hardcoded)
    await expect(page.locator('[data-testid="total-nfts-minted"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-hcs-messages"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-hfs-files"]')).toBeVisible();
    
    // Verify transaction feed from Mirror Node
    await expect(page.locator('[data-testid="recent-transactions"]')).toBeVisible();
    
    // Check transaction format (Hedera transaction ID pattern)
    const firstTransaction = page.locator('[data-testid="transaction-item"]').first();
    await expect(firstTransaction).toContainText(/0\.0\.[0-9]+@[0-9]+\.[0-9]+/);
    
    // Verify HashScan links are properly formatted
    const hashscanLink = page.locator('[data-testid="hashscan-link"]').first();
    await expect(hashscanLink).toHaveAttribute('href', /hashscan\.io\/testnet/);
    
    console.log('Mirror Node integration verified: Real-time data displayed');
  });

  test('Wallet Integration: Error handling and edge cases', async ({ page }) => {
    // Test wallet not installed scenario
    await page.addInitScript(() => {
      delete window.hashconnect;
    });
    
    await page.click('[data-testid="connect-wallet-btn"]');
    await page.click('[data-testid="hashpack-option"]');
    
    await expect(page.locator('[data-testid="wallet-not-found"]')).toContainText('HashPack wallet not found');
    await expect(page.locator('[data-testid="install-wallet-link"]')).toBeVisible();
    
    // Test wrong network configuration
    await page.addInitScript(() => {
      window.hashconnect = {
        init: () => Promise.resolve(),
        connectToLocalWallet: () => Promise.resolve({
          accountIds: ['0.0.123456'],
          network: 'mainnet' // Wrong network
        }),
        sendTransaction: () => Promise.resolve({ response: { transactionId: '0.0.123456@1234567890.123456789', status: 'SUCCESS' } })
      };
    });
    
    await page.reload();
    await page.click('[data-testid="connect-wallet-btn"]');
    await page.click('[data-testid="hashpack-option"]');
    
    await expect(page.locator('[data-testid="network-error"]')).toContainText('Please switch to testnet');
    
    // Test insufficient balance handling
    await page.addInitScript(() => {
      window.hashconnect = {
        init: () => Promise.resolve(),
        connectToLocalWallet: () => Promise.resolve({
          accountIds: ['0.0.123456'],
          network: 'testnet'
        }),
        sendTransaction: () => Promise.reject(new Error('Insufficient account balance'))
      };
    });
    
    await page.reload();
    await page.click('[data-testid="connect-wallet-btn"]');
    await page.click('[data-testid="hashpack-option"]');
    await page.waitForSelector('[data-testid="wallet-connected"]');
    
    // Attempt to fund an invoice with insufficient balance
    await page.click('[data-testid="invoices-nav"]');
    const invoice = page.locator('[data-testid="invoice-row"]').first();
    await invoice.click();
    
    await page.click('[data-testid="fund-invoice-btn"]');
    await page.fill('[data-testid="funding-amount"]', '800');
    await page.click('[data-testid="confirm-funding"]');
    
    await expect(page.locator('[data-testid="balance-error"]')).toContainText('Insufficient account balance');
    await expect(page.locator('[data-testid="fund-account-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText('ISSUED');
    
    // Verify Hedera proof links are still accessible
    await expect(page.locator('[data-testid="nft-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="hfs-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="hcs-link"]')).toBeVisible();
    
    console.log('Wallet integration edge cases handled correctly');
  });

  test('Hedera Proofs: Complete verification of all proof links', async ({ page }) => {
    // Navigate to invoices with complete transaction history
    await page.click('[data-testid="invoices-nav"]');
    
    // Find a completed invoice with all proofs
    const completedInvoice = page.locator('[data-testid="invoice-row"]').filter({ hasText: 'PAID' }).first();
    await completedInvoice.click();
    
    // Verify NFT proof link
    const nftLink = page.locator('[data-testid="nft-link"]');
    await expect(nftLink).toHaveAttribute('href', /hashscan\.io.*\/token\//);
    
    // Verify HFS file proof link
    const hfsLink = page.locator('[data-testid="hfs-link"]');
    await expect(hfsLink).toHaveAttribute('href', /hashscan\.io.*\/file\//);
    
    // Verify HCS topic proof links
    const hcsLinks = page.locator('[data-testid*="hcs-link"]');
    await expect(hcsLinks.first()).toHaveAttribute('href', /hashscan\.io.*\/topic\//);
    
    // Verify Mirror Node API connectivity
    const mirrorApiStatus = page.locator('[data-testid="mirror-api-status"]');
    await expect(mirrorApiStatus).toContainText('Connected');
    
    console.log('All Hedera proofs verified and accessible');
  });

  test('Error Recovery: Network failures and retry mechanisms', async ({ page }) => {
    // Simulate network failure
    await page.route('**/api/**', route => route.abort());
    await page.reload();
    
    // Verify error state
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Unable to connect');
    
    // Test recovery mechanism
    await page.unroute('**/api/**');
    await page.click('[data-testid="retry-btn"]');
    
    // Verify successful recovery
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    
    console.log('Error recovery mechanisms working correctly');
  });
});