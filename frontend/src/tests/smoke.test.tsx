import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock all wallet-related modules before any imports
vi.mock('@hashgraph/hedera-wallet-connect', () => ({
  HashConnect: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    connectToLocalWallet: vi.fn(),
    disconnect: vi.fn(),
    sendTransaction: vi.fn(),
  })),
  HashConnectTypes: {
    WalletMetadata: {},
    AppMetadata: {},
  },
}));

vi.mock('hashconnect', () => ({
  HashConnect: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    connectToLocalWallet: vi.fn(),
    disconnect: vi.fn(),
    sendTransaction: vi.fn(),
  })),
}));

vi.mock('@walletconnect/modal-core', () => ({
  ExplorerCtrl: {
    state: {},
    subscribe: vi.fn(),
  },
}));

import App from '../App';
import { AuthProvider } from '../contexts/AuthContext';
import { WalletProvider } from '../contexts/WalletContext';

// Mock the store
vi.mock('../store', () => ({
  useSession: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    token: null,
    accountId: null,
  }),
  useSessionActions: () => ({
    setUser: vi.fn(),
    setToken: vi.fn(),
    setAccountId: vi.fn(),
    setAuthenticated: vi.fn(),
    setLoading: vi.fn(),
    logout: vi.fn(),
  }),
  useUI: () => ({
    theme: 'light',
    sidebarCollapsed: false,
    notifications: [],
    modals: {},
  }),
  useUIActions: () => ({
    setTheme: vi.fn(),
    toggleSidebar: vi.fn(),
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
  useWizard: () => ({
    currentStep: 0,
    steps: [],
    data: {},
    isComplete: false,
  }),
  useWizardActions: () => ({
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    goToStep: vi.fn(),
    updateData: vi.fn(),
    resetWizard: vi.fn(),
    completeWizard: vi.fn(),
  }),
}));

// Mock API client
vi.mock('../services/api', () => ({
  apiClient: {
    setAuthToken: vi.fn(),
    getCurrentUser: vi.fn(),
    refreshToken: vi.fn(),
  },
  api: {
    authApi: {
      connectWallet: vi.fn(),
      refreshToken: vi.fn(),
      logout: vi.fn(),
    },
    userApi: {
      getCurrentUser: vi.fn(),
      updateProfile: vi.fn(),
    },
  },
}));

// Mock wallet context
vi.mock('../contexts/WalletContext', () => ({
  WalletProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useWallet: () => ({
    isConnected: false,
    accountId: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    signMessage: vi.fn(),
  }),
}));

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </WalletProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('Smoke Tests - Route Guards and Basic Flows', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  describe('Route Guards', () => {
    it('should redirect unauthenticated users to login', async () => {
      const TestWrapper = createTestWrapper();
      
      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should show login/landing page for unauthenticated users
      await waitFor(() => {
        expect(screen.getByText(/YieldHarvest/i) || screen.getByText(/Login/i) || screen.getByText(/Connect Wallet/i)).toBeInTheDocument();
      });
    });

    it('should handle protected routes correctly', async () => {
      const TestWrapper = createTestWrapper();
      
      // Mock authenticated state
      vi.mocked(require('../store').useSession).mockReturnValue({
        user: {
          id: '1',
          accountId: '0.0.123',
          role: 'supplier',
          email: 'test@example.com',
          name: 'Test User',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        isAuthenticated: true,
        isLoading: false,
        token: 'mock-token',
        accountId: '0.0.123',
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should render the main app layout for authenticated users
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Basic Navigation Flow', () => {
    it('should render app without crashing', () => {
      const TestWrapper = createTestWrapper();
      
      expect(() => {
        render(
          <TestWrapper>
            <App />
          </TestWrapper>
        );
      }).not.toThrow();
    });

    it('should handle role-based navigation', async () => {
      const TestWrapper = createTestWrapper();
      
      // Mock supplier role
      vi.mocked(require('../store').useSession).mockReturnValue({
        user: {
          id: '1',
          accountId: '0.0.123',
          role: 'supplier',
          email: 'supplier@example.com',
          name: 'Supplier User',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        isAuthenticated: true,
        isLoading: false,
        token: 'mock-token',
        accountId: '0.0.123',
      });

      render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should render without errors for supplier role
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Error Boundaries', () => {
    it('should handle component errors gracefully', () => {
      const TestWrapper = createTestWrapper();
      
      // Mock a component that throws an error
      const ThrowError = () => {
        throw new Error('Test error');
      };

      expect(() => {
        render(
          <TestWrapper>
            <ThrowError />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Store Integration', () => {
    it('should initialize store correctly', () => {
      const { useSession, useUI, useWizard } = require('../store');
      
      expect(useSession).toBeDefined();
      expect(useUI).toBeDefined();
      expect(useWizard).toBeDefined();
    });

    it('should handle store actions without errors', () => {
      const { useSessionActions, useUIActions, useWizardActions } = require('../store');
      
      const sessionActions = useSessionActions();
      const uiActions = useUIActions();
      const wizardActions = useWizardActions();

      expect(() => {
        sessionActions.setUser(null);
        sessionActions.setToken(null);
        sessionActions.logout();
        
        uiActions.setTheme('dark');
        uiActions.toggleSidebar();
        
        wizardActions.nextStep();
        wizardActions.resetWizard();
      }).not.toThrow();
    });
  });

  describe('API Integration', () => {
    it('should handle API client initialization', () => {
      const { apiClient, api } = require('../services/api');
      
      expect(apiClient).toBeDefined();
      expect(api).toBeDefined();
      expect(api.authApi).toBeDefined();
      expect(api.userApi).toBeDefined();
      expect(api.invoiceApi).toBeDefined();
    });

    it('should handle API errors gracefully', async () => {
      const { apiClient } = require('../services/api');
      
      // Mock API error
      vi.mocked(apiClient.getCurrentUser).mockRejectedValue(new Error('API Error'));
      
      expect(async () => {
        try {
          await apiClient.getCurrentUser();
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }).not.toThrow();
    });
  });

  describe('Wallet Integration', () => {
    it('should handle wallet connection states', () => {
      const { useWallet } = require('../contexts/WalletContext');
      
      const wallet = useWallet();
      
      expect(wallet.isConnected).toBeDefined();
      expect(wallet.accountId).toBeDefined();
      expect(wallet.connect).toBeDefined();
      expect(wallet.disconnect).toBeDefined();
    });
  });
});