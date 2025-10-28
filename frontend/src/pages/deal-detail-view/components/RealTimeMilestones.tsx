import React, { useEffect, useState } from 'react';
import { useMilestoneUpdates } from '../../../hooks/useWebSocket';
import MilestoneTimeline from '../../../components/MilestoneTimeline';
import Icon from '../../../components/AppIcon';
import { Button } from '../../../components/ui/button';

interface RealTimeMilestonesProps {
  tokenId: string;
  serial: string;
  className?: string;
}

const RealTimeMilestones: React.FC<RealTimeMilestonesProps> = ({
  tokenId,
  serial,
  className = ''
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  const {
    isConnected,
    milestoneTimeline,
    latestUpdate,
    updates,
    clearUpdates,
    connect,
    disconnect
  } = useMilestoneUpdates(tokenId, serial, (update) => {
    console.log('Real-time milestone update:', update);
  });

  useEffect(() => {
    if (isConnected) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('disconnected');
    }
  }, [isConnected]);

  const handleReconnect = () => {
    setConnectionStatus('connecting');
    connect();
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
        return 'text-yellow-500';
      case 'disconnected':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Wifi';
      case 'connecting':
        return 'Loader';
      case 'disconnected':
        return 'WifiOff';
      default:
        return 'Wifi';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Live Updates Active';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection Status */}
      <div className="bg-muted/30 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Icon 
              name={getStatusIcon()} 
              size={20} 
              className={`${getStatusColor()} ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} 
            />
            <div>
              <div className="text-sm font-medium text-foreground">
                {getStatusText()}
              </div>
              <div className="text-xs text-muted-foreground">
                {connectionStatus === 'connected' && `${updates.length} updates received`}
                {connectionStatus === 'connecting' && 'Establishing WebSocket connection...'}
                {connectionStatus === 'disconnected' && 'Real-time updates unavailable'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {connectionStatus === 'disconnected' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReconnect}
                className="text-xs"
              >
                <Icon name="RefreshCw" size={12} className="mr-1" />
                Reconnect
              </Button>
            )}
            
            {updates.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearUpdates}
                className="text-xs"
              >
                <Icon name="Trash2" size={12} className="mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Latest Update Alert */}
      {latestUpdate && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon name="Bell" size={16} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">
                New Milestone Update
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {latestUpdate.type === 'milestone_updated' && latestUpdate.data?.parsedData?.payload && (
                  <>
                    {latestUpdate.data.parsedData.payload.milestone} milestone recorded at{' '}
                    {new Date(latestUpdate.timestamp).toLocaleTimeString()}
                  </>
                )}
                {latestUpdate.type === 'hcs_message' && (
                  <>
                    HCS message received at {new Date(latestUpdate.timestamp).toLocaleTimeString()}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Timeline */}
      <MilestoneTimeline
        tokenId={tokenId}
        serial={serial}
        milestones={milestoneTimeline}
      />

      {/* Debug Info (only in development) */}
      {import.meta.env.DEV && updates.length > 0 && (
        <div className="bg-muted/30 rounded-xl p-4">
          <details>
            <summary className="text-sm font-medium text-foreground cursor-pointer">
              Debug: Recent Updates ({updates.length})
            </summary>
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {updates.slice(0, 5).map((update, index) => (
                <div key={index} className="bg-background p-3 rounded-lg">
                  <div className="text-xs font-mono text-foreground">
                    <div><strong>Type:</strong> {update.type}</div>
                    <div><strong>Time:</strong> {new Date(update.timestamp).toLocaleString()}</div>
                    {update.data?.parsedData?.payload && (
                      <div><strong>Milestone:</strong> {update.data.parsedData.payload.milestone}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default RealTimeMilestones;