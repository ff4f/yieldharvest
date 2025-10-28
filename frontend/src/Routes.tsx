import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Pages - Core
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import Invoices from '@/pages/Invoices';
import CreateInvoice from '@/pages/CreateInvoice';
import InvoiceDetail from '@/pages/InvoiceDetail';
import Investors from '@/pages/Investors';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';
import Login from '@/pages/Login';
import ConnectWallet from '@/pages/ConnectWallet';
import Unauthorized from '@/pages/Unauthorized';

// Portal Pages
import AgentPortalMilestoneTracking from '@/pages/agent-portal-milestone-tracking';
import DealDetailView from '@/pages/deal-detail-view';
import SettlementAuditDashboard from '@/pages/settlement-audit-dashboard';
import SupplierPortalDashboard from '@/pages/supplier-portal-dashboard';
import InvestorPortalDashboard from '@/pages/investor-portal-dashboard';
import InvoiceUploadWizard from '@/pages/invoice-upload-wizard';

// E2E Test Portal Pages
import AgentPortal from '@/pages/AgentPortal';
import InvestorPortal from '@/pages/InvestorPortal';
import SupplierPortal from '@/pages/SupplierPortal';
import SettlementAudit from '@/pages/SettlementAudit';

// Components
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/ErrorBoundary';

// Types
import { UserRole } from '@/contexts/AuthContext';

interface RouteConfig {
  path: string;
  element: React.ReactElement;
  requiredRole?: UserRole;
  requiredPermission?: string;
  requireWallet?: boolean;
  isPublic?: boolean;
  withLayout?: boolean;
}

const AppRoutes: React.FC = () => {
  // Route configurations with role-based access control
  const routes: RouteConfig[] = [
    // Public routes
    { path: '/', element: <Landing />, isPublic: true },
    { path: '/login', element: <Login />, isPublic: true },
    { path: '/connect-wallet', element: <ConnectWallet />, isPublic: true },
    { path: '/unauthorized', element: <Unauthorized />, isPublic: true },

    // Protected dashboard routes
    { 
      path: '/dashboard', 
      element: <Dashboard />, 
      withLayout: true,
      requireWallet: true 
    },

    // Role-specific portal routes
    { 
      path: '/investor-portal-dashboard', 
      element: <InvestorPortalDashboard />, 
      requiredRole: 'investor',
      withLayout: true,
      requireWallet: true 
    },
    { 
      path: '/supplier-portal-dashboard', 
      element: <SupplierPortalDashboard />, 
      requiredRole: 'supplier',
      withLayout: true,
      requireWallet: true 
    },
    { 
      path: '/agent-portal-milestone-tracking', 
      element: <AgentPortalMilestoneTracking />, 
      requiredRole: 'agent',
      withLayout: true,
      requireWallet: true 
    },
    { 
      path: '/settlement-audit-dashboard', 
      element: <SettlementAuditDashboard />, 
      requiredRole: 'auditor',
      withLayout: true,
      requireWallet: true 
    },

    // Invoice management routes
    { 
      path: '/invoices', 
      element: <Invoices />, 
      requiredPermission: 'view_invoices',
      withLayout: true,
      requireWallet: true 
    },
    { 
      path: '/invoices/create', 
      element: <CreateInvoice />, 
      requiredPermission: 'create_invoices',
      withLayout: true,
      requireWallet: true 
    },
    { 
      path: '/invoices/:id', 
      element: <InvoiceDetail />, 
      requiredPermission: 'view_invoices',
      withLayout: true,
      requireWallet: true 
    },
    { 
      path: '/invoice-upload-wizard', 
      element: <InvoiceUploadWizard />, 
      requiredPermission: 'upload_documents',
      withLayout: true,
      requireWallet: true 
    },

    // Deal management routes
    { 
      path: '/deal-detail-view', 
      element: <DealDetailView />, 
      requiredPermission: 'view_deals',
      withLayout: true,
      requireWallet: true 
    },

    // Admin routes
    { 
      path: '/investors', 
      element: <Investors />, 
      requiredRole: 'admin',
      withLayout: true,
      requireWallet: true 
    },

    // Settings route
    { 
      path: '/settings', 
      element: <Settings />, 
      withLayout: true,
      requireWallet: true 
    },

    // E2E Test Portal Routes (simplified for testing)
    { 
      path: '/agent-portal', 
      element: <AgentPortal />, 
      isPublic: true,
      withLayout: true
    },
    { 
      path: '/investor-portal', 
      element: <InvestorPortal />, 
      isPublic: true,
      withLayout: true
    },
    { 
      path: '/supplier-portal', 
      element: <SupplierPortal />, 
      isPublic: true,
      withLayout: true
    },
    { 
      path: '/settlement-audit', 
      element: <SettlementAudit />, 
      isPublic: true,
      withLayout: true
    },
    { 
      path: '/create-invoice', 
      element: <CreateInvoice />, 
      isPublic: true,
      withLayout: true
    },
  ];

  const renderRoute = (route: RouteConfig) => {
    const { 
      path, 
      element, 
      requiredRole, 
      requiredPermission, 
      requireWallet = true, 
      isPublic = false, 
      withLayout = false 
    } = route;

    let routeElement = element;

    // Wrap with Layout if needed
    if (withLayout) {
      routeElement = <Layout>{element}</Layout>;
    }

    // Wrap with ProtectedRoute if not public
    if (!isPublic) {
      routeElement = (
        <ProtectedRoute
          requiredRole={requiredRole}
          requiredPermission={requiredPermission}
          requireWallet={requireWallet}
        >
          {routeElement}
        </ProtectedRoute>
      );
    }

    return (
      <Route
        key={path}
        path={path}
        element={
          <ErrorBoundary>
            {routeElement}
          </ErrorBoundary>
        }
      />
    );
  };

  return (
    <Routes>
      {routes.map(renderRoute)}
      
      {/* Redirect root to dashboard for authenticated users */}
      <Route path="/home" element={<Navigate to="/dashboard" replace />} />
      
      {/* Catch all route - 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;