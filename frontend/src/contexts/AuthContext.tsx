import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useWallet } from './WalletContext';
import { apiClient } from '../services/api';
import { useSession, useSessionActions } from '@/store';
import { User, UserRole } from '@/types/shared';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (accountId: string, signature: string, nonce: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  token: string | null;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  investor: ['view_deals', 'fund_deals', 'view_portfolio', 'view_invoices'],
  supplier: ['create_invoices', 'view_own_invoices', 'upload_documents', 'view_milestones'],
  agent: ['view_all_deals', 'manage_milestones', 'verify_documents', 'track_progress'],
  auditor: ['audit_settlements', 'view_audit_trail', 'verify_transactions', 'generate_reports'],
  admin: ['*'] // Admin has all permissions
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Use Zustand store instead of local state
  const session = useSession();
  const { setUser, setToken, setAccountId, setAuthenticated, setLoading, logout: storeLogout } = useSessionActions();
  const { isConnected } = useWallet();

  // Initialize auth state from stored token
  useEffect(() => {
    const initializeAuth = async () => {
      setLoading(true);
      
      try {
        const storedToken = session.token;
        if (storedToken) {
          apiClient.setAuthToken(storedToken);
          
          try {
            const userData = await apiClient.getCurrentUser();
            setUser(userData);
            setAuthenticated(true);
          } catch (error) {
            console.error('Failed to validate stored token:', error);
            // Clear invalid token
            storeLogout();
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Handle wallet connection changes
  useEffect(() => {
    if (!isConnected && session.isAuthenticated) {
      // Wallet disconnected, logout user
      logout();
    }
  }, [isConnected, session.isAuthenticated]);

  const login = async (accountId: string, signature: string, nonce: string): Promise<void> => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/wallet-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          signature,
          nonce,
        }),
      });

      if (!response.ok) {
        throw new Error('Authentication failed');
      }

      const data = await response.json();
      
      // Update Zustand store
      setToken(data.token);
      setUser(data.user);
      setAccountId(accountId);
      setAuthenticated(true);
      
      // Set token in API client
      apiClient.setAuthToken(data.token);
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = (): void => {
    // Clear API client token
    apiClient.setAuthToken(null);
    
    // Clear Zustand store
    storeLogout();
  };

  const refreshToken = async (): Promise<void> => {
    try {
      const response = await apiClient.refreshToken();
      setToken(response.token);
      setUser(response.user);
      apiClient.setAuthToken(response.token);
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      throw error;
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!session.user) return false;
    
    const userPermissions = ROLE_PERMISSIONS[session.user.role] || [];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  };

  const hasRole = (role: UserRole): boolean => {
    return session.user?.role === role;
  };

  const value: AuthContextType = {
    user: session.user,
    isAuthenticated: session.isAuthenticated,
    isLoading: session.isLoading,
    token: session.token,
    login,
    logout,
    refreshToken,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};