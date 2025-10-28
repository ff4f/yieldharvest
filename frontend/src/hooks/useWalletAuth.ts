import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';

export interface WalletAuthState {
  isAuthenticating: boolean;
  authStep: 'connect' | 'sign' | 'authenticate' | 'complete';
  error: string | null;
}

export interface WalletAuthActions {
  authenticate: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

export const useWalletAuth = () => {
  const [state, setState] = useState<WalletAuthState>({
    isAuthenticating: false,
    authStep: 'connect',
    error: null
  });

  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { 
    isConnected, 
    accountId, 
    walletType,
    hashConnect, 
    pairingData,
    connect,
    isConnecting 
  } = useWallet();

  const updateState = useCallback((updates: Partial<WalletAuthState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const authenticate = useCallback(async () => {
    if (!isConnected || !accountId) {
      updateState({ error: 'Wallet not connected' });
      return;
    }

    if (!hashConnect || !pairingData) {
      updateState({ error: 'Wallet not properly initialized' });
      return;
    }

    updateState({ 
      isAuthenticating: true, 
      error: null, 
      authStep: 'sign' 
    });

    try {
      // Generate nonce for signature
      const nonce = Date.now().toString();
      const timestamp = new Date().toISOString();
      const message = `YieldHarvest Authentication\nNonce: ${nonce}\nAccount: ${accountId}\nTimestamp: ${timestamp}`;

      toast.info('Please sign the message in your wallet...');

      // Request signature from wallet
      const signResult = await hashConnect.sign(
        pairingData.topic,
        accountId,
        message
      );

      if (!signResult.success || !signResult.signedMessage) {
        throw new Error('Signature was rejected or failed');
      }

      updateState({ authStep: 'authenticate' });
      toast.info('Signature received, authenticating...');

      // Authenticate with backend
      await login(accountId, signResult.signedMessage, nonce);
      
      updateState({ 
        authStep: 'complete',
        isAuthenticating: false 
      });
      toast.success('Successfully authenticated!');
      
    } catch (error: any) {
      console.error('Authentication failed:', error);
      const errorMessage = error.message || 'Authentication failed';
      updateState({ 
        error: errorMessage,
        authStep: 'sign',
        isAuthenticating: false 
      });
      toast.error('Authentication failed. Please try again.');
      throw error;
    }
  }, [isConnected, accountId, hashConnect, pairingData, login, updateState]);

  const connectWallet = useCallback(async () => {
    try {
      updateState({ error: null, authStep: 'connect' });
      await connect();
      updateState({ authStep: 'sign' });
    } catch (error: any) {
      updateState({ error: error.message || 'Failed to connect wallet' });
      toast.error('Wallet connection failed');
      throw error;
    }
  }, [connect, updateState]);

  const reset = useCallback(() => {
    setState({
      isAuthenticating: false,
      authStep: 'connect',
      error: null
    });
  }, []);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Auto-advance to sign step when wallet connects
  React.useEffect(() => {
    if (isConnected && accountId && state.authStep === 'connect') {
      updateState({ authStep: 'sign' });
    }
  }, [isConnected, accountId, state.authStep, updateState]);

  const actions: WalletAuthActions = {
    authenticate,
    reset,
    clearError
  };

  return {
    // State
    ...state,
    isAuthenticated,
    authLoading,
    isConnected,
    isConnecting,
    accountId,
    walletType,
    
    // Actions
    ...actions,
    connectWallet,
    
    // Computed
    canAuthenticate: isConnected && accountId && !state.isAuthenticating,
    isReady: isConnected && accountId,
    needsConnection: !isConnected,
    
    // Step helpers
    isConnectStep: state.authStep === 'connect',
    isSignStep: state.authStep === 'sign',
    isAuthenticateStep: state.authStep === 'authenticate',
    isCompleteStep: state.authStep === 'complete',
    
    // Status helpers
    getStepStatus: (step: string) => {
      const steps = ['connect', 'sign', 'authenticate', 'complete'];
      const currentIndex = steps.indexOf(state.authStep);
      const stepIndex = steps.indexOf(step);
      
      if (stepIndex < currentIndex) return 'completed';
      if (stepIndex === currentIndex) return 'current';
      return 'pending';
    }
  };
};

export default useWalletAuth;