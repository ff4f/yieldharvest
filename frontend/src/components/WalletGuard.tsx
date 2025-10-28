import React from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Wallet, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WalletGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showFallback?: boolean;
  requireNetwork?: string;
  redirectTo?: string;
}

const WalletGuard: React.FC<WalletGuardProps> = ({
  children,
  fallback,
  showFallback = true,
  requireNetwork,
  redirectTo = '/connect-wallet'
}) => {
  const { isConnected, network } = useWallet();
  const navigate = useNavigate();

  // Check wallet connection
  if (!isConnected) {
    return showFallback ? (
      fallback || (
        <Alert>
          <Wallet className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Please connect your Hedera wallet to continue.</span>
            <Button 
              size="sm" 
              onClick={() => navigate(redirectTo)}
              className="ml-4"
            >
              Connect Wallet
            </Button>
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check network requirement
  if (requireNetwork && network !== requireNetwork) {
    return showFallback ? (
      fallback || (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Wrong network. Please switch to {requireNetwork} network in your wallet.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  return <>{children}</>;
};

export default WalletGuard;
export { WalletGuard };