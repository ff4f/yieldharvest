import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Upload, FileText, CheckCircle, AlertCircle, ExternalLink, Hash, Clock } from 'lucide-react';
import { useCreateInvoice } from '../../hooks/useInvoices';
import { useMirrorNode } from '../../hooks/useMirrorNode';

// TypeScript interfaces
interface FormData {
  supplierName: string;
  buyerName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  description: string;
  faceValue: string;
  apr: string;
  tenor: string;
  buyerEmail: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'pending' | 'uploaded' | 'verified';
  url?: string;
  hash?: string;
}

interface ProofTransaction {
  id: string;
  type: string;
  status: string;
  timestamp: string;
  description: string;
  transactionId?: string;
  hashScanLink?: string;
  amount?: string;
}

const InvoiceUploadWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<FormData>({
    supplierName: '',
    buyerName: '',
    invoiceNumber: '',
    amount: '',
    dueDate: '',
    description: '',
    faceValue: '',
    apr: '',
    tenor: '',
    buyerEmail: ''
  });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [proofTransactions, setProofTransactions] = useState<ProofTransaction[]>([
    {
      id: '1',
      type: 'Invoice Creation',
      status: 'pending',
      timestamp: new Date().toISOString(),
      description: 'Creating invoice record on Hedera'
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Initialize Hedera-related hooks
  const createInvoice = useCreateInvoice();
  const mirrorNodeQuery = useMirrorNode<any>(
    async () => ({ message: 'Mirror node ready' }),
    { enabled: true }
  );

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/supplier' },
    { label: 'Upload Invoice', href: '/supplier/upload', current: true }
  ];

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const newDoc: Document = {
        id: Date.now().toString(),
        name: file.name,
        type: file.type,
        size: file.size,
        status: 'pending'
      };
      setDocuments(prev => [...prev, newDoc]);
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Add proof transaction for invoice creation
      setProofTransactions(prev => [...prev, {
        id: Date.now().toString(),
        type: 'Invoice Submitted',
        status: 'completed',
        timestamp: new Date().toISOString(),
        amount: formData.faceValue,
        description: `Invoice ${formData.invoiceNumber} submitted for processing`
      }]);

      // Simulate invoice creation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigate to success or next step
      navigate('/supplier/dashboard');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Invoice Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Supplier Name</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-md"
                  value={formData.supplierName}
                  onChange={(e) => handleInputChange('supplierName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Buyer Name</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-md"
                  value={formData.buyerName}
                  onChange={(e) => handleInputChange('buyerName', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Invoice Number</label>
                <input
                  type="text"
                  className="w-full p-2 border rounded-md"
                  value={formData.invoiceNumber}
                  onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Amount</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-md"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Document Upload</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">Drop files here or click to upload</p>
              <input
                type="file"
                multiple
                className="hidden"
                id="file-upload"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <label htmlFor="file-upload">
                <Button type="button" variant="outline">Choose Files</Button>
              </label>
            </div>
            {documents.length > 0 && (
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5" />
                      <span>{doc.name}</span>
                    </div>
                    <Badge variant={doc.status === 'verified' ? 'default' : 'secondary'}>
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Review & Submit</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Invoice Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Supplier:</span><span>{formData.supplierName}</span>
                <span>Buyer:</span><span>{formData.buyerName}</span>
                <span>Invoice #:</span><span>{formData.invoiceNumber}</span>
                <span>Amount:</span><span>${formData.amount}</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Upload Invoice - Step {currentStep} of 3</CardTitle>
              </CardHeader>
              <CardContent>
                {renderStepContent()}
                
                <div className="flex justify-between mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                    disabled={currentStep === 1}
                  >
                    Previous
                  </Button>
                  
                  {currentStep < 3 ? (
                    <Button
                      onClick={() => setCurrentStep(currentStep + 1)}
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Invoice'}
                    </Button>
                  )}
                </div>
                
                {submitError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
                    {submitError}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Proof Tray */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Hash className="h-5 w-5" />
                  <span>Blockchain Proofs</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {proofTransactions.map(proof => (
                    <div key={proof.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{proof.type}</span>
                        <div className="flex items-center space-x-1">
                          {proof.status === 'completed' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : proof.status === 'pending' ? (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                          <Badge variant={proof.status === 'completed' ? 'default' : 'secondary'}>
                            {proof.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{proof.description}</p>
                      <div className="text-xs text-gray-500">
                        {new Date(proof.timestamp).toLocaleString()}
                      </div>
                      {proof.hashScanLink && (
                        <a
                          href={proof.hashScanLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 mt-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>View on HashScan</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceUploadWizard;