import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import WalletInfo from '../WalletInfo';
import { useWallet } from '@/contexts/WalletContext';

// Mock the wallet context
vi.mock('@/contexts/WalletContext');

const mockUseWallet = vi.mocked(useWallet);

describe('WalletInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders wallet information when connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100.50 HBAR',
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });

    render(<WalletInfo />);

    expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
    expect(screen.getByText('0.0.123456')).toBeInTheDocument();
    expect(screen.getByText('hashpack')).toBeInTheDocument();
    expect(screen.getByText('testnet')).toBeInTheDocument();
    expect(screen.getByText('100.50 HBAR')).toBeInTheDocument();
  });

  it('renders not connected state when wallet is not connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      accountId: null,
      walletType: null,
      network: 'testnet',
      balance: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });

    render(<WalletInfo />);

    expect(screen.getByText('Wallet Not Connected')).toBeInTheDocument();
    expect(screen.queryByText('0.0.123456')).not.toBeInTheDocument();
  });

  it('renders connecting state when wallet is connecting', () => {
    mockUseWallet.mockReturnValue({
      isConnected: false,
      accountId: null,
      walletType: null,
      network: 'testnet',
      balance: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: true,
    });

    render(<WalletInfo />);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('renders HashScan link when account is connected', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '100.50 HBAR',
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });

    render(<WalletInfo />);

    const hashScanLink = screen.getByRole('link', { name: /view on hashscan/i });
    expect(hashScanLink).toBeInTheDocument();
    expect(hashScanLink).toHaveAttribute('href', 'https://hashscan.io/testnet/account/0.0.123456');
    expect(hashScanLink).toHaveAttribute('target', '_blank');
  });

  it('renders mainnet HashScan link for mainnet network', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'mainnet',
      balance: '100.50 HBAR',
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });

    render(<WalletInfo />);

    const hashScanLink = screen.getByRole('link', { name: /view on hashscan/i });
    expect(hashScanLink).toHaveAttribute('href', 'https://hashscan.io/mainnet/account/0.0.123456');
  });

  it('handles null balance gracefully', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });

    render(<WalletInfo />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('handles empty balance string', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '',
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });

    render(<WalletInfo />);

    expect(screen.getByText('0 HBAR')).toBeInTheDocument();
  });

  it('formats complex balance strings correctly', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'hashpack',
      network: 'testnet',
      balance: '1000.123456789 HBAR, 50 TOKEN1, 25.5 TOKEN2',
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });

    render(<WalletInfo />);

    expect(screen.getByText('1000.123456789 HBAR')).toBeInTheDocument();
    expect(screen.getByText('50 TOKEN1')).toBeInTheDocument();
    expect(screen.getByText('25.5 TOKEN2')).toBeInTheDocument();
  });

  it('renders different wallet types correctly', () => {
    mockUseWallet.mockReturnValue({
      isConnected: true,
      accountId: '0.0.123456',
      walletType: 'blade',
      network: 'testnet',
      balance: '100.50 HBAR',
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });

    render(<WalletInfo />);

    expect(screen.getByText('blade')).toBeInTheDocument();
  });
});