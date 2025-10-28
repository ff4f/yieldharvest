import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/button';

const QRScanner = ({ isOpen, onClose, onScanSuccess, currentMilestone, deal }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (isOpen && isScanning) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen, isScanning]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      if (videoRef?.current) {
        videoRef.current.srcObject = stream;
        videoRef?.current?.play();
      }
      setError(null);
    } catch (err) {
      setError('Camera access denied. Please enable camera permissions.');
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (videoRef?.current && videoRef?.current?.srcObject) {
      const tracks = videoRef?.current?.srcObject?.getTracks();
      tracks?.forEach(track => track?.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleScanClick = () => {
    // Simulate QR code scanning with mock data
    setIsScanning(true);
    
    // Mock scan delay
    setTimeout(() => {
      const mockQRData = {
        dealId: deal?.dealId,
        milestone: currentMilestone?.key,
        timestamp: new Date()?.toISOString(),
        signature: 'mock_signature_hash_' + Math.random()?.toString(36)?.substr(2, 9),
        amount: (deal?.totalValue * currentMilestone?.percentage) / 100
      };
      
      setScanResult(mockQRData);
      setIsScanning(false);
    }, 2000);
  };

  const handleConfirmScan = () => {
    if (scanResult && onScanSuccess) {
      onScanSuccess(scanResult, currentMilestone, deal);
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setIsScanning(false);
    setScanResult(null);
    setError(null);
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
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-institutional">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">QR Code Scanner</h3>
            <p className="text-sm text-muted-foreground">
              Scan milestone verification QR code
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
              <Icon name={currentMilestone?.icon || 'Package'} size={20} className="text-primary" />
              <div>
                <div className="font-medium text-foreground">
                  {currentMilestone?.label}
                </div>
                <div className="text-sm text-muted-foreground">
                  Deal #{deal?.dealId} • {formatCurrency((deal?.totalValue * currentMilestone?.percentage) / 100)} disbursement
                </div>
              </div>
            </div>
          </div>

          {/* Scanner Area */}
          <div className="relative mb-6">
            <div className="bg-muted rounded-lg aspect-video flex items-center justify-center relative overflow-hidden">
              {/* Video Stream */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                style={{ display: isScanning ? 'block' : 'none' }}
                muted
                playsInline
              />
              
              {/* Scanner Overlay */}
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-primary rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary"></div>
                    
                    {/* Scanning Line Animation */}
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-primary animate-pulse"></div>
                  </div>
                </div>
              )}

              {/* Placeholder */}
              {!isScanning && !scanResult && (
                <div className="text-center">
                  <Icon name="Camera" size={48} className="text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Click "Start Scanning" to begin
                  </p>
                </div>
              )}

              {/* Scan Result */}
              {scanResult && (
                <div className="absolute inset-0 bg-success/10 flex items-center justify-center">
                  <div className="text-center">
                    <Icon name="CheckCircle" size={48} className="text-success mb-4" />
                    <p className="text-success font-medium">QR Code Scanned Successfully!</p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Icon name="AlertCircle" size={16} className="text-error" />
                  <span className="text-sm text-error">{error}</span>
                </div>
              </div>
            )}
          </div>

          {/* Scan Result Details */}
          {scanResult && (
            <div className="mb-6 p-4 bg-success/5 border border-success/20 rounded-lg">
              <h4 className="font-medium text-foreground mb-3">Scan Result</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deal ID:</span>
                  <span className="text-foreground font-mono">{scanResult?.dealId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Milestone:</span>
                  <span className="text-foreground">{currentMilestone?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disbursement:</span>
                  <span className="text-foreground font-medium">{formatCurrency(scanResult?.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Signature:</span>
                  <span className="text-foreground font-mono text-xs">{scanResult?.signature}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            {!scanResult && (
              <Button
                variant="default"
                onClick={handleScanClick}
                disabled={isScanning}
                loading={isScanning}
                iconName="Camera"
                iconPosition="left"
                className="flex-1"
              >
                {isScanning ? 'Scanning...' : 'Start Scanning'}
              </Button>
            )}
            
            {scanResult && (
              <Button
                variant="default"
                onClick={handleConfirmScan}
                iconName="CheckCircle"
                iconPosition="left"
                className="flex-1"
              >
                Confirm & Execute Disbursement
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default QRScanner;