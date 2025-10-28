import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const AgentPortal: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Agent Portal</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card data-testid="invoice-item">
          <CardHeader>
            <CardTitle>Invoice #INV-001</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Amount: $50,000</p>
            <p className="text-gray-600 mb-4">Status: MINTED</p>
            <Button 
              data-testid="status-shipped" 
              className="w-full"
            >
              Mark as Shipped
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="invoice-item">
          <CardHeader>
            <CardTitle>Invoice #INV-002</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Amount: $75,000</p>
            <p className="text-gray-600 mb-4">Status: CREATED</p>
            <Button 
              data-testid="status-shipped" 
              className="w-full"
              variant="outline"
            >
              Mark as Shipped
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="invoice-item">
          <CardHeader>
            <CardTitle>Invoice #INV-003</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Amount: $25,000</p>
            <p className="text-gray-600 mb-4">Status: SHIPPED</p>
            <Button 
              data-testid="status-shipped" 
              className="w-full"
              disabled
            >
              Already Shipped
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentPortal;