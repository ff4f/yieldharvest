import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadingState } from '../LoadingState'

describe('LoadingState', () => {
  it('renders default loading state', () => {
    render(<LoadingState />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('renders custom message', () => {
    render(<LoadingState message="Loading invoices..." />)
    
    expect(screen.getByText('Loading invoices...')).toBeInTheDocument()
  })

  it('renders card variant correctly', () => {
    const { container } = render(
      <LoadingState variant="card" message="Loading data..." />
    )
    
    expect(container.firstChild).toHaveClass('border')
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('renders inline variant correctly', () => {
    const { container } = render(
      <LoadingState variant="inline" message="Loading..." />
    )
    
    expect(container.firstChild).toHaveClass('flex-row')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders spinner variant correctly', () => {
    render(<LoadingState variant="spinner" />)
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders skeleton variant correctly', () => {
    render(<LoadingState variant="skeleton" />)
    
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <LoadingState className="custom-loading-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-loading-class')
  })



  it('renders with different sizes', () => {
    const { rerender } = render(<LoadingState size="sm" />)
    expect(screen.getByTestId('loading-spinner')).toHaveClass('h-4', 'w-4')
    
    rerender(<LoadingState size="lg" />)
    expect(screen.getByTestId('loading-spinner')).toHaveClass('h-8', 'w-8')
  })

  it('renders skeleton elements in skeleton variant', () => {
    render(<LoadingState variant="skeleton" />)
    
    expect(screen.getByTestId('skeleton-loader')).toBeInTheDocument()
    // Should contain skeleton elements
    const skeletons = document.querySelectorAll('[data-testid="skeleton-loader"] .animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})