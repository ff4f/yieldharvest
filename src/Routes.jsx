import React from "react";
import { BrowserRouter, Routes as RouterRoutes, Route } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import NotFound from "pages/NotFound";
import Landing from "./pages/Landing";
import AgentPortalMilestoneTracking from './pages/agent-portal-milestone-tracking';
import DealDetailView from './pages/deal-detail-view';
import SettlementAuditDashboard from './pages/settlement-audit-dashboard';
import SupplierPortalDashboard from './pages/supplier-portal-dashboard';
import InvestorPortalDashboard from './pages/investor-portal-dashboard';
import InvoiceUploadWizard from './pages/invoice-upload-wizard';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <RouterRoutes>
        {/* Define your route here */}
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<AgentPortalMilestoneTracking />} />
        <Route path="/agent-portal-milestone-tracking" element={<AgentPortalMilestoneTracking />} />
        <Route path="/deal-detail-view" element={<DealDetailView />} />
        <Route path="/settlement-audit-dashboard" element={<SettlementAuditDashboard />} />
        <Route path="/supplier-portal-dashboard" element={<SupplierPortalDashboard />} />
        <Route path="/investor-portal-dashboard" element={<InvestorPortalDashboard />} />
        <Route path="/invoice-upload-wizard" element={<InvoiceUploadWizard />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;
