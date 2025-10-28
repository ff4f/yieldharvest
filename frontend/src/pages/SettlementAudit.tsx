import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SettlementAudit: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settlement & Audit Dashboard</h1>
      
      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="total-volume" className="text-2xl font-bold">$2.4M</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div data-testid="active-invoices" className="text-2xl font-bold">156</div>
            <p className="text-xs text-muted-foreground">+12 from last week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.2%</div>
            <p className="text-xs text-muted-foreground">+0.5% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Avg Settlement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3.2 days</div>
            <p className="text-xs text-muted-foreground">-0.8 days improvement</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for ProofTray and Audit Trail */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger data-testid="proof-tray-tab" value="proof-tray">ProofTray</TabsTrigger>
          <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Settlements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 border rounded">
                  <div>
                    <p className="font-medium">Invoice #INV-001</p>
                    <p className="text-sm text-gray-600">$50,000 - Completed</p>
                  </div>
                  <Button variant="outline" size="sm">View Details</Button>
                </div>
                <div className="flex justify-between items-center p-4 border rounded">
                  <div>
                    <p className="font-medium">Invoice #INV-002</p>
                    <p className="text-sm text-gray-600">$75,000 - In Progress</p>
                  </div>
                  <Button variant="outline" size="sm">View Details</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proof-tray" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blockchain Proof Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div data-testid="proof-links" className="space-y-4">
                <div className="p-4 border rounded">
                  <h4 className="font-medium mb-2">NFT Mint Transactions</h4>
                  <div className="space-y-2">
                    <a href="https://hashscan.io/testnet/transaction/0.0.123@1234567890.123" 
                       className="text-blue-600 hover:underline block text-sm">
                      0.0.123@1234567890.123 - Invoice #INV-001 NFT
                    </a>
                    <a href="https://hashscan.io/testnet/transaction/0.0.124@1234567891.124" 
                       className="text-blue-600 hover:underline block text-sm">
                      0.0.124@1234567891.124 - Invoice #INV-002 NFT
                    </a>
                  </div>
                </div>

                <div className="p-4 border rounded">
                  <h4 className="font-medium mb-2">HFS File Uploads</h4>
                  <div className="space-y-2">
                    <a href="https://hashscan.io/testnet/file/0.0.456" 
                       className="text-blue-600 hover:underline block text-sm">
                      0.0.456 - Invoice #INV-001 PDF
                    </a>
                    <a href="https://hashscan.io/testnet/file/0.0.457" 
                       className="text-blue-600 hover:underline block text-sm">
                      0.0.457 - Invoice #INV-002 PDF
                    </a>
                  </div>
                </div>

                <div className="p-4 border rounded">
                  <h4 className="font-medium mb-2">HCS Status Messages</h4>
                  <div className="space-y-2">
                    <a href="https://hashscan.io/testnet/topic/0.0.789" 
                       className="text-blue-600 hover:underline block text-sm">
                      0.0.789 - Status Updates Topic
                    </a>
                  </div>
                </div>

                <div className="p-4 border rounded">
                  <h4 className="font-medium mb-2">Funding Transactions</h4>
                  <div className="space-y-2">
                    <a href="https://hashscan.io/testnet/transaction/0.0.321@1234567892.125" 
                       className="text-blue-600 hover:underline block text-sm">
                      0.0.321@1234567892.125 - $45,000 Funding
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit-trail" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Complete Audit Trail</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border-l-4 border-green-500 bg-green-50">
                  <p className="font-medium">Invoice Created</p>
                  <p className="text-sm text-gray-600">2024-01-15 10:30:00 UTC</p>
                </div>
                <div className="p-4 border-l-4 border-blue-500 bg-blue-50">
                  <p className="font-medium">NFT Minted</p>
                  <p className="text-sm text-gray-600">2024-01-15 10:35:00 UTC</p>
                </div>
                <div className="p-4 border-l-4 border-yellow-500 bg-yellow-50">
                  <p className="font-medium">Status: Shipped</p>
                  <p className="text-sm text-gray-600">2024-01-16 14:20:00 UTC</p>
                </div>
                <div className="p-4 border-l-4 border-purple-500 bg-purple-50">
                  <p className="font-medium">Invoice Funded</p>
                  <p className="text-sm text-gray-600">2024-01-17 09:15:00 UTC</p>
                </div>
                <div className="p-4 border-l-4 border-green-600 bg-green-100">
                  <p className="font-medium">Payment Confirmed & Funds Released</p>
                  <p className="text-sm text-gray-600">2024-01-20 16:45:00 UTC</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettlementAudit;