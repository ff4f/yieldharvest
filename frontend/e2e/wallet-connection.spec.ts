import { test, expect } from '@playwright/test';

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display wallet connection button when not connected', async ({ page }) => {
    // Check if wallet connection button is visible
    const connectButton = page.locator('[data-testid="wallet-connect-button"]');
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toContainText('Connect Wallet');
  });

  test('should show wallet selection modal when connect button is clicked', async ({ page }) => {
    // Click connect wallet button
    await page.click('[data-testid="wallet-connect-button"]');
    
    // Check if wallet selection modal appears
    const modal = page.locator('[data-testid="wallet-selection-modal"]');
    await expect(modal).toBeVisible();
    
    // Check if HashPack option is available
    const hashpackOption = page.locator('[data-testid="wallet-option-hashpack"]');
    await expect(hashpackOption).toBeVisible();
    await expect(hashpackOption).toContainText('HashPack');
  });

  test('should display wallet info when connected (mocked)', async ({ page }) => {
    // Mock wallet connection state
    await page.addInitScript(() => {
      // Mock localStorage to simulate connected wallet
      localStorage.setItem('walletConnect', JSON.stringify({
        accountId: '0.0.123456',
        network: 'testnet',
        walletType: 'hashpack'
      }));
    });

    await page.reload();

    // Check if wallet info is displayed
    const walletInfo = page.locator('[data-testid="wallet-info"]');
    await expect(walletInfo).toBeVisible();
    
    const accountId = page.locator('[data-testid="wallet-account-id"]');
    await expect(accountId).toContainText('0.0.123456');
  });

  test('should show disconnect option when wallet is connected', async ({ page }) => {
    // Mock wallet connection state
    await page.addInitScript(() => {
      localStorage.setItem('walletConnect', JSON.stringify({
        accountId: '0.0.123456',
        network: 'testnet',
        walletType: 'hashpack'
      }));
    });

    await page.reload();

    // Click on wallet info to open dropdown
    await page.click('[data-testid="wallet-info"]');
    
    // Check if disconnect option is available
    const disconnectButton = page.locator('[data-testid="wallet-disconnect-button"]');
    await expect(disconnectButton).toBeVisible();
    await expect(disconnectButton).toContainText('Disconnect');
  });

  test('should clear wallet data when disconnected', async ({ page }) => {
    // Mock wallet connection state
    await page.addInitScript(() => {
      localStorage.setItem('walletConnect', JSON.stringify({
        accountId: '0.0.123456',
        network: 'testnet',
        walletType: 'hashpack'
      }));
    });

    await page.reload();

    // Click on wallet info to open dropdown
    await page.click('[data-testid="wallet-info"]');
    
    // Click disconnect
    await page.click('[data-testid="wallet-disconnect-button"]');
    
    // Check if connect button is visible again
    const connectButton = page.locator('[data-testid="wallet-connect-button"]');
    await expect(connectButton).toBeVisible();
    await expect(connectButton).toContainText('Connect Wallet');
  });
});