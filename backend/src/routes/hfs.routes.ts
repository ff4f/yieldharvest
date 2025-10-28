import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { HFSController } from '../controllers/hfs.controller';
import { HederaService } from '../services/hedera';
import { fileUploadValidator } from '../middleware/fileUpload';

export async function hfsRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Get HederaService instance from fastify decorator
  const hederaService = (fastify as any).hederaService as HederaService;
  const hfsController = new HFSController(hederaService);

  // File upload endpoint with validation middleware
  fastify.post('/upload', {
    preHandler: [fileUploadValidator],
    schema: {
      description: 'Upload files to Hedera File Service',
      tags: ['HFS'],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        properties: {
          files: {
            type: 'array',
            items: { type: 'string', format: 'binary' },
            description: 'Files to upload (max 10MB each)',
          },
          description: {
            type: 'string',
            maxLength: 500,
            description: 'Optional description for the files',
          },
          category: {
            type: 'string',
            enum: ['invoice', 'contract', 'receipt', 'document'],
            default: 'document',
            description: 'File category',
          },
          metadata: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Additional metadata as key-value pairs',
          },
        },
      },
      response: {
        200: {
          description: 'Files uploaded successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            totalFiles: { type: 'number' },
            successful: { type: 'number' },
            failed: { type: 'number' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  filename: { type: 'string' },
                  sanitizedFilename: { type: 'string' },
                  fileId: { type: 'string' },
                  transactionId: { type: 'string' },
                  hash: { type: 'string' },
                  size: { type: 'number' },
                  mimeType: { type: 'string' },
                  uploadedAt: { type: 'string' },
                  hashScanUrl: { type: 'string' },
                  mirrorNodeUrl: { type: 'string' },
                },
              },
            },
          },
        },
        207: {
          description: 'Partial success - some files uploaded',
          type: 'object',
          properties: {
            message: { type: 'string' },
            totalFiles: { type: 'number' },
            successful: { type: 'number' },
            failed: { type: 'number' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  filename: { type: 'string' },
                  error: { type: 'string' },
                  code: { type: 'string' },
                },
              },
            },
          },
        },
        400: {
          description: 'Bad request - validation failed',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'array' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: any, reply: any) => {
    return hfsController.uploadFile(request, reply);
  });

  // Get file by ID
  fastify.get('/:fileId', {
    schema: {
      description: 'Get file from Hedera File Service',
      tags: ['HFS'],
      params: {
        type: 'object',
        properties: {
          fileId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera File ID (format: 0.0.xxxxx)',
          },
        },
        required: ['fileId'],
      },
      response: {
        200: {
          description: 'File content',
          type: 'string',
          format: 'binary',
          headers: {
            'X-File-ID': { type: 'string' },
            'Content-Type': { type: 'string' },
          },
        },
        404: {
          description: 'File not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            fileId: { type: 'string' },
          },
        },
        400: {
          description: 'Invalid file ID format',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'array' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: any, reply: any) => {
    return hfsController.getFile(request, reply);
  });

  // List uploaded files
  fastify.get('/files', {
    schema: {
      description: 'List uploaded files',
      tags: ['HFS'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            files: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  fileId: { type: 'string' },
                  fileName: { type: 'string' },
                  fileHash: { type: 'string' },
                  invoiceId: { type: 'string' },
                  invoiceNumber: { type: 'string' },
                  supplierId: { type: 'string' },
                  supplierName: { type: 'string', nullable: true },
                  supplierAccountId: { type: 'string' },
                  uploadedAt: { type: 'string', format: 'date-time' },
                  size: { type: 'integer', nullable: true },
                  contentType: { type: 'string' },
                  links: {
                    type: 'object',
                    properties: {
                      hashscan: { type: 'string' },
                      mirrorNode: { type: 'string' },
                      download: { type: 'string' }
                    }
                  }
                }
              }
            },
            count: { type: 'integer' },
            total: { type: 'integer' },
            limit: { type: 'integer' },
            offset: { type: 'integer' },
            order: { type: 'string' },
            pagination: {
              type: 'object',
              properties: {
                hasMore: { type: 'boolean' },
                nextOffset: { type: 'integer', nullable: true },
                prevOffset: { type: 'integer', nullable: true }
              }
            },
            links: {
              type: 'object',
              properties: {
                hashscan: { type: 'string' },
                mirrorNode: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, hfsController.listFiles);

  // Download file proxy endpoint
  fastify.get('/files/:fileId/download', {
    schema: {
      description: 'Download file from Hedera File Service with proper headers',
      tags: ['HFS'],
      params: {
        type: 'object',
        properties: {
          fileId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera File ID (format: 0.0.xxxxx)',
          },
        },
        required: ['fileId'],
      },
      response: {
        200: {
          description: 'File content with proper headers',
          type: 'string',
          format: 'binary',
          headers: {
            'X-File-ID': { type: 'string' },
            'X-File-Hash': { type: 'string' },
            'Content-Type': { type: 'string' },
            'Content-Disposition': { type: 'string' },
            'Cache-Control': { type: 'string' },
          },
        },
        404: {
          description: 'File not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            fileId: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: any, reply: any) => {
    return hfsController.downloadFile(request, reply);
  });

  // Checksum verification endpoint
  fastify.get('/files/:fileId/checksum', {
    schema: {
      description: 'Verify file checksum and integrity',
      tags: ['HFS'],
      params: {
        type: 'object',
        properties: {
          fileId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera File ID (format: 0.0.xxxxx)',
          },
        },
        required: ['fileId'],
      },
      querystring: {
        type: 'object',
        properties: {
          expectedHash: {
            type: 'string',
            description: 'Expected SHA-384 hash to verify against',
          },
        },
      },
      response: {
        200: {
          description: 'Checksum verification result',
          type: 'object',
          properties: {
            fileId: { type: 'string' },
            hash: { type: 'string' },
            algorithm: { type: 'string' },
            verified: { type: 'boolean' },
            expectedHash: { type: 'string', nullable: true },
            size: { type: 'number' },
            lastModified: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
            hashScanUrl: { type: 'string' },
          },
        },
        404: {
          description: 'File not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            fileId: { type: 'string' },
          },
        },
        500: {
          description: 'Internal server error',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: any, reply: any) => {
    return hfsController.verifyChecksum(request, reply);
  });
}