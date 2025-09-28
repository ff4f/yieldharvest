import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, WalletIcon, LogOut, Copy, ExternalLink } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';

interface WalletConnectProps {
  className?: string;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({ className }) => {
  const { isConnected, accountId, connect, disconnect } = useWallet();

  const copyAccountId = () => {
    if (accountId) {
      navigator.clipboard.writeText(accountId);
      toast.success('Account ID copied to clipboard');
    }
  };

  const openHashScan = () => {
    if (accountId) {
      window.open(`https://hashscan.io/testnet/account/${accountId}`, '_blank');
    }
  };

  const formatAccountId = (id: string) => {
    return `${id.slice(0, 8)}...${id.slice(-6)}`;
  };

  if (!isConnected) {
    return (
      <Card className={className}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <WalletIcon className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Connect Your Wallet</CardTitle>
          <CardDescription>
            Connect your HashPack wallet to interact with YieldHarvest on Hedera testnet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={connect} className="w-full" size="lg">
            <Wallet className="mr-2 h-4 w-4" />
            Connect HashPack
          </Button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don't have HashPack?{' '}
            <a 
              href="https://www.hashpack.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Download here
            </a>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <Wallet className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-sm">Wallet Connected</CardTitle>
              <Badge variant="secondary" className="text-xs">
                Hedera Testnet
              </Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={disconnect}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Account ID</p>
              <p className="text-xs text-muted-foreground">
                {accountId ? formatAccountId(accountId) : 'Loading...'}
              </p>
            </div>
            <div className="flex space-x-1">
              <Button variant="ghost" size="sm" onClick={copyAccountId}>
                <Copy className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="sm" onClick={openHashScan}>
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Connected via HashPack
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};