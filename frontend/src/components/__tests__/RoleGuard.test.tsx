import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import RoleGuard from '../RoleGuard';
import { useAuth } from '@/contexts/AuthContext';

// Mock the auth context
vi.mock('@/contexts/AuthContext');

const mockUseAuth = vi.mocked(useAuth);

describe('RoleGuard', () => {
  const mockHasRole = vi.fn();
  const mockHasPermission = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: {
        id: '1',
        accountId: '0.0.123456',
        role: 'supplier',
        name: 'Test User',
        email: 'test@example.com',
        permissions: ['create_invoices', 'view_own_invoices'],
        isVerified: true,
      },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: mockHasRole,
      hasPermission: mockHasPermission,
      isLoading: false,
      token: 'mock-token',
      refreshToken: vi.fn(),
    });
  });

  it('renders children when user has required role', () => {
    mockHasRole.mockReturnValue(true);

    render(
      <RoleGuard requiredRole="supplier">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows access denied when user lacks required role', () => {
    mockHasRole.mockReturnValue(false);

    render(
      <RoleGuard requiredRole="admin">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('You do not have the required role to access this content.')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user has one of multiple required roles (OR operator)', () => {
    mockHasRole.mockImplementation((role) => role === 'supplier');

    render(
      <RoleGuard requiredRoles={['supplier', 'admin']} operator="OR">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows access denied when user lacks all required roles (OR operator)', () => {
    mockHasRole.mockReturnValue(false);

    render(
      <RoleGuard requiredRoles={['admin', 'investor']} operator="OR">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user has all required roles (AND operator)', () => {
    mockHasRole.mockReturnValue(true);

    render(
      <RoleGuard requiredRoles={['supplier', 'agent']} operator="AND">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows access denied when user lacks some required roles (AND operator)', () => {
    mockHasRole.mockImplementation((role) => role === 'supplier');

    render(
      <RoleGuard requiredRoles={['supplier', 'admin']} operator="AND">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user has required permission', () => {
    mockHasPermission.mockReturnValue(true);

    render(
      <RoleGuard requiredPermission="create_invoice">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows access denied when user lacks required permission', () => {
    mockHasPermission.mockReturnValue(false);

    render(
      <RoleGuard requiredPermission="admin_access">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    mockHasRole.mockReturnValue(false);

    const customFallback = <div>Custom Access Denied Message</div>;

    render(
      <RoleGuard requiredRole="admin" fallback={customFallback}>
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Custom Access Denied Message')).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders nothing when showFallback is false and access denied', () => {
    mockHasRole.mockReturnValue(false);

    const { container } = render(
      <RoleGuard requiredRole="admin" showFallback={false}>
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(container.firstChild).toBeNull();
  });

  it('shows authentication required when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: mockHasRole,
      hasPermission: mockHasPermission,
      isLoading: false,
      token: null,
      refreshToken: vi.fn(),
    });

    render(
      <RoleGuard requiredRole="supplier">
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText('Please log in to access this content.')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});