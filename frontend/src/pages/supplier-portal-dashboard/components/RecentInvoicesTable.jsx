import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RecentInvoicesTable = () => {
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  const invoices = [
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
      nftId: '0.0.123456'
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
      nftId: '0.0.123457'
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
      nftId: '0.0.123458'
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
      nftId: '0.0.123459'
    }
  ];

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
              <Link to={`/deal-detail-view?invoice=${invoice?.id}`}>
                <Button variant="outline" size="sm" iconName="Eye">
                  View Details
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentInvoicesTable;