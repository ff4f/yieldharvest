import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wallet, 
  LogIn, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Shield,
  User
} from 'lucide-react';
import { WalletSelector } from './WalletSelector';
import { WalletStatus } from './WalletStatus';
import { toast } from 'sonner';

interface WalletAuthProps {
  redirectTo?: string;
  showHeader?: boolean;
  compact?: boolean;
}

export const WalletAuth: React.FC<WalletAuthProps> = ({ 
  redirectTo = '/dashboard',
  showHeader = true,
  compact = false
}) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStep, setAuthStep] = useState<'connect' | 'sign' | 'authenticate' | 'complete'>('connect');
  const [error, setError] = useState<string | null>(null);
  
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const { 
    connect, 
    isConnected, 
    accountId, 
    walletType,
    hashConnect, 
    pairingData,
    isConnecting 
  } = useWallet();
  
  const location = useLocation();
  const from = location.state?.from?.pathname || redirectTo;

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  // Auto-advance to sign step when wallet connects
  useEffect(() => {
    if (isConnected && accountId && authStep === 'connect') {
      setAuthStep('sign');
    }
  }, [isConnected, accountId, authStep]);

  const handleWalletConnect = async () => {
    try {
      setError(null);
      setAuthStep('connect');
      await connect();
    } catch (error: any) {
      setError(error.message || 'Failed to connect wallet');
      toast.error('Wallet connection failed');
    }
  };

  const handleAuthenticate = async () => {
    if (!isConnected || !accountId) {
      setError('Wallet not connected');
      return;
    }

    if (!hashConnect || !pairingData) {
      setError('Wallet not properly initialized');
      return;
    }

    setIsAuthenticating(true);
    setError(null);
    setAuthStep('sign');

    try {
      // Generate nonce for signature
      const nonce = Date.now().toString();
      const message = `YieldHarvest Authentication\nNonce: ${nonce}\nAccount: ${accountId}\nTimestamp: ${new Date().toISOString()}`;

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

      setAuthStep('authenticate');
      toast.info('Signature received, authenticating...');

      // Authenticate with backend
      await login(accountId, signResult.signedMessage, nonce);
      
      setAuthStep('complete');
      toast.success('Successfully authenticated!');
      
    } catch (error: any) {
      console.error('Authentication failed:', error);
      setError(error.message || 'Authentication failed');
      setAuthStep('sign');
      toast.error('Authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const getStepStatus = (step: string) => {
    const currentStepIndex = ['connect', 'sign', 'authenticate', 'complete'].indexOf(authStep);
    const stepIndex = ['connect', 'sign', 'authenticate', 'complete'].indexOf(step);
    
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'current';
    return 'pending';
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-6">
      {[
        { key: 'connect', label: 'Connect', icon: Wallet },
        { key: 'sign', label: 'Sign', icon: Shield },
        { key: 'authenticate', label: 'Authenticate', icon: User },
        { key: 'complete', label: 'Complete', icon: CheckCircle }
      ].map((step, index) => {
        const status = getStepStatus(step.key);
        const Icon = step.icon;
        
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center space-y-2">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                ${status === 'completed' ? 'bg-green-500 border-green-500 text-white' : ''}
                ${status === 'current' ? 'bg-primary border-primary text-white' : ''}
                ${status === 'pending' ? 'bg-gray-100 border-gray-300 text-gray-400' : ''}
              `}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${
                status === 'current' ? 'text-primary' : 
                status === 'completed' ? 'text-green-600' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
            {index < 3 && (
              <div className={`w-8 h-0.5 ${
                getStepStatus(['connect', 'sign', 'authenticate'][index]) === 'completed' 
                  ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderContent = () => {
    if (compact && isConnected) {
      return (
        <div className="space-y-4">
          <WalletStatus compact showBalance={false} />
          <Button 
            onClick={handleAuthenticate} 
            disabled={isAuthenticating || authLoading}
            className="w-full"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {authStep === 'sign' ? 'Sign Message...' : 'Authenticating...'}
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {!compact && renderStepIndicator()}
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Connect Wallet */}
        {authStep === 'connect' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">Connect Your Wallet</h3>
              <p className="text-sm text-muted-foreground">
                Choose your preferred Hedera wallet to continue
              </p>
            </div>
            <WalletSelector />
          </div>
        )}

        {/* Step 2 & 3: Sign and Authenticate */}
        {(authStep === 'sign' || authStep === 'authenticate') && isConnected && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                {authStep === 'sign' ? 'Sign Authentication Message' : 'Authenticating...'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {authStep === 'sign' 
                  ? 'Sign the message in your wallet to prove ownership of your account'
                  : 'Verifying your signature with YieldHarvest...'
                }
              </p>
            </div>

            <WalletStatus compact showBalance={false} />

            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 text-sm">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">Secure Authentication</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your private keys never leave your wallet. We only verify ownership through cryptographic signatures.
              </p>
            </div>

            <Button 
              onClick={handleAuthenticate} 
              disabled={isAuthenticating || authLoading}
              className="w-full"
              size="lg"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {authStep === 'sign' ? 'Waiting for signature...' : 'Authenticating...'}
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign & Authenticate
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 4: Complete */}
        {authStep === 'complete' && (
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-600">Authentication Successful!</h3>
              <p className="text-sm text-muted-foreground">
                Redirecting to your dashboard...
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="space-y-4">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        {showHeader && (
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Welcome to YieldHarvest</CardTitle>
            <CardDescription>
              Connect your Hedera wallet to access invoice financing on the blockchain
            </CardDescription>
          </CardHeader>
        )}
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletAuth;