import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { WalletService, WalletProvider, WalletAccount, HashPackMetadata, BladeWalletConfig } from '../services/wallet.service';
import { auditLogger, logger } from '../utils/logger';

// Zod schemas for validation
const WalletAccountSchema = z.object({
  accountId: z.string().min(1, 'Account ID is required'),
  publicKey: z.string().min(1, 'Public key is required'),
  network: z.enum(['testnet', 'mainnet'], {
    errorMap: () => ({ message: 'Network must be testnet or mainnet' }),
  }),
});

const WalletProviderSchema = z.object({
  name: z.enum(['hashpack', 'blade'], {
    errorMap: () => ({ message: 'Wallet provider must be hashpack or blade' }),
  }),
  isConnected: z.boolean(),
  account: WalletAccountSchema.optional(),
});

const HashPackInitSchema = z.object({
  name: z.string().min(1, 'App name is required'),
  description: z.string().min(1, 'App description is required'),
  icon: z.string().url('Icon must be a valid URL'),
  url: z.string().url('App URL must be valid'),
});

const BladeInitSchema = z.object({
  network: z.enum(['testnet', 'mainnet']),
  dAppCode: z.string().min(1, 'dApp code is required'),
});

const ConnectWalletSchema = z.object({
  provider: WalletProviderSchema,
});

const VerifyTransactionSchema = z.object({
  transactionBytes: z.string().min(1, 'Transaction bytes are required'),
  signedBytes: z.string().min(1, 'Signed bytes are required'),
  expectedSignerAccountId: z.string().min(1, 'Expected signer account ID is required'),
});

const PrepareTransactionSchema = z.object({
  transactionBytes: z.string().min(1, 'Transaction bytes are required'),
  payerAccountId: z.string().min(1, 'Payer account ID is required'),
  description: z.string().optional(),
});

const SignedTransactionResponseSchema = z.object({
  transactionBytes: z.string().min(1, 'Transaction bytes are required'),
  signedBytes: z.string().min(1, 'Signed bytes are required'),
  transactionId: z.string().min(1, 'Transaction ID is required'),
});

export class WalletController {
  private walletService: WalletService;

  constructor(walletService: WalletService) {
    this.walletService = walletService;
  }

