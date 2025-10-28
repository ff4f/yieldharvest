import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useWallet } from '@/contexts/WalletContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredPermission?: string;
  requireWallet?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
  requireWallet = true
}) => {
  const { isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();
  const { isConnected } = useWallet();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Check wallet connection if required
  if (requireWallet && !isConnected) {
    return (
      <Navigate 
        to="/connect-wallet" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check authentication
  if (!isAuthenticated) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Check role-based access
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <Navigate 
        to="/unauthorized" 
        state={{ 
          from: location,
          requiredRole,
          message: `Access denied. This page requires ${requiredRole} role.`
        }} 
        replace 
      />
    );
  }

  // Check permission-based access
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Navigate 
        to="/unauthorized" 
        state={{ 
          from: location,
          requiredPermission,
          message: `Access denied. This page requires '${requiredPermission}' permission.`
        }} 
        replace 
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;