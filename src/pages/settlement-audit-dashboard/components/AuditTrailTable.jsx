import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const AuditTrailTable = () => {
  const [selectedEntry, setSelectedEntry] = useState(null);

  const auditData = [
    {
      id: "AUDIT-2025-001",
      dealId: "DEAL-2025-001",
      merkleRoot: "0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385",
      hcsAnchor: "0x8a0bfde2d1e68b8bg77bc5fbe8afde2d1e68b8bg77bc5fbe8d3d3fc8c22ba2496",
      timestamp: "2025-08-24T14:35:00Z",
      blockHeight: 12847563,
      status: "verified",
      eventCount: 8,
      dataSize: "2.4 KB"
    },
    {
      id: "AUDIT-2025-002",
      dealId: "DEAL-2025-002",
      merkleRoot: "0x9g1gbef3e2f79c9ch88cd6gcf9gbef3e2f79c9ch88cd6gcf9e4e4gd9d33cb3507",
      hcsAnchor: "0xab1cgef4f3g8ac0di99de7hda0cgef4f3g8ac0di99de7hda0f5f5he0e44dc4618",
      timestamp: "2025-08-23T16:50:00Z",
      blockHeight: 12845892,
      status: "verified",
      eventCount: 8,
      dataSize: "2.1 KB"
    },
    {
      id: "AUDIT-2025-003",
      dealId: "DEAL-2025-003",
      merkleRoot: "0xbc2dhfg5g4h9bd1ej00ef8ieb1dhfg5g4h9bd1ej00ef8ieb1g6g6if1f55ed5729",
      hcsAnchor: "0xcd3eigh6h5i0ce2fk11fg9jfc2eigh6h5i0ce2fk11fg9jfc2h7h7jg2g66fe6830",
      timestamp: "2025-08-22T11:25:00Z",
      blockHeight: 12844221,
      status: "verified",
      eventCount: 8,
      dataSize: "2.8 KB"
    },
    {
      id: "AUDIT-2025-004",
      dealId: "DEAL-2025-004",
      merkleRoot: "0xde4fjhi7i6j1df3gl22gh0kgd3fjhi7i6j1df3gl22gh0kgd3i8i8kh3h77gf7941",
      hcsAnchor: "0xef5gkij8j7k2eg4hm33hi1lhe4gkij8j7k2eg4hm33hi1lhe4j9j9li4i88hg8052",
      timestamp: "2025-08-21T09:20:00Z",
      blockHeight: 12842550,
      status: "pending",
      eventCount: 6,
      dataSize: "1.9 KB"
    }
  ];

  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      verified: {
        color: 'bg-success text-success-foreground',
        icon: 'CheckCircle'
      },
      pending: {
        color: 'bg-warning text-warning-foreground pulse-gentle',
        icon: 'Clock'
      },
      failed: {
        color: 'bg-error text-error-foreground',
        icon: 'XCircle'
      }
    };

    const config = statusConfig?.[status] || statusConfig?.pending;

    return (
      <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config?.color}`}>
        <Icon name={config?.icon} size={12} />
        <span className="capitalize">{status}</span>
      </div>
    );
  };

  const handleHashScanClick = (hash, type) => {
    const baseUrl = type === 'hcs' ? 'https://hashscan.io/mainnet/topic' : 'https://hashscan.io/mainnet/transaction';
    window.open(`${baseUrl}/${hash}`, '_blank');
  };

  const handleExportJSON = (entry) => {
    const jsonData = {
      auditId: entry?.id,
      dealId: entry?.dealId,
      merkleRoot: entry?.merkleRoot,
      hcsAnchor: entry?.hcsAnchor,
      timestamp: entry?.timestamp,
      blockHeight: entry?.blockHeight,
      status: entry?.status,
      eventCount: entry?.eventCount,
      dataSize: entry?.dataSize,
      exportedAt: new Date()?.toISOString()
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = window.URL?.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${entry?.id}.json`;
    a?.click();
    window.URL?.revokeObjectURL(url);
  };

  const ProofPill = ({ type, hash, onClick }) => {
    const pillConfig = {
      hts: { color: 'bg-primary text-primary-foreground', label: 'HTS' },
      hcs: { color: 'bg-accent text-accent-foreground', label: 'HCS' },
      hfs: { color: 'bg-secondary text-secondary-foreground', label: 'HFS' }
    };

    const config = pillConfig?.[type] || pillConfig?.hts;

    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config?.color} hover:opacity-80 transition-institutional`}
      >
        <span>{config?.label}</span>
        <span className="font-mono">{hash?.slice(0, 6)}...{hash?.slice(-4)}</span>
        <Icon name="ExternalLink" size={10} />
      </button>
    );
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-institutional">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Blockchain Audit Trail</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Icon name="Search" size={16} className="mr-2" />
              Verify Proof
            </Button>
            <Button variant="outline" size="sm">
              <Icon name="Filter" size={16} className="mr-2" />
              Filter
            </Button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-4 font-medium text-foreground">Audit ID</th>
              <th className="text-left p-4 font-medium text-foreground">Deal ID</th>
              <th className="text-left p-4 font-medium text-foreground">Merkle Root</th>
              <th className="text-left p-4 font-medium text-foreground">HCS Anchor</th>
              <th className="text-left p-4 font-medium text-foreground">Timestamp</th>
              <th className="text-left p-4 font-medium text-foreground">Status</th>
              <th className="text-left p-4 font-medium text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {auditData?.map((entry, index) => (
              <tr key={index} className="border-b border-border hover:bg-muted/30 transition-institutional">
                <td className="p-4">
                  <div className="font-medium text-foreground">{entry?.id}</div>
                  <div className="text-xs text-muted-foreground">Block #{entry?.blockHeight}</div>
                </td>
                <td className="p-4">
                  <div className="font-medium text-primary">{entry?.dealId}</div>
                  <div className="text-xs text-muted-foreground">{entry?.eventCount} events • {entry?.dataSize}</div>
                </td>
                <td className="p-4">
                  <ProofPill 
                    type="hts" 
                    hash={entry?.merkleRoot}
                    onClick={() => handleHashScanClick(entry?.merkleRoot, 'hts')}
                  />
                </td>
                <td className="p-4">
                  <ProofPill 
                    type="hcs" 
                    hash={entry?.hcsAnchor}
                    onClick={() => handleHashScanClick(entry?.hcsAnchor, 'hcs')}
                  />
                </td>
                <td className="p-4">
                  <div className="text-sm text-foreground">{formatDate(entry?.timestamp)}</div>
                </td>
                <td className="p-4">
                  {getStatusBadge(entry?.status)}
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExportJSON(entry)}
                    >
                      <Icon name="Download" size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <Icon name="Eye" size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Audit Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-institutional max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Audit Details: {selectedEntry?.id}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEntry(null)}
                >
                  <Icon name="X" size={16} />
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Deal ID</label>
                  <div className="text-foreground font-medium">{selectedEntry?.dealId}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedEntry?.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Block Height</label>
                  <div className="text-foreground font-medium">#{selectedEntry?.blockHeight}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Event Count</label>
                  <div className="text-foreground font-medium">{selectedEntry?.eventCount} events</div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Merkle Root</label>
                <div className="mt-1 p-3 bg-muted rounded-lg font-mono text-sm break-all">
                  {selectedEntry?.merkleRoot}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">HCS Anchor</label>
                <div className="mt-1 p-3 bg-muted rounded-lg font-mono text-sm break-all">
                  {selectedEntry?.hcsAnchor}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handleExportJSON(selectedEntry)}
                >
                  <Icon name="Download" size={16} className="mr-2" />
                  Export JSON
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleHashScanClick(selectedEntry?.hcsAnchor, 'hcs')}
                >
                  <Icon name="ExternalLink" size={16} className="mr-2" />
                  View on HashScan
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditTrailTable;