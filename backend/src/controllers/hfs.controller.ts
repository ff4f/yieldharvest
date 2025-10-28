import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HederaService } from '../services/hedera';
import { auditLogger } from '../utils/logger';
import { ValidatedFile } from '../middleware/fileUpload';
import { PrismaClient } from '@prisma/client';
import { mirrorNodeService } from '../services/mirrorNodeService';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Zod schemas for validation
const uploadFileSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  category: z.enum(['invoice', 'contract', 'receipt', 'document']).default('document'),
  metadata: z.record(z.string()).optional(),
});

const getFileSchema = z.object({
  fileId: z.string().regex(/^0\.0\.\d+$/, 'Invalid Hedera File ID format'),
});

const checksumSchema = z.object({
  fileId: z.string().regex(/^0\.0\.\d+$/, 'Invalid Hedera File ID format'),
});

const checksumQuerySchema = z.object({
  expectedHash: z.string().optional(),
});

interface HFSUploadRequest extends FastifyRequest {
  validatedFiles?: ValidatedFile[];
  body: z.infer<typeof uploadFileSchema>;
}

interface HFSGetRequest extends FastifyRequest {
  params: z.infer<typeof getFileSchema>;
}

interface HFSChecksumRequest extends FastifyRequest {
  params: z.infer<typeof checksumSchema>;
  query: z.infer<typeof checksumQuerySchema>;
}

export class HFSController {
  constructor(private hederaService: HederaService) {}

