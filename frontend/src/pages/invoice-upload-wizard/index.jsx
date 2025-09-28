import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalHeader from '../../components/ui/GlobalHeader';
import PortalSidebar from '../../components/ui/PortalSidebar';
import ProofTray from '../../components/ui/ProofTray';
import BreadcrumbNavigation from '../../components/ui/BreadcrumbNavigation';
import StepIndicator from './components/StepIndicator';
import MetadataEntryForm from './components/MetadataEntryForm';
import DocumentUploadForm from './components/DocumentUploadForm';
import NFTMintingForm from './components/NFTMintingForm';

const InvoiceUploadWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    faceValue: '',
    currency: 'USD',
    apr: '',
    tenor: '',
    riskRating: '',
    buyerName: '',
    buyerEmail: '',
    buyerAddress: '',
    contactPerson: '',
    phoneNumber: '',
    description: '',
    referenceNumber: '',
    issueDate: '',
    dueDate: ''
  });

  // Documents state
  const [documents, setDocuments] = useState({});

  // Proof tray transactions
  const [proofTransactions, setProofTransactions] = useState([
    {
      id: '0x1a2b3c4d',
      type: 'invoice_tokenization',
      status: 'pending',
      timestamp: '2025-08-25T18:35:00Z',
      amount: '$125,000',
      description: 'Invoice tokenization in progress'
    }
  ]);

  const customBreadcrumbs = [
    { label: 'Home', path: '/', icon: 'Home' },
    { label: 'Supplier Portal', path: '/supplier-portal-dashboard', icon: 'Package' },
    { label: 'Upload Invoice', path: '/invoice-upload-wizard', icon: 'Upload' }
  ];

  const handleLogout = () => {
    navigate('/');
  };

  const handleNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleWizardComplete = () => {
    // Add completion transaction to proof tray
    const completionTransaction = {
      id: `0x${Math.random()?.toString(16)?.substr(2, 8)}`,
      type: 'invoice_tokenization',
      status: 'confirmed',
      timestamp: new Date()?.toISOString(),
      amount: `$${formData?.faceValue?.toLocaleString()}`,
      description: `Invoice ${formData?.invoiceNumber} successfully tokenized`
    };

    setProofTransactions(prev => [completionTransaction, ...prev]);
    
    // Navigate to supplier dashboard
    setTimeout(() => {
      navigate('/supplier-portal-dashboard');
    }, 2000);
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData?.invoiceNumber && 
               formData?.faceValue && 
               formData?.apr && 
               formData?.tenor && 
               formData?.buyerName && 
               formData?.buyerEmail && 
               formData?.description;
      case 2:
        return documents?.invoice && documents?.bol;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <MetadataEntryForm
            formData={formData}
            onFormDataChange={setFormData}
            onNext={handleNextStep}
            isValid={isStepValid()}
          />
        );
      case 2:
        return (
          <DocumentUploadForm
            documents={documents}
            onDocumentsChange={setDocuments}
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
          />
        );
      case 3:
        return (
          <NFTMintingForm
            formData={formData}
            documents={documents}
            onComplete={handleWizardComplete}
            onPrevious={handlePreviousStep}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Global Header */}
      <GlobalHeader 
        userRole="supplier"
        userName="Sarah Johnson"
        onLogout={handleLogout}
      />

      {/* Sidebar */}
      <PortalSidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole="supplier"
      />

      {/* Proof Tray */}
      <ProofTray
        isVisible={true}
        transactions={proofTransactions}
      />

      {/* Main Content */}
      <main className={`
        transition-smooth pt-16
        ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-80'}
      `}>
        <div className="container mx-auto px-6 py-8 max-w-6xl">
          {/* Breadcrumb Navigation */}
          <BreadcrumbNavigation customBreadcrumbs={customBreadcrumbs} />

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Invoice Upload Wizard</h1>
            <p className="text-muted-foreground">
              Tokenize your invoice as an NFT to access funding opportunities through our DeFi platform
            </p>
          </div>

          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} totalSteps={3} />

          {/* Wizard Content */}
          <div className="mb-8">
            {renderCurrentStep()}
          </div>

          {/* Help Section */}
          <div className="bg-muted/30 border border-border rounded-xl p-6">
            <h3 className="text-lg font-medium text-foreground mb-3">Need Help?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-foreground mb-1">Step 1: Metadata</h4>
                <p className="text-muted-foreground">Enter accurate invoice and deal information for proper tokenization.</p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-1">Step 2: Documents</h4>
                <p className="text-muted-foreground">Upload required PDF documents to Hedera File Service for verification.</p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-1">Step 3: Minting</h4>
                <p className="text-muted-foreground">Create your invoice NFT on Hedera Token Service for funding access.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InvoiceUploadWizard;