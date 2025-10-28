import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { hederaConsensusService, InvoiceStatusMessage } from '../services/hederaConsensusService';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface CreateTopicRequest {
  Body: {
    invoiceId: string;
    memo?: string;
  };
}

export interface SubmitMessageRequest {
  Body: {
    topicId: string;
    invoiceId: string;
    status: 'ISSUED' | 'FUNDED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    previousStatus?: string;
    metadata?: Record<string, any>;
  };
}

export interface TopicParamsRequest {
  Params: {
    topicId: string;
  };
}

export interface InvoiceParamsRequest {
  Params: {
    invoiceId: string;
  };
}

export const hcsController = {
  /**
   * Create a new HCS topic for an invoice
   */
  async createInvoiceTopic(
    request: FastifyRequest<CreateTopicRequest>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId, memo } = request.body;

      // Get invoice details
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { supplier: true }
      });

      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: 'Invoice not found'
        });
      }

      logger.info(`Creating HCS topic for invoice: ${invoiceId}`);

      // Create topic
      const topicMemo = memo || `YieldHarvest Invoice Topic - ${invoice.invoiceNumber}`;
      const result = await hederaConsensusService.createTopic(topicMemo);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error || 'Failed to create HCS topic'
        });
      }

      // Update invoice with topic ID
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { topicId: result.topicId }
      });

      // Create invoice event record
      await prisma.invoiceEvent.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId,
          eventType: 'TOPIC_CREATED',
          description: `HCS topic created: ${result.topicId}`,
          transactionId: result.transactionId,
          metadata: JSON.stringify({
            topicId: result.topicId,
            hashScanUrl: result.hashScanUrl,
            mirrorNodeUrl: result.mirrorNodeUrl
          })
        }
      });

      // Submit initial invoice creation event
      const invoiceMessage: InvoiceStatusMessage = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierId: invoice.supplierId,
        status: invoice.status as any,
        amount: invoice.amount,
        currency: invoice.currency,
        timestamp: new Date().toISOString()
      };

      const messageResult = await hederaConsensusService.submitInvoiceStatusMessage(
        result.topicId!,
        invoiceMessage
      );

      logger.info(`HCS topic created successfully: ${result.topicId}`);

      return reply.send({
        success: true,
        topic: {
          topicId: result.topicId,
          transactionId: result.transactionId,
          hashScanUrl: result.hashScanUrl,
          mirrorNodeUrl: result.mirrorNodeUrl
        },
        initialMessage: messageResult
      });

    } catch (error) {
      logger.error(`Failed to create HCS topic: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * Submit invoice status update message to HCS
   */
  async submitStatusUpdate(
    request: FastifyRequest<SubmitMessageRequest>,
    reply: FastifyReply
  ) {
    try {
      const { topicId, invoiceId, status, previousStatus, metadata } = request.body;

      // Get invoice details
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { supplier: true }
      });

      if (!invoice) {
        return reply.status(404).send({
          success: false,
          error: 'Invoice not found'
        });
      }

      logger.info(`Submitting status update to HCS: ${invoiceId} -> ${status}`);

      // Create status message
      const statusMessage: InvoiceStatusMessage = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        supplierId: invoice.supplierId,
        status,
        previousStatus: previousStatus || invoice.status,
        amount: invoice.amount,
        currency: invoice.currency,
        timestamp: new Date().toISOString(),
        metadata
      };

      // Submit to HCS
      const result = await hederaConsensusService.submitInvoiceStatusMessage(
        topicId,
        statusMessage
      );

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error || 'Failed to submit message to HCS'
        });
      }

      // Update invoice status
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status }
      });

      // Create invoice event record
      await prisma.invoiceEvent.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId,
          eventType: 'STATUS_UPDATED',
          description: `Status changed from ${previousStatus || invoice.status} to ${status}`,
          hcsMessageId: result.messageId,
          transactionId: result.transactionId,
          metadata: JSON.stringify({
            sequenceNumber: result.sequenceNumber,
            hashScanUrl: result.hashScanUrl,
            mirrorNodeUrl: result.mirrorNodeUrl,
            statusMessage
          })
        }
      });

      logger.info(`Status update submitted successfully: ${result.sequenceNumber}`);

      return reply.send({
        success: true,
        message: {
          messageId: result.messageId,
          sequenceNumber: result.sequenceNumber,
          transactionId: result.transactionId,
          hashScanUrl: result.hashScanUrl,
          mirrorNodeUrl: result.mirrorNodeUrl
        }
      });

    } catch (error) {
      logger.error(`Failed to submit status update: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * Get HCS topic information
   */
  async getTopicInfo(
    request: FastifyRequest<TopicParamsRequest>,
    reply: FastifyReply
  ) {
    try {
      const { topicId } = request.params;

      logger.info(`Getting HCS topic info: ${topicId}`);

      const topicInfo = await hederaConsensusService.getTopicInfo(topicId);

      if (!topicInfo) {
        return reply.status(404).send({
          success: false,
          error: 'Topic not found or inaccessible'
        });
      }

      return reply.send({
        success: true,
        topic: topicInfo
      });

    } catch (error) {
      logger.error(`Failed to get topic info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * Get invoice events from database
   */
  async getInvoiceEvents(
    request: FastifyRequest<InvoiceParamsRequest>,
    reply: FastifyReply
  ) {
    try {
      const { invoiceId } = request.params;

      const events = await prisma.invoiceEvent.findMany({
        where: { invoiceId },
        orderBy: { createdAt: 'desc' }
      });

      return reply.send({
        success: true,
        events: events.map(event => ({
          id: event.id,
          eventType: event.eventType,
          description: event.description,
          hcsMessageId: event.hcsMessageId,
          hcsTimestamp: event.hcsTimestamp,
          transactionId: event.transactionId,
          metadata: event.metadata ? JSON.parse(event.metadata) : null,
          createdAt: event.createdAt
        }))
      });

    } catch (error) {
      logger.error(`Failed to get invoice events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  },

  /**
   * Submit custom event to HCS topic
   */
  async submitCustomEvent(
    request: FastifyRequest<{
      Body: {
        topicId: string;
        eventType: string;
        eventData: Record<string, any>;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { topicId, eventType, eventData } = request.body;

      logger.info(`Submitting custom event to HCS: ${eventType}`);

      const result = await hederaConsensusService.submitEventMessage(
        topicId,
        eventType,
        eventData
      );

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error || 'Failed to submit event to HCS'
        });
      }

      return reply.send({
        success: true,
        message: {
          messageId: result.messageId,
          sequenceNumber: result.sequenceNumber,
          transactionId: result.transactionId,
          hashScanUrl: result.hashScanUrl,
          mirrorNodeUrl: result.mirrorNodeUrl
        }
      });

    } catch (error) {
      logger.error(`Failed to submit custom event: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      });
    }
  }
};