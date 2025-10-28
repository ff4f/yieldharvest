import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');

  // Launch browser for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Wait for frontend to be ready
    console.log('⏳ Waiting for frontend server...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('✅ Frontend server is ready');

    // Wait for backend to be ready
    console.log('⏳ Waiting for backend server...');
    const response = await page.request.get('http://localhost:3001/health');
    if (response.ok()) {
      console.log('✅ Backend server is ready');
    } else {
      console.log('⚠️ Backend server health check failed, but continuing...');
    }

    // Optional: Set up test data or authentication state
    // This could include creating test accounts, seeding data, etc.
    console.log('🔧 Setting up test environment...');

    // Store any global state that tests might need
    // For example, you could store authentication tokens, test account IDs, etc.
    process.env.TEST_SETUP_COMPLETE = 'true';

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }

  console.log('✅ Global setup completed successfully');
}

export default globalSetup;