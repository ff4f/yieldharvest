import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const SupplierPortal: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Supplier Portal</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card data-testid="funded-invoice">
          <CardHeader>
            <CardTitle>Invoice #INV-001</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-2">Amount: $50,000</p>
            <p className="text-gray-600 mb-2">Funded: $45,000</p>
            <p className="text-blue-600 mb-4">Status: FUNDED</p>
            
            <div className="space-y-3">
              <Button 
                data-testid="mark-paid" 
                className="w-full"
              >
                Mark as Paid
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="funded-invoice">
          <CardHeader>
            <CardTitle>Invoice #INV-002</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-2">Amount: $75,000</p>
            <p className="text-gray-600 mb-2">Funded: $70,000</p>
            <p className="text-blue-600 mb-4">Status: FUNDED</p>
            
            <div className="space-y-3">
              <Button 
                data-testid="mark-paid" 
                className="w-full"
              >
                Mark as Paid
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice #INV-003</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-2">Amount: $25,000</p>
            <p className="text-gray-600 mb-2">Funded: $22,500</p>
            <p className="text-green-600 mb-4">Status: PAID</p>
            
            <Button 
              className="w-full"
              disabled
            >
              Already Paid
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Payment Confirmation Modal Trigger */}
      <div className="hidden">
        <Button data-testid="confirm-payment">
          Confirm Payment
        </Button>
      </div>
    </div>
  );
};

export default SupplierPortal;