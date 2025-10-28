import React from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  ExternalLink, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { toast } from 'sonner';

interface WalletInfoProps {
  variant?: 'card' | 'inline' | 'compact';
  showBalance?: boolean;
  showActions?: boolean;
}

const WalletInfo: React.FC<WalletInfoProps> = ({ 
  variant = 'card',
  showBalance = true,
  showActions = true
}) => {
  const { 
    isConnected, 
    accountId, 
    walletType, 
    network,
    balance,
    disconnect 
  } = useWallet();
  const { user } = useAuth();

  const formatBalance = (balance: string) => {
    // Parse and format balance for display
    const tokens = balance.split(' ');
    return tokens.map((token: string, index: number) => (
      <span key={index} className={index === 0 ? 'font-mono' : 'text-xs opacity-75'}>
        {token}
      </span>
    ));
  };

  const copyAccountId = async () => {
    if (accountId) {
      await navigator.clipboard.writeText(accountId);
      toast.success('Account ID copied to clipboard');
    }
  };

  const openHashScan = () => {
    if (accountId) {
      const baseUrl = network === 'mainnet' 
        ? 'https://hashscan.io/mainnet' 
        : 'https://hashscan.io/testnet';
      window.open(`${baseUrl}/account/${accountId}`, '_blank');
    }
  };

  if (!isConnected) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex items-center gap-3 pt-6">
          <WifiOff className="h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Wallet Disconnected</p>
            <p className="text-sm text-muted-foreground">
              Please connect your wallet to continue
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Wifi className="h-3 w-3 text-green-500" />
          <Badge variant="secondary" className="text-xs">
            {walletType}
          </Badge>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {accountId?.slice(0, 8)}...{accountId?.slice(-4)}
        </span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <Badge variant="outline">{walletType}</Badge>
          </div>
          <div>
            <p className="text-sm font-medium">{user?.name || 'Connected'}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {accountId}
            </p>
          </div>
        </div>
        {showActions && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={copyAccountId}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={openHashScan}>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Wallet Connection
          <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Wallet Type</p>
            <Badge variant="outline" className="mt-1">
              {walletType}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Network</p>
            <Badge 
              variant={network === 'mainnet' ? 'default' : 'secondary'}
              className="mt-1"
            >
              {network}
            </Badge>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground">Account ID</p>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-sm bg-muted px-2 py-1 rounded flex-1">
              {accountId}
            </code>
            <Button size="sm" variant="ghost" onClick={copyAccountId}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {showBalance && balance && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">Balance</p>
            <p className="text-lg font-semibold mt-1">
              {balance.hbar} HBAR
            </p>
            {balance.tokens && balance.tokens.length > 0 && (
              <div className="mt-2 space-y-1">
                {balance.tokens.slice(0, 3).map((token, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>{token.symbol}</span>
                    <span>{token.balance}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showActions && (
          <div className="flex gap-2 pt-2">
            <Button size="sm" variant="outline" onClick={openHashScan}>
              <ExternalLink className="h-3 w-3 mr-1" />
              View on HashScan
            </Button>
            <Button size="sm" variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletInfo;