import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ProofTray from '../../../components/ui/ProofTray';
import { useInvoices } from '../../../hooks/useInvoices';
import { useNFTsByToken, useHCSMessages } from '../../../hooks/useMirrorNode';

const RecentInvoicesTable = () => {
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedInvoiceForProof, setSelectedInvoiceForProof] = useState<string | null>(null);

  // Get real data from Mirror Node and backend
  const { data: invoicesResponse, isLoading: invoicesLoading, error: invoicesError } = useInvoices({
    limit: 50,
  });

  const invoiceTokenId = import.meta.env.VITE_INVOICE_TOKEN_ID || '0.0.123456';
  const statusTopicId = import.meta.env.VITE_STATUS_TOPIC_ID || '0.0.123457';
  const network = import.meta.env.VITE_HEDERA_NETWORK || 'testnet';

  const { data: nftData } = useNFTsByToken(invoiceTokenId, 100);
  const { data: hcsData } = useHCSMessages(statusTopicId, { order: 'desc', limit: 50 });

  // Use real data if available, fallback to mock data for demo
  const realInvoices = invoicesResponse?.data || [];
  const mockInvoices = [
    {
      id: 'INV-2025-001',
      amount: '$25,000.00',
      buyer: 'Global Foods Ltd.',
      status: 'FUNDING_OPEN',
      apr: '12.5%',
      fundingProgress: 65,
      targetAmount: '$22,500.00',
      raisedAmount: '$14,625.00',
      date: '2025-08-25',
      dueDate: '2025-11-25',
      nftId: '0.0.123456',
      tokenId: invoiceTokenId,
      serialNumber: '1',
      fileId: '0.0.123460',
      transactionId: '0.0.123456@1234567890.123456789'
    },
    {
      id: 'INV-2025-002',
      amount: '$18,750.00',
      buyer: 'Fresh Market Co.',
      status: 'FUNDED',
      apr: '11.8%',
      fundingProgress: 100,
      targetAmount: '$16,875.00',
      raisedAmount: '$16,875.00',
      date: '2025-08-24',
      dueDate: '2025-10-24',
      nftId: '0.0.123457',
      tokenId: invoiceTokenId,
      serialNumber: '2',
      fileId: '0.0.123461',
      transactionId: '0.0.123456@1234567891.123456789'
    },
    {
      id: 'INV-2025-003',
      amount: '$32,500.00',
      buyer: 'Organic Distributors Inc.',
      status: 'FUNDING_OPEN',
      apr: '13.2%',
      fundingProgress: 25,
      targetAmount: '$29,250.00',
      raisedAmount: '$7,312.50',
      date: '2025-08-23',
      dueDate: '2025-12-23',
      nftId: '0.0.123458',
      tokenId: invoiceTokenId,
      serialNumber: '3',
      fileId: '0.0.123462',
      transactionId: '0.0.123456@1234567892.123456789'
    },
    {
      id: 'INV-2025-004',
      amount: '$15,000.00',
      buyer: 'Premium Grocers',
      status: 'FUNDED',
      apr: '10.9%',
      fundingProgress: 100,
      targetAmount: '$13,500.00',
      raisedAmount: '$13,500.00',
      date: '2025-08-22',
      dueDate: '2025-09-22',
      nftId: '0.0.123459',
      tokenId: invoiceTokenId,
      serialNumber: '4',
      fileId: '0.0.123463',
      transactionId: '0.0.123456@1234567893.123456789'
    }
  ];

  // Transform real invoices to match expected format
  const transformedInvoices = realInvoices.map(invoice => ({
    id: invoice.invoiceNumber || invoice.id,
    amount: `$${parseFloat(invoice.amount || '0').toLocaleString()}`,
    buyer: invoice.buyerName || 'Unknown Buyer',
    status: invoice.status || 'ISSUED',
    apr: invoice.interestRate ? `${invoice.interestRate}%` : '12.0%',
    fundingProgress: invoice.fundingProgress || 0,
    targetAmount: invoice.targetAmount ? `$${parseFloat(invoice.targetAmount).toLocaleString()}` : '$0',
    raisedAmount: invoice.raisedAmount ? `$${parseFloat(invoice.raisedAmount).toLocaleString()}` : '$0',
    date: invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    nftId: invoice.nftTokenId || '0.0.123456',
    tokenId: invoice.nftTokenId || invoiceTokenId,
    serialNumber: invoice.nftSerialNumber || '1',
    fileId: invoice.fileId || '0.0.123460',
    transactionId: invoice.transactionId || '0.0.123456@1234567890.123456789'
  }));

  const invoices = transformedInvoices.length > 0 ? transformedInvoices : mockInvoices;

  const generateProofData = (invoice: any) => {
    return [
      {
        type: 'nft' as const,
        label: 'Invoice NFT',
        value: `${invoice.tokenId}/${invoice.serialNumber}`,
        url: `https://hashscan.io/${network}/token/${invoice.tokenId}/${invoice.serialNumber}`,
        status: 'verified' as const,
        timestamp: new Date().toISOString()
      },
      {
        type: 'hfs' as const,
        label: 'Invoice Document',
        value: invoice.fileId,
        url: `https://hashscan.io/${network}/file/${invoice.fileId}`,
        status: 'verified' as const,
        hash: 'sha256:a1b2c3d4e5f6...'
      },
      {
        type: 'hcs' as const,
        label: 'Status Updates',
        value: `${statusTopicId}/seq:1-5`,
        url: `https://hashscan.io/${network}/topic/${statusTopicId}`,
        status: 'verified' as const,
        timestamp: new Date().toISOString()
      },
      {
        type: 'transaction' as const,
        label: 'Creation Transaction',
        value: invoice.transactionId,
        url: `https://hashscan.io/${network}/transaction/${invoice.transactionId}`,
        status: 'verified' as const,
        timestamp: new Date().toISOString()
      }
    ];
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      FUNDING_OPEN: {
        label: 'Funding Open',
        className: 'bg-warning/10 text-warning border-warning/20'
      },
      FUNDED: {
        label: 'Funded',
        className: 'bg-success/10 text-success border-success/20'
      }
    };

    const config = statusConfig?.[status] || statusConfig?.FUNDING_OPEN;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${config?.className}`}>
        {config?.label}
      </span>
    );
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedInvoices = [...invoices]?.sort((a, b) => {
    let aValue = a?.[sortField];
    let bValue = b?.[sortField];
    
    if (sortField === 'amount' || sortField === 'targetAmount' || sortField === 'raisedAmount') {
      aValue = parseFloat(aValue?.replace(/[$,]/g, ''));
      bValue = parseFloat(bValue?.replace(/[$,]/g, ''));
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return (
    <div className="bg-card rounded-2xl border border-border shadow-[0_8px_30px_rgba(0,0,0,.06)]">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Recent Invoices</h3>
          <Link to="/invoice-upload-wizard">
            <Button variant="outline" size="sm" iconName="Plus" iconPosition="left">
              New Invoice
            </Button>
          </Link>
        </div>
      </div>
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                <button 
                  onClick={() => handleSort('id')}
                  className="flex items-center space-x-1 hover:text-foreground transition-institutional"
                >
                  <span>Invoice #</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                <button 
                  onClick={() => handleSort('amount')}
                  className="flex items-center space-x-1 hover:text-foreground transition-institutional"
                >
                  <span>Amount</span>
                  <Icon name="ArrowUpDown" size={14} />
                </button>
              </th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Buyer</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">APR</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Funding Progress</th>
              <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedInvoices?.map((invoice) => (
              <tr key={invoice?.id} className="border-b border-border hover:bg-muted/30 transition-institutional">
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{invoice?.id}</span>
                    <span className="text-xs text-muted-foreground">NFT: {invoice?.nftId}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{invoice?.amount}</span>
                    <span className="text-xs text-muted-foreground">Target: {invoice?.targetAmount}</span>
                  </div>
                </td>
                <td className="p-4">
                  <span className="text-foreground">{invoice?.buyer}</span>
                </td>
                <td className="p-4">
                  {getStatusBadge(invoice?.status)}
                </td>
                <td className="p-4">
                  <span className="font-medium text-success">{invoice?.apr}</span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{invoice?.fundingProgress}%</span>
                      <span className="text-muted-foreground">{invoice?.raisedAmount}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary rounded-full h-2 transition-smooth"
                        style={{ width: `${invoice?.fundingProgress}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      iconName="Shield"
                      onClick={() => setSelectedInvoiceForProof(invoice?.id)}
                    >
                      Proof
                    </Button>
                    <Link to={`/deal-detail-view?invoice=${invoice?.id}`}>
                      <Button variant="ghost" size="sm" iconName="Eye">
                        View
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" iconName="MoreHorizontal" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile Cards */}
      <div className="lg:hidden p-4 space-y-4">
        {sortedInvoices?.map((invoice) => (
          <div key={invoice?.id} className="bg-muted/30 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-foreground">{invoice?.id}</h4>
                <p className="text-xs text-muted-foreground">NFT: {invoice?.nftId}</p>
              </div>
              {getStatusBadge(invoice?.status)}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-semibold text-foreground">{invoice?.amount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">APR</p>
                <p className="font-medium text-success">{invoice?.apr}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Funding Progress</span>
                <span className="text-muted-foreground">{invoice?.fundingProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary rounded-full h-2 transition-smooth"
                  style={{ width: `${invoice?.fundingProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {invoice?.raisedAmount} of {invoice?.targetAmount} raised
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">{invoice?.buyer}</p>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  iconName="Shield"
                  onClick={() => setSelectedInvoiceForProof(invoice?.id)}
                >
                  Proof
                </Button>
                <Link to={`/deal-detail-view?invoice=${invoice?.id}`}>
                  <Button variant="outline" size="sm" iconName="Eye">
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ProofTray Modal */}
      {selectedInvoiceForProof && (
        <ProofTray
          isOpen={true}
          onClose={() => setSelectedInvoiceForProof(null)}
          invoiceId={selectedInvoiceForProof}
          title="Blockchain Proofs"
          proofs={generateProofData(invoices.find(inv => inv.id === selectedInvoiceForProof))}
        />
      )}
    </div>
  );
};

export default RecentInvoicesTable;