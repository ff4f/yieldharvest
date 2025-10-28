import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { hederaFileService } from '../services/hederaFileService';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface DocumentUploadRequest {
  Body: {
    invoiceId: string;
    supplierId: string;
    documentType: 'invoice' | 'contract' | 'receipt';
    filename: string;
  };
}

export interface DocumentDownloadRequest {
  Params: {
    documentId: string;
  };
}

export interface DocumentListRequest {
  Querystring: {
    invoiceId?: string;
    supplierId?: string;
    documentType?: string;
  };
}

export const documentController = {
  /**
   * Upload a document to HFS and store metadata in database
   */
  async uploadDocument(
    request: FastifyRequest<DocumentUploadRequest>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId, supplierId, documentType, filename } = request.body;
      
      // Get file from multipart form data
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file provided'
        });
      }

      const fileBuffer = await data.toBuffer();
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      logger.info(`Uploading document: ${filename}, type: ${documentType}, size: ${fileBuffer.length}`);

      // Upload to HFS
      const uploadResult = await hederaFileService.uploadFile(
        fileBuffer,
        filename,
        `YieldHarvest ${documentType} - Invoice: ${invoiceId}`
      );

      if (!uploadResult.success) {
        return reply.status(500).send({
          success: false,
          error: uploadResult.error || 'Failed to upload to HFS'
        });
      }

      // Store document metadata in database
      const document = await prisma.document.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId,
          supplierId,
          documentType,
          filename,
          fileId: uploadResult.fileId,
          hash: uploadResult.hash,
          size: uploadResult.size,
          mimeType: data.mimetype,
          transactionId: uploadResult.transactionId,
          hashScanUrl: uploadResult.hashScanUrl,
          mirrorNodeUrl: uploadResult.mirrorNodeUrl,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info(`Document uploaded successfully: ${document.id}, fileId: ${uploadResult.fileId}`);

      return reply.send({
        success: true,
        document: {
          id: document.id,
          fileId: uploadResult.fileId,
          hash: uploadResult.hash,
          size: uploadResult.size,
          transactionId: uploadResult.transactionId,
          hashScanUrl: uploadResult.hashScanUrl,
          mirrorNodeUrl: uploadResult.mirrorNodeUrl
        }
      });

    } catch (error) {
      logger.error(`Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * Download a document from HFS
   */
  async downloadDocument(
    request: FastifyRequest<DocumentDownloadRequest>,
    reply: FastifyReply
  ) {
    try {
      const { documentId } = request.params;

      // Get document metadata from database
      const document = await prisma.document.findUnique({
        where: { id: documentId }
      });

      if (!document) {
        return reply.status(404).send({
          success: false,
          error: 'Document not found'
        });
      }

      logger.info(`Downloading document: ${documentId}, fileId: ${document.fileId}`);

      // Download from HFS
      const downloadResult = await hederaFileService.downloadFile(document.fileId);

      if (!downloadResult.success) {
        return reply.status(500).send({
          success: false,
          error: downloadResult.error || 'Failed to download from HFS'
        });
      }

      // Verify file integrity
      const downloadedHash = crypto.createHash('sha256').update(downloadResult.content).digest('hex');
      if (downloadedHash !== document.hash) {
        logger.error(`File integrity check failed for document: ${documentId}`);
        return reply.status(500).send({
          success: false,
          error: 'File integrity check failed'
        });
      }

      // Set appropriate headers
      reply.header('Content-Type', document.mimeType || 'application/octet-stream');
      reply.header('Content-Disposition', `attachment; filename="${document.filename}"`);
      reply.header('Content-Length', downloadResult.content.length);

      return reply.send(downloadResult.content);

    } catch (error) {
      logger.error(`Failed to download document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * Get document information
   */
  async getDocumentInfo(
    request: FastifyRequest<DocumentDownloadRequest>,
    reply: FastifyReply
  ) {
    try {
      const { documentId } = request.params;

      const document = await prisma.document.findUnique({
        where: { id: documentId }
      });

      if (!document) {
        return reply.status(404).send({
          success: false,
          error: 'Document not found'
        });
      }

      // Get file info from HFS
      const fileInfo = await hederaFileService.getFileInfo(document.fileId);

      return reply.send({
        success: true,
        document: {
          id: document.id,
          invoiceId: document.invoiceId,
          supplierId: document.supplierId,
          documentType: document.documentType,
          filename: document.filename,
          fileId: document.fileId,
          hash: document.hash,
          size: document.size,
          mimeType: document.mimeType,
          transactionId: document.transactionId,
          hashScanUrl: document.hashScanUrl,
          mirrorNodeUrl: document.mirrorNodeUrl,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          hfsInfo: fileInfo
        }
      });

    } catch (error) {
      logger.error(`Failed to get document info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * List documents with optional filters
   */
  async listDocuments(
    request: FastifyRequest<DocumentListRequest>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId, supplierId, documentType } = request.query;

      const where: any = {};
      if (invoiceId) where.invoiceId = invoiceId;
      if (supplierId) where.supplierId = supplierId;
      if (documentType) where.documentType = documentType;

      const documents = await prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({
        success: true,
        documents: documents.map((doc: any) => ({
          id: doc.id,
          invoiceId: doc.invoiceId,
          supplierId: doc.supplierId,
          documentType: doc.documentType,
          filename: doc.filename,
          fileId: doc.fileId,
          hash: doc.hash,
          size: doc.size,
          mimeType: doc.mimeType,
          transactionId: doc.transactionId,
          hashScanUrl: doc.hashScanUrl,
          mirrorNodeUrl: doc.mirrorNodeUrl,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt
        }))
      });

    } catch (error) {
      logger.error(`Failed to list documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * Delete a document from HFS and database
   */
  async deleteDocument(
    request: FastifyRequest<DocumentDownloadRequest>,
    reply: FastifyReply
  ) {
    try {
      const { documentId } = request.params;

      // Get document metadata from database
      const document = await prisma.document.findUnique({
        where: { id: documentId }
      });

      if (!document) {
        return reply.status(404).send({
          success: false,
          error: 'Document not found'
        });
      }

      logger.info(`Deleting document: ${documentId}, fileId: ${document.fileId}`);

      // Delete from HFS
      const deleteResult = await hederaFileService.deleteFile(document.fileId);

      if (!deleteResult.success) {
        logger.error(`Failed to delete file from HFS: ${deleteResult.error}`);
        // Continue with database deletion even if HFS deletion fails
      }

      // Delete from database
      await prisma.document.delete({
        where: { id: documentId }
      });

      return reply.send({
        success: true,
        message: 'Document deleted successfully',
        hfsDeleteResult: deleteResult
      });

    } catch (error) {
      logger.error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }
};