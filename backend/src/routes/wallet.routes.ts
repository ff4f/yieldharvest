import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { WalletController } from '../controllers/wallet.controller';
import { WalletService } from '../services/wallet.service';

export async function walletRoutes(fastify: FastifyInstance) {
  const walletService = new WalletService({
    network: (process.env.HEDERA_NETWORK as 'testnet' | 'mainnet') || 'testnet',
    mirrorNodeUrl: process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com',
  });

  const walletController = new WalletController(walletService);

  // Initialize HashPack wallet
  fastify.post('/hashpack/init', {
    schema: {
      description: 'Initialize HashPack wallet connection',
      tags: ['Wallet'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Application name' },
          description: { type: 'string', description: 'Application description' },
          icon: { type: 'string', format: 'uri', description: 'Application icon URL' },
          url: { type: 'string', format: 'uri', description: 'Application URL' },
        },
        required: ['name', 'description', 'icon', 'url'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            metadata: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                icon: { type: 'string' },
                url: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return walletController.initHashPack(request, reply);
  });

  // Initialize Blade wallet
  fastify.post('/blade/init', {
    schema: {
      description: 'Initialize Blade wallet connection',
      tags: ['Wallet'],
      body: {
        type: 'object',
        properties: {
          network: { type: 'string', enum: ['testnet', 'mainnet'], description: 'Hedera network' },
          dAppCode: { type: 'string', description: 'dApp code for Blade wallet' },
        },
        required: ['network', 'dAppCode'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            config: {
              type: 'object',
              properties: {
                network: { type: 'string' },
                dAppCode: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return walletController.initBlade(request, reply);
  });

  // Connect wallet
  fastify.post('/connect', {
    schema: {
      description: 'Connect to a wallet (HashPack or Blade)',
      tags: ['Wallet'],
      body: {
        type: 'object',
        properties: {
          provider: {
            type: 'object',
            properties: {
              name: { type: 'string', enum: ['hashpack', 'blade'], description: 'Wallet provider name' },
              isConnected: { type: 'boolean', description: 'Connection status' },
              account: {
                type: 'object',
                properties: {
                  accountId: { type: 'string', description: 'Hedera account ID' },
                  publicKey: { type: 'string', description: 'Account public key' },
                  network: { type: 'string', enum: ['testnet', 'mainnet'], description: 'Network' },
                },
                required: ['accountId', 'publicKey', 'network'],
              },
            },
            required: ['name', 'isConnected'],
          },
        },
        required: ['provider'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            wallet: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                accountId: { type: 'string' },
                network: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return walletController.connectWallet(request, reply);
  });

  // Disconnect wallet
  fastify.post('/disconnect', {
    schema: {
      description: 'Disconnect current wallet',
      tags: ['Wallet'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return walletController.disconnectWallet(request, reply);
  });

  // Get wallet status
  fastify.get('/status', {
    schema: {
      description: 'Get current wallet connection status',
      tags: ['Wallet'],
      response: {
        200: {
          type: 'object',
          properties: {
            isConnected: { type: 'boolean' },
            wallet: {
              type: 'object',
              nullable: true,
              properties: {
                name: { type: 'string' },
                accountId: { type: 'string' },
                network: { type: 'string' },
              },
            },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return walletController.getWalletStatus(request, reply);
  });

  // Get supported wallets
  fastify.get('/supported', {
    schema: {
      description: 'Get list of supported wallet providers',
      tags: ['Wallet'],
      response: {
        200: {
          type: 'object',
          properties: {
            wallets: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  displayName: { type: 'string' },
                  icon: { type: 'string' },
                },
              },
            },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return walletController.getSupportedWallets(request, reply);
  });

  // Prepare transaction for signing
  fastify.post('/transaction/prepare', {
    schema: {
      description: 'Prepare a transaction for wallet signing',
      tags: ['Wallet'],
      body: {
        type: 'object',
        properties: {
          transactionBytes: { type: 'string', description: 'Base64 encoded transaction bytes' },
          payerAccountId: { type: 'string', description: 'Payer account ID' },
          description: { type: 'string', description: 'Transaction description' },
        },
        required: ['transactionBytes', 'payerAccountId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            transactionId: { type: 'string' },
            signingRequest: {
              type: 'object',
              properties: {
                transactionBytes: { type: 'string' },
                accountId: { type: 'string' },
                description: { type: 'string' },
                network: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return walletController.prepareTransaction(request, reply);
  });

  // Verify signed transaction
  fastify.post('/transaction/verify', {
    schema: {
      description: 'Verify a signed transaction',
      tags: ['Wallet'],
      body: {
        type: 'object',
        properties: {
          transactionBytes: { type: 'string', description: 'Base64 encoded original transaction bytes' },
          signedBytes: { type: 'string', description: 'Base64 encoded signed transaction bytes' },
          expectedSignerAccountId: { type: 'string', description: 'Expected signer account ID' },
        },
        required: ['transactionBytes', 'signedBytes', 'expectedSignerAccountId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            isValid: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return walletController.verifyTransaction(request, reply);
  });

  // Process signed transaction response
  fastify.post('/transaction/process', {
    schema: {
      description: 'Process a signed transaction response from wallet',
      tags: ['Wallet'],
      body: {
        type: 'object',
        properties: {
          transactionBytes: { type: 'string', description: 'Base64 encoded original transaction bytes' },
          signedBytes: { type: 'string', description: 'Base64 encoded signed transaction bytes' },
          transactionId: { type: 'string', description: 'Transaction ID' },
        },
        required: ['transactionBytes', 'signedBytes', 'transactionId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            transactionId: { type: 'string' },
            message: { type: 'string' },
            signedTransaction: {
              type: 'object',
              properties: {
                transactionId: { type: 'string' },
                signedBytes: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'array' },
          },
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    return walletController.processSignedTransaction(request, reply);
  });
}