// Jest setup file
import { jest } from '@jest/globals';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Override with test-specific environment variables
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] || 'file:./prisma/test.db';
process.env['HEDERA_NETWORK'] = process.env['HEDERA_NETWORK'] || 'testnet';
process.env['OPERATOR_ID'] = process.env['OPERATOR_ID'] || '0.0.6435668';
process.env['OPERATOR_KEY'] = process.env['OPERATOR_KEY'] || '3030020100300706052b8104000a042204208377d6342dcd55926a0c1a21f03e333a005bf83301c378b38cf85557ad9ec3f3';
process.env['MIRROR_NODE_URL'] = process.env['MIRROR_NODE_URL'] || 'https://testnet.mirrornode.hedera.com';
process.env['INVOICE_TOKEN_ID'] = process.env['INVOICE_TOKEN_ID'] || '0.0.6861251';
process.env['INVOICE_TOPIC_ID'] = process.env['INVOICE_TOPIC_ID'] || '0.0.6861250';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] || 'test-jwt-secret';

// Global test timeout
jest.setTimeout(30000);