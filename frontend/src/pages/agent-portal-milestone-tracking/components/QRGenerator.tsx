import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/button';

const QRGenerator = ({ isOpen, onClose, milestone, deal }) => {
  const [qrData, setQrData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateQRCode = () => {
    setIsGenerating(true);
    
    // Mock QR generation delay
    setTimeout(() => {
      const mockQRData = {
        dealId: deal?.dealId,
        milestone: milestone?.key,
        timestamp: new Date()?.toISOString(),
        signature: 'qr_signature_' + Math.random()?.toString(36)?.substr(2, 9),
        amount: (deal?.totalValue * milestone?.percentage) / 100,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify({
          dealId: deal?.dealId,
          milestone: milestone?.key,
          timestamp: new Date()?.toISOString()
        }))}`
      };
      
      setQrData(mockQRData);
      setIsGenerating(false);
    }, 1500);
  };

  const handleDownloadQR = () => {
    if (qrData?.qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrData?.qrCodeUrl;
      link.download = `QR_Deal_${deal?.dealId}_${milestone?.key}.png`;
      document.body?.appendChild(link);
      link?.click();
      document.body?.removeChild(link);
    }
  };

  const handlePrintQR = () => {
    if (qrData) {
      const printWindow = window.open('', '_blank');
      printWindow?.document?.write(`
        <html>
          <head>
            <title>QR Code - Deal ${deal?.dealId}</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
              .qr-container { margin: 20px auto; }
              .details { margin: 20px 0; text-align: left; max-width: 400px; margin: 20px auto; }
            </style>
          </head>
          <body>
            <h2>Milestone Verification QR Code</h2>
            <div class="qr-container">
              <img src="${qrData?.qrCodeUrl}" alt="QR Code" />
            </div>
            <div class="details">
              <p><strong>Deal ID:</strong> ${deal?.dealId}</p>
              <p><strong>Milestone:</strong> ${milestone?.label}</p>
              <p><strong>Disbursement:</strong> $${((deal?.totalValue * milestone?.percentage) / 100)?.toLocaleString()}</p>
              <p><strong>Generated:</strong> ${new Date()?.toLocaleString()}</p>
            </div>
          </body>
        </html>
      `);
      printWindow?.document?.close();
      printWindow?.print();
    }
  };

  const handleClose = () => {
    setQrData(null);
    setIsGenerating(false);
    onClose();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })?.format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-institutional">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">QR Code Generator</h3>
            <p className="text-sm text-muted-foreground">
              Generate verification QR code
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            iconName="X"
          />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Milestone Info */}
          <div className="mb-6 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center space-x-3 mb-2">
              <Icon name={milestone?.icon || 'Package'} size={20} className="text-primary" />
              <div>
                <div className="font-medium text-foreground">
                  {milestone?.label}
                </div>
                <div className="text-sm text-muted-foreground">
                  Deal #{deal?.dealId} • {formatCurrency((deal?.totalValue * milestone?.percentage) / 100)} disbursement
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Area */}
          <div className="mb-6">
            <div className="bg-muted rounded-lg p-8 flex items-center justify-center min-h-[200px]">
              {!qrData && !isGenerating && (
                <div className="text-center">
                  <Icon name="QrCode" size={48} className="text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Click "Generate QR Code" to create
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-muted-foreground">Generating QR Code...</p>
                </div>
              )}

              {qrData && (
                <div className="text-center">
                  <img 
                    src={qrData?.qrCodeUrl} 
                    alt="Generated QR Code"
                    className="mx-auto mb-4 border border-border rounded-lg"
                  />
                  <p className="text-sm text-success font-medium">QR Code Generated Successfully!</p>
                </div>
              )}
            </div>
          </div>

          {/* QR Data Details */}
          {qrData && (
            <div className="mb-6 p-4 bg-success/5 border border-success/20 rounded-lg">
              <h4 className="font-medium text-foreground mb-3">QR Code Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deal ID:</span>
                  <span className="text-foreground font-mono">{qrData?.dealId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Milestone:</span>
                  <span className="text-foreground">{milestone?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disbursement:</span>
                  <span className="text-foreground font-medium">{formatCurrency(qrData?.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Generated:</span>
                  <span className="text-foreground">{new Date(qrData.timestamp)?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signature:</span>
                  <span className="text-foreground font-mono text-xs">{qrData?.signature}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            {!qrData && (
              <Button
                variant="default"
                onClick={generateQRCode}
                disabled={isGenerating}
                loading={isGenerating}
                iconName="QrCode"
                iconPosition="left"
                className="flex-1"
              >
                Generate QR Code
              </Button>
            )}
            
            {qrData && (
              <>
                <Button
                  variant="default"
                  onClick={handleDownloadQR}
                  iconName="Download"
                  iconPosition="left"
                  className="flex-1"
                >
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePrintQR}
                  iconName="Printer"
                  iconPosition="left"
                  className="flex-1"
                >
                  Print
                </Button>
              </>
            )}
            
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRGenerator;