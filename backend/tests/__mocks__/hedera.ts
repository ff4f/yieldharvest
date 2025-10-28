import { jest } from '@jest/globals';

// Mock implementation for Hedera service
export const hederaService = {
  createNFT: jest.fn(() => Promise.resolve({
    tokenId: '0.0.123456',
    serialNumber: '1',
    transactionId: '0.0.123456@1234567890.123456789'
  })),
  
  uploadFile: jest.fn(() => Promise.resolve({
    fileId: '0.0.789012',
    hash: 'mock-file-hash',
    transactionId: '0.0.123456@1234567890.123456789'
  })),
  
  submitMessage: jest.fn(() => Promise.resolve({
    topicId: '0.0.345678',
    sequenceNumber: '1',
    transactionId: '0.0.123456@1234567890.123456789'
  })),
  
  getClient: jest.fn(() => ({
    close: jest.fn()
  })),
  
  close: jest.fn(() => Promise.resolve())
};

export default hederaService;