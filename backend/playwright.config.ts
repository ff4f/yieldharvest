import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'basic-api',
      testMatch: '**/basic-api.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api-tests',
      testMatch: '**/api-integration.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'hedera-tests',
      testMatch: '**/hedera-integration.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'ui-tests',
      testMatch: '**/invoice-flows.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Remove webServer config for now - assume services are already running
});