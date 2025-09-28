import React from 'react';
import Icon from '../../../components/AppIcon';

const StepIndicator = ({ currentStep, totalSteps = 3 }) => {
  const steps = [
    { number: 1, title: 'Metadata Entry', description: 'Invoice & deal details' },
    { number: 2, title: 'Document Upload', description: 'Upload required documents' },
    { number: 3, title: 'NFT Minting', description: 'Tokenize your invoice' }
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between">
        {steps?.map((step, index) => (
          <React.Fragment key={step?.number}>
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center border-2 transition-institutional
                ${currentStep === step?.number 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : currentStep > step?.number
                    ? 'bg-success border-success text-success-foreground'
                    : 'bg-background border-border text-muted-foreground'
                }
              `}>
                {currentStep > step?.number ? (
                  <Icon name="Check" size={20} />
                ) : (
                  <span className="font-semibold">{step?.number}</span>
                )}
              </div>
              
              {/* Step Info */}
              <div className="mt-3 text-center">
                <div className={`text-sm font-medium ${
                  currentStep >= step?.number ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step?.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1 max-w-24">
                  {step?.description}
                </div>
              </div>
            </div>

            {/* Connector Line */}
            {index < steps?.length - 1 && (
              <div className={`flex-1 h-0.5 mx-4 transition-institutional ${
                currentStep > step?.number ? 'bg-success' : 'bg-border'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default StepIndicator;