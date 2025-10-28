import React from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Lock } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requiredRoles?: UserRole[];
  requiredPermission?: string;
  requiredPermissions?: string[];
  fallback?: React.ReactNode;
  showFallback?: boolean;
  operator?: 'AND' | 'OR'; // For multiple roles/permissions
}

const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  requiredRole,
  requiredRoles = [],
  requiredPermission,
  requiredPermissions = [],
  fallback,
  showFallback = true,
  operator = 'OR'
}) => {
  const { user, hasRole, hasPermission } = useAuth();

  if (!user) {
    return showFallback ? (
      fallback || (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to access this content.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check single role
  if (requiredRole && !hasRole(requiredRole)) {
    return showFallback ? (
      fallback || (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Access denied. This content requires {requiredRole} role.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check multiple roles
  if (requiredRoles.length > 0) {
    const roleChecks = requiredRoles.map(role => hasRole(role));
    const hasAccess = operator === 'AND' 
      ? roleChecks.every(check => check)
      : roleChecks.some(check => check);

    if (!hasAccess) {
      return showFallback ? (
        fallback || (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Access denied. This content requires one of the following roles: {requiredRoles.join(', ')}.
            </AlertDescription>
          </Alert>
        )
      ) : null;
    }
  }

  // Check single permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return showFallback ? (
      fallback || (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Access denied. This content requires '{requiredPermission}' permission.
          </AlertDescription>
        </Alert>
      )
    ) : null;
  }

  // Check multiple permissions
  if (requiredPermissions.length > 0) {
    const permissionChecks = requiredPermissions.map(permission => hasPermission(permission));
    const hasAccess = operator === 'AND'
      ? permissionChecks.every(check => check)
      : permissionChecks.some(check => check);

    if (!hasAccess) {
      return showFallback ? (
        fallback || (
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertDescription>
              Access denied. This content requires one of the following permissions: {requiredPermissions.join(', ')}.
            </AlertDescription>
          </Alert>
        )
      ) : null;
    }
  }

  return <>{children}</>;
};

export default RoleGuard;
export { RoleGuard };