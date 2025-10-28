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
import { useAppStore } from '@/store';

// Use a single, consistent env var for API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Additional types for F.MD implementation
export interface User {
  id: string;
  accountId: string;
  email?: string;
  name?: string;
  role: 'supplier' | 'investor' | 'agent' | 'auditor' | 'admin';
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  invoiceId: string;
  investorId: string;
  investorName: string;
  fundingAmount: number;
  interestRate: number;
  status: 'pending' | 'active' | 'completed' | 'defaulted';
  createdAt: string;
  updatedAt: string;
  scheduledTransactionId?: string;
  escrowAccountId?: string;
  proofLinks: ProofLink[];
}

export interface ProofLink {
  type: 'hts' | 'hfs' | 'hcs' | 'hashscan' | 'mirror';
  label: string;
  url: string;
  hash?: string;
  timestamp?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
  accountId: string;
}

export interface WalletConnectRequest {
  accountId: string;
  publicKey: string;
  signature: string;
}

class ApiClient {
  private baseURL: string;
  private authToken: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Get token from Zustand store instead of localStorage
    this.authToken = useAppStore.getState().session.token;
  }

  // Integrate with Zustand store for token management
  setAuthToken(token: string | null) {
    this.authToken = token;
    useAppStore.getState().setToken(token);
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

    // Add auth token if available
    if (this.authToken) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${this.authToken}`,
      };
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        // Handle 401 unauthorized
        if (response.status === 401) {
          useAppStore.getState().logout();
          window.location.href = '/login';
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network request failed');
    }
  }

  // Auth endpoints
  async connectWallet(request: WalletConnectRequest): Promise<AuthResponse> {
    const response = await this.request<{ data: AuthResponse }>('/auth/wallet-connect', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.data;
  }

  async refreshToken(): Promise<AuthResponse> {
    const response = await this.request<{ data: AuthResponse }>('/auth/refresh', {
      method: 'POST',
    });
    return response.data;
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // User endpoints
  async getCurrentUser(): Promise<User> {
    const response = await this.request<{ data: User }>('/users/me');
    return response.data;
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    const response = await this.request<{ data: User }>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
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
    
    // Add all invoice fields
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'file' && value !== undefined) {
        formData.append(key, String(value));
      }
    });
    
    // Add file if present
    if (data.file) {
      formData.append('file', data.file);
    }

    return this.request<CreateInvoiceResponse>('/api/invoices', {
      method: 'POST',
      headers: {}, // Let browser set Content-Type for FormData
      body: formData,
    });
  }

  // Wallet signing endpoints for invoices
  async prepareMintTransaction(data: {
    invoiceNumber: string;
    supplierId: string;
    buyerId: string;
    amount: string;
    currency: string;
    dueDate: string;
    description?: string;
    accountId: string;
  }): Promise<{
    data: {
      transactionBytes: string;
      invoiceId: string;
      transactionId: string;
    }
  }> {
    return this.request('/api/invoices/prepare-mint', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitMintTransaction(data: {
    invoiceId: string;
    signedTransactionBytes: string;
    transactionId: string;
  }): Promise<{
    data: {
      tokenId: string;
      serialNumber: string;
      transactionId: string;
      fileId?: string;
      fileHash?: string;
      topicId?: string;
    }
  }> {
    return this.request('/api/invoices/submit-mint', {
      method: 'POST',
      body: JSON.stringify(data),
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
    return this.request<any>(`/api/fundings/${fundingId}/refund`, {
      method: 'POST',
    });
  }

  // Mirror Node endpoints
  async getNFTInfo(tokenId: string, serialNumber: string): Promise<any> {
    return this.request<any>(`/api/hedera/mirror/tokens/${tokenId}/nfts/${serialNumber}`);
  }

  async getNFTsByToken(tokenId: string, limit: number = 25): Promise<any> {
    return this.request<any>(`/api/hedera/mirror/tokens/${tokenId}/nfts?limit=${limit}`);
  }

  async getHCSMessages(topicId: string, filters: any = {}): Promise<any> {
    const searchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    const endpoint = `/api/hedera/mirror/topics/${topicId}/messages${queryString ? `?${queryString}` : ''}`;
    return this.request<any>(endpoint);
  }

  async getAccountInfo(accountId: string): Promise<any> {
    return this.request<any>(`/api/hedera/mirror/accounts/${accountId}`);
  }

  async getAccountTransactions(accountId: string, limit: number = 25, order: 'asc' | 'desc' = 'desc'): Promise<any> {
    return this.request<any>(`/api/hedera/mirror/accounts/${accountId}/transactions?limit=${limit}&order=${order}`);
  }

  async getTransaction(transactionId: string): Promise<any> {
    return this.request<any>(`/api/hedera/mirror/transactions/${transactionId}`);
  }

  async getNetworkStats(): Promise<any> {
    return this.request<any>('/api/hedera/mirror/network/stats');
  }

  async getDashboardMetrics(): Promise<any> {
    return this.request<any>('/api/hedera/mirror/dashboard/metrics');
  }

  async generateHashScanLinks(data: any): Promise<any> {
    return this.request<any>('/api/hedera/mirror/hashscan-links', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCacheStats(): Promise<any> {
    return this.request<any>('/api/hedera/mirror/cache/stats');
  }

  async clearCache(): Promise<any> {
    return this.request<any>('/api/hedera/mirror/cache', {
      method: 'DELETE',
    });
  }

  async checkMirrorNodeHealth(): Promise<any> {
    return this.request<any>('/api/hedera/mirror/health');
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Enhanced API exports for F.MD implementation
export const authApi = {
  connectWallet: (request: WalletConnectRequest) => apiClient.connectWallet(request),
  refreshToken: () => apiClient.refreshToken(),
  logout: () => apiClient.logout(),
};

export const userApi = {
  getCurrentUser: () => apiClient.getCurrentUser(),
  updateProfile: (updates: Partial<User>) => apiClient.updateProfile(updates),
};

export const invoiceApi = {
  getAll: (filters?: InvoiceFilters) => apiClient.getInvoices(filters),
  getById: (id: string) => apiClient.getInvoice(id),
  create: (data: CreateInvoiceRequest) => apiClient.createInvoice(data),
  update: (id: string, data: UpdateInvoiceRequest) => apiClient.updateInvoice(id, data),
  delete: (id: string) => apiClient.deleteInvoice(id),
  fund: (invoiceId: string, amount: string) => apiClient.fundInvoice(invoiceId, amount),
  prepareMint: (data: any) => apiClient.prepareMintTransaction(data),
  submitMint: (data: any) => apiClient.submitMintTransaction(data),
};

export const fundingApi = {
  create: (invoiceId: string, amount: string) => apiClient.fundInvoice(invoiceId, amount),
  getById: (fundingId: string) => apiClient.getFunding(fundingId),
  getByInvoice: (invoiceId: string) => apiClient.getFundingsByInvoice(invoiceId),
  release: (fundingId: string) => apiClient.releaseFunding(fundingId),
  refund: (fundingId: string) => apiClient.refundFunding(fundingId),
};

export const mirrorNodeApi = {
  getNFTInfo: (tokenId: string, serialNumber: string) => apiClient.getNFTInfo(tokenId, serialNumber),
  getNFTsByToken: (tokenId: string, limit?: number) => apiClient.getNFTsByToken(tokenId, limit),
  getHCSMessages: (topicId: string, filters?: any) => apiClient.getHCSMessages(topicId, filters),
  getAccountInfo: (accountId: string) => apiClient.getAccountInfo(accountId),
  getAccountTransactions: (accountId: string, limit?: number, order?: 'asc' | 'desc') => 
    apiClient.getAccountTransactions(accountId, limit, order),
  getTransaction: (transactionId: string) => apiClient.getTransaction(transactionId),
  getNetworkStats: () => apiClient.getNetworkStats(),
  getDashboardMetrics: () => apiClient.getDashboardMetrics(),
  generateHashScanLinks: (data: any) => apiClient.generateHashScanLinks(data),
  getCacheStats: () => apiClient.getCacheStats(),
  clearCache: () => apiClient.clearCache(),
  checkHealth: () => apiClient.checkMirrorNodeHealth(),
};

// Unified API object for easy imports
export const api = {
  auth: authApi,
  user: userApi,
  invoice: invoiceApi,
  funding: fundingApi,
  mirror: mirrorNodeApi,
  client: apiClient,
};

export default api;