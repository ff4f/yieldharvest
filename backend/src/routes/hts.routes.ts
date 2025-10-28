import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { HTSController } from '../controllers/hts.controller';
import { HederaService } from '../services/hedera';

export async function htsRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Get HederaService instance from fastify decorator
  const hederaService = (fastify as any).hederaService as HederaService;
  const htsController = new HTSController(hederaService);

  // Create NFT token
  fastify.post('/tokens', {
    schema: {
      description: 'Create a new NFT token for invoices',
      tags: ['HTS'],
      body: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Token name',
          },
          symbol: {
            type: 'string',
            minLength: 1,
            maxLength: 10,
            pattern: '^[A-Z0-9]+$',
            description: 'Token symbol (uppercase alphanumeric)',
          },
          memo: {
            type: 'string',
            maxLength: 100,
            description: 'Optional memo for the token',
          },
        },
        required: ['name', 'symbol'],
      },
      response: {
        201: {
          description: 'Token created successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            tokenId: { type: 'string' },
            transactionId: { type: 'string' },
            name: { type: 'string' },
            symbol: { type: 'string' },
            memo: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
            tokenUrl: { type: 'string' },
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
    return htsController.createToken(request, reply);
  });

  // Mint invoice NFT
  fastify.post('/mint', {
    schema: {
      description: 'Mint an invoice NFT',
      tags: ['HTS'],
      body: {
        type: 'object',
        properties: {
          tokenId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera Token ID',
          },
          invoiceId: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Unique invoice identifier',
          },
          invoiceNumber: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Invoice number',
          },
          amount: {
            type: 'string',
            pattern: '^\\d+(\\.\\d{1,8})?$',
            description: 'Invoice amount',
          },
          currency: {
            type: 'string',
            pattern: '^[A-Z]{3}$',
            description: '3-letter currency code',
          },
          dueDate: {
            type: 'string',
            format: 'date-time',
            description: 'Invoice due date',
          },
          supplierId: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Supplier identifier',
          },
          buyerId: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Buyer identifier',
          },
          fileId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Optional Hedera File ID for invoice document',
          },
          fileHash: {
            type: 'string',
            description: 'Optional file hash for integrity verification',
          },
          metadata: {
            type: 'object',
            additionalProperties: { type: 'string' },
            description: 'Additional metadata',
          },
        },
        required: ['tokenId', 'invoiceId', 'invoiceNumber', 'amount', 'currency', 'dueDate', 'supplierId', 'buyerId'],
      },
      response: {
        201: {
          description: 'NFT minted successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            tokenId: { type: 'string' },
            serialNumber: { type: 'string' },
            transactionId: { type: 'string' },
            invoiceId: { type: 'string' },
            invoiceNumber: { type: 'string' },
            amount: { type: 'string' },
            currency: { type: 'string' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
            nftUrl: { type: 'string' },
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
    return htsController.mintNFT(request, reply);
  });

  // Get NFT information
  fastify.get('/:tokenId/:serialNumber', {
    schema: {
      description: 'Get NFT information',
      tags: ['HTS'],
      params: {
        type: 'object',
        properties: {
          tokenId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera Token ID',
          },
          serialNumber: {
            type: 'string',
            pattern: '^\\d+$',
            description: 'NFT serial number',
          },
        },
        required: ['tokenId', 'serialNumber'],
      },
      response: {
        200: {
          description: 'NFT information',
          type: 'object',
          properties: {
            tokenId: { type: 'string' },
            serialNumber: { type: 'string' },
            nftInfo: { type: 'object' },
            hashScanUrl: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
          },
        },
        404: {
          description: 'NFT not found',
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            tokenId: { type: 'string' },
            serialNumber: { type: 'string' },
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
    return htsController.getNFT(request, reply);
  });

  // Get token information
  fastify.get('/tokens/:tokenId', {
    schema: {
      description: 'Get token information',
      tags: ['HTS'],
      params: {
        type: 'object',
        properties: {
          tokenId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera Token ID',
          },
        },
        required: ['tokenId'],
      },
      response: {
        200: {
          description: 'Token information',
          type: 'object',
          properties: {
            message: { type: 'string' },
            tokenId: { type: 'string' },
            note: { type: 'string' },
            suggestion: { type: 'string' },
            mirrorNodeUrl: { type: 'string' },
            hashScanUrl: { type: 'string' },
          },
        },
        400: {
          description: 'Invalid token ID',
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
    return htsController.getToken(request, reply);
  });

  // List NFTs for a token
  fastify.get('/:tokenId/nfts', {
    schema: {
      description: 'List NFTs for a token',
      tags: ['HTS'],
      params: {
        type: 'object',
        properties: {
          tokenId: {
            type: 'string',
            pattern: '^0\\.0\\.\\d+$',
            description: 'Hedera Token ID',
          },
        },
        required: ['tokenId'],
      },
      response: {
        200: {
          description: 'NFT listing information',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            tokenId: { type: 'string' },
            nfts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tokenId: { type: 'string' },
                  serialNumber: { type: 'number' },
                  accountId: { type: 'string' },
                  createdTimestamp: { type: 'string' },
                  modifiedTimestamp: { type: 'string' },
                  metadata: { type: 'object' },
                  spender: { type: 'string' },
                  hashScanUrl: { type: 'string' },
                  mirrorNodeUrl: { type: 'string' }
                }
              }
            },
            count: { type: 'number' },
            limit: { type: 'number' },
            order: { type: 'string' },
            links: {
              type: 'object',
              properties: {
                hashScan: { type: 'string' },
                mirrorNode: { type: 'string' }
              }
            }
          },
        },
        400: {
          description: 'Invalid token ID',
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
    return htsController.listNFTs(request, reply);
  });
}