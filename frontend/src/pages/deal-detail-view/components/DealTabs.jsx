import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const DealTabs = ({ deal }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'FileText' },
    { id: 'documents', label: 'Documents', icon: 'FolderOpen' },
    { id: 'nft', label: 'NFT Info', icon: 'Hexagon' },
    { id: 'milestones', label: 'Milestones', icon: 'CheckCircle' }
  ];

  const documents = [
    {
      name: 'Invoice.pdf',
      type: 'invoice',
      size: '2.4 MB',
      hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
      uploadDate: '2025-08-20T10:30:00Z'
    },
    {
      name: 'Bill of Lading.pdf',
      type: 'bol',
      size: '1.8 MB',
      hash: 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567a',
      uploadDate: '2025-08-20T11:15:00Z'
    },
    {
      name: 'Packing List.pdf',
      type: 'packing',
      size: '1.2 MB',
      hash: 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567ab2',
      uploadDate: '2025-08-20T11:45:00Z'
    }
  ];

  const milestones = [
    { id: 1, name: 'Contract Signed', percentage: 10, status: 'completed', date: '2025-08-20' },
    { id: 2, name: 'Pickup', percentage: 15, status: 'completed', date: '2025-08-21' },
    { id: 3, name: 'Port Out', percentage: 25, status: 'completed', date: '2025-08-22' },
    { id: 4, name: 'Vessel Departed', percentage: 20, status: 'active', date: null },
    { id: 5, name: 'Arrived', percentage: 15, status: 'pending', date: null },
    { id: 6, name: 'Customs In', percentage: 10, status: 'pending', date: null },
    { id: 7, name: 'Warehouse In', percentage: 5, status: 'pending', date: null },
    { id: 8, name: 'Delivered', percentage: 0, status: 'pending', date: null }
  ];

  const handleDocumentDownload = (document) => {
    // Mock download functionality
    console.log(`Downloading ${document?.name}`);
  };

  const handleHashScanClick = (hash) => {
    window.open(`https://hashscan.io/mainnet/transaction/${hash}`, '_blank');
  };

  const getMilestoneStatusColor = (status) => {
    const statusMap = {
      completed: 'bg-success text-success-foreground',
      active: 'bg-primary text-primary-foreground pulse-gentle',
      pending: 'bg-muted text-muted-foreground'
    };
    return statusMap?.[status] || 'bg-muted text-muted-foreground';
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Supplier Information */}
      <div className="bg-muted/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Icon name="Building" size={20} className="mr-2" />
          Supplier Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Company Name</p>
            <p className="font-medium text-foreground">{deal?.supplier?.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="font-medium text-foreground">{deal?.supplier?.location}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Industry</p>
            <p className="font-medium text-foreground">{deal?.supplier?.industry}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Credit Rating</p>
            <p className="font-medium text-success">{deal?.supplier?.creditRating}</p>
          </div>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="bg-muted/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Icon name="Receipt" size={20} className="mr-2" />
          Invoice Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Invoice Number</p>
            <p className="font-medium text-foreground font-mono">{deal?.invoiceNumber}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Issue Date</p>
            <p className="font-medium text-foreground">{new Date(deal.issueDate)?.toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Due Date</p>
            <p className="font-medium text-foreground">{new Date(deal.dueDate)?.toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Buyer</p>
            <p className="font-medium text-foreground">{deal?.buyer}</p>
          </div>
        </div>
      </div>

      {/* Deal Terms */}
      <div className="bg-muted/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Icon name="FileContract" size={20} className="mr-2" />
          Deal Terms
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Minimum Investment</p>
            <p className="font-medium text-foreground">${deal?.minInvestment?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Maximum Investment</p>
            <p className="font-medium text-foreground">${deal?.maxInvestment?.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Settlement Date</p>
            <p className="font-medium text-foreground">{new Date(deal.settlementDate)?.toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Collateral</p>
            <p className="font-medium text-foreground">{deal?.collateral}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-4">
      {documents?.map((doc) => (
        <div key={doc?.name} className="bg-muted/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Icon name="FileText" size={24} className="text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-foreground">{doc?.name}</h4>
                <p className="text-sm text-muted-foreground">
                  {doc?.size} • Uploaded {new Date(doc.uploadDate)?.toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDocumentDownload(doc)}
              iconName="Download"
              iconPosition="left"
            >
              Download
            </Button>
          </div>
          <div className="mt-4 p-3 bg-background rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">SHA-256 Hash</p>
            <div className="flex items-center justify-between">
              <code className="text-xs font-mono text-foreground break-all">{doc?.hash}</code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigator.clipboard?.writeText(doc?.hash)}
                iconName="Copy"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderNFTInfo = () => (
    <div className="space-y-6">
      <div className="bg-muted/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
          <Icon name="Hexagon" size={20} className="mr-2" />
          HTS Token Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Token ID</p>
            <div className="flex items-center space-x-2">
              <code className="font-mono text-sm text-foreground">{deal?.nft?.tokenId}</code>
              <button
                onClick={() => handleHashScanClick(deal?.nft?.tokenId)}
                className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/80 transition-institutional"
              >
                HTS
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Serial Number</p>
            <p className="font-mono text-sm text-foreground">{deal?.nft?.serialNumber}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Mint Transaction</p>
            <div className="flex items-center space-x-2">
              <code className="font-mono text-xs text-foreground">{deal?.nft?.mintTxId}</code>
              <button
                onClick={() => handleHashScanClick(deal?.nft?.mintTxId)}
                className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/80 transition-institutional"
              >
                HTS
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Metadata URI</p>
            <div className="flex items-center space-x-2">
              <code className="font-mono text-xs text-foreground truncate">{deal?.nft?.metadataUri}</code>
              <button
                onClick={() => handleHashScanClick(deal?.nft?.metadataUri)}
                className="px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs hover:bg-secondary/80 transition-institutional"
              >
                HFS
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-muted/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Metadata</h3>
        <pre className="bg-background p-4 rounded-lg text-xs font-mono text-foreground overflow-x-auto">
{JSON.stringify(deal?.nft?.metadata, null, 2)}
        </pre>
      </div>
    </div>
  );

  const renderMilestones = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {milestones?.map((milestone) => (
          <div key={milestone?.id} className="bg-muted/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-foreground">{milestone?.name}</h4>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getMilestoneStatusColor(milestone?.status)}`}>
                {milestone?.status}
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Release: {milestone?.percentage}%</span>
              {milestone?.date && (
                <span className="text-sm text-muted-foreground">
                  {new Date(milestone.date)?.toLocaleDateString()}
                </span>
              )}
            </div>
            {milestone?.status === 'active' && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  iconName="QrCode"
                  iconPosition="left"
                  fullWidth
                >
                  View QR Code
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,.06)]">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <nav className="flex space-x-8 px-6">
          {tabs?.map((tab) => (
            <button
              key={tab?.id}
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center space-x-2 py-4 border-b-2 font-medium text-sm transition-institutional ${
                activeTab === tab?.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab?.icon} size={16} />
              <span>{tab?.label}</span>
            </button>
          ))}
        </nav>
      </div>
      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'documents' && renderDocuments()}
        {activeTab === 'nft' && renderNFTInfo()}
        {activeTab === 'milestones' && renderMilestones()}
      </div>
    </div>
  );
};

export default DealTabs;