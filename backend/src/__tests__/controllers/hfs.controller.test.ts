import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { HFSController } from '../../controllers/hfs.controller';
import { HederaService } from '../../services/hedera';
import { ValidatedFile } from '../../middleware/fileUpload';

// Mock dependencies
const mockHederaService = {
  uploadFile: jest.fn(),
  getFileContents: jest.fn(),
  getFileInfo: jest.fn(),
} as jest.Mocked<HederaService>;

const mockAuditLogger = {
  logHederaTransaction: jest.fn(),
};

// Mock crypto module
jest.mock('crypto', () => ({
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hash-value'),
  })),
}));

// Mock audit logger
jest.mock('../../utils/logger', () => ({
  auditLogger: mockAuditLogger,
}));

describe('HFSController', () => {
  let hfsController: HFSController;
  let mockRequest: any;
  let mockReply: any;

  beforeEach(() => {
    jest.clearAllMocks();
    hfsController = new HFSController(mockHederaService);
    
    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    const mockValidatedFile: ValidatedFile = {
      filename: 'test-invoice.pdf',
      sanitizedFilename: 'test-invoice-sanitized.pdf',
      detectedMimeType: 'application/pdf',
      validationHash: 'validation-hash-123',
      toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
    };

    const mockHFSResult = {
      fileId: '0.0.123456',
      transactionId: '0.0.123@1640995200.000000000',
      fileHashSha384: 'mock-file-hash-sha384',
    };

    beforeEach(() => {
      mockRequest = {
        body: {
          description: 'Test invoice document',
          category: 'invoice',
          metadata: { invoiceNumber: 'INV-001' },
        },
        validatedFiles: [mockValidatedFile],
      };

      mockHederaService.uploadFile.mockResolvedValue(mockHFSResult);
    });

    it('should successfully upload a file to HFS', async () => {
      await hfsController.uploadFile(mockRequest, mockReply);

      expect(mockHederaService.uploadFile).toHaveBeenCalledWith(
        Buffer.from('mock-pdf-content'),
        expect.stringContaining('test-invoice.pdf')
      );

      expect(mockAuditLogger.logHederaTransaction).toHaveBeenCalledWith({
        txId: mockHFSResult.transactionId,
        fileId: mockHFSResult.fileId,
        action: 'hfs_upload',
        success: true,
      });

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'Files uploaded successfully',
        results: [
          {
            success: true,
            filename: 'test-invoice.pdf',
            sanitizedFilename: 'test-invoice-sanitized.pdf',
            fileId: '0.0.123456',
            transactionId: '0.0.123@1640995200.000000000',
            hash: 'mock-hash-value',
            size: 16,
            mimeType: 'application/pdf',
            uploadedAt: expect.any(String),
            hashScanUrl: 'https://hashscan.io/testnet/transaction/0.0.123@1640995200.000000000',
            mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com/api/v1/transactions/0.0.123@1640995200.000000000',
          },
        ],
        totalUploaded: 1,
        totalFailed: 0,
      });
    });

    it('should handle validation errors', async () => {
      mockRequest.body = {
        description: '', // Invalid: too short
        category: 'invalid-category', // Invalid enum value
      };

      await hfsController.uploadFile(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: expect.any(Array),
      });
    });

    it('should handle missing files', async () => {
      mockRequest.validatedFiles = [];

      await hfsController.uploadFile(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'No valid files provided',
        code: 'NO_FILES',
        message: 'At least one valid file is required',
      });
    });

    it('should handle HFS upload errors', async () => {
      const uploadError = new Error('HFS upload failed');
      mockHederaService.uploadFile.mockRejectedValue(uploadError);

      await hfsController.uploadFile(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'File upload completed with some errors',
        results: [
          {
            success: false,
            filename: 'test-invoice.pdf',
            error: 'HFS upload failed',
          },
        ],
        totalUploaded: 0,
        totalFailed: 1,
      });
    });

    it('should handle multiple files with mixed success/failure', async () => {
      const secondFile: ValidatedFile = {
        filename: 'test-contract.pdf',
        sanitizedFilename: 'test-contract-sanitized.pdf',
        detectedMimeType: 'application/pdf',
        validationHash: 'validation-hash-456',
        toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-contract-content')),
      };

      mockRequest.validatedFiles = [mockValidatedFile, secondFile];

      // First file succeeds, second fails
      mockHederaService.uploadFile
        .mockResolvedValueOnce(mockHFSResult)
        .mockRejectedValueOnce(new Error('Second file failed'));

      await hfsController.uploadFile(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'File upload completed with some errors',
        results: [
          expect.objectContaining({ success: true, filename: 'test-invoice.pdf' }),
          expect.objectContaining({ success: false, filename: 'test-contract.pdf' }),
        ],
        totalUploaded: 1,
        totalFailed: 1,
      });
    });
  });

  describe('getFile', () => {
    const mockFileContents = Buffer.from('mock-file-contents');
    const mockFileInfo = {
      file_id: '0.0.123456',
      size: 1024,
      created_timestamp: '1640995200.000000000',
      modified_timestamp: '1640995200.000000000',
      deleted: false,
      memo: 'Test file memo',
    };

    beforeEach(() => {
      mockRequest = {
        params: { fileId: '0.0.123456' },
      };

      mockHederaService.getFileContents.mockResolvedValue(mockFileContents);
      mockHederaService.getFileInfo.mockResolvedValue(mockFileInfo);
    });

    it('should successfully retrieve file contents', async () => {
      await hfsController.getFile(mockRequest, mockReply);

      expect(mockHederaService.getFileContents).toHaveBeenCalledWith('0.0.123456');
      expect(mockHederaService.getFileInfo).toHaveBeenCalledWith('0.0.123456');

      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'File retrieved successfully',
        fileId: '0.0.123456',
        fileInfo: mockFileInfo,
        contents: mockFileContents.toString('base64'),
        size: mockFileContents.length,
        hashScanUrl: 'https://hashscan.io/testnet/file/0.0.123456',
        mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com/api/v1/files/0.0.123456',
      });
    });

    it('should handle invalid file ID format', async () => {
      mockRequest.params = { fileId: 'invalid-file-id' };

      await hfsController.getFile(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: expect.any(Array),
      });
    });

    it('should handle file not found', async () => {
      mockHederaService.getFileContents.mockRejectedValue(new Error('File not found'));

      await hfsController.getFile(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(404);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'File not found',
        code: 'FILE_NOT_FOUND',
        message: 'The requested file could not be found on Hedera File Service',
      });
    });

    it('should handle HFS service errors', async () => {
      const serviceError = new Error('HFS service unavailable');
      mockHederaService.getFileContents.mockRejectedValue(serviceError);

      await hfsController.getFile(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Failed to retrieve file',
        code: 'HFS_RETRIEVAL_ERROR',
        message: 'HFS service unavailable',
      });
    });
  });

  describe('listFiles', () => {
    beforeEach(() => {
      mockRequest = {
        query: {
          limit: '10',
          offset: '0',
        },
      };
    });

    it('should return placeholder response for file listing', async () => {
      await hfsController.listFiles(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'File listing endpoint - placeholder implementation',
        note: 'This endpoint will be implemented when Mirror Node provides file listing capabilities',
        query: mockRequest.query,
        suggestion: 'Use specific file IDs to retrieve individual files',
      });
    });

    it('should handle query parameters', async () => {
      mockRequest.query = {
        limit: '25',
        offset: '50',
        category: 'invoice',
      };

      await hfsController.listFiles(mockRequest, mockReply);

      expect(mockReply.send).toHaveBeenCalledWith({
        message: 'File listing endpoint - placeholder implementation',
        note: 'This endpoint will be implemented when Mirror Node provides file listing capabilities',
        query: mockRequest.query,
        suggestion: 'Use specific file IDs to retrieve individual files',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors in uploadFile', async () => {
      mockRequest = {
        body: { category: 'invoice' },
        validatedFiles: [
          {
            filename: 'test.pdf',
            toBuffer: jest.fn().mockRejectedValue(new Error('Buffer conversion failed')),
          },
        ],
      };

      await hfsController.uploadFile(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          totalFailed: 1,
          results: expect.arrayContaining([
            expect.objectContaining({
              success: false,
              error: 'Buffer conversion failed',
            }),
          ]),
        })
      );
    });

    it('should handle malformed request in getFile', async () => {
      mockRequest = { params: {} }; // Missing fileId

      await hfsController.getFile(mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: expect.any(Array),
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle large file uploads', async () => {
      const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB file
      const largeFile: ValidatedFile = {
        filename: 'large-document.pdf',
        sanitizedFilename: 'large-document-sanitized.pdf',
        detectedMimeType: 'application/pdf',
        validationHash: 'large-file-hash',
        toBuffer: jest.fn().mockResolvedValue(largeBuffer),
      };

      mockRequest = {
        body: { category: 'document' },
        validatedFiles: [largeFile],
      };

      const mockResult = {
        fileId: '0.0.789012',
        transactionId: '0.0.123@1640995300.000000000',
        fileHashSha384: 'large-file-hash-sha384',
      };

      mockHederaService.uploadFile.mockResolvedValue(mockResult);

      await hfsController.uploadFile(mockRequest, mockReply);

      expect(mockHederaService.uploadFile).toHaveBeenCalledWith(
        largeBuffer,
        expect.any(String)
      );

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          totalUploaded: 1,
          results: expect.arrayContaining([
            expect.objectContaining({
              success: true,
              size: 1024 * 1024,
            }),
          ]),
        })
      );
    });
  });
});