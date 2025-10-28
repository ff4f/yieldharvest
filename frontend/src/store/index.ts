import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Types
export interface User {
  id: string;
  accountId: string;
  email?: string;
  name?: string;
  role: 'supplier' | 'investor' | 'agent' | 'auditor' | 'admin';
  permissions: string[];
}

export interface SessionState {
  user: User | null;
  token: string | null;
  accountId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface UIState {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  notifications: Notification[];
  filters: Record<string, any>;
  theme: 'light' | 'dark';
}

export interface WizardState {
  invoiceDraft: InvoiceDraft | null;
  currentStep: number;
  completedSteps: number[];
  isSubmitting: boolean;
}

export interface InvoiceDraft {
  id?: string;
  supplierId: string;
  amount: number;
  currency: string;
  description: string;
  dueDate: string;
  documents: File[];
  metadata: Record<string, any>;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

export interface ProofLink {
  type: 'hts' | 'hfs' | 'hcs' | 'hashscan';
  label: string;
  url: string;
  hash?: string;
  timestamp?: number;
}

// Combined store interface
interface AppStore {
  // Session state
  session: SessionState;
  
  // UI state
  ui: UIState;
  
  // Wizard state
  wizard: WizardState;
  
  // Proof links for Hedera integration
  proofLinks: ProofLink[];
  
  // Session actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setAccountId: (accountId: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
  
  // UI actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setFilters: (filters: Record<string, any>) => void;
  updateFilter: (key: string, value: any) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Wizard actions
  setInvoiceDraft: (draft: InvoiceDraft | null) => void;
  updateInvoiceDraft: (updates: Partial<InvoiceDraft>) => void;
  setCurrentStep: (step: number) => void;
  markStepCompleted: (step: number) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  resetWizard: () => void;
  
  // Proof link actions
  addProofLink: (link: ProofLink) => void;
  clearProofLinks: () => void;
  
  // Utility actions
  reset: () => void;
}

// Initial states
const initialSessionState: SessionState = {
  user: null,
  token: null,
  accountId: null,
  isAuthenticated: false,
  isLoading: false,
};

const initialUIState: UIState = {
  sidebarCollapsed: false,
  activeModal: null,
  notifications: [],
  filters: {},
  theme: 'light',
};

const initialWizardState: WizardState = {
  invoiceDraft: null,
  currentStep: 0,
  completedSteps: [],
  isSubmitting: false,
};

// Create the store
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        session: initialSessionState,
        ui: initialUIState,
        wizard: initialWizardState,
        proofLinks: [],

        // Session actions
        setUser: (user) =>
          set((state) => {
            state.session.user = user;
          }),

        setToken: (token) =>
          set((state) => {
            state.session.token = token;
          }),

        setAccountId: (accountId) =>
          set((state) => {
            state.session.accountId = accountId;
          }),

        setAuthenticated: (isAuthenticated) =>
          set((state) => {
            state.session.isAuthenticated = isAuthenticated;
          }),

        setLoading: (isLoading) =>
          set((state) => {
            state.session.isLoading = isLoading;
          }),

        logout: () =>
          set((state) => {
            state.session = initialSessionState;
            state.wizard = initialWizardState;
            state.proofLinks = [];
          }),

        // UI actions
        toggleSidebar: () =>
          set((state) => {
            state.ui.sidebarCollapsed = !state.ui.sidebarCollapsed;
          }),

        setSidebarCollapsed: (collapsed) =>
          set((state) => {
            state.ui.sidebarCollapsed = collapsed;
          }),

        openModal: (modalId) =>
          set((state) => {
            state.ui.activeModal = modalId;
          }),

        closeModal: () =>
          set((state) => {
            state.ui.activeModal = null;
          }),

        addNotification: (notification) =>
          set((state) => {
            const newNotification: Notification = {
              ...notification,
              id: Date.now().toString(),
              timestamp: Date.now(),
              read: false,
            };
            state.ui.notifications.unshift(newNotification);
            
            // Keep only last 50 notifications
            if (state.ui.notifications.length > 50) {
              state.ui.notifications = state.ui.notifications.slice(0, 50);
            }
          }),

