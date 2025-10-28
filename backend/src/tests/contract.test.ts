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

    // Mock signer
    mockSigner = {
      address: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
      getAddress: jest.fn().mockResolvedValue('0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC'),
    } as any;

    // Mock contract
    mockContract = {
      deposit: jest.fn(),
      release: jest.fn(),
      invoiceToEscrowId: jest.fn(),
      escrows: jest.fn(),
      getBalance: jest.fn().mockResolvedValue(ethers.parseEther('100')),
      owner: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      platformFeeRate: jest.fn().mockResolvedValue(250),
      feeRecipient: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
      target: '0x75e3c67F65a1a7671a4438F2d6ec7d755Ab5D36A',
      interface: {
        parseLog: jest.fn() as jest.MockedFunction<any>,
      },
    } as any;

    // Mock ethers constructors
    mockEthers.Contract = jest.fn().mockImplementation(() => {
      // Return a contract that has a connect method
      const contract = { ...mockContract };
      contract.connect = jest.fn().mockReturnValue(mockContract);
      return contract;
    });
    mockEthers.JsonRpcProvider = jest.fn().mockImplementation(() => mockProvider);
    mockEthers.Wallet = jest.fn().mockImplementation(() => mockSigner) as any;
    mockEthers.parseEther = jest.fn().mockImplementation((value) => BigInt(value) * BigInt(10 ** 18));
    mockEthers.formatEther = jest.fn().mockImplementation((value) => (Number(value) / 10 ** 18).toString());

    // Directly set the contract property and other properties
    (contractService as any).contract = mockContract;
    (contractService as any).contractAddress = '0x75e3c67F65a1a7671a4438F2d6ec7d755Ab5D36A';
    (contractService as any).provider = mockProvider;
  });

  describe('createEscrow', () => {
    it('should create escrow successfully', async () => {
      const mockLog = {
        topics: ['0x...', '0x...'],
        data: '0x...',
      };
      
      const mockTxResponse = {
        hash: '0xabc123def456',
        wait: jest.fn().mockResolvedValue({
          status: 1,
          blockNumber: 12345,
          gasUsed: BigInt(150000),
          logs: [mockLog],
        }),
      };

      // Mock parseLog to return EscrowCreated event (called twice)
      const mockParsedEvent = { name: 'EscrowCreated', args: { escrowId: BigInt(1) } };
      (mockContract.interface.parseLog as jest.MockedFunction<any>)
        .mockReturnValue(mockParsedEvent);

      mockContract.deposit.mockResolvedValue(mockTxResponse);

      const params: CreateEscrowParams = {
        invoiceId: 'test-invoice-123',
        supplierAddress: '0.0.12345',
        amount: '100',
        nftSerialNumber: 1,
      };

      const result = await contractService.createEscrow(params);

      expect(result).toEqual({
        escrowId: '1',
        transactionHash: '0xabc123def456',
        blockNumber: 12345,
        gasUsed: '150000',
        status: 'confirmed',
      });

      expect(mockContract.deposit).toHaveBeenCalledWith(
        'test-invoice-123',
        '0.0.12345',
        1,
        { value: mockEthers.parseEther('100'), gasLimit: 500000 }
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

      mockContract.deposit.mockResolvedValue(mockTxResponse);

      const params: CreateEscrowParams = {
        invoiceId: 'test-invoice-456',
        supplierAddress: '0.0.12345',
        amount: '50',
        nftSerialNumber: 1,
      };

      await expect(contractService.createEscrow(params)).rejects.toThrow('Transaction failed');
    });

    it('should handle contract revert', async () => {
      mockContract.deposit.mockRejectedValue(new Error('execution reverted: Insufficient funds'));

      const params: CreateEscrowParams = {
        invoiceId: 'test-invoice-789',
        supplierAddress: '0.0.12345',
        amount: '1000000', // Very large amount
        nftSerialNumber: 1,
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

      mockContract.invoiceToEscrowId.mockResolvedValue(BigInt(1));
      mockContract.release.mockResolvedValue(mockTxResponse);

      const result = await contractService.releaseEscrow('test-invoice-123');

      expect(result).toEqual({
        escrowId: '1',
        transactionHash: '0xrelease123',
        blockNumber: 12347,
        gasUsed: '80000',
        status: 'confirmed',
      });

      expect(mockContract.release).toHaveBeenCalledWith('test-invoice-123', { gasLimit: 300000 });
    });

    it('should handle unauthorized release', async () => {
      mockContract.invoiceToEscrowId.mockResolvedValue(BigInt(1));
      mockContract.release.mockRejectedValue(new Error('execution reverted: Not authorized'));

      await expect(contractService.releaseEscrow('1')).rejects.toThrow('execution reverted: Not authorized');
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow successfully', async () => {
      const mockTxResponse = {
        hash: '0xrelease123',
        wait: jest.fn().mockResolvedValue({
          status: 1,
          blockNumber: 12348,
          gasUsed: BigInt(75000),
        }),
      };

      mockContract.invoiceToEscrowId.mockResolvedValue(BigInt(1));
      mockContract.release.mockResolvedValue(mockTxResponse);

      const result = await contractService.releaseEscrow('test-invoice-123');

      expect(result).toEqual({
        escrowId: '1',
        transactionHash: '0xrelease123',
        blockNumber: 12348,
        gasUsed: '75000',
        status: 'confirmed',
      });

      expect(mockContract.release).toHaveBeenCalledWith('test-invoice-123', { gasLimit: 300000 });
    });

    it('should handle escrow not eligible for release', async () => {
      mockContract.release.mockRejectedValue(new Error('execution reverted: Escrow not releasable'));

      await expect(contractService.releaseEscrow('test-invoice-123')).rejects.toThrow('execution reverted: Escrow not releasable');
    });
  });

  describe('getEscrow', () => {
    it('should retrieve escrow data successfully', async () => {
      const mockEscrowData = {
        id: BigInt(1),
        invoiceId: 'test-invoice-123',
        investor: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
        supplier: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        amount: BigInt('100000000000000000000'),
        nftSerialNumber: BigInt(1),
        status: 0,
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        releasedAt: BigInt(0),
      };

      mockContract.escrows.mockResolvedValue(mockEscrowData);

      const result = await contractService.getEscrow('1');

      expect(result).toEqual(mockEscrowData);

      expect(mockContract.escrows).toHaveBeenCalledWith('1');
    });

    it('should return null for non-existent escrow', async () => {
      mockContract.escrows.mockRejectedValue(new Error('execution reverted: Escrow does not exist'));

      const result = await contractService.getEscrow('999');
      expect(result).toBeNull();
    });
  });

  describe('getEscrowByInvoice', () => {
    it('should get escrow by invoice ID', async () => {
      const mockEscrowId = BigInt(1);
      const mockEscrowData = {
        id: BigInt(1),
        invoiceId: 'test-invoice-123',
        investor: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
        supplier: '0x742d35Cc6634C0532925a3b8D4C9db96DfbB8b2f',
        amount: BigInt('100000000000000000000'),
        nftSerialNumber: BigInt(1),
        status: 0,
        createdAt: BigInt(1640995200),
        releasedAt: BigInt(0),
      };

      mockContract.invoiceToEscrowId.mockResolvedValue(mockEscrowId);
      
      // Spy on getEscrow method
      const getEscrowSpy = jest.spyOn(contractService, 'getEscrow').mockResolvedValue(mockEscrowData);

      const result = await contractService.getEscrowByInvoice('test-invoice-123');

      expect(result).toEqual(mockEscrowData);
      expect(mockContract.invoiceToEscrowId).toHaveBeenCalledWith('test-invoice-123');
      expect(getEscrowSpy).toHaveBeenCalledWith('1');
      
      getEscrowSpy.mockRestore();
    });

    it('should return null for invoice with no escrow', async () => {
      mockContract.invoiceToEscrowId.mockResolvedValue(BigInt(0));

      const result = await contractService.getEscrowByInvoice('empty-invoice');
      expect(result).toBeNull();
    });
  });

  describe('getContractInfo', () => {
    it('should retrieve contract information', async () => {
      mockContract.getBalance.mockResolvedValue(BigInt('500000000000000000000')); // 500 HBAR
      mockContract.owner.mockResolvedValue('0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC');
      mockContract.platformFeeRate.mockResolvedValue(BigInt(250)); // 2.5%
      mockContract.feeRecipient.mockResolvedValue('0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC');
      
      // Mock provider.getNetwork()
      mockProvider.getNetwork = jest.fn().mockResolvedValue({
        name: 'hedera-testnet',
        chainId: 296,
      });

      const result = await contractService.getContractInfo();

      expect(result).toEqual({
        address: '0x75e3c67F65a1a7671a4438F2d6ec7d755Ab5D36A',
        balance: '500',
        owner: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
        platformFeeRate: '250',
        feeRecipient: '0xc2A10DCB44F8dB19199FD8D88c9aEF7367F012DC',
        network: {
          name: 'hedera-testnet',
          chainId: 296,
        },
      });
    });
  });

  describe('utility methods', () => {
    it('should generate correct HashScan URLs', () => {
      const txUrl = contractService.getHashScanUrl('0xabc123');
      expect(txUrl).toBe('https://hashscan.io/testnet/transaction/0xabc123');

      const contractUrl = contractService.getContractHashScanUrl();
      expect(contractUrl).toBe('https://hashscan.io/testnet/contract/0x75e3c67F65a1a7671a4438F2d6ec7d755Ab5D36A');
    });
  });
});