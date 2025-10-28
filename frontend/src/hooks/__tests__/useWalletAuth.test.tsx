import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useWalletAuth } from '../useWalletAuth';
import { useWallet } from '../useWallet';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('sonner');
vi.mock('../useWallet');
vi.mock('../../contexts/AuthContext');
vi.mock('../../services/api');

const mockUseWallet = vi.mocked(useWallet);
const mockUseAuth = vi.mocked(useAuth);
const mockApiClient = {
  request: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
};

// Mock the API client
vi.mocked(import('../../services/api')).mockResolvedValue({
  apiClient: mockApiClient,
});

describe('useWalletAuth', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockLogin = vi.fn();
  const mockLogout = vi.fn();
  const mockHashConnect = {
    sign: vi.fn(),
  };
  const mockPairingData = {
    topic: 'test-topic',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseWallet.mockReturnValue({
      isConnected: false,
      accountId: null,
      walletType: null,
      network: 'testnet',
      balance: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      hashConnect: null,
      pairingData: null,
    });

    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: mockLogin,
      logout: mockLogout,
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      isLoading: false,
      token: null,
      refreshToken: vi.fn(),
    });
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useWalletAuth());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isAuthenticating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.authStep).toBe('connect');
  });

  it('should handle wallet connection successfully', async () => {
    mockConnect.mockResolvedValue(undefined);
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
    });

    const { result } = renderHook(() => useWalletAuth());

    await act(async () => {
      await result.current.connectWallet('hashpack');
    });

    expect(mockConnect).toHaveBeenCalledWith('hashpack');
  });

  it('should handle wallet connection error', async () => {
    const error = new Error('Connection failed');
    mockConnect.mockRejectedValue(error);

    const { result } = renderHook(() => useWalletAuth());

    await act(async () => {
      await result.current.connectWallet('hashpack');
    });

    expect(result.current.error).toBe('Connection failed');
  });

  it('should handle authentication with nonce', async () => {
    const mockNonce = 'test-nonce-123';
    const mockSignature = 'test-signature';
    
    mockApiClient.get.mockResolvedValue({
      data: { nonce: mockNonce }
    });

    mockLogin.mockResolvedValue(undefined);

    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
    });

    // Mock HashConnect signing
    const mockHashConnect = {
      signMessage: vi.fn().mockResolvedValue({
        signedMessage: mockSignature
      })
    };

    // Mock window.hashconnect
    Object.defineProperty(window, 'hashconnect', {
      value: mockHashConnect,
      writable: true
    });

    const { result } = renderHook(() => useWalletAuth());

    await act(async () => {
      await result.current.authenticate();
    });

    expect(mockApiClient.get).toHaveBeenCalledWith('/auth/nonce/0.0.123456');
    expect(mockLogin).toHaveBeenCalledWith('0.0.123456', mockSignature, mockNonce);
  });

  it('should handle authentication error', async () => {
    const error = new Error('Authentication failed');
    mockApiClient.get.mockRejectedValue(error);

    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
    });

    const { result } = renderHook(() => useWalletAuth());

    await act(async () => {
      await result.current.authenticate();
    });

    expect(result.current.error).toBe('Authentication failed');
  });

  it('should handle disconnect properly', async () => {
    mockDisconnect.mockResolvedValue(undefined);
    mockLogout.mockImplementation(() => {});

    const { result } = renderHook(() => useWalletAuth());

    await act(async () => {
      await result.current.disconnectWallet();
    });

    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalled();
  });

  it('should clear error when clearError is called', () => {
    const { result } = renderHook(() => useWalletAuth());

    // Set an error first
    act(() => {
      result.current.setError('Test error');
    });

    expect(result.current.error).toBe('Test error');

    // Clear the error
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should not authenticate when wallet is not connected', async () => {
    const { result } = renderHook(() => useWalletAuth());

    await act(async () => {
      await result.current.authenticate();
    });

    expect(mockApiClient.get).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Wallet not connected');
  });

  it('should handle loading states correctly', async () => {
    mockConnect.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    const { result } = renderHook(() => useWalletAuth());

    act(() => {
      result.current.connectWallet('hashpack');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should reflect wallet and auth states correctly', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        accountId: '0.0.123456',
        role: 'supplier',
        name: 'Test User',
        email: 'test@example.com',
        permissions: ['create_invoices'],
        isVerified: true,
      },
      isAuthenticated: true,
      login: mockLogin,
      logout: mockLogout,
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      isLoading: false,
      token: 'test-token',
      refreshToken: vi.fn(),
    });

    const { result } = renderHook(() => useWalletAuth());

    expect(result.current.isConnected).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.accountId).toBe('0.0.123456');
    expect(result.current.walletType).toBe('hashpack');
  });
});