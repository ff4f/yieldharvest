// Shared TypeScript types for YieldHarvest F.MD implementation

// User and Authentication Types
export interface User {
  id: string;
  accountId: string;
  email?: string;
  name?: string;
  role: UserRole;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'supplier' | 'investor' | 'agent' | 'auditor' | 'admin';

export interface AuthState {
  user: User | null;
  token: string | null;
  accountId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Invoice Types
export interface Invoice {
  id: string;
  supplierId: string;
  supplierName: string;
  buyerId?: string;
  buyerName?: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  description: string;
  status: InvoiceStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  
  // Hedera integration fields
  nftTokenId?: string;
  nftSerialNumber?: string;
  fileId?: string;
  fileHash?: string;
  topicId?: string;
  transactionId?: string;
  
  // Metadata and proofs
  metadata: Record<string, any>;
  proofLinks: ProofLink[];
  documents: InvoiceDocument[];
}

export type InvoiceStatus = 
  | 'draft' 
  | 'issued' 
  | 'funded' 
  | 'paid' 
  | 'overdue' 
  | 'cancelled'
  | 'disputed';

export interface InvoiceDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  fileId?: string;
  hash?: string;
  uploadedAt: string;
}

// Deal and Funding Types
export interface Deal {
  id: string;
  invoiceId: string;
  investorId: string;
  investorName: string;
  fundingAmount: number;
  interestRate: number;
  status: DealStatus;
  createdAt: string;
  updatedAt: string;
  
  // Hedera integration
  scheduledTransactionId?: string;
  escrowAccountId?: string;
  contractId?: string;
  
  // Metadata and proofs
  proofLinks: ProofLink[];
  milestones: DealMilestone[];
}

export type DealStatus = 
  | 'pending' 
  | 'active' 
  | 'completed' 
  | 'defaulted'
  | 'cancelled'
  | 'disputed';

export interface DealMilestone {
  id: string;
  dealId: string;
  title: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'completed' | 'overdue';
  completedAt?: string;
  transactionId?: string;
  proofLinks: ProofLink[];
}

// Hedera Integration Types
export interface ProofLink {
  type: 'hts' | 'hfs' | 'hcs' | 'hashscan' | 'mirror' | 'contract';
  label: string;
  url: string;
  hash?: string;
  timestamp?: number;
  verified?: boolean;
}

export interface HederaTransaction {
  transactionId: string;
  status: 'pending' | 'success' | 'failed';
  type: 'nft_mint' | 'file_create' | 'topic_message' | 'transfer' | 'contract_call';
  timestamp: string;
  fee: number;
  memo?: string;
  receipt?: any;
  record?: any;
}

export interface NFTMetadata {
  tokenId: string;
  serialNumber: string;
  metadata: {
    name: string;
    description: string;
    image?: string;
    properties: Record<string, any>;
  };
  owner: string;
  createdAt: string;
}

// UI State Types
export interface UIState {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  notifications: Notification[];
  filters: Record<string, any>;
  theme: 'light' | 'dark';
  loading: Record<string, boolean>;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'default' | 'destructive';
}

// Wizard and Form Types
export interface WizardState {
  invoiceDraft: InvoiceDraft | null;
  currentStep: number;
  completedSteps: number[];
  isSubmitting: boolean;
  errors: Record<string, string>;
}

export interface InvoiceDraft {
  id?: string;
  supplierId: string;
  buyerId?: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  description: string;
  dueDate: string;
  documents: File[];
  metadata: Record<string, any>;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

// Dashboard and Analytics Types
export interface DashboardMetrics {
  totalInvoices: number;
  totalFunded: number;
  totalValue: number;
  activeDeals: number;
  pendingSettlements: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'invoice_created' | 'deal_funded' | 'payment_received' | 'milestone_completed';
  title: string;
  description: string;
  timestamp: string;
  actor: string;
  entityId: string;
  proofLinks: ProofLink[];
}

export interface KPICard {
  id: string;
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease';
  icon: string;
  color: string;
  description?: string;
}

// Filter and Search Types
export interface InvoiceFilters {
  status?: InvoiceStatus[];
  supplierId?: string;
  buyerId?: string;
  amountMin?: number;
  amountMax?: number;
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DealFilters {
  status?: DealStatus[];
  investorId?: string;
  invoiceId?: string;
  amountMin?: number;
  amountMax?: number;
  interestRateMin?: number;
  interestRateMax?: number;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Wallet Integration Types
export interface WalletState {
  isConnected: boolean;
  accountId: string | null;
  publicKey: string | null;
  network: 'testnet' | 'mainnet';
  provider: 'hashpack' | 'blade' | null;
  balance: number;
}

export interface WalletTransaction {
  id: string;
  type: string;
  amount?: number;
  recipient?: string;
  memo?: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: string;
  transactionId?: string;
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface TableColumn<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface ModalProps extends BaseComponentProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Route and Navigation Types
export interface RouteConfig {
  path: string;
  element: React.ComponentType;
  roles?: UserRole[];
  permissions?: string[];
  layout?: 'default' | 'auth' | 'portal';
  title?: string;
  breadcrumb?: string;
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: string;
  current?: boolean;
}

// Form Validation Types
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  custom?: (value: any) => string | null;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'number' | 'date' | 'select' | 'textarea' | 'file';
  placeholder?: string;
  description?: string;
  required?: boolean;
  validation?: ValidationRule;
  options?: { label: string; value: any }[];
  disabled?: boolean;
}

// Export utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};