  /**
   * Initialize HashPack wallet
   */
  async initHashPack(request: FastifyRequest, reply: FastifyReply) {
    try {
      const metadata = HashPackInitSchema.parse(request.body);

      const success = await this.walletService.initHashPack(metadata);

      if (success) {
        auditLogger.logHederaTransaction({
          txId: 'hashpack-init',
          action: 'WALLET_INIT',
          success: true,
        });

        return reply.send({
          success: true,
          message: 'HashPack wallet initialization successful',
          metadata,
        });
      } else {
        return reply.status(500).send({
          error: 'INITIALIZATION_FAILED',
          message: 'Failed to initialize HashPack wallet',
        });
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to initialize HashPack wallet');

      auditLogger.logHederaTransaction({
        txId: 'hashpack-init',
        action: 'WALLET_INIT',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to initialize HashPack wallet',
      });
    }
  }

  /**
   * Initialize Blade wallet
   */
  async initBlade(request: FastifyRequest, reply: FastifyReply) {
    try {
      const config = BladeInitSchema.parse(request.body);

      const success = await this.walletService.initBlade(config);

      if (success) {
        auditLogger.logHederaTransaction({
          txId: 'blade-init',
          action: 'WALLET_INIT',
          success: true,
        });

        return reply.send({
          success: true,
          message: 'Blade wallet initialization successful',
          config: {
            network: config.network,
            dAppCode: config.dAppCode,
          },
        });
      } else {
        return reply.status(500).send({
          error: 'INITIALIZATION_FAILED',
          message: 'Failed to initialize Blade wallet',
        });
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to initialize Blade wallet');

      auditLogger.logHederaTransaction({
        txId: 'blade-init',
        action: 'WALLET_INIT',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to initialize Blade wallet',
      });
    }
  }

  /**
   * Connect wallet
   */
  async connectWallet(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { provider } = ConnectWalletSchema.parse(request.body);

      // Validate wallet account if provided
      if (provider.account && !this.walletService.validateWalletAccount(provider.account)) {
        return reply.status(400).send({
          error: 'INVALID_ACCOUNT',
          message: 'Invalid wallet account format',
        });
      }

      const success = await this.walletService.connectWallet(provider);

      if (success) {
        auditLogger.logHederaTransaction({
          txId: `${provider.name}-connect`,
          action: 'WALLET_CONNECT',
          success: true,
        });

        return reply.send({
          success: true,
          message: 'Wallet connected successfully',
          wallet: {
            name: provider.name,
            accountId: provider.account?.accountId,
            network: provider.account?.network,
          },
        });
      } else {
        return reply.status(500).send({
          error: 'CONNECTION_FAILED',
          message: 'Failed to connect wallet',
        });
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to connect wallet');

      auditLogger.logHederaTransaction({
        txId: 'wallet-connect',
        action: 'WALLET_CONNECT',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to connect wallet',
      });
    }
  }

  /**
   * Disconnect wallet
   */
  async disconnectWallet(request: FastifyRequest, reply: FastifyReply) {
    try {
      const connectedWallet = this.walletService.getConnectedWallet();
      
      await this.walletService.disconnectWallet();

      auditLogger.logHederaTransaction({
        txId: `${connectedWallet?.name || 'unknown'}-disconnect`,
        action: 'WALLET_DISCONNECT',
        success: true,
      });

      return reply.send({
        success: true,
        message: 'Wallet disconnected successfully',
      });
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to disconnect wallet');

      auditLogger.logHederaTransaction({
        txId: 'wallet-disconnect',
        action: 'WALLET_DISCONNECT',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to disconnect wallet',
      });
    }
  }

  /**
   * Get wallet status
   */
  async getWalletStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const connectedWallet = this.walletService.getConnectedWallet();
      const isConnected = this.walletService.isWalletConnected();
      const accountId = this.walletService.getConnectedAccountId();

      return reply.send({
        isConnected,
        wallet: connectedWallet ? {
          name: connectedWallet.name,
          accountId,
          network: connectedWallet.account?.network,
        } : null,
      });
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get wallet status');

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get wallet status',
      });
    }
  }

  /**
   * Get supported wallets
   */
  async getSupportedWallets(request: FastifyRequest, reply: FastifyReply) {
    try {
      const wallets = this.walletService.getSupportedWallets();

      return reply.send({
        wallets,
      });
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to get supported wallets');

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get supported wallets',
      });
    }
  }

  /**
   * Prepare transaction for signing
   */
  async prepareTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { transactionBytes, payerAccountId, description } = PrepareTransactionSchema.parse(request.body);

      // Decode transaction bytes from base64
      const txBytes = Buffer.from(transactionBytes, 'base64');
      
      // Import Transaction class dynamically to avoid circular dependencies
      const { Transaction } = await import('@hashgraph/sdk');
      const transaction = Transaction.fromBytes(txBytes);

      const prepared = await this.walletService.prepareTransactionForSigning(
        transaction,
        payerAccountId
      );

      const signingRequest = this.walletService.createSigningRequest(
        prepared.transactionBytes,
        payerAccountId,
        description
      );

      auditLogger.logHederaTransaction({
        txId: prepared.transactionId,
        action: 'TRANSACTION_PREPARE',
        success: true,
      });

      return reply.send({
        success: true,
        transactionId: prepared.transactionId,
        signingRequest,
      });
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to prepare transaction');

      auditLogger.logHederaTransaction({
        txId: 'unknown',
        action: 'TRANSACTION_PREPARE',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to prepare transaction',
      });
    }
  }

  /**
   * Verify signed transaction
   */
  async verifyTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { transactionBytes, signedBytes, expectedSignerAccountId } = VerifyTransactionSchema.parse(request.body);

      // Decode bytes from base64
      const txBytes = Buffer.from(transactionBytes, 'base64');
      const signedTxBytes = Buffer.from(signedBytes, 'base64');

      const isValid = await this.walletService.verifySignedTransaction(
        txBytes,
        signedTxBytes,
        expectedSignerAccountId
      );

      auditLogger.logHederaTransaction({
        txId: 'verification',
        action: 'TRANSACTION_VERIFY',
        success: isValid,
      });

      return reply.send({
        success: true,
        isValid,
        message: isValid ? 'Transaction signature is valid' : 'Transaction signature is invalid',
      });
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to verify transaction');

      auditLogger.logHederaTransaction({
        txId: 'verification',
        action: 'TRANSACTION_VERIFY',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to verify transaction',
      });
    }
  }

  /**
   * Process signed transaction response
   */
  async processSignedTransaction(request: FastifyRequest, reply: FastifyReply) {
    try {
      const response = SignedTransactionResponseSchema.parse(request.body);

      const signedTransaction = this.walletService.parseSignedTransactionResponse(response);

      // Verify the signed transaction
      const isValid = await this.walletService.verifySignedTransaction(
        signedTransaction.transactionBytes,
        signedTransaction.signedBytes,
        this.walletService.getConnectedAccountId() || ''
      );

      if (!isValid) {
        return reply.status(400).send({
          error: 'INVALID_SIGNATURE',
          message: 'Transaction signature is invalid',
        });
      }

      auditLogger.logHederaTransaction({
        txId: signedTransaction.transactionId,
        action: 'TRANSACTION_PROCESS',
        success: true,
      });

      return reply.send({
        success: true,
        transactionId: signedTransaction.transactionId,
        message: 'Signed transaction processed successfully',
        signedTransaction: {
          transactionId: signedTransaction.transactionId,
          signedBytes: Buffer.from(signedTransaction.signedBytes).toString('base64'),
        },
      });
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
      }, 'Failed to process signed transaction');

      auditLogger.logHederaTransaction({
        txId: 'unknown',
        action: 'TRANSACTION_PROCESS',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        error: 'INTERNAL_ERROR',
        message: 'Failed to process signed transaction',
      });
    }
  }
}