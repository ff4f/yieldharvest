import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...');

  try {
    // Clean up any test data that was created during tests
    console.log('🗑️ Cleaning up test data...');

    // Optional: Clean up test accounts, reset database state, etc.
    // This could include API calls to clean up test invoices, NFTs, etc.

    // Clear any environment variables set during setup
    delete process.env.TEST_SETUP_COMPLETE;

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown;