// Jest setup file
import { jest } from '@jest/globals';

// Mock environment variables
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['HEDERA_NETWORK'] = 'testnet';
process.env['HEDERA_ACCOUNT_ID'] = '0.0.123456';
process.env['HEDERA_PRIVATE_KEY'] = 'test-private-key';
process.env['JWT_SECRET'] = 'test-jwt-secret';

// Global test timeout
jest.setTimeout(10000);