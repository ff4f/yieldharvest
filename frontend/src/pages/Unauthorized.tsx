import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const Unauthorized: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const message = location.state?.message || 'You do not have permission to access this page.';
  const requiredRole = location.state?.requiredRole;
  const requiredPermission = location.state?.requiredPermission;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Access Denied
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {message}
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="space-y-4">
              {user && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Current User Information
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">Account:</span> {user.accountId}</p>
                    <p><span className="font-medium">Role:</span> {user.role}</p>
                    {user.name && (
                      <p><span className="font-medium">Name:</span> {user.name}</p>
                    )}
                  </div>
                </div>
              )}

              {requiredRole && (
                <div className="bg-yellow-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-yellow-800 mb-1">
                    Required Role
                  </h3>
                  <p className="text-sm text-yellow-700">
                    This page requires <span className="font-medium">{requiredRole}</span> role access.
                  </p>
                </div>
              )}

              {requiredPermission && (
                <div className="bg-blue-50 p-4 rounded-md">
                  <h3 className="text-sm font-medium text-blue-800 mb-1">
                    Required Permission
                  </h3>
                  <p className="text-sm text-blue-700">
                    This page requires <span className="font-medium">{requiredPermission}</span> permission.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            <Link to="/dashboard">
              <Button className="w-full" variant="default">
                Go to Dashboard
              </Button>
            </Link>
            
            <Button
              onClick={logout}
              variant="outline"
              className="w-full"
            >
              Logout & Switch Account
            </Button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              If you believe this is an error, please contact your administrator
              or try logging in with a different account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;