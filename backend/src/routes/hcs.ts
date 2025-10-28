import { FastifyInstance } from 'fastify';
import { hcsController } from '../controllers/hcsController';

// Schema definitions for HCS operations
const createTopicSchema = {
  body: {
    type: 'object',
    required: ['invoiceId'],
    properties: {
      invoiceId: { type: 'string' },
      memo: { type: 'string' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        topic: {
          type: 'object',
          properties: {
            topicId: { type: 'string' },
            transactionId: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' }
          }
        },
        initialMessage: {
          type: 'object',
          properties: {
            messageId: { type: 'string' },
            sequenceNumber: { type: 'string' },
            transactionId: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' }
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

const submitMessageSchema = {
  body: {
    type: 'object',
    required: ['topicId', 'invoiceId', 'status'],
    properties: {
      topicId: { type: 'string' },
      invoiceId: { type: 'string' },
      status: {
        type: 'string',
        enum: ['ISSUED', 'FUNDED', 'PAID', 'OVERDUE', 'CANCELLED']
      },
      previousStatus: { type: 'string' },
      metadata: { type: 'object' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: {
          type: 'object',
          properties: {
            messageId: { type: 'string' },
            sequenceNumber: { type: 'string' },
            transactionId: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' }
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

const topicParamsSchema = {
  type: 'object',
  required: ['topicId'],
  properties: {
    topicId: { type: 'string' }
  }
};

const invoiceParamsSchema = {
  type: 'object',
  required: ['invoiceId'],
  properties: {
    invoiceId: { type: 'string' }
  }
};

const topicInfoResponseSchema = {
  200: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      topic: {
        type: 'object',
        properties: {
          topicId: { type: 'string' },
          adminKey: { type: 'string' },
          submitKey: { type: 'string' },
          memo: { type: 'string' },
          runningHash: { type: 'string' },
          sequenceNumber: { type: 'string' },
          expirationTime: { type: 'string' },
          autoRenewPeriod: { type: 'string' },
          autoRenewAccount: { type: 'string' }
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

const eventsResponseSchema = {
  200: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      events: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            eventType: { type: 'string' },
            description: { type: 'string' },
            hcsMessageId: { type: 'string' },
            hcsTimestamp: { type: 'string' },
            transactionId: { type: 'string' },
            metadata: { type: 'object' },
            createdAt: { type: 'string' }
          }
        }
      }
    }
  }
};

const customEventSchema = {
  body: {
    type: 'object',
    required: ['topicId', 'eventType', 'eventData'],
    properties: {
      topicId: { type: 'string' },
      eventType: { type: 'string' },
      eventData: { type: 'object' }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: {
          type: 'object',
          properties: {
            messageId: { type: 'string' },
            sequenceNumber: { type: 'string' },
            transactionId: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' }
          }
        }
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

export default async function hcsRoutes(fastify: FastifyInstance) {
  // Create HCS topic for invoice
  fastify.post('/topics', {
    schema: createTopicSchema,
    handler: hcsController.createInvoiceTopic
  });

  // Submit invoice status update to HCS
  fastify.post('/messages/status', {
    schema: submitMessageSchema,
    handler: hcsController.submitStatusUpdate
  });

  // Get HCS topic information
  fastify.get('/topics/:topicId', {
    schema: {
      params: topicParamsSchema,
      response: topicInfoResponseSchema
    },
    handler: hcsController.getTopicInfo
  });

  // Get invoice events from database
  fastify.get('/invoices/:invoiceId/events', {
    schema: {
      params: invoiceParamsSchema,
      response: eventsResponseSchema
    },
    handler: hcsController.getInvoiceEvents
  });

  // Submit custom event to HCS
  fastify.post('/messages/custom', {
    schema: customEventSchema,
    handler: hcsController.submitCustomEvent
  });
}