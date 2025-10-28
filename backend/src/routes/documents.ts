import { FastifyInstance } from 'fastify';
import { documentController } from '../controllers/documentController';

// Schema definitions for document operations
const documentUploadSchema = {
  consumes: ['multipart/form-data'],
  body: {
    type: 'object',
    required: ['invoiceId', 'supplierId', 'documentType', 'filename'],
    properties: {
      invoiceId: { type: 'string' },
      supplierId: { type: 'string' },
      documentType: { 
        type: 'string',
        enum: ['invoice', 'contract', 'receipt']
      },
      filename: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        document: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fileId: { type: 'string' },
            hash: { type: 'string' },
            size: { type: 'number' },
            transactionId: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' }
          }
        }
      }
    },
    400: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' }
      }
    },
    500: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        error: { type: 'string' }
      }
    }
  }
};

const documentParamsSchema = {
  type: 'object',
  required: ['documentId'],
  properties: {
    documentId: { type: 'string' }
  }
};

const documentInfoResponseSchema = {
  200: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      document: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          invoiceId: { type: 'string' },
          supplierId: { type: 'string' },
          documentType: { type: 'string' },
          filename: { type: 'string' },
          fileId: { type: 'string' },
          hash: { type: 'string' },
          size: { type: 'number' },
          mimeType: { type: 'string' },
          transactionId: { type: 'string' },
          hashScanUrl: { type: 'string' },
          mirrorNodeUrl: { type: 'string' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
          hfsInfo: { type: 'object' }
        }
      }
    }
  },
  404: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      error: { type: 'string' }
    }
  }
};

const documentListQuerySchema = {
  type: 'object',
  properties: {
    invoiceId: { type: 'string' },
    supplierId: { type: 'string' },
    documentType: { 
      type: 'string',
      enum: ['invoice', 'contract', 'receipt']
    }
  }
};

const documentListResponseSchema = {
  200: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      documents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            invoiceId: { type: 'string' },
            supplierId: { type: 'string' },
            documentType: { type: 'string' },
            filename: { type: 'string' },
            fileId: { type: 'string' },
            hash: { type: 'string' },
            size: { type: 'number' },
            mimeType: { type: 'string' },
            transactionId: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' }
          }
        }
      }
    }
  }
};

export default async function documentRoutes(fastify: FastifyInstance) {
  // Upload document to HFS
  fastify.post('/upload', {
    schema: documentUploadSchema,
    handler: documentController.uploadDocument
  });

  // Download document from HFS
  fastify.get('/:documentId/download', {
    schema: {
      params: documentParamsSchema,
      response: {
        200: {
          type: 'string',
          format: 'binary'
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    },
    handler: documentController.downloadDocument
  });

  // Get document information
  fastify.get('/:documentId', {
    schema: {
      params: documentParamsSchema,
      response: documentInfoResponseSchema
    },
    handler: documentController.getDocumentInfo
  });

  // List documents with optional filters
  fastify.get('/', {
    schema: {
      querystring: documentListQuerySchema,
      response: documentListResponseSchema
    },
    handler: documentController.listDocuments
  });

  // Delete document
  fastify.delete('/:documentId', {
    schema: {
      params: documentParamsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            hfsDeleteResult: { type: 'object' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    },
    handler: documentController.deleteDocument
  });
}