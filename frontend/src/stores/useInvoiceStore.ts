import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Types
export interface Invoice {
  id: string;
  tokenId: string; // HTS NFT Token ID
  fileId: string; // HFS File ID
  topicId: string; // HCS Topic ID
  supplierAccountId: string;
  buyerAccountId: string;
  amount: number;
  currency: string;
  dueDate: Date;
  issueDate: Date;
  status: 'draft' | 'issued' | 'funded' | 'paid' | 'overdue' | 'disputed';
  fundingStatus: 'unfunded' | 'partial' | 'fully_funded';
  metadata: {
    invoiceNumber: string;
    description: string;
    items: InvoiceItem[];
    terms: string;
    attachments: string[];
  };
  blockchain: {
    mintTransactionId?: string;
    fileUploadTransactionId?: string;
    consensusMessages: ConsensusMessage[];
    proofLinks: {
      hashscan?: string;
      mirrorNode?: string;
      hfsExplorer?: string;
    };
  };
  funding?: {
    totalRequested: number;
    totalFunded: number;
    investors: InvestorFunding[];
    escrowAccountId?: string;
    scheduledTransactionId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ConsensusMessage {
  id: string;
  topicId: string;
  sequenceNumber: number;
  message: string;
  timestamp: Date;
  transactionId: string;
}

export interface InvestorFunding {
  investorAccountId: string;
  amount: number;
  transactionId: string;
  timestamp: Date;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface InvoiceFilters {
  status?: string[];
  fundingStatus?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  amountRange?: {
    min: number;
    max: number;
  };
  supplierAccountId?: string;
  buyerAccountId?: string;
}

export interface InvoiceState {
  // Data
  invoices: Invoice[];
  selectedInvoice: Invoice | null;
  filters: InvoiceFilters;
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Pagination
  currentPage: number;
  pageSize: number;
  totalCount: number;
  
  // Actions
  setInvoices: (invoices: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  removeInvoice: (id: string) => void;
  setSelectedInvoice: (invoice: Invoice | null) => void;
  
  // Filtering & Pagination
  setFilters: (filters: Partial<InvoiceFilters>) => void;
  clearFilters: () => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  
  // UI Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Blockchain Actions
  updateBlockchainData: (id: string, data: Partial<Invoice['blockchain']>) => void;
  addConsensusMessage: (id: string, message: ConsensusMessage) => void;
  updateFunding: (id: string, funding: Partial<Invoice['funding']>) => void;
  
  // Utility
  getInvoiceById: (id: string) => Invoice | undefined;
  getInvoicesByStatus: (status: Invoice['status']) => Invoice[];
  getInvoicesBySupplier: (supplierAccountId: string) => Invoice[];
  getTotalFundingAmount: () => number;
  
  // Reset
  reset: () => void;
}

const initialFilters: InvoiceFilters = {};

export const useInvoiceStore = create<InvoiceState>()(
  devtools(
    (set, get) => ({
      // Initial state
      invoices: [],
      selectedInvoice: null,
      filters: initialFilters,
      loading: false,
      error: null,
      currentPage: 1,
      pageSize: 10,
      totalCount: 0,
      
      // Basic CRUD Actions
      setInvoices: (invoices) => set({ invoices }, false, 'setInvoices'),
      
      addInvoice: (invoice) => set(
        (state) => ({
          invoices: [invoice, ...state.invoices],
          totalCount: state.totalCount + 1,
        }),
        false,
        'addInvoice'
      ),
      
      updateInvoice: (id, updates) => set(
        (state) => ({
          invoices: state.invoices.map((invoice) =>
            invoice.id === id 
              ? { ...invoice, ...updates, updatedAt: new Date() }
              : invoice
          ),
          selectedInvoice: state.selectedInvoice?.id === id
            ? { ...state.selectedInvoice, ...updates, updatedAt: new Date() }
            : state.selectedInvoice,
        }),
        false,
        'updateInvoice'
      ),
      
      removeInvoice: (id) => set(
        (state) => ({
          invoices: state.invoices.filter((invoice) => invoice.id !== id),
          selectedInvoice: state.selectedInvoice?.id === id ? null : state.selectedInvoice,
          totalCount: Math.max(0, state.totalCount - 1),
        }),
        false,
        'removeInvoice'
      ),
      
      setSelectedInvoice: (invoice) => set({ selectedInvoice: invoice }, false, 'setSelectedInvoice'),
      
      // Filtering & Pagination
      setFilters: (filters) => set(
        (state) => ({
          filters: { ...state.filters, ...filters },
          currentPage: 1, // Reset to first page when filters change
        }),
        false,
        'setFilters'
      ),
      
      clearFilters: () => set(
        { filters: initialFilters, currentPage: 1 },
        false,
        'clearFilters'
      ),
      
      setCurrentPage: (page) => set({ currentPage: page }, false, 'setCurrentPage'),
      setPageSize: (size) => set({ pageSize: size, currentPage: 1 }, false, 'setPageSize'),
      setTotalCount: (count) => set({ totalCount: count }, false, 'setTotalCount'),
      
      // UI Actions
      setLoading: (loading) => set({ loading }, false, 'setLoading'),
      setError: (error) => set({ error }, false, 'setError'),
      
      // Blockchain Actions
      updateBlockchainData: (id, data) => set(
        (state) => ({
          invoices: state.invoices.map((invoice) =>
            invoice.id === id
              ? {
                  ...invoice,
                  blockchain: { ...invoice.blockchain, ...data },
                  updatedAt: new Date(),
                }
              : invoice
          ),
        }),
        false,
        'updateBlockchainData'
      ),
      
      addConsensusMessage: (id, message) => set(
        (state) => ({
          invoices: state.invoices.map((invoice) =>
            invoice.id === id
              ? {
                  ...invoice,
                  blockchain: {
                    ...invoice.blockchain,
                    consensusMessages: [...invoice.blockchain.consensusMessages, message],
                  },
                  updatedAt: new Date(),
                }
              : invoice
          ),
        }),
        false,
        'addConsensusMessage'
      ),
      
      updateFunding: (id, funding) => set(
        (state) => ({
          invoices: state.invoices.map((invoice) =>
            invoice.id === id
              ? {
                  ...invoice,
                  funding: invoice.funding ? { ...invoice.funding, ...funding } : funding as Invoice['funding'],
                  updatedAt: new Date(),
                }
              : invoice
          ),
        }),
        false,
        'updateFunding'
      ),
      
      // Utility Functions
      getInvoiceById: (id) => {
        return get().invoices.find((invoice) => invoice.id === id);
      },
      
      getInvoicesByStatus: (status) => {
        return get().invoices.filter((invoice) => invoice.status === status);
      },
      
      getInvoicesBySupplier: (supplierAccountId) => {
        return get().invoices.filter((invoice) => invoice.supplierAccountId === supplierAccountId);
      },
      
      getTotalFundingAmount: () => {
        return get().invoices.reduce((total, invoice) => {
          return total + (invoice.funding?.totalFunded || 0);
        }, 0);
      },
      
      // Reset
      reset: () => set(
        {
          invoices: [],
          selectedInvoice: null,
          filters: initialFilters,
          loading: false,
          error: null,
          currentPage: 1,
          pageSize: 10,
          totalCount: 0,
        },
        false,
        'reset'
      ),
    }),
    {
      name: 'YieldHarvest Invoice Store',
    }
  )
);

// Selectors
export const useInvoices = () => useInvoiceStore((state) => state.invoices);
export const useSelectedInvoice = () => useInvoiceStore((state) => state.selectedInvoice);
export const useInvoiceFilters = () => useInvoiceStore((state) => state.filters);
export const useInvoiceLoading = () => useInvoiceStore((state) => state.loading);
export const useInvoiceError = () => useInvoiceStore((state) => state.error);

// Action selectors
export const useInvoiceActions = () => useInvoiceStore((state) => ({
  setInvoices: state.setInvoices,
  addInvoice: state.addInvoice,
  updateInvoice: state.updateInvoice,
  removeInvoice: state.removeInvoice,
  setSelectedInvoice: state.setSelectedInvoice,
  setFilters: state.setFilters,
  clearFilters: state.clearFilters,
  setCurrentPage: state.setCurrentPage,
  setPageSize: state.setPageSize,
  setTotalCount: state.setTotalCount,
  setLoading: state.setLoading,
  setError: state.setError,
  updateBlockchainData: state.updateBlockchainData,
  addConsensusMessage: state.addConsensusMessage,
  updateFunding: state.updateFunding,
  getInvoiceById: state.getInvoiceById,
  getInvoicesByStatus: state.getInvoicesByStatus,
  getInvoicesBySupplier: state.getInvoicesBySupplier,
  getTotalFundingAmount: state.getTotalFundingAmount,
  reset: state.reset,
}));