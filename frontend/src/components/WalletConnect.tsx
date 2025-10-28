import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletIcon } from 'lucide-react';
import { WalletSelector } from './WalletSelector';
import { WalletStatus } from './WalletStatus';
import { useWallet } from '@/contexts/WalletContext';

interface WalletConnectProps {
  className?: string;
  showBalance?: boolean;
  compact?: boolean;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({ 
  className, 
  showBalance = true,
  compact = false 
}) => {
  const { isConnected } = useWallet();

  if (isConnected) {
    return <WalletStatus className={className} showBalance={showBalance} compact={compact} />;
  }

  if (compact) {
    return <WalletSelector className={className} />;
  }

  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <WalletIcon className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Connect Your Wallet</CardTitle>
        <CardDescription>
          Choose your preferred wallet to interact with YieldHarvest on Hedera testnet
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <WalletSelector />
      </CardContent>
    </Card>
  );
};