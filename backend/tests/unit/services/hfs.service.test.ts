import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { HfsService } from '../../../src/services/hfs.service';
import { HederaService } from '../../../src/services/hedera';
import { logger } from '../../../src/utils/logger';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../../../src/services/hedera');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-sha256-hash')
  }))
}));

const mockHederaService = {
  uploadFile: jest.fn(),
  getFileContents: jest.fn(),
  getFileInfo: jest.fn(),
  deleteFile: jest.fn()
} as jest.Mocked<HederaService>;

describe('HfsService', () => {
  let hfsService: HfsService;
  const mockFileBuffer = Buffer.from('test file content');
  const mockFileId = '0.0.123456';
  const mockTransactionId = '0.0.123456@1234567890.123456789';

  beforeEach(() => {
    jest.clearAllMocks();
    (HederaService as jest.MockedClass<typeof HederaService>).mockImplementation(() => mockHederaService);
    hfsService = new HfsService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockUploadParams = {
      filename: 'test-invoice.pdf',
      buffer: mockFileBuffer,
      mimeType: 'application/pdf'
    };

    it('should successfully upload a file to HFS', async () => {
      const mockUploadResult = {
        success: true,
        fileId: mockFileId,
        transactionId: mockTransactionId,
        hash: 'mock-sha256-hash',
        size: mockFileBuffer.length
      };

      mockHederaService.uploadFile.mockResolvedValue(mockUploadResult);

      const result = await hfsService.uploadFile(mockUploadParams);

      expect(result).toEqual({
        success: true,
        fileId: mockFileId,
        transactionId: mockTransactionId,
        hash: 'mock-sha256-hash',
        size: mockFileBuffer.length,
        filename: 'test-invoice.pdf',
        mimeType: 'application/pdf'
      });

      expect(mockHederaService.uploadFile).toHaveBeenCalledWith({
        filename: 'test-invoice.pdf',
        contents: mockFileBuffer,
        keys: undefined
      });

      expect(logger.info).toHaveBeenCalledWith('File uploaded to HFS successfully', {
        fileId: mockFileId,
        filename: 'test-invoice.pdf',
        size: mockFileBuffer.length
      });
    });

    it('should handle upload failure', async () => {
      const mockError = new Error('Upload failed');
      mockHederaService.uploadFile.mockRejectedValue(mockError);

      const result = await hfsService.uploadFile(mockUploadParams);

      expect(result).toEqual({
        success: false,
        error: 'Upload failed',
        details: mockError
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to upload file to HFS', {
        filename: 'test-invoice.pdf',
        error: mockError
      });
    });

    it('should validate file size limits', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const largeFileParams = {
        ...mockUploadParams,
        buffer: largeBuffer
      };

      const result = await hfsService.uploadFile(largeFileParams);

      expect(result).toEqual({
        success: false,
        error: 'File size exceeds maximum limit of 5MB',
        details: expect.any(Error)
      });

      expect(mockHederaService.uploadFile).not.toHaveBeenCalled();
    });

    it('should validate filename', async () => {
      const invalidFileParams = {
        ...mockUploadParams,
        filename: ''
      };

      const result = await hfsService.uploadFile(invalidFileParams);

      expect(result).toEqual({
        success: false,
        error: 'Invalid filename provided',
        details: expect.any(Error)
      });

      expect(mockHederaService.uploadFile).not.toHaveBeenCalled();
    });

    it('should calculate file hash correctly', async () => {
      const mockHashInstance = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn(() => 'calculated-hash')
      };
      
      (crypto.createHash as jest.Mock).mockReturnValue(mockHashInstance);

      mockHederaService.uploadFile.mockResolvedValue({
        success: true,
        fileId: mockFileId,
        transactionId: mockTransactionId,
        hash: 'calculated-hash',
        size: mockFileBuffer.length
      });

      await hfsService.uploadFile(mockUploadParams);

      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockHashInstance.update).toHaveBeenCalledWith(mockFileBuffer);
      expect(mockHashInstance.digest).toHaveBeenCalledWith('hex');
    });
  });

  describe('getFile', () => {
    it('should successfully retrieve a file from HFS', async () => {
      const mockFileContents = Buffer.from('retrieved file content');
      const mockFileInfo = {
        fileId: mockFileId,
        size: mockFileContents.length,
        expirationTime: new Date(Date.now() + 86400000) // 24 hours from now
      };

      mockHederaService.getFileContents.mockResolvedValue(mockFileContents);
      mockHederaService.getFileInfo.mockResolvedValue(mockFileInfo);

      const result = await hfsService.getFile(mockFileId);

      expect(result).toEqual({
        success: true,
        fileId: mockFileId,
        contents: mockFileContents,
        size: mockFileContents.length,
        hash: 'mock-sha256-hash'
      });

      expect(mockHederaService.getFileContents).toHaveBeenCalledWith(mockFileId);
      expect(logger.info).toHaveBeenCalledWith('File retrieved from HFS successfully', {
        fileId: mockFileId,
        size: mockFileContents.length
      });
    });

    it('should handle file not found', async () => {
      const mockError = new Error('File not found');
      mockHederaService.getFileContents.mockRejectedValue(mockError);

      const result = await hfsService.getFile(mockFileId);

      expect(result).toEqual({
        success: false,
        error: 'File not found',
        details: mockError
      });

      expect(logger.error).toHaveBeenCalledWith('Failed to retrieve file from HFS', {
        fileId: mockFileId,
        error: mockError
      });
    });

    it('should validate fileId format', async () => {
      const invalidFileId = 'invalid-file-id';

      const result = await hfsService.getFile(invalidFileId);

      expect(result).toEqual({
        success: false,
        error: 'Invalid file ID format',
        details: expect.any(Error)
      });

      expect(mockHederaService.getFileContents).not.toHaveBeenCalled();
    });
  });

  describe('getFileInfo', () => {
    it('should successfully retrieve file information', async () => {
      const mockFileInfo = {
        fileId: mockFileId,
        size: 1024,
        expirationTime: new Date(Date.now() + 86400000),
        keys: [],
        deleted: false
      };

      mockHederaService.getFileInfo.mockResolvedValue(mockFileInfo);

      const result = await hfsService.getFileInfo(mockFileId);

      expect(result).toEqual({
        success: true,
        ...mockFileInfo
      });

      expect(mockHederaService.getFileInfo).toHaveBeenCalledWith(mockFileId);
    });

    it('should handle file info retrieval failure', async () => {
      const mockError = new Error('File info not available');
      mockHederaService.getFileInfo.mockRejectedValue(mockError);

      const result = await hfsService.getFileInfo(mockFileId);

      expect(result).toEqual({
        success: false,
        error: 'File info not available',
        details: mockError
      });
    });
  });

  describe('verifyFileIntegrity', () => {
    it('should verify file integrity successfully', async () => {
      const mockFileContents = Buffer.from('test content');
      const expectedHash = 'mock-sha256-hash';

      mockHederaService.getFileContents.mockResolvedValue(mockFileContents);

      const result = await hfsService.verifyFileIntegrity(mockFileId, expectedHash);

      expect(result).toEqual({
        success: true,
        fileId: mockFileId,
        verified: true,
        expectedHash,
        actualHash: 'mock-sha256-hash'
      });
    });

    it('should detect hash mismatch', async () => {
      const mockFileContents = Buffer.from('modified content');
      const expectedHash = 'different-hash';

      mockHederaService.getFileContents.mockResolvedValue(mockFileContents);

      const result = await hfsService.verifyFileIntegrity(mockFileId, expectedHash);

      expect(result).toEqual({
        success: true,
        fileId: mockFileId,
        verified: false,
        expectedHash: 'different-hash',
        actualHash: 'mock-sha256-hash'
      });

      expect(logger.warn).toHaveBeenCalledWith('File integrity verification failed', {
        fileId: mockFileId,
        expectedHash: 'different-hash',
        actualHash: 'mock-sha256-hash'
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when service is operational', async () => {
      const result = await hfsService.healthCheck();

      expect(result).toEqual({
        service: 'HFS',
        status: 'healthy',
        timestamp: expect.any(String)
      });
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      
      mockHederaService.uploadFile.mockRejectedValue(timeoutError);

      const result = await hfsService.uploadFile({
        filename: 'test.pdf',
        buffer: mockFileBuffer,
        mimeType: 'application/pdf'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('should handle insufficient balance errors', async () => {
      const balanceError = new Error('Insufficient account balance');
      balanceError.name = 'InsufficientBalanceError';
      
      mockHederaService.uploadFile.mockRejectedValue(balanceError);

      const result = await hfsService.uploadFile({
        filename: 'test.pdf',
        buffer: mockFileBuffer,
        mimeType: 'application/pdf'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient account balance');
    });
  });
});