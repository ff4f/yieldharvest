import React from 'react';
import { useLocation } from 'react-router-dom';
import WalletAuth from '@/components/WalletAuth';

const Login: React.FC = () => {
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  return (
    <WalletAuth redirectTo={from} />
  );
};

export default Login;