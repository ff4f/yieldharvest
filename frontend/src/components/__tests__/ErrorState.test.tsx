import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { ErrorState, EmptyState } from '../ErrorState'

describe('ErrorState', () => {
  const mockError = new Error('Test error message')
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders error message and retry button', () => {
    render(
      <ErrorState 
        error={mockError} 
        onRetry={mockOnRetry}
      />
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    render(
      <ErrorState 
        error={mockError} 
        onRetry={mockOnRetry}
      />
    )

    fireEvent.click(screen.getByText('Try Again'))
    expect(mockOnRetry).toHaveBeenCalledTimes(1)
  })

  it('renders custom title and description', () => {
    render(
      <ErrorState 
        error={mockError}
        onRetry={mockOnRetry}
        title="Custom Error Title"
        description="Custom error description"
      />
    )

    expect(screen.getByText('Custom Error Title')).toBeInTheDocument()
    expect(screen.getByText('Custom error description')).toBeInTheDocument()
  })

  it('renders card variant correctly', () => {
    const { container } = render(
      <ErrorState 
        error={mockError}
        onRetry={mockOnRetry}
        variant="card"
      />
    )

    expect(container.firstChild).toHaveClass('border')
  })

  it('renders inline variant correctly', () => {
    const { container } = render(
      <ErrorState 
        error={mockError}
        onRetry={mockOnRetry}
        variant="inline"
      />
    )

    expect(container.firstChild).toHaveClass('flex-row')
  })

  it('renders minimal variant correctly', () => {
    render(
      <ErrorState 
        error={mockError}
        onRetry={mockOnRetry}
        variant="minimal"
      />
    )

    expect(screen.getByText('Test error message')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('handles network errors specifically', () => {
    const networkError = new Error('Network Error')
    render(
      <ErrorState 
        error={networkError}
        onRetry={mockOnRetry}
      />
    )

    expect(screen.getByText('Connection Problem')).toBeInTheDocument()
    expect(screen.getByText('Please check your internet connection and try again.')).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('renders empty state with default props', () => {
    render(<EmptyState />)

    expect(screen.getByText('No data found')).toBeInTheDocument()
    expect(screen.getByText('There are no items to display.')).toBeInTheDocument()
  })

  it('renders custom title and description', () => {
    render(
      <EmptyState 
        title="No Invoices"
        description="You haven't created any invoices yet."
      />
    )

    expect(screen.getByText('No Invoices')).toBeInTheDocument()
    expect(screen.getByText("You haven't created any invoices yet.")).toBeInTheDocument()
  })

  it('renders action button when provided', () => {
    const mockAction = vi.fn()
    const actionButton = (
      <button onClick={mockAction}>Create Invoice</button>
    )
    
    render(
      <EmptyState 
        action={actionButton}
      />
    )

    const button = screen.getByText('Create Invoice')
    expect(button).toBeInTheDocument()
    
    fireEvent.click(button)
    expect(mockAction).toHaveBeenCalledTimes(1)
  })

  it('renders with custom className', () => {
    render(
      <EmptyState 
        className="custom-class"
      />
    )

    const container = screen.getByText('No data found').closest('div')
    expect(container).toHaveClass('custom-class')
  })
})