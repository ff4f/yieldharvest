// React Query hooks for Invoice operations

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Invoice,
  CreateInvoiceRequest,
  CreateInvoiceResponse,
  UpdateInvoiceRequest,
  InvoiceFilters,
} from '@/types/api';
import { invoiceApi } from '@/services/api';

// Query keys
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
};

// Get all invoices with filters
export function useInvoices(filters: InvoiceFilters = {}) {
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () => invoiceApi.getAll(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}

// Get single invoice by ID
export function useInvoice(id: string) {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: () => invoiceApi.getById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}

// Create invoice mutation
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) => invoiceApi.create(data),
    onSuccess: (response: CreateInvoiceResponse) => {
      // Invalidate and refetch invoice lists
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      
      toast.success('Invoice created successfully!', {
        description: `Invoice ${response.invoice.invoiceNumber} has been minted as NFT`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create invoice', {
        description: error.message,
      });
    },
  });
}

// Update invoice mutation
export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoiceRequest }) =>
      invoiceApi.update(id, data),
    onSuccess: (updatedInvoice: Invoice) => {
      // Update the specific invoice in cache
      queryClient.setQueryData(
        invoiceKeys.detail(updatedInvoice.id),
        updatedInvoice
      );
      
      // Invalidate lists to ensure consistency
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      
      toast.success('Invoice updated successfully!');
    },
    onError: (error: Error) => {
      toast.error('Failed to update invoice', {
        description: error.message,
      });
    },
  });
}

// Delete invoice mutation
export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoiceApi.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: invoiceKeys.detail(deletedId) });
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      
      toast.success('Invoice deleted successfully!');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete invoice', {
        description: error.message,
      });
    },
  });
}

// Fund invoice mutation
export function useFundInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, amount }: { invoiceId: string; amount: string }) =>
      invoiceApi.fund(invoiceId, amount),
    onSuccess: (_, { invoiceId }) => {
      // Invalidate the specific invoice and lists
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(invoiceId) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      
      toast.success('Invoice funded successfully!');
    },
    onError: (error: Error) => {
      toast.error('Failed to fund invoice', {
        description: error.message,
      });
    },
  });
}

// Helper hook for eligible invoices (for investors)
export function useEligibleInvoices(filters: InvoiceFilters = {}) {
  return useInvoices({
    ...filters,
    status: 'ISSUED', // Only show issued invoices for investment
  });
}