        markNotificationRead: (id) =>
          set((state) => {
            const notification = state.ui.notifications.find((n) => n.id === id);
            if (notification) {
              notification.read = true;
            }
          }),

        clearNotifications: () =>
          set((state) => {
            state.ui.notifications = [];
          }),

        setFilters: (filters) =>
          set((state) => {
            state.ui.filters = filters;
          }),

        updateFilter: (key, value) =>
          set((state) => {
            state.ui.filters[key] = value;
          }),

        setTheme: (theme) =>
          set((state) => {
            state.ui.theme = theme;
          }),

        // Wizard actions
        setInvoiceDraft: (draft) =>
          set((state) => {
            state.wizard.invoiceDraft = draft;
          }),

        updateInvoiceDraft: (updates) =>
          set((state) => {
            if (state.wizard.invoiceDraft) {
              Object.assign(state.wizard.invoiceDraft, updates);
            }
          }),

        setCurrentStep: (step) =>
          set((state) => {
            state.wizard.currentStep = step;
          }),

        markStepCompleted: (step) =>
          set((state) => {
            if (!state.wizard.completedSteps.includes(step)) {
              state.wizard.completedSteps.push(step);
            }
          }),

        setSubmitting: (isSubmitting) =>
          set((state) => {
            state.wizard.isSubmitting = isSubmitting;
          }),

        resetWizard: () =>
          set((state) => {
            state.wizard = initialWizardState;
          }),

        // Proof link actions
        addProofLink: (link) =>
          set((state) => {
            state.proofLinks.push(link);
          }),

        clearProofLinks: () =>
          set((state) => {
            state.proofLinks = [];
          }),

        // Utility actions
        reset: () =>
          set((state) => {
            state.session = initialSessionState;
            state.ui = initialUIState;
            state.wizard = initialWizardState;
            state.proofLinks = [];
          }),
      })),
      {
        name: 'yieldharvest-store',
        partialize: (state) => ({
          session: {
            token: state.session.token,
            accountId: state.session.accountId,
          },
          ui: {
            sidebarCollapsed: state.ui.sidebarCollapsed,
            theme: state.ui.theme,
            filters: state.ui.filters,
          },
        }),
      }
    ),
    {
      name: 'YieldHarvest Store',
    }
  )
);

// Selector hooks for better performance
export const useSession = () => useAppStore((state) => state.session);
export const useUI = () => useAppStore((state) => state.ui);
export const useWizard = () => useAppStore((state) => state.wizard);
export const useProofLinks = () => useAppStore((state) => state.proofLinks);

// Action hooks
export const useSessionActions = () => useAppStore((state) => ({
  setUser: state.setUser,
  setToken: state.setToken,
  setAccountId: state.setAccountId,
  setAuthenticated: state.setAuthenticated,
  setLoading: state.setLoading,
  logout: state.logout,
}));

export const useUIActions = () => useAppStore((state) => ({
  toggleSidebar: state.toggleSidebar,
  setSidebarCollapsed: state.setSidebarCollapsed,
  openModal: state.openModal,
  closeModal: state.closeModal,
  addNotification: state.addNotification,
  markNotificationRead: state.markNotificationRead,
  clearNotifications: state.clearNotifications,
  setFilters: state.setFilters,
  updateFilter: state.updateFilter,
  setTheme: state.setTheme,
}));

export const useWizardActions = () => useAppStore((state) => ({
  setInvoiceDraft: state.setInvoiceDraft,
  updateInvoiceDraft: state.updateInvoiceDraft,
  setCurrentStep: state.setCurrentStep,
  markStepCompleted: state.markStepCompleted,
  setSubmitting: state.setSubmitting,
  resetWizard: state.resetWizard,
}));

export const useProofActions = () => useAppStore((state) => ({
  addProofLink: state.addProofLink,
  clearProofLinks: state.clearProofLinks,
}));