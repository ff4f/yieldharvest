import React from 'react';
import { useLocation } from 'react-router-dom';
import WalletAuth from '@/components/WalletAuth';

const ConnectWallet: React.FC = () => {
  const location = useLocation();
  const from = location.state?.from?.pathname || '/login';

  return (
    <WalletAuth redirectTo={from} showHeader={false} />
  );
};

export default ConnectWallet;