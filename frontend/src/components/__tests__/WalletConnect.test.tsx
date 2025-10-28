import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WalletConnect } from '../WalletConnect';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
vi.mock('@/contexts/WalletContext');
vi.mock('@/contexts/AuthContext');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockUseWallet = vi.mocked(useWallet);
const mockUseAuth = vi.mocked(useAuth);

describe('WalletConnect Integration', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockLogin = vi.fn();
  const mockLogout = vi.fn();

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

  it('should render wallet selection when not connected', () => {
    render(<WalletConnect />);
    
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument();
    expect(screen.getByText(/hashpack/i)).toBeInTheDocument();
    expect(screen.getByText(/blade/i)).toBeInTheDocument();
  });

  it('should show connecting state when wallet is connecting', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      accountId: null,
      walletType: null,
      network: 'testnet',
      balance: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: true,
      hashConnect: null,
      pairingData: null,
    });

    render(<WalletConnect />);
    
    expect(screen.getByText(/connecting/i)).toBeInTheDocument();
  });

  it('should handle wallet connection', async () => {
    mockConnect.mockResolvedValue(undefined);
    
    render(<WalletConnect />);
    
    const hashpackButton = screen.getByText(/hashpack/i);
    fireEvent.click(hashpackButton);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('hashpack');
    });
  });

  it('should show wallet info when connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      hashConnect: null,
      pairingData: null,
    });

    render(<WalletConnect />);
    
    expect(screen.getByText('0.0.123456')).toBeInTheDocument();
    expect(screen.getByText('100 HBAR')).toBeInTheDocument();
    expect(screen.getByText(/disconnect/i)).toBeInTheDocument();
  });

  it('should handle wallet disconnection', async () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      hashConnect: null,
      pairingData: null,
    });

    mockDisconnect.mockResolvedValue(undefined);
    
    render(<WalletConnect />);
    
    const disconnectButton = screen.getByText(/disconnect/i);
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  it('should show authentication status when user is authenticated', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      hashConnect: null,
      pairingData: null,
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

    render(<WalletConnect />);
    
    expect(screen.getByText(/authenticated/i)).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should handle connection errors gracefully', async () => {
    const error = new Error('Connection failed');
    mockConnect.mockRejectedValue(error);
    
    render(<WalletConnect />);
    
    const hashpackButton = screen.getByText(/hashpack/i);
    fireEvent.click(hashpackButton);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('hashpack');
    });

    // Should show error state or retry option
    expect(screen.getByText(/connect/i)).toBeInTheDocument();
  });

  it('should display network information correctly', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      hashConnect: null,
      pairingData: null,
    });

    render(<WalletConnect />);
    
    expect(screen.getByText(/testnet/i)).toBeInTheDocument();
  });

  it('should handle different wallet types', async () => {
    render(<WalletConnect />);
    
    // Test HashPack connection
    const hashpackButton = screen.getByText(/hashpack/i);
    fireEvent.click(hashpackButton);
    
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('hashpack');
    });

    vi.clearAllMocks();

    // Test Blade connection
    const bladeButton = screen.getByText(/blade/i);
    fireEvent.click(bladeButton);
    
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('blade');
    });
  });
});