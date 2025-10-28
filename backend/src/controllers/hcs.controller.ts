import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { HederaService } from '../services/hedera';
import { auditLogger } from '../utils/logger';

// Zod schemas for validation
const CreateTopicSchema = z.object({
  memo: z.string().max(100).optional(),
  adminKey: z.string().optional(),
  submitKey: z.string().optional(),
});

const SubmitMessageSchema = z.object({
  topicId: z.string().regex(/^0\.0\.\d+$/, 'Invalid Hedera Topic ID format'),
  message: z.string().min(1).max(1024),
  messageType: z.enum(['invoice_created', 'invoice_funded', 'invoice_paid', 'invoice_cancelled', 'status_update']),
  invoiceId: z.string().min(1).max(50).optional(),
  metadata: z.record(z.string()).optional(),
});

const GetMessagesSchema = z.object({
  topicId: z.string().regex(/^0\.0\.\d+$/, 'Invalid Hedera Topic ID format'),
  sequenceNumber: z.string().regex(/^\d+$/, 'Invalid sequence number').optional(),
  limit: z.string().regex(/^\d+$/, 'Invalid limit').optional(),
});

// Request types
type CreateTopicRequest = FastifyRequest<{
  Body: z.infer<typeof CreateTopicSchema>;
}>;

type SubmitMessageRequest = FastifyRequest<{
  Body: z.infer<typeof SubmitMessageSchema>;
}>;

type GetMessagesRequest = FastifyRequest<{
  Params: { topicId: string };
  Querystring: { sequenceNumber?: string; limit?: string };
}>;

export class HCSController {
  constructor(private hederaService: HederaService) {}

  async createTopic(request: CreateTopicRequest, reply: FastifyReply) {
    try {
      // Validate request body
      const validatedData = CreateTopicSchema.parse(request.body);

      // Create topic via Hedera service
      const result = await this.hederaService.createTopic(validatedData.memo);

      // Log the transaction
      await auditLogger.logHederaTransaction({
        txId: result.transactionId,
        action: 'create_topic',
        success: true,
      });

      // Return success response with HashScan and Mirror Node links
      return reply.status(201).send({
        message: 'Topic created successfully',
        topicId: result.topicId,
        transactionId: result.transactionId,
        memo: validatedData.memo,
        hashScanUrl: `https://hashscan.io/testnet/topic/${result.topicId}`,
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/topics/${result.topicId}`,
        topicUrl: `https://testnet.mirrornode.hedera.com/api/v1/topics/${result.topicId}/messages`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      // Log error
      await auditLogger.logHederaTransaction({
        action: 'create_topic',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.status(500).send({
        error: 'Failed to create topic',
        code: 'HCS_CREATE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async submitMessage(request: SubmitMessageRequest, reply: FastifyReply) {
    try {
      // Validate request body
      const validatedData = SubmitMessageSchema.parse(request.body);

      // Prepare message data
      const messageData = {
        type: validatedData.messageType,
        timestamp: new Date().toISOString(),
        invoiceId: validatedData.invoiceId,
        message: validatedData.message,
        metadata: validatedData.metadata,
      };

      // Submit message via Hedera service
      const result = await this.hederaService.submitTopicMessage(
        validatedData.topicId,
        messageData
      );

      // Log the transaction
      await auditLogger.logHederaTransaction({
        txId: result.transactionId,
        action: 'submit_message',
        success: true,
      });

      // Return success response with HashScan and Mirror Node links
      return reply.status(201).send({
        message: 'Message submitted successfully',
        topicId: validatedData.topicId,
        sequenceNumber: result.sequenceNumber,
        transactionId: result.transactionId,
        messageType: validatedData.messageType,
        invoiceId: validatedData.invoiceId,
        hashScanUrl: `https://hashscan.io/testnet/transaction/${result.transactionId}`,
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${result.transactionId}`,
        messageUrl: `https://testnet.mirrornode.hedera.com/api/v1/topics/${validatedData.topicId}/messages/${result.sequenceNumber}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      // Log error
      await auditLogger.logHederaTransaction({
        action: 'submit_message',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.status(500).send({
        error: 'Failed to submit message',
        code: 'HCS_SUBMIT_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getMessages(request: GetMessagesRequest, reply: FastifyReply) {
    try {
      // Validate request parameters
      const validatedParams = GetMessagesSchema.parse({
        topicId: request.params.topicId,
        sequenceNumber: request.query.sequenceNumber,
        limit: request.query.limit,
      });

      const limit = validatedParams.limit ? parseInt(validatedParams.limit) : 10;

      // Get messages via Hedera service (Mirror Node)
      const messages = await this.hederaService.getTopicMessages(
        validatedParams.topicId,
        limit
      );

      // Log the request
      await auditLogger.logHederaTransaction({
        action: 'get_messages',
        success: true,
      });

      // Return messages with Mirror Node links
      return reply.status(200).send({
        topicId: validatedParams.topicId,
        messages: messages.map((msg: any) => ({
          ...msg,
          messageUrl: `https://testnet.mirrornode.hedera.com/api/v1/topics/${validatedParams.topicId}/messages/${msg.sequence_number}`,
        })),
        count: messages.length,
        limit,
        sequenceNumber: validatedParams.sequenceNumber,
        hashScanUrl: `https://hashscan.io/testnet/topic/${validatedParams.topicId}`,
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/topics/${validatedParams.topicId}/messages`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        });
      }

      // Log error
      await auditLogger.logHederaTransaction({
        action: 'get_messages',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.status(500).send({
        error: 'Failed to get messages',
        code: 'HCS_GET_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getTopic(request: FastifyRequest<{ Params: { topicId: string } }>, reply: FastifyReply) {
    try {
      const { topicId } = request.params;

      // Validate topic ID format
      if (!/^0\.0\.\d+$/.test(topicId)) {
        return reply.status(400).send({
          error: 'Invalid topic ID format',
          code: 'INVALID_TOPIC_ID',
        });
      }

      // Log the request
      await auditLogger.logHederaTransaction({
        action: 'get_topic',
        success: true,
      });

      // Return placeholder response with Mirror Node links
      return reply.status(200).send({
        message: 'Topic information retrieval',
        topicId,
        note: 'Topic info retrieval via Mirror Node API - implementation pending',
        suggestion: 'Use Mirror Node REST API to get topic details',
        mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}`,
        hashScanUrl: `https://hashscan.io/testnet/topic/${topicId}`,
      });
    } catch (error) {
      // Log error
      await auditLogger.logHederaTransaction({
        action: 'get_topic',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.status(500).send({
        error: 'Failed to get topic information',
        code: 'HCS_TOPIC_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}