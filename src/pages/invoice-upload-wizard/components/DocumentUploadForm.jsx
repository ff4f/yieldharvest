import React, { useState, useCallback } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const DocumentUploadForm = ({ documents, onDocumentsChange, onNext, onPrevious }) => {
  const [draggedOver, setDraggedOver] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});

  const requiredDocuments = [
    {
      key: 'invoice',
      label: 'Invoice PDF',
      description: 'Original invoice document',
      accept: '.pdf',
      required: true
    },
    {
      key: 'bol',
      label: 'Bill of Lading',
      description: 'Shipping document',
      accept: '.pdf',
      required: true
    },
    {
      key: 'packingList',
      label: 'Packing List',
      description: 'Detailed item list',
      accept: '.pdf',
      required: false
    }
  ];

  const generateSHA256Hash = (file) => {
    // Mock SHA-256 hash generation
    const mockHashes = {
      'invoice.pdf': 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
      'bol.pdf': 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567a',
      'packing_list.pdf': 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567ab2'
    };
    
    return mockHashes?.[file?.name] || '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  };

  const simulateUpload = (file, documentKey) => {
    return new Promise((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          resolve();
        }
        setUploadProgress(prev => ({
          ...prev,
          [documentKey]: Math.min(progress, 100)
        }));
      }, 200);
    });
  };

  const handleFileSelect = async (file, documentKey) => {
    if (!file) return;

    // Start upload simulation
    await simulateUpload(file, documentKey);

    // Generate hash and update documents
    const hash = generateSHA256Hash(file);
    const newDocument = {
      file,
      name: file?.name,
      size: file?.size,
      hash,
      uploadedAt: new Date()?.toISOString(),
      hfsTransactionId: `0x${Math.random()?.toString(16)?.substr(2, 8)}`
    };

    onDocumentsChange({
      ...documents,
      [documentKey]: newDocument
    });

    // Clear progress after completion
    setTimeout(() => {
      setUploadProgress(prev => {
        const updated = { ...prev };
        delete updated?.[documentKey];
        return updated;
      });
    }, 1000);
  };

  const handleDrop = useCallback((e, documentKey) => {
    e?.preventDefault();
    setDraggedOver(null);
    
    const files = Array.from(e?.dataTransfer?.files);
    if (files?.length > 0) {
      handleFileSelect(files?.[0], documentKey);
    }
  }, []);

  const handleDragOver = useCallback((e, documentKey) => {
    e?.preventDefault();
    setDraggedOver(documentKey);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e?.preventDefault();
    setDraggedOver(null);
  }, []);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i))?.toFixed(2)) + ' ' + sizes?.[i];
  };

  const isFormValid = () => {
    return requiredDocuments?.filter(doc => doc?.required)?.every(doc => documents?.[doc?.key]);
  };

  const ProofPill = ({ hash, transactionId }) => (
    <div className="inline-flex items-center px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-mono">
      <Icon name="Database" size={12} className="mr-1" />
      <span className="mr-2">HFS</span>
      <span className="truncate max-w-24">{hash?.slice(0, 8)}...{hash?.slice(-8)}</span>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Document Upload</h2>
        <p className="text-muted-foreground">Upload required documents to Hedera File Service (HFS)</p>
      </div>
      <div className="space-y-6">
        {requiredDocuments?.map((docType) => {
          const document = documents?.[docType?.key];
          const isUploading = uploadProgress?.[docType?.key] !== undefined;
          let progress = uploadProgress?.[docType?.key] || 0;

          return (
            <div key={docType?.key} className="border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-foreground flex items-center">
                    {docType?.label}
                    {docType?.required && <span className="text-error ml-1">*</span>}
                  </h3>
                  <p className="text-sm text-muted-foreground">{docType?.description}</p>
                </div>
                {document && (
                  <div className="flex items-center space-x-2">
                    <Icon name="CheckCircle" size={20} className="text-success" />
                    <span className="text-sm text-success font-medium">Uploaded</span>
                  </div>
                )}
              </div>
              {!document && !isUploading && (
                <div
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition-institutional cursor-pointer
                    ${draggedOver === docType?.key 
                      ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50 hover:bg-muted/50'
                    }
                  `}
                  onDrop={(e) => handleDrop(e, docType?.key)}
                  onDragOver={(e) => handleDragOver(e, docType?.key)}
                  onDragLeave={handleDragLeave}
                  onClick={() => document?.getElementById(`file-${docType?.key}`)?.click()}
                >
                  <Icon name="Upload" size={32} className="mx-auto text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium mb-2">
                    Drop your {docType?.label?.toLowerCase()} here, or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports PDF files up to 10MB
                  </p>
                  <input
                    id={`file-${docType?.key}`}
                    type="file"
                    accept={docType?.accept}
                    className="hidden"
                    onChange={(e) => handleFileSelect(e?.target?.files?.[0], docType?.key)}
                  />
                </div>
              )}
              {isUploading && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Icon name="Upload" size={20} className="text-primary animate-pulse" />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-foreground">Uploading to HFS...</span>
                        <span className="text-muted-foreground">{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {document && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-error/10 rounded-lg flex items-center justify-center">
                        <Icon name="FileText" size={20} className="text-error" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{document?.name}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(document?.size)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newDocs = { ...documents };
                        delete newDocs?.[docType?.key];
                        onDocumentsChange(newDocs);
                      }}
                    >
                      <Icon name="Trash2" size={16} />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">SHA-256 Hash:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard?.writeText(document?.hash)}
                      >
                        <Icon name="Copy" size={14} />
                      </Button>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground bg-background p-2 rounded border break-all">
                      {document?.hash}
                    </div>
                    <div className="flex justify-between items-center">
                      <ProofPill hash={document?.hash} transactionId={document?.hfsTransactionId} />
                      <span className="text-xs text-muted-foreground">
                        Uploaded {new Date(document.uploadedAt)?.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Action Buttons */}
      <div className="flex justify-between mt-8 pt-6 border-t border-border">
        <Button
          variant="outline"
          onClick={onPrevious}
          iconName="ArrowLeft"
          iconPosition="left"
        >
          Previous
        </Button>
        
        <Button
          variant="default"
          onClick={onNext}
          disabled={!isFormValid()}
          iconName="ArrowRight"
          iconPosition="right"
          className="px-8"
        >
          Next: Mint NFT
        </Button>
      </div>
    </div>
  );
};

export default DocumentUploadForm;