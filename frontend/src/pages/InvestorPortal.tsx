import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const InvestorPortal: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Investor Portal</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card data-testid="fund-invoice">
          <CardHeader>
            <CardTitle>Invoice #INV-001</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-2">Amount: $50,000</p>
            <p className="text-gray-600 mb-2">Status: SHIPPED</p>
            <p className="text-green-600 mb-4">Available for Funding</p>
            
            <div className="space-y-3">
              <Input 
                data-testid="funding-amount"
                placeholder="Enter funding amount"
                type="number"
              />
              <Button 
                data-testid="submit-funding" 
                className="w-full"
              >
                Fund Invoice
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="fund-invoice">
          <CardHeader>
            <CardTitle>Invoice #INV-002</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-2">Amount: $75,000</p>
            <p className="text-gray-600 mb-2">Status: SHIPPED</p>
            <p className="text-green-600 mb-4">Available for Funding</p>
            
            <div className="space-y-3">
              <Input 
                data-testid="funding-amount"
                placeholder="Enter funding amount"
                type="number"
              />
              <Button 
                data-testid="submit-funding" 
                className="w-full"
              >
                Fund Invoice
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
            <p className="text-gray-600 mb-2">Status: FUNDED</p>
            <p className="text-blue-600 mb-4">Already Funded</p>
            
            <Button 
              className="w-full"
              disabled
            >
              Funded
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default InvestorPortal;