import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Wallet, LogOut, Copy, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';

interface WalletBalance {
  hbar: string;
  tokens: Array<{
    tokenId: string;
    symbol: string;
    balance: string;
  }>;
}

interface WalletStatusProps {
  className?: string;
  showBalance?: boolean;
  compact?: boolean;
}

export const WalletStatus: React.FC<WalletStatusProps> = ({ 
  className, 
  showBalance = true,
  compact = false 
}) => {
  const { isConnected, accountId, walletType, disconnect, network } = useWallet();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!accountId) return;

    setIsLoadingBalance(true);
    setBalanceError(null);

    try {
      // Fetch balance from Mirror Node API
      const baseUrl = network === 'mainnet' 
        ? 'https://mainnet-public.mirrornode.hedera.com' 
        : 'https://testnet.mirrornode.hedera.com';
      
      const response = await fetch(`${baseUrl}/api/v1/accounts/${accountId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch balance: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Convert tinybars to HBAR (1 HBAR = 100,000,000 tinybars)
      const hbarBalance = (parseInt(data.balance.balance) / 100000000).toFixed(4);
      
      // Fetch token balances
      const tokensResponse = await fetch(`${baseUrl}/api/v1/accounts/${accountId}/tokens`);
      let tokens: Array<{ tokenId: string; symbol: string; balance: string }> = [];
      
      if (tokensResponse.ok) {
        const tokensData = await tokensResponse.json();
        tokens = tokensData.tokens?.slice(0, 5).map((token: any) => ({
          tokenId: token.token_id,
          symbol: token.symbol || 'Unknown',
          balance: token.balance || '0'
        })) || [];
      }

      setBalance({
        hbar: hbarBalance,
        tokens
      });
    } catch (error) {
      console.error('Failed to fetch balance:', error);
      setBalanceError(error instanceof Error ? error.message : 'Failed to fetch balance');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const copyAccountId = () => {
    if (accountId) {
      navigator.clipboard.writeText(accountId);
      toast.success('Account ID copied to clipboard');
    }
  };

  const openHashScan = () => {
    if (accountId) {
      const baseUrl = network === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';
      window.open(`${baseUrl}/account/${accountId}`, '_blank');
    }
  };

  const formatAccountId = (id: string) => {
    if (compact) {
      return `${id.slice(0, 6)}...${id.slice(-4)}`;
    }
    return `${id.slice(0, 8)}...${id.slice(-6)}`;
  };

  useEffect(() => {
    if (isConnected && accountId && showBalance) {
      fetchBalance();
    }
  }, [isConnected, accountId, showBalance, network]);

  if (!isConnected) {
    return null;
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
            <Wallet className="h-3 w-3 text-green-600" />
          </div>
          <span className="text-sm font-medium">
            {accountId ? formatAccountId(accountId) : 'Connected'}
          </span>
          <Badge variant="secondary" className="text-xs">
            {network}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          <LogOut className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Wallet className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-sm">
                {walletType === 'hashpack' ? 'HashPack' : 'Blade'} Connected
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-xs">
                  Hedera {network}
                </Badge>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={disconnect} data-testid="disconnect-wallet-button">
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4" data-testid="wallet-info">
        {/* Account Information */}
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Account ID</p>
              <p className="font-mono text-sm text-muted-foreground" data-testid="account-id">
                {accountId ? formatAccountId(accountId) : 'Loading...'}
              </p>
            </div>
            <div className="flex space-x-1">
              <Button variant="ghost" size="sm" onClick={copyAccountId} data-testid="copy-account-button">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={openHashScan}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Balance Information */}
        {showBalance && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Balance</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchBalance}
                  disabled={isLoadingBalance}
                  data-testid="refresh-balance-button"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {balanceError ? (
                <div className="flex items-center space-x-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{balanceError}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* HBAR Balance */}
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">ℏ</span>
                      </div>
                      <span className="text-sm font-medium">HBAR</span>
                    </div>
                    <span className="font-mono text-sm">
                      {isLoadingBalance ? '...' : balance?.hbar || '0.0000'}
                    </span>
                  </div>

                  {/* Token Balances */}
                  {balance?.tokens && balance.tokens.length > 0 && (
                    <div className="space-y-1">
                      {balance.tokens.map((token) => (
                        <div key={token.tokenId} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                          <span className="text-xs text-muted-foreground">
                            {token.symbol}
                          </span>
                          <span className="font-mono text-xs">
                            {token.balance}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};