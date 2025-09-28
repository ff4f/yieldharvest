import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Dashboard from '../Dashboard'
import { useInvoices } from '@/hooks/useInvoices'
import { PaginatedResponse, Invoice } from '@/types/api'

// Mock the hooks
vi.mock('@/hooks/useInvoices')
vi.mock('@/components/LoadingState', () => ({
  LoadingState: ({ variant }: { variant: string }) => <div data-testid="loading-state">{variant} loading</div>
}))
vi.mock('@/components/ErrorState', () => ({
  ErrorState: ({ error, onRetry }: { error: Error; onRetry: () => void }) => (
    <div data-testid="error-state">
      <span>{error.message}</span>
      <button onClick={onRetry}>Retry</button>
    </div>
  )
}))

const mockUseInvoices = vi.mocked(useInvoices)

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

const mockInvoiceData: PaginatedResponse<Invoice> = {
  data: [
    {
      id: '1',
      invoiceNumber: 'INV-001',
      supplierId: 'supplier-1',
      buyerId: 'buyer-1',
      amount: '1000.00',
      currency: 'USD',
      dueDate: '2024-12-31',
      status: 'ISSUED',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      supplier: {
        id: 'supplier-1',
        name: 'Test Supplier',
        email: 'supplier@test.com'
      }
    },
    {
      id: '2',
      invoiceNumber: 'INV-002',
      supplierId: 'supplier-2',
      buyerId: 'buyer-2',
      amount: '2000.00',
      currency: 'USD',
      dueDate: '2024-12-31',
      status: 'FUNDED',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      supplier: {
        id: 'supplier-2',
        name: 'Test Supplier 2',
        email: 'supplier2@test.com'
      }
    }
  ],
  pagination: {
    page: 1,
    limit: 5,
    total: 2,
    totalPages: 1
  }
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state when data is loading', () => {
    mockUseInvoices.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })
    
    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
  })

  it('renders error state when there is an error', () => {
    const mockError = new Error('Failed to fetch')
    mockUseInvoices.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: mockError,
      refetch: vi.fn()
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })
    
    expect(screen.getByTestId('error-state')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument()
  })

  it('renders dashboard with invoice data', async () => {
    mockUseInvoices.mockReturnValue({
      data: mockInvoiceData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Total Invoices')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Total count
      expect(screen.getByText('$3,000')).toBeInTheDocument() // Total value
    })
  })

  it('displays recent invoices', async () => {
    mockUseInvoices.mockReturnValue({
      data: mockInvoiceData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument()
      expect(screen.getByText('INV-002')).toBeInTheDocument()
      expect(screen.getByText('Test Supplier')).toBeInTheDocument()
      expect(screen.getByText('Test Supplier 2')).toBeInTheDocument()
    })
  })

  it('shows create invoice button when no invoices exist', async () => {
    const emptyData: PaginatedResponse<Invoice> = {
      data: [],
      pagination: {
        page: 1,
        limit: 5,
        total: 0,
        totalPages: 0
      }
    }

    mockUseInvoices.mockReturnValue({
      data: emptyData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('No invoices yet')).toBeInTheDocument()
      expect(screen.getByText('Create Your First Invoice')).toBeInTheDocument()
    })
  })

  it('calculates stats correctly', async () => {
    mockUseInvoices.mockReturnValue({
      data: mockInvoiceData,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<Dashboard />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      // Total invoices should be 2
      expect(screen.getByText('2')).toBeInTheDocument()
      
      // Total value should be $3,000 (1000 + 2000)
      expect(screen.getByText('$3,000')).toBeInTheDocument()
      
      // Active fundings should be 1 (one FUNDED invoice)
      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })
})