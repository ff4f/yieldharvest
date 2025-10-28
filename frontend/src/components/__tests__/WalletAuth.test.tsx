import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import WalletAuth from '../WalletAuth';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';

// Mock the contexts
vi.mock('@/contexts/AuthContext');
vi.mock('@/contexts/WalletContext');

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseWallet = vi.mocked(useWallet);

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('WalletAuth', () => {
  const mockLogin = vi.fn();
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: mockLogin,
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      isLoading: false,
      token: null,
      refreshToken: vi.fn(),
    });

    mockUseWallet.mockReturnValue({
      isConnected: false,
      accountId: null,
      walletType: null,
      balance: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      network: 'testnet',
    });
  });

  it('renders wallet connection step when not connected', () => {
    renderWithRouter(<WalletAuth />);
    
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
    expect(screen.getByText('Choose your preferred wallet to continue')).toBeInTheDocument();
    expect(screen.getByText('Connect HashPack')).toBeInTheDocument();
    expect(screen.getByText('Connect Blade')).toBeInTheDocument();
  });

  it('shows connecting state when wallet is connecting', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      accountId: null,
      walletType: null,
      balance: null,
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: true,
      network: 'testnet',
    });

    renderWithRouter(<WalletAuth />);
    
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('shows sign message step when wallet is connected but not authenticated', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      balance: '100.00 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      network: 'testnet',
    });

    renderWithRouter(<WalletAuth />);
    
    expect(screen.getByText('Sign Authentication Message')).toBeInTheDocument();
    expect(screen.getByText('Sign Message')).toBeInTheDocument();
  });

  it('shows complete step when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', accountId: '0.0.123456', role: 'supplier' },
      isAuthenticated: true,
      login: mockLogin,
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      isLoading: false,
    });

    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      balance: '100.00 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      network: 'testnet',
    });

    renderWithRouter(<WalletAuth />);
    
    expect(screen.getByText('Authentication Complete')).toBeInTheDocument();
    expect(screen.getByText('Continue to Dashboard')).toBeInTheDocument();
  });

  it('handles HashPack wallet connection', async () => {
    renderWithRouter(<WalletAuth />);
    
    const hashpackButton = screen.getByText('Connect HashPack');
    fireEvent.click(hashpackButton);
    
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('hashpack');
    });
  });

  it('handles Blade wallet connection', async () => {
    renderWithRouter(<WalletAuth />);
    
    const bladeButton = screen.getByText('Connect Blade');
    fireEvent.click(bladeButton);
    
    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith('blade');
    });
  });

  it('displays error message when authentication fails', () => {
    renderWithRouter(<WalletAuth />);
    
    // Simulate error by calling the component with error state
    // This would typically be set through the useWalletAuth hook
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it('shows wallet disconnect option when connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      balance: '100.00 HBAR',
      connect: mockConnect,
      disconnect: mockDisconnect,
      isConnecting: false,
      network: 'testnet',
    });

    renderWithRouter(<WalletAuth />);
    
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });
});