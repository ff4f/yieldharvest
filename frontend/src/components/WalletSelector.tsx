import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ExternalLink, Loader2 } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { toast } from 'sonner';

interface WalletSelectorProps {
  className?: string;
}

export const WalletSelector: React.FC<WalletSelectorProps> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { connect, isConnecting } = useWallet();

  const handleConnect = async () => {
    try {
      await connect();
      setIsOpen(false);
      toast.success('Wallet connected successfully!');
    } catch (error) {
      console.error('Connection failed:', error);
      toast.error('Failed to connect wallet. Please try again.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className={className} 
          size="lg" 
          disabled={isConnecting}
          data-testid="wallet-connect-button"
        >
          {isConnecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wallet className="mr-2 h-4 w-4" />
          )}
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Your Wallet</DialogTitle>
          <DialogDescription>
            Connect your Hedera wallet to YieldHarvest on testnet
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-3" data-testid="wallet-selection-modal">
          {/* HashPack Wallet */}
          <Card 
            className="cursor-pointer transition-colors hover:bg-accent" 
            onClick={handleConnect}
            data-testid="hashpack-wallet-option"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                    <Wallet className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">HashPack</CardTitle>
                    <CardDescription className="text-xs">
                      Official Hedera wallet with WalletConnect
                    </CardDescription>
                  </div>
                </div>
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Blade Wallet */}
          <Card className="cursor-not-allowed opacity-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Wallet className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">Blade Wallet</CardTitle>
                    <CardDescription className="text-xs">
                      Coming soon
                    </CardDescription>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </Card>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-muted-foreground">
            By connecting your wallet, you agree to our Terms of Service and Privacy Policy.
            Make sure you're on the Hedera testnet.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
            <span>Don't have a wallet?</span>
            <a 
              href="https://www.hashpack.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Get HashPack
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};