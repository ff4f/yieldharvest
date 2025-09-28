// Funding hooks for smart contract escrow operations

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Funding,
  CreateFundingRequest,
  CreateFundingResponse,
  FundingActionResponse,
} from '@/types/api';
import { fundingApi } from '@/services/api';

// Query keys for funding operations
export const fundingKeys = {
  all: ['fundings'] as const,
  lists: () => [...fundingKeys.all, 'list'] as const,
  details: () => [...fundingKeys.all, 'detail'] as const,
  detail: (id: string) => [...fundingKeys.details(), id] as const,
  byInvoice: (invoiceId: string) => [...fundingKeys.all, 'invoice', invoiceId] as const,
};

// Get funding by ID
export function useFunding(fundingId: string) {
  return useQuery({
    queryKey: fundingKeys.detail(fundingId),
    queryFn: () => fundingApi.getById(fundingId),
    enabled: !!fundingId,
  });
}

// Get fundings by invoice ID
export function useFundingsByInvoice(invoiceId: string) {
  return useQuery({
    queryKey: fundingKeys.byInvoice(invoiceId),
    queryFn: () => fundingApi.getByInvoice(invoiceId),
    enabled: !!invoiceId,
  });
}

// Create funding (smart contract escrow)
export function useCreateFunding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, amount }: { invoiceId: string; amount: string }) =>
      fundingApi.create(invoiceId, amount),
    onSuccess: (data: CreateFundingResponse, { invoiceId }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: fundingKeys.byInvoice(invoiceId) });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'detail', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', 'list'] });
      
      toast.success('Funding created successfully!', {
        description: `Escrow created with transaction: ${data.proofs.transactionHash}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to create funding', {
        description: error.message,
      });
    },
  });
}

// Release funding from escrow
export function useReleaseFunding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fundingId: string) => fundingApi.release(fundingId),
    onSuccess: (data: FundingActionResponse, fundingId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: fundingKeys.detail(fundingId) });
      queryClient.invalidateQueries({ queryKey: fundingKeys.lists() });
      
      toast.success('Funding released successfully!', {
        description: `Transaction: ${data.transactionHash}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to release funding', {
        description: error.message,
      });
    },
  });
}

// Refund funding from escrow
export function useRefundFunding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fundingId: string) => fundingApi.refund(fundingId),
    onSuccess: (data: FundingActionResponse, fundingId) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: fundingKeys.detail(fundingId) });
      queryClient.invalidateQueries({ queryKey: fundingKeys.lists() });
      
      toast.success('Funding refunded successfully!', {
        description: `Transaction: ${data.transactionHash}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Failed to refund funding', {
        description: error.message,
      });
    },
  });
}

// Legacy hook for backward compatibility
export function useFundInvoice() {
  return useCreateFunding();
}