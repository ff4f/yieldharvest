import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { contractService, CreateEscrowParams, EscrowData } from '../services/contract';
import { ethers } from 'ethers';

// Mock ethers for testing
jest.mock('ethers');
const mockEthers = ethers as jest.Mocked<typeof ethers>;

describe('ContractService', () => {
  let mockProvider: jest.Mocked<ethers.JsonRpcProvider>;
  let mockContract: jest.Mocked<ethers.Contract>;
  let mockSigner: jest.Mocked<ethers.Wallet>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock provider
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 296n, name: 'hedera-testnet' }),
      getBalance: jest.fn().mockResolvedValue(ethers.parseEther('100')),
      getTransactionReceipt: jest.fn(),
      waitForTransaction: jest.fn(),
    } as any;

    // Set up default mock return values for contract methods
    mockContract.owner = jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890');
    mockContract.platformFeeRate = jest.fn().mockResolvedValue(250);
    mockContract.feeRecipient = jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890');
    mockContract.getBalance = jest.fn().mockResolvedValue(ethers.parseEther('100'));

    // Mock signer
    mockSigner = {
      address: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
      getAddress: jest.fn().mockResolvedValue('0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC'),
    } as any;

    // Mock contract
    mockContract = {
      createEscrow: jest.fn(),
      releaseEscrow: jest.fn(),
      refundEscrow: jest.fn(),
      getEscrow: jest.fn(),
      getEscrowsByInvoice: jest.fn(),
      getBalance: jest.fn(),
      owner: jest.fn(),
      platformFeeRate: jest.fn(),
      feeRecipient: jest.fn(),
      target: '0x75e3c67F65a1a7671a4438F2d6ec7d755Ab5D36A',
    } as any;

    // Mock ethers constructors
    mockEthers.JsonRpcProvider = jest.fn().mockReturnValue(mockProvider);
    mockEthers.Wallet = jest.fn().mockReturnValue(mockSigner);
    mockEthers.Contract = jest.fn().mockReturnValue(mockContract);
    mockEthers.parseEther = jest.fn().mockImplementation((value) => BigInt(value) * BigInt(10 ** 18));
    mockEthers.formatEther = jest.fn().mockImplementation((value) => (Number(value) / 10 ** 18).toString());
  });

  describe('createEscrow', () => {
    it('should create escrow successfully', async () => {
      const mockTxResponse = {
        hash: '0xabc123def456',
        wait: jest.fn().mockResolvedValue({
          status: 1,
          blockNumber: 12345,
          gasUsed: BigInt(150000),
          logs: [{
            topics: ['0x...', '0x...'],
            data: '0x...',
          }],
        }),
      };

      mockContract.createEscrow.mockResolvedValue(mockTxResponse);

      const params: CreateEscrowParams = {
        invoiceId: 'test-invoice-123',
        buyerAddress: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        amount: '100',
        dueDateTimestamp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
      };

      const result = await contractService.createEscrow(params);

      expect(result).toEqual({
        escrowId: expect.any(String),
        transactionHash: '0xabc123def456',
        blockNumber: 12345,
        gasUsed: '150000',
        status: 'confirmed',
      });

      expect(mockContract.createEscrow).toHaveBeenCalledWith(
        'test-invoice-123',
        '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        mockEthers.parseEther('100'),
        params.dueDateTimestamp,
        { value: mockEthers.parseEther('100') }
      );
    });

    it('should handle transaction failure', async () => {
      const mockTxResponse = {
        hash: '0xfailed123',
        wait: jest.fn().mockResolvedValue({
          status: 0, // Failed transaction
          blockNumber: 12346,
          gasUsed: BigInt(50000),
        }),
      };

      mockContract.createEscrow.mockResolvedValue(mockTxResponse);

      const params: CreateEscrowParams = {
        invoiceId: 'test-invoice-456',
        buyerAddress: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        amount: '50',
        dueDateTimestamp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      await expect(contractService.createEscrow(params)).rejects.toThrow('Transaction failed');
    });

    it('should handle contract revert', async () => {
      mockContract.createEscrow.mockRejectedValue(new Error('execution reverted: Insufficient funds'));

      const params: CreateEscrowParams = {
        invoiceId: 'test-invoice-789',
        buyerAddress: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        amount: '1000000', // Very large amount
        dueDateTimestamp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      await expect(contractService.createEscrow(params)).rejects.toThrow('execution reverted: Insufficient funds');
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow successfully', async () => {
      const mockTxResponse = {
        hash: '0xrelease123',
        wait: jest.fn().mockResolvedValue({
          status: 1,
          blockNumber: 12347,
          gasUsed: BigInt(80000),
        }),
      };

      mockContract.releaseEscrow.mockResolvedValue(mockTxResponse);

      const result = await contractService.releaseEscrow('1');

      expect(result).toEqual({
        escrowId: '1',
        transactionHash: '0xrelease123',
        blockNumber: 12347,
        gasUsed: '80000',
        status: 'confirmed',
      });

      expect(mockContract.releaseEscrow).toHaveBeenCalledWith(1);
    });

    it('should handle unauthorized release', async () => {
      mockContract.releaseEscrow.mockRejectedValue(new Error('execution reverted: Not authorized'));

      await expect(contractService.releaseEscrow('1')).rejects.toThrow('execution reverted: Not authorized');
    });
  });

  describe('refundEscrow', () => {
    it('should refund escrow successfully', async () => {
      const mockTxResponse = {
        hash: '0xrefund123',
        wait: jest.fn().mockResolvedValue({
          status: 1,
          blockNumber: 12348,
          gasUsed: BigInt(75000),
        }),
      };

      mockContract.refundEscrow.mockResolvedValue(mockTxResponse);

      const result = await contractService.refundEscrow('2');

      expect(result).toEqual({
        escrowId: '2',
        transactionHash: '0xrefund123',
        blockNumber: 12348,
        gasUsed: '75000',
        status: 'confirmed',
      });

      expect(mockContract.refundEscrow).toHaveBeenCalledWith(2);
    });

    it('should handle escrow not eligible for refund', async () => {
      mockContract.refundEscrow.mockRejectedValue(new Error('execution reverted: Escrow not refundable'));

      await expect(contractService.refundEscrow('2')).rejects.toThrow('execution reverted: Escrow not refundable');
    });
  });

  describe('getEscrow', () => {
    it('should retrieve escrow data successfully', async () => {
      const mockEscrowData = {
        id: BigInt(1),
        invoiceId: 'test-invoice-123',
        seller: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
        buyer: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        amount: BigInt('100000000000000000000'), // 100 HBAR in wei
        dueDate: BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60),
        status: 0, // Active
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
      };

      mockContract.getEscrow.mockResolvedValue(mockEscrowData);

      const result = await contractService.getEscrow('1');

      expect(result).toEqual({
        id: BigInt(1),
        invoiceId: 'test-invoice-123',
        seller: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
        buyer: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        amount: BigInt('100000000000000000000'),
        dueDate: mockEscrowData.dueDate,
        status: 0,
        createdAt: mockEscrowData.createdAt,
      });

      expect(mockContract.getEscrow).toHaveBeenCalledWith(1);
    });

    it('should return null for non-existent escrow', async () => {
      mockContract.getEscrow.mockRejectedValue(new Error('execution reverted: Escrow does not exist'));

      const result = await contractService.getEscrow('999');
      expect(result).toBeNull();
    });
  });

  describe('getEscrowsByInvoice', () => {
    it('should retrieve escrow IDs for invoice', async () => {
      const mockEscrowIds = [BigInt(1), BigInt(2), BigInt(3)];
      mockContract.getEscrowsByInvoice.mockResolvedValue(mockEscrowIds);

      const result = await contractService.getEscrowsByInvoice('test-invoice-123');

      expect(result).toEqual(['1', '2', '3']);
      expect(mockContract.getEscrowsByInvoice).toHaveBeenCalledWith('test-invoice-123');
    });

    it('should return empty array for invoice with no escrows', async () => {
      mockContract.getEscrowsByInvoice.mockResolvedValue([]);

      const result = await contractService.getEscrowsByInvoice('empty-invoice');
      expect(result).toEqual([]);
    });
  });

  describe('getContractInfo', () => {
    it('should retrieve contract information', async () => {
      mockContract.getBalance.mockResolvedValue(BigInt('500000000000000000000')); // 500 HBAR
      mockContract.owner.mockResolvedValue('0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC');
      mockContract.platformFeeRate.mockResolvedValue(BigInt(250)); // 2.5%
      mockContract.feeRecipient.mockResolvedValue('0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC');

      const result = await contractService.getContractInfo();

      expect(result).toEqual({
        address: '0x75e3c67F65a1a7671a4438F2d6ec7d755Ab5D36A',
        balance: '500.0',
        owner: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
        platformFeeRate: '2.5',
        feeRecipient: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
      });
    });
  });

  describe('utility methods', () => {
    it('should generate correct HashScan URLs', () => {
      const txUrl = contractService.getHashScanUrl('0xabc123');
      expect(txUrl).toBe('https://hashscan.io/testnet/transaction/0xabc123');

      const contractUrl = contractService.getContractHashScanUrl();
      expect(contractUrl).toBe('https://hashscan.io/testnet/contract/0x1234567890123456789012345678901234567890');
    });
  });
});