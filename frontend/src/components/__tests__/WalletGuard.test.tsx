import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import WalletGuard from '../WalletGuard';
import { useWallet } from '@/contexts/WalletContext';

// Mock the wallet context
vi.mock('@/contexts/WalletContext');

const mockUseWallet = vi.mocked(useWallet);

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('WalletGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children when wallet is connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      balance: '100.00 HBAR',
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      network: 'testnet',
    });

    renderWithRouter(
      <WalletGuard>
        <div>Protected Content</div>
      </WalletGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows connection prompt when wallet is not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      accountId: null,
      walletType: null,
      balance: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      network: 'testnet',
    });

    renderWithRouter(
      <WalletGuard>
        <div>Protected Content</div>
      </WalletGuard>
    );

    expect(screen.getByText('Wallet Connection Required')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('shows network mismatch when wrong network is connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      balance: '100.00 HBAR',
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      network: 'mainnet',
    });

    renderWithRouter(
      <WalletGuard requireNetwork="testnet">
        <div>Protected Content</div>
      </WalletGuard>
    );

    expect(screen.getByText('Wrong network. Please switch to testnet network in your wallet.')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when correct network is connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      balance: '100.00 HBAR',
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      network: 'testnet',
    });

    renderWithRouter(
      <WalletGuard requireNetwork="testnet">
        <div>Protected Content</div>
      </WalletGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      accountId: null,
      walletType: null,
      balance: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      network: 'testnet',
    });

    const customFallback = <div>Custom Fallback Message</div>;

    renderWithRouter(
      <WalletGuard fallback={customFallback}>
        <div>Protected Content</div>
      </WalletGuard>
    );

    expect(screen.getByText('Custom Fallback Message')).toBeInTheDocument();
    expect(screen.queryByText('Wallet Connection Required')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders nothing when showFallback is false and wallet not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      accountId: null,
      walletType: null,
      balance: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
      network: 'testnet',
    });

    const { container } = renderWithRouter(
      <WalletGuard showFallback={false}>
        <div>Protected Content</div>
      </WalletGuard>
    );

    expect(container.firstChild).toBeNull();
  });
});