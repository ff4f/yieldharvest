import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.HOST = '0.0.0.0';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.HEDERA_NETWORK = 'testnet';
process.env.MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com';
process.env.OPERATOR_ID = '0.0.123456';
process.env.OPERATOR_KEY = '302e020100300506032b6570042204201234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
process.env.PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
process.env.ESCROW_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890';
process.env.JSON_RPC_URL = 'https://testnet.hashio.io/api';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};