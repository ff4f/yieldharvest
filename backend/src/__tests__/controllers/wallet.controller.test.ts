import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Fastify from 'fastify';
import { WalletController } from '../../controllers/wallet.controller';
import { WalletService, WalletConfig } from '../../services/wallet.service';

// Mock the Hedera SDK
jest.mock('@hashgraph/sdk', () => ({
  Transaction: {
    fromBytes: jest.fn().mockReturnValue({
      transactionId: null,
      freeze: jest.fn(),
      toBytes: jest.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      _makeTransactionBody: jest.fn().mockReturnValue({
        toBytes: jest.fn().mockReturnValue(new Uint8Array([4, 5, 6]))
      })
    })
  }
}));

jest.mock('../../services/wallet.service');
const MockedWalletService = WalletService as jest.MockedClass<typeof WalletService>;

describe('WalletController', () => {
  let app: FastifyInstance;
  let walletController: WalletController;
  let mockWalletService: jest.Mocked<WalletService>;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    const mockConfig: WalletConfig = {
      network: 'testnet',
      mirrorNodeUrl: 'https://testnet.mirrornode.hedera.com'
    };
    mockWalletService = new MockedWalletService(mockConfig) as jest.Mocked<WalletService>;
    walletController = new WalletController(mockWalletService);
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('initHashPack', () => {
    it('should initialize HashPack wallet successfully', async () => {
      const mockConfig = {
        name: 'YieldHarvest',
        description: 'Invoice factoring platform',
        icon: 'https://example.com/icon.png',
        url: 'https://example.com'
      };

      mockWalletService.initHashPack.mockResolvedValue(true);

      const request = {
        body: mockConfig
      } as FastifyRequest<{ Body: typeof mockConfig }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.initHashPack(request, reply);

      expect(mockWalletService.initHashPack).toHaveBeenCalledWith(mockConfig);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'HashPack wallet initialization successful',
        metadata: mockConfig
      });
    });

    it('should handle HashPack initialization failure', async () => {
      const mockConfig = {
        name: 'YieldHarvest',
        description: 'Invoice factoring platform',
        icon: 'https://example.com/icon.png',
        url: 'https://example.com'
      };

      mockWalletService.initHashPack.mockRejectedValue(new Error('Initialization failed'));

      const request = {
        body: mockConfig
      } as FastifyRequest<{ Body: typeof mockConfig }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.initHashPack(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'INTERNAL_ERROR',
        message: 'Failed to initialize HashPack wallet'
      });
    });
  });

  describe('initBlade', () => {
    it('should initialize Blade wallet successfully', async () => {
      const mockConfig = {
        network: 'testnet' as const,
        dAppCode: 'yieldharvest'
      };

      mockWalletService.initBlade.mockResolvedValue(true);

      const request = {
        body: mockConfig
      } as FastifyRequest<{ Body: typeof mockConfig }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.initBlade(request, reply);

      expect(mockWalletService.initBlade).toHaveBeenCalledWith(mockConfig);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Blade wallet initialization successful',
        config: {
          network: 'testnet',
          dAppCode: 'yieldharvest'
        }
      });
    });
  });

  describe('connectWallet', () => {
    it('should connect wallet successfully', async () => {
      const mockRequest = {
        provider: {
          name: 'hashpack' as const,
          isConnected: false,
          account: {
            accountId: '0.0.123456',
            publicKey: 'mock-public-key',
            network: 'testnet'
          }
        }
      };

      mockWalletService.validateWalletAccount.mockReturnValue(true);
      mockWalletService.connectWallet.mockResolvedValue(true);

      const request = {
        body: mockRequest
      } as FastifyRequest<{ Body: typeof mockRequest }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.connectWallet(request, reply);

      expect(mockWalletService.connectWallet).toHaveBeenCalledWith(mockRequest.provider);
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Wallet connected successfully',
        wallet: {
          name: 'hashpack',
          accountId: '0.0.123456',
          network: 'testnet'
        }
      });
    });

    it('should handle wallet connection failure', async () => {
      const mockRequest = {
        provider: {
          name: 'hashpack' as const,
          isConnected: false
        }
      };

      mockWalletService.connectWallet.mockRejectedValue(new Error('Connection failed'));

      const request = {
        body: mockRequest
      } as FastifyRequest<{ Body: typeof mockRequest }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.connectWallet(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'INTERNAL_ERROR',
        message: 'Failed to connect wallet'
      });
    });
  });

  describe('disconnectWallet', () => {
    it('should disconnect wallet successfully', async () => {
      mockWalletService.disconnectWallet.mockResolvedValue(undefined);

      const request = {} as FastifyRequest;
      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.disconnectWallet(request, reply);

      expect(mockWalletService.disconnectWallet).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Wallet disconnected successfully'
      });
    });
  });

  describe('getWalletStatus', () => {
    it('should return wallet status', async () => {
      const mockWallet = {
        name: 'hashpack' as const,
        isConnected: true,
        account: {
          accountId: '0.0.123456',
          publicKey: 'mock-public-key',
          network: 'testnet'
        }
      };

      mockWalletService.getConnectedWallet.mockReturnValue(mockWallet);
      mockWalletService.isWalletConnected.mockReturnValue(true);
      mockWalletService.getConnectedAccountId.mockReturnValue('0.0.123456');

      const request = {} as FastifyRequest;
      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.getWalletStatus(request, reply);

      expect(mockWalletService.getConnectedWallet).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith({
        isConnected: true,
        wallet: {
          name: 'hashpack',
          accountId: '0.0.123456',
          network: 'testnet'
        }
      });
    });
  });

  describe('prepareTransaction', () => {
    it('should prepare transaction successfully', async () => {
      const mockRequest = {
        transactionBytes: 'mock-tx-bytes',
        payerAccountId: '0.0.123456',
        description: 'Test transaction'
      };

      const mockPreparedTx = {
        transactionId: 'mock-tx-id',
        transactionBytes: new Uint8Array([1, 2, 3]),
        bodyBytes: new Uint8Array([4, 5, 6])
      };

      const mockSigningRequest = {
        transactionBytes: 'base64-encoded-bytes',
        accountId: '0.0.123456',
        description: 'Test transaction',
        network: 'testnet'
      };

      mockWalletService.prepareTransactionForSigning.mockResolvedValue(mockPreparedTx);
      mockWalletService.createSigningRequest.mockReturnValue(mockSigningRequest);

      const request = {
        body: mockRequest
      } as FastifyRequest<{ Body: typeof mockRequest }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.prepareTransaction(request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        transactionId: 'mock-tx-id',
        signingRequest: mockSigningRequest
      });
    });

    it('should handle transaction preparation failure', async () => {
      const mockRequest = {
        transactionBytes: 'mock-tx-bytes',
        payerAccountId: '0.0.123456'
      };

      mockWalletService.prepareTransactionForSigning.mockRejectedValue(new Error('Preparation failed'));

      const request = {
        body: mockRequest
      } as FastifyRequest<{ Body: typeof mockRequest }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.prepareTransaction(request, reply);

      expect(reply.status).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        error: 'INTERNAL_ERROR',
        message: 'Failed to prepare transaction'
      });
    });
  });

  describe('verifyTransaction', () => {
    it('should verify signed transaction successfully', async () => {
      const mockRequest = {
        transactionBytes: 'mock-tx-bytes',
        signedBytes: 'mock-signed-bytes',
        expectedSignerAccountId: '0.0.123456'
      };

      mockWalletService.verifySignedTransaction.mockResolvedValue(true);

      const request = {
        body: mockRequest
      } as FastifyRequest<{ Body: typeof mockRequest }>;

      const reply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn()
      } as unknown as FastifyReply;

      await walletController.verifyTransaction(request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        isValid: true,
        message: 'Transaction signature is valid'
      });
    });
  });
});