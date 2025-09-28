// API Service Layer for YieldHarvest

import {
  Invoice,
  CreateInvoiceRequest,
  CreateInvoiceResponse,
  UpdateInvoiceRequest,
  PaginatedResponse,
  InvoiceFilters,
  ApiError,
} from '@/types/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData: ApiError = await response.json().catch(() => ({
          error: 'Network error',
          statusCode: response.status,
        }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  // Invoice endpoints
  async getInvoices(filters: InvoiceFilters = {}): Promise<PaginatedResponse<Invoice>> {
    const searchParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const queryString = searchParams.toString();
    const endpoint = `/api/invoices${queryString ? `?${queryString}` : ''}`;
    
    return this.request<PaginatedResponse<Invoice>>(endpoint);
  }

  async getInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>(`/api/invoices/${id}`);
  }

  async createInvoice(data: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
    const formData = new FormData();
    
    // Add all fields to FormData
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'file' && value instanceof File) {
          formData.append('file', value);
        } else {
          formData.append(key, String(value));
        }
      }
    });

    return this.request<CreateInvoiceResponse>('/api/invoices', {
      method: 'POST',
      headers: {}, // Remove Content-Type to let browser set it for FormData
      body: formData,
    });
  }

  async updateInvoice(id: string, data: UpdateInvoiceRequest): Promise<Invoice> {
    return this.request<Invoice>(`/api/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInvoice(id: string): Promise<void> {
    return this.request<void>(`/api/invoices/${id}`, {
      method: 'DELETE',
    });
  }

  // Funding endpoints
  async fundInvoice(invoiceId: string, amount: string): Promise<any> {
    return this.request(`/api/fundings`, {
      method: 'POST',
      body: JSON.stringify({ 
        invoiceId, 
        amount: parseFloat(amount),
        investorId: 'current-user-id' // TODO: Get from auth context
      }),
    });
  }

  // New funding endpoints for smart contract escrow
  async getFunding(fundingId: string): Promise<any> {
    return this.request(`/api/fundings/${fundingId}`);
  }

  async getFundingsByInvoice(invoiceId: string): Promise<any> {
    return this.request(`/api/fundings/invoice/${invoiceId}`);
  }

  async releaseFunding(fundingId: string): Promise<any> {
    return this.request(`/api/fundings/${fundingId}/release`, {
      method: 'POST',
    });
  }

  async refundFunding(fundingId: string): Promise<any> {
    return this.request(`/api/fundings/${fundingId}/refund`, {
      method: 'POST',
    });
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export individual service functions for easier testing
export const invoiceApi = {
  getAll: (filters?: InvoiceFilters) => apiClient.getInvoices(filters),
  getById: (id: string) => apiClient.getInvoice(id),
  create: (data: CreateInvoiceRequest) => apiClient.createInvoice(data),
  update: (id: string, data: UpdateInvoiceRequest) => apiClient.updateInvoice(id, data),
  delete: (id: string) => apiClient.deleteInvoice(id),
  fund: (invoiceId: string, amount: string) => apiClient.fundInvoice(invoiceId, amount),
};

// Export funding service functions
export const fundingApi = {
  create: (invoiceId: string, amount: string) => apiClient.fundInvoice(invoiceId, amount),
  getById: (fundingId: string) => apiClient.getFunding(fundingId),
  getByInvoice: (invoiceId: string) => apiClient.getFundingsByInvoice(invoiceId),
  release: (fundingId: string) => apiClient.releaseFunding(fundingId),
  refund: (fundingId: string) => apiClient.refundFunding(fundingId),
};