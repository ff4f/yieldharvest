import React, { useState } from 'react';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const MetadataEntryForm = ({ formData, onFormDataChange, onNext, isValid }) => {
  const [errors, setErrors] = useState({});

  const currencyOptions = [
    { value: 'USD', label: 'US Dollar (USD)' },
    { value: 'EUR', label: 'Euro (EUR)' },
    { value: 'GBP', label: 'British Pound (GBP)' }
  ];

  const tenorOptions = [
    { value: '30', label: '30 Days' },
    { value: '60', label: '60 Days' },
    { value: '90', label: '90 Days' },
    { value: '120', label: '120 Days' },
    { value: '180', label: '180 Days' }
  ];

  const riskRatingOptions = [
    { value: 'AAA', label: 'AAA - Highest Quality' },
    { value: 'AA', label: 'AA - High Quality' },
    { value: 'A', label: 'A - Upper Medium Grade' },
    { value: 'BBB', label: 'BBB - Medium Grade' },
    { value: 'BB', label: 'BB - Lower Medium Grade' }
  ];

  const handleInputChange = (field, value) => {
    onFormDataChange({
      ...formData,
      [field]: value
    });

    // Clear error when user starts typing
    if (errors?.[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.invoiceNumber) newErrors.invoiceNumber = 'Invoice number is required';
    if (!formData?.faceValue || formData?.faceValue <= 0) newErrors.faceValue = 'Valid face value is required';
    if (!formData?.apr || formData?.apr <= 0) newErrors.apr = 'Valid APR is required';
    if (!formData?.tenor) newErrors.tenor = 'Tenor is required';
    if (!formData?.buyerName) newErrors.buyerName = 'Buyer name is required';
    if (!formData?.buyerEmail) newErrors.buyerEmail = 'Buyer email is required';
    if (!formData?.description) newErrors.description = 'Description is required';

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext();
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-foreground mb-2">Invoice Metadata</h2>
        <p className="text-muted-foreground">Enter the details for your invoice tokenization</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Invoice Details */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
              <Icon name="FileText" size={20} className="mr-2 text-primary" />
              Invoice Information
            </h3>
            
            <div className="space-y-4">
              <Input
                label="Invoice Number"
                type="text"
                placeholder="INV-2025-001"
                value={formData?.invoiceNumber || ''}
                onChange={(e) => handleInputChange('invoiceNumber', e?.target?.value)}
                error={errors?.invoiceNumber}
                required
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Face Value"
                  type="number"
                  placeholder="125000"
                  value={formData?.faceValue || ''}
                  onChange={(e) => handleInputChange('faceValue', parseFloat(e?.target?.value))}
                  error={errors?.faceValue}
                  required
                />

                <Select
                  label="Currency"
                  options={currencyOptions}
                  value={formData?.currency || 'USD'}
                  onChange={(value) => handleInputChange('currency', value)}
                  placeholder="Select currency"
                />
              </div>

              <Input
                label="Issue Date"
                type="date"
                value={formData?.issueDate || ''}
                onChange={(e) => handleInputChange('issueDate', e?.target?.value)}
                required
              />

              <Input
                label="Due Date"
                type="date"
                value={formData?.dueDate || ''}
                onChange={(e) => handleInputChange('dueDate', e?.target?.value)}
                required
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
              <Icon name="TrendingUp" size={20} className="mr-2 text-success" />
              Deal Terms
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="APR (%)"
                  type="number"
                  placeholder="8.5"
                  step="0.1"
                  value={formData?.apr || ''}
                  onChange={(e) => handleInputChange('apr', parseFloat(e?.target?.value))}
                  error={errors?.apr}
                  required
                />

                <Select
                  label="Tenor"
                  options={tenorOptions}
                  value={formData?.tenor || ''}
                  onChange={(value) => handleInputChange('tenor', value)}
                  error={errors?.tenor}
                  placeholder="Select tenor"
                  required
                />
              </div>

              <Select
                label="Risk Rating"
                options={riskRatingOptions}
                value={formData?.riskRating || ''}
                onChange={(value) => handleInputChange('riskRating', value)}
                placeholder="Select risk rating"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Buyer Details */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
              <Icon name="Building" size={20} className="mr-2 text-accent" />
              Buyer Information
            </h3>
            
            <div className="space-y-4">
              <Input
                label="Buyer Name"
                type="text"
                placeholder="Global Trading Corp"
                value={formData?.buyerName || ''}
                onChange={(e) => handleInputChange('buyerName', e?.target?.value)}
                error={errors?.buyerName}
                required
              />

              <Input
                label="Buyer Email"
                type="email"
                placeholder="procurement@globaltrading.com"
                value={formData?.buyerEmail || ''}
                onChange={(e) => handleInputChange('buyerEmail', e?.target?.value)}
                error={errors?.buyerEmail}
                required
              />

              <Input
                label="Buyer Address"
                type="text"
                placeholder="123 Commerce Street, New York, NY 10001"
                value={formData?.buyerAddress || ''}
                onChange={(e) => handleInputChange('buyerAddress', e?.target?.value)}
              />

              <Input
                label="Contact Person"
                type="text"
                placeholder="John Smith"
                value={formData?.contactPerson || ''}
                onChange={(e) => handleInputChange('contactPerson', e?.target?.value)}
              />

              <Input
                label="Phone Number"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData?.phoneNumber || ''}
                onChange={(e) => handleInputChange('phoneNumber', e?.target?.value)}
              />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
              <Icon name="AlignLeft" size={20} className="mr-2 text-secondary" />
              Additional Details
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description *
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Describe the goods/services covered by this invoice..."
                  value={formData?.description || ''}
                  onChange={(e) => handleInputChange('description', e?.target?.value)}
                />
                {errors?.description && (
                  <p className="text-sm text-error mt-1">{errors?.description}</p>
                )}
              </div>

              <Input
                label="Reference Number"
                type="text"
                placeholder="PO-2025-001"
                value={formData?.referenceNumber || ''}
                onChange={(e) => handleInputChange('referenceNumber', e?.target?.value)}
              />
            </div>
          </div>
        </div>
      </div>
      {/* Action Buttons */}
      <div className="flex justify-end mt-8 pt-6 border-t border-border">
        <Button
          variant="default"
          onClick={handleNext}
          iconName="ArrowRight"
          iconPosition="right"
          className="px-8"
        >
          Next: Upload Documents
        </Button>
      </div>
    </div>
  );
};

export default MetadataEntryForm;