  /**
   * Upload file to Hedera File Service
   * POST /api/hedera/hfs/upload
   */
  async uploadFile(request: HFSUploadRequest, reply: FastifyReply) {
    try {
      // Validate request body
      const validatedBody = uploadFileSchema.parse(request.body);
      
      // Check if files were validated by middleware
      if (!request.validatedFiles || request.validatedFiles.length === 0) {
        return reply.status(400).send({
          error: 'No valid files provided',
          code: 'NO_FILES',
          message: 'At least one valid file is required',
        });
      }

      const uploadResults = [];

      for (const file of request.validatedFiles) {
        try {
          // Convert file to buffer
          const fileBuffer = await file.toBuffer();
          
          // Generate file hash for integrity verification
          const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
          
          // Prepare file metadata
          const fileMetadata = {
            originalName: file.filename,
            sanitizedName: file.sanitizedFilename,
            mimeType: file.detectedMimeType,
            size: fileBuffer.length,
            uploadedAt: new Date().toISOString(),
            hash: fileHash,
            category: validatedBody.category,
            description: validatedBody.description,
            validationHash: file.validationHash,
            ...validatedBody.metadata,
          };

          // Upload to Hedera File Service using available method
          const hfsResult = await this.hederaService.uploadFile(
            fileBuffer,
            JSON.stringify(fileMetadata)
          );

          // Log successful upload
          auditLogger.logHederaTransaction({
            txId: hfsResult.transactionId,
            fileId: hfsResult.fileId,
            action: 'hfs_upload',
            success: true,
          });

          uploadResults.push({
            success: true,
            filename: file.filename,
            sanitizedFilename: file.sanitizedFilename,
            fileId: hfsResult.fileId,
            transactionId: hfsResult.transactionId,
            hash: fileHash,
            size: fileBuffer.length,
            mimeType: file.detectedMimeType,
            uploadedAt: fileMetadata.uploadedAt,
            hashScanUrl: `https://hashscan.io/testnet/transaction/${hfsResult.transactionId}`,
            mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${hfsResult.transactionId}`,
          });

        } catch (fileError) {
          const errorMessage = fileError instanceof Error ? fileError.message : 'Unknown error';
          
          auditLogger.logHederaTransaction({
            action: 'hfs_upload',
            success: false,
            errorMessage,
          });

          uploadResults.push({
            success: false,
            filename: file.filename,
            error: errorMessage,
            code: 'UPLOAD_FAILED',
          });
        }
      }

      // Check if any uploads succeeded
      const successfulUploads = uploadResults.filter(result => result.success);
      const failedUploads = uploadResults.filter(result => !result.success);

      if (successfulUploads.length === 0) {
        return reply.status(500).send({
          error: 'All file uploads failed',
          code: 'ALL_UPLOADS_FAILED',
          results: uploadResults,
        });
      }

      const responseStatus = failedUploads.length > 0 ? 207 : 200; // 207 Multi-Status if partial success

      return reply.status(responseStatus).send({
        message: `${successfulUploads.length} file(s) uploaded successfully`,
        totalFiles: request.validatedFiles.length,
        successful: successfulUploads.length,
        failed: failedUploads.length,
        results: uploadResults,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      auditLogger.logSecurity({
        eventType: 'hfs_upload_error',
        severity: 'high',
        details: {
          error: errorMessage,
          filesCount: request.validatedFiles?.length || 0,
        },
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'File upload failed',
        code: 'UPLOAD_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Get file from Hedera File Service
   * GET /api/hedera/hfs/:fileId
   */
  async getFile(request: HFSGetRequest, reply: FastifyReply) {
    try {
      const { fileId } = getFileSchema.parse(request.params);

      // Get file from HFS using available method
      const fileData = await this.hederaService.getFileContents(fileId);

      if (!fileData) {
        return reply.status(404).send({
          error: 'File not found',
          code: 'FILE_NOT_FOUND',
          fileId,
        });
      }

      // Log file access
      auditLogger.logHederaTransaction({
        fileId,
        action: 'hfs_get',
        success: true,
      });

      // Set basic headers
      reply.header('X-File-ID', fileId);
      reply.header('Content-Type', 'application/octet-stream');

      return reply.send(fileData);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      auditLogger.logHederaTransaction({
        fileId: request.params?.fileId,
        action: 'hfs_get',
        success: false,
        errorMessage,
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid file ID format',
          code: 'INVALID_FILE_ID',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'Failed to retrieve file',
        code: 'GET_FILE_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Download file from Hedera File Service with proper headers
   * GET /api/hedera/hfs/files/:fileId/download
   */
  async downloadFile(request: HFSGetRequest, reply: FastifyReply) {
    try {
      const { fileId } = getFileSchema.parse(request.params);

      // Get file from HFS
      const fileData = await this.hederaService.getFileContents(fileId);

      if (!fileData) {
        return reply.status(404).send({
          error: 'File not found',
          code: 'FILE_NOT_FOUND',
          fileId,
        });
      }

      // Try to get file metadata from database
      const invoice = await prisma.invoice.findFirst({
        where: { fileId },
        include: { supplier: true }
      });

      // Calculate file hash for verification
      const fileHash = crypto.createHash('sha384').update(fileData).digest('hex');

      // Set proper headers for download
      reply.header('X-File-ID', fileId);
      reply.header('X-File-Hash', fileHash);
      reply.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      if (invoice) {
        const filename = `invoice-${invoice.invoiceNumber}.pdf`;
        reply.header('Content-Type', 'application/pdf');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      } else {
        reply.header('Content-Type', 'application/octet-stream');
        reply.header('Content-Disposition', `attachment; filename="file-${fileId}.bin"`);
      }

      // Log file download
      auditLogger.logHederaTransaction({
        fileId,
        action: 'hfs_download',
        success: true,
        metadata: {
          userAgent: request.headers['user-agent'],
          ip: request.ip,
          filename: invoice ? `invoice-${invoice.invoiceNumber}.pdf` : `file-${fileId}.bin`
        }
      });

      return reply.send(fileData);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      auditLogger.logHederaTransaction({
        fileId: request.params?.fileId,
        action: 'hfs_download',
        success: false,
        errorMessage,
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid file ID format',
          code: 'INVALID_FILE_ID',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'Failed to download file',
        code: 'DOWNLOAD_FILE_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * Verify file checksum and integrity
   * GET /api/hedera/hfs/files/:fileId/checksum
   */
  async verifyChecksum(request: HFSChecksumRequest, reply: FastifyReply) {
    try {
      const { fileId } = checksumSchema.parse(request.params);
      const { expectedHash } = checksumQuerySchema.parse(request.query);

      // Get file from HFS
      const fileData = await this.hederaService.getFileContents(fileId);

      if (!fileData) {
        return reply.status(404).send({
          error: 'File not found',
          code: 'FILE_NOT_FOUND',
          fileId,
        });
      }

      // Calculate SHA-384 hash
      const actualHash = crypto.createHash('sha384').update(fileData).digest('hex');
      
      // Verify against expected hash if provided
      const verified = expectedHash ? actualHash === expectedHash : null;

      // Get file info from Mirror Node for additional metadata
      let lastModified = new Date().toISOString();
      try {
        const mirrorResponse = await mirrorNodeService.getFileInfo(fileId);
        if (mirrorResponse?.timestamp) {
          lastModified = new Date(mirrorResponse.timestamp * 1000).toISOString();
        }
      } catch (mirrorError) {
        // Mirror Node error is not critical for checksum verification
        auditLogger.logSecurity({
          eventType: 'mirror_node_warning',
          severity: 'low',
          details: {
            fileId,
            error: mirrorError instanceof Error ? mirrorError.message : 'Unknown mirror error'
          }
        });
      }

      // Log checksum verification
      auditLogger.logHederaTransaction({
        fileId,
        action: 'hfs_checksum_verify',
        success: true,
        metadata: {
          hash: actualHash,
          expectedHash,
          verified,
          size: fileData.length
        }
      });

      return reply.status(200).send({
        fileId,
        hash: actualHash,
        algorithm: 'SHA-384',
        verified,
        expectedHash: expectedHash || null,
        size: fileData.length,
        lastModified,
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/files/${fileId}`,
        hashScanUrl: `https://hashscan.io/testnet/file/${fileId}`,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      auditLogger.logHederaTransaction({
        fileId: request.params?.fileId,
        action: 'hfs_checksum_verify',
        success: false,
        errorMessage,
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Invalid request parameters',
          code: 'INVALID_PARAMS',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'Failed to verify checksum',
        code: 'CHECKSUM_VERIFY_ERROR',
        message: errorMessage,
      });
    }
  }

  /**
   * List files from database
   * GET /api/hedera/hfs/files
   */
  async listFiles(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as any;
      const limit = Math.min(parseInt(query.limit) || 20, 100);
      const offset = parseInt(query.offset) || 0;
      const order = query.order === 'asc' ? 'asc' : 'desc';

      // Fetch invoices with file data from database
      const invoices = await prisma.invoice.findMany({
        where: {
          AND: [
            { fileId: { not: null } },
            { fileHash: { not: null } }
          ]
        },
        include: {
          supplier: true
        },
        orderBy: {
          createdAt: order
        },
        take: limit,
        skip: offset
      });

      // Get total count for pagination
      const totalCount = await prisma.invoice.count({
        where: {
          AND: [
            { fileId: { not: null } },
            { fileHash: { not: null } }
          ]
        }
      });

      // Format files data
      const files = invoices.map(invoice => ({
        fileId: invoice.fileId!,
        fileName: `invoice-${invoice.invoiceNumber}.pdf`,
        fileHash: invoice.fileHash!,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierId: invoice.supplierId,
        supplierName: invoice.supplier.name,
        supplierAccountId: invoice.supplier.accountId,
        uploadedAt: invoice.createdAt,
        size: null, // Size not stored in our schema
        contentType: 'application/pdf',
        links: {
          hashscan: `https://hashscan.io/testnet/file/${invoice.fileId}`,
          mirrorNode: `https://testnet.mirrornode.hedera.com/api/v1/files/${invoice.fileId}`,
          download: `/api/hfs/files/${invoice.fileId}/download`
        }
      }));

      // Calculate pagination info
      const hasMore = offset + limit < totalCount;
      const nextOffset = hasMore ? offset + limit : null;
      const prevOffset = offset > 0 ? Math.max(0, offset - limit) : null;

      // Log API request
      auditLogger.logApiRequest({
        correlationId: 'hfs-list-' + Date.now(),
        endpoint: request.url,
        method: request.method,
        statusCode: 200,
        duration: 0,
      });

      return reply.status(200).send({
        success: true,
        files,
        count: files.length,
        total: totalCount,
        limit,
        offset,
        order,
        pagination: {
          hasMore,
          nextOffset,
          prevOffset
        },
        links: {
          hashscan: 'https://hashscan.io/testnet/files',
          mirrorNode: 'https://testnet.mirrornode.hedera.com/api/v1/files'
        }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      auditLogger.logSecurity({
        eventType: 'hfs_list_error',
        severity: 'medium',
        details: {
          error: errorMessage,
        },
      });

      return reply.status(500).send({
        error: 'Failed to list files',
        code: 'LIST_FILES_ERROR',
        message: errorMessage,
      });
    }
  }
}