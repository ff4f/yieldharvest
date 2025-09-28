import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import InvoiceDetail from '../InvoiceDetail'
import { useInvoice, useFundInvoice } from '@/hooks/useInvoices'
import { Invoice } from '@/types/api'

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

const mockUseInvoice = vi.mocked(useInvoice)
const mockUseFundInvoice = vi.mocked(useFundInvoice)
// Mock mark as paid functionality (not implemented yet)
const mockMarkAsPaid = vi.fn()

const createWrapper = (initialEntries = ['/invoices/1']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

const mockInvoice: Invoice = {
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
  },
  // buyer info would come from separate API call
  tokenId: 'token-123',
  fileId: 'file-456',
  topicId: 'topic-789',
  fundings: []
}

const mockFundedInvoice: Invoice = {
  ...mockInvoice,
  status: 'FUNDED',
  fundings: [{
    id: 'funding-1',
    invoiceId: '1',
    investorId: 'investor-1',
    amount: '800.00',
    createdAt: '2024-01-02T00:00:00Z',
    investor: {
      id: 'investor-1',
      name: 'Test Investor',
      email: 'investor@test.com'
    }
  }]
}

describe('InvoiceDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseFundInvoice.mockReturnValue({
      mutate: vi.fn(),
      isPending: false
    } as any)
    // Mark as paid not implemented yet
  })

  it('renders loading state when data is loading', () => {
    mockUseInvoice.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<InvoiceDetail />, { wrapper: createWrapper() })
    
    expect(screen.getByTestId('loading-state')).toBeInTheDocument()
  })

  it('renders error state when there is an error', () => {
    const mockError = new Error('Failed to fetch invoice')
    mockUseInvoice.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: mockError,
      refetch: vi.fn()
    } as any)

    render(<InvoiceDetail />, { wrapper: createWrapper() })
    
    expect(screen.getByTestId('error-state')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch invoice')).toBeInTheDocument()
  })

  it('renders invoice details correctly', async () => {
    mockUseInvoice.mockReturnValue({
      data: mockInvoice,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<InvoiceDetail />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('INV-001')).toBeInTheDocument()
      expect(screen.getByText('Test Supplier')).toBeInTheDocument()
      expect(screen.getByText('Test Buyer')).toBeInTheDocument()
      expect(screen.getByText('$1,000')).toBeInTheDocument()
      expect(screen.getByText('ISSUED')).toBeInTheDocument()
    })
  })

  it('shows fund invoice button for issued invoices', async () => {
    mockUseInvoice.mockReturnValue({
      data: mockInvoice,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<InvoiceDetail />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('Fund Invoice')).toBeInTheDocument()
    })
  })

  it('displays funding information for funded invoices', async () => {
    mockUseInvoice.mockReturnValue({
      data: mockFundedInvoice,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<InvoiceDetail />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('FUNDED')).toBeInTheDocument()
    })
  })

  it('calls fund invoice mutation when fund button is clicked', async () => {
    const mockFundMutate = vi.fn()
    mockUseFundInvoice.mockReturnValue({
      mutate: mockFundMutate,
      isPending: false
    } as any)
    
    mockUseInvoice.mockReturnValue({
      data: mockInvoice,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<InvoiceDetail />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      const fundButton = screen.getByText('Fund Invoice')
      fireEvent.click(fundButton)
      expect(mockFundMutate).toHaveBeenCalledWith('1')
    })
  })



  it('displays investor information for funded invoices', async () => {
    mockUseInvoice.mockReturnValue({
      data: mockFundedInvoice,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<InvoiceDetail />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('Test Investor')).toBeInTheDocument()
      expect(screen.getByText('$800')).toBeInTheDocument()
    })
  })

  it('displays token and file information', async () => {
    mockUseInvoice.mockReturnValue({
      data: mockInvoice,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<InvoiceDetail />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      expect(screen.getByText('token-123')).toBeInTheDocument()
      expect(screen.getByText('file-456')).toBeInTheDocument()
      expect(screen.getByText('topic-789')).toBeInTheDocument()
    })
  })

  it('shows loading state on buttons when mutations are pending', async () => {
    mockUseFundInvoice.mockReturnValue({
      mutate: vi.fn(),
      isPending: true
    } as any)
    
    mockUseInvoice.mockReturnValue({
      data: mockInvoice,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<InvoiceDetail />, { wrapper: createWrapper() })
    
    await waitFor(() => {
      const fundButton = screen.getByText('Funding...')
      expect(fundButton).toBeInTheDocument()
      expect(fundButton).toBeDisabled()
    })
  })
})