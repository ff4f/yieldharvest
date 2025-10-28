import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { HCSController } from '../controllers/hcs.controller';
import { HederaService } from '../services/hedera';

export async function hcsRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Get HederaService instance from fastify decorator
  const hederaService = (fastify as any).hedera as HederaService;
  const hcsController = new HCSController(hederaService);

  // Create topic
  fastify.post('/topics', {
    schema: {
      description: 'Create a new HCS topic for invoice status updates',
      tags: ['HCS'],
      body: {
        type: 'object',
        properties: {
          memo: {
            type: 'string',
            maxLength: 100,
            description: 'Optional memo for the topic',
          },
          adminKey: {
            type: 'string',
            description: 'Optional admin key (not implemented)',
          },
          submitKey: {
            type: 'string',
            description: 'Optional submit key (not implemented)',
          },
        },
      },
      response: {
        201: {
          description: 'Topic created successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            topicId: { type: 'string' },
            transactionId: { type: 'string' },
            memo: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
            topicUrl: { type: 'string' },
          },
        },
        400: {
          description: 'Validation failed',
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
    return hcsController.createTopic(request, reply);
  });

  // Submit message to topic
  fastify.post('/messages', {
    schema: {
      description: 'Submit a message to an HCS topic',
      tags: ['HCS'],
      body: {
        type: 'object',
        properties: {
          topicId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera Topic ID',
          },
          message: {
            type: 'string',
            minLength: 1,
            maxLength: 1024,
            description: 'Message content',
          },
          messageType: {
            type: 'string',
            enum: ['invoice_created', 'invoice_funded', 'invoice_paid', 'invoice_cancelled', 'status_update'],
            description: 'Type of message',
          },
          invoiceId: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Optional invoice identifier',
          },
          metadata: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Additional metadata',
          },
        },
        required: ['topicId', 'message', 'messageType'],
      },
      response: {
        201: {
          description: 'Message submitted successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            topicId: { type: 'string' },
            sequenceNumber: { type: 'string' },
            transactionId: { type: 'string' },
            messageType: { type: 'string' },
            invoiceId: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
            messageUrl: { type: 'string' },
          },
        },
        400: {
          description: 'Validation failed',
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
    return hcsController.submitMessage(request, reply);
  });

  // Get topic messages
  fastify.get('/:topicId/messages', {
    schema: {
      description: 'Get messages from an HCS topic',
      tags: ['HCS'],
      params: {
        type: 'object',
        properties: {
          topicId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera Topic ID',
          },
        },
        required: ['topicId'],
      },
      querystring: {
        type: 'object',
        properties: {
          sequenceNumber: {
            type: 'string',
            pattern: '^\\d+$',
            description: 'Starting sequence number',
          },
          limit: {
            type: 'string',
            pattern: '^\\d+$',
            description: 'Maximum number of messages to return',
          },
        },
      },
      response: {
        200: {
          description: 'Topic messages',
          type: 'object',
          properties: {
            topicId: { type: 'string' },
            messages: { type: 'array' },
            count: { type: 'number' },
            limit: { type: 'number' },
            sequenceNumber: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
          },
        },
        400: {
          description: 'Invalid parameters',
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
    return hcsController.getMessages(request, reply);
  });

  // Get topic information
  fastify.get('/topics/:topicId', {
    schema: {
      description: 'Get topic information',
      tags: ['HCS'],
      params: {
        type: 'object',
        properties: {
          topicId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera Topic ID',
          },
        },
        required: ['topicId'],
      },
      response: {
        200: {
          description: 'Topic information',
          type: 'object',
          properties: {
            message: { type: 'string' },
            topicId: { type: 'string' },
            note: { type: 'string' },
            suggestion: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
            hashScanUrl: { type: 'string' },
          },
        },
        400: {
          description: 'Invalid topic ID',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
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
    return hcsController.getTopic(request, reply);
  });
}