import React from 'react';
import Icon from './AppIcon';
import { Button } from './ui/button';

interface MilestoneTimelineProps {
  tokenId: string;
  serial: string;
  milestones?: any[];
  className?: string;
}

interface MilestoneItem {
  id: string;
  tokenId: string;
  serial: string;
  milestone: string;
  timestamp: string;
  fileHash?: string;
  agentId?: string;
  location?: string;
  notes?: string;
  documentUrl?: string;
  metadata?: any;
  sequenceNumber?: number;
  consensusTimestamp?: string;
  topicId?: string;
}

const MILESTONE_CONFIG = {
  'CONTRACT_SIGNED': {
    label: 'Contract Signed',
    icon: 'FileSignature',
    color: 'bg-blue-500',
    description: 'Initial contract execution and agreement'
  },
  'PICKUP': {
    label: 'Pickup',
    icon: 'Truck',
    color: 'bg-orange-500',
    description: 'Goods collected from supplier location'
  },
  'PORT_OUT': {
    label: 'Port Out',
    icon: 'Ship',
    color: 'bg-cyan-500',
    description: 'Departure from origin port'
  },
  'VESSEL_DEPARTED': {
    label: 'Vessel Departed',
    icon: 'Anchor',
    color: 'bg-indigo-500',
    description: 'Ship departed with cargo'
  },
  'ARRIVED': {
    label: 'Arrived',
    icon: 'MapPin',
    color: 'bg-green-500',
    description: 'Arrived at destination port'
  },
  'CUSTOMS_IN': {
    label: 'Customs In',
    icon: 'Shield',
    color: 'bg-purple-500',
    description: 'Customs clearance completed'
  },
  'WAREHOUSE_IN': {
    label: 'Warehouse In',
    icon: 'Warehouse',
    color: 'bg-yellow-500',
    description: 'Goods received at warehouse'
  },
  'DELIVERED': {
    label: 'Delivered',
    icon: 'CheckCircle',
    color: 'bg-emerald-500',
    description: 'Final delivery completed'
  }
};

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({
  tokenId,
  serial,
  milestones = [],
  className = ''
}) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getMilestoneConfig = (milestone: string) => {
    return MILESTONE_CONFIG[milestone as keyof typeof MILESTONE_CONFIG] || {
      label: milestone,
      icon: 'Circle',
      color: 'bg-gray-500',
      description: 'Milestone update'
    };
  };

  const openHashScan = (topicId?: string, sequenceNumber?: number) => {
    if (topicId && sequenceNumber) {
      const url = `https://hashscan.io/testnet/topic/${topicId}/message/${sequenceNumber}`;
      window.open(url, '_blank');
    }
  };

  const openFileDownload = (fileHash?: string) => {
    if (fileHash) {
      // Assuming we have an HFS download endpoint
      const url = `/api/hfs/files/download?hash=${fileHash}`;
      window.open(url, '_blank');
    }
  };

  if (milestones.length === 0) {
    return (
      <div className={`bg-muted/30 rounded-xl p-6 ${className}`}>
        <div className="text-center">
          <Icon name="Clock" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No Milestones Yet</h3>
          <p className="text-muted-foreground">
            Milestone updates will appear here as they are published to the Hedera Consensus Service.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-muted/30 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Milestone Timeline</h3>
        <div className="text-sm text-muted-foreground">
          {tokenId} • Serial #{serial}
        </div>
      </div>

      <div className="space-y-4">
        {milestones.map((milestone: MilestoneItem, index: number) => {
          const config = getMilestoneConfig(milestone.milestone);
          const isLast = index === milestones.length - 1;

          return (
            <div key={milestone.id} className="relative">
              {/* Timeline line */}
              {!isLast && (
                <div className="absolute left-6 top-12 w-0.5 h-16 bg-border" />
              )}

              <div className="flex items-start space-x-4">
                {/* Milestone icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${config.color} text-white flex-shrink-0`}>
                  <Icon name={config.icon} size={20} />
                </div>

                {/* Milestone content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-base font-medium text-foreground">
                      {config.label}
                    </h4>
                    <div className="text-sm text-muted-foreground">
                      {formatTimestamp(milestone.timestamp)}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">
                    {config.description}
                  </p>

                  {/* Additional details */}
                  <div className="space-y-2">
                    {milestone.agentId && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Agent:</span> {milestone.agentId}
                      </div>
                    )}
                    
                    {milestone.location && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Location:</span> {milestone.location}
                      </div>
                    )}
                    
                    {milestone.notes && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Notes:</span> {milestone.notes}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center space-x-2 mt-3">
                    {milestone.topicId && milestone.sequenceNumber && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openHashScan(milestone.topicId, milestone.sequenceNumber)}
                        className="text-xs"
                      >
                        <Icon name="ExternalLink" size={12} className="mr-1" />
                        HCS
                      </Button>
                    )}
                    
                    {milestone.fileHash && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openFileDownload(milestone.fileHash)}
                        className="text-xs"
                      >
                        <Icon name="Download" size={12} className="mr-1" />
                        File
                      </Button>
                    )}
                    
                    {milestone.documentUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(milestone.documentUrl, '_blank')}
                        className="text-xs"
                      >
                        <Icon name="FileText" size={12} className="mr-1" />
                        Document
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MilestoneTimeline;