import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = import.meta.env.PROD 
  ? 'wss://api.yieldharvest.com/ws'
  : 'ws://localhost:3000/ws';

const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30000;

interface WebSocketOptions {
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: (event?: CloseEvent) => void;
  onError?: (error: any) => void;
  autoReconnect?: boolean;
  subscriptions?: any[];
}

export const useWebSocket = (options: WebSocketOptions = {}) => {
  const {
    onMessage,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    subscriptions = []
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [error, setError] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const subscriptionsRef = useRef(new Set());

  // Send message to WebSocket
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (err) {
        console.error('Failed to send WebSocket message:', err);
        setError(err);
        return false;
      }
    }
    return false;
  }, []);

  // Subscribe to specific updates
  const subscribe = useCallback((dealId: string, invoiceId: string) => {
    const subscription = { dealId, invoiceId };
    subscriptionsRef.current.add(JSON.stringify(subscription));
    
    if (isConnected) {
      sendMessage({
        type: 'subscribe',
        dealId,
        invoiceId
      });
    }
  }, [isConnected, sendMessage]);

  // Unsubscribe from updates
  const unsubscribe = useCallback((dealId: string, invoiceId: string) => {
    const subscription = { dealId, invoiceId };
    subscriptionsRef.current.delete(JSON.stringify(subscription));
    
    if (isConnected) {
      sendMessage({
        type: 'unsubscribe',
        dealId,
        invoiceId
      });
    }
  }, [isConnected, sendMessage]);

  // Start ping interval
  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, PING_INTERVAL);
  }, [sendMessage]);

  // Stop ping interval
  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      setConnectionStatus('connecting');
      setError(null);
      
      wsRef.current = new WebSocket(WS_URL);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        
        // Start ping interval
        startPingInterval();
        
        // Re-subscribe to existing subscriptions
        subscriptionsRef.current.forEach(subscriptionStr => {
          try {
            const subscription = JSON.parse(subscriptionStr as string);
            sendMessage({
              type: 'subscribe',
              ...subscription
            });
          } catch (err) {
            console.error('Failed to parse subscription:', err);
          }
        });
        
        onConnect?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage(message);
          
          // Handle pong messages
          if (message.type === 'pong') {
            return;
          }
          
          onMessage?.(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
          setError(err);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        stopPingInterval();
        
        onDisconnect?.(event);
        
        // Auto-reconnect if enabled and not a manual close
        if (autoReconnect && event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          setConnectionStatus('reconnecting');
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_INTERVAL * reconnectAttemptsRef.current);
        }
      };

      wsRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        const error = new Error('WebSocket connection error');
        setError(error);
        onError?.(error);
      };

    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      setError(err);
      setConnectionStatus('error');
    }
  }, [autoReconnect, onConnect, onDisconnect, onError, onMessage, sendMessage, startPingInterval, stopPingInterval]);

  // Disconnect from WebSocket
  const disconnect = useCallback((reason?: string) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopPingInterval();
    
    if (wsRef.current) {
      wsRef.current.close(1000, reason || 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, [stopPingInterval]);

  // Initialize connection on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle subscription changes
  useEffect(() => {
    subscriptions.forEach(sub => {
      if (sub.dealId || sub.invoiceId) {
        subscribe(sub.dealId, sub.invoiceId);
      }
    });
    
    return () => {
      subscriptions.forEach(sub => {
        if (sub.dealId || sub.invoiceId) {
          unsubscribe(sub.dealId, sub.invoiceId);
        }
      });
    };
  }, [subscriptions, subscribe, unsubscribe]);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    error,
    sendMessage,
    subscribe,
    unsubscribe,
    connect,
    disconnect
  };
};

// Hook for milestone-specific updates
export const useMilestoneUpdates = (tokenId?: string, serial?: string, onUpdate?: (data: any) => void) => {
  const [updates, setUpdates] = useState<any[]>([]);
  const [latestUpdate, setLatestUpdate] = useState<any>(null);
  const [milestoneTimeline, setMilestoneTimeline] = useState<any[]>([]);

  const handleMessage = useCallback((message: any) => {
    if (message.type === 'milestone_created' || 
        message.type === 'milestone_updated' || 
        message.type === 'deal_progress' ||
        message.type === 'hcs_message') {
      
      // Check if update is relevant to our token/serial
      const isRelevant = (!tokenId && !serial) || // Listen to all if no specific token/serial
                        (tokenId && message.dealId === tokenId) || 
                        (serial && message.invoiceId === serial) ||
                        (message.data?.tokenId === tokenId && message.data?.serial === serial);
      
      if (isRelevant) {
        setLatestUpdate(message);
        setUpdates((prev: any[]) => [message, ...prev.slice(0, 49)]); // Keep last 50 updates
        
        // Update milestone timeline for normalized milestone messages
        if (message.type === 'milestone_updated' && message.data?.parsedData?.payload) {
          const { payload, context } = message.data.parsedData;
          const milestoneData = {
            id: `${payload.tokenId}-${payload.serial}-${payload.milestone}-${payload.ts}`,
            tokenId: payload.tokenId,
            serial: payload.serial,
            milestone: payload.milestone,
            timestamp: new Date(payload.ts * 1000).toISOString(),
            fileHash: payload.fileHash,
            agentId: context?.agentId,
            location: context?.location,
            notes: context?.notes,
            documentUrl: context?.documentUrl,
            metadata: context?.metadata,
            sequenceNumber: message.data.sequenceNumber,
            consensusTimestamp: message.data.consensusTimestamp,
            topicId: message.data.topicId
          };
          
          setMilestoneTimeline((prev: any[]) => {
            const existing = prev.find(m => m.id === milestoneData.id);
            if (existing) return prev; // Avoid duplicates
            return [milestoneData, ...prev].sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
        
        onUpdate?.(message);
      }
    }
  }, [tokenId, serial, onUpdate]);

  const websocket = useWebSocket({
    onMessage: handleMessage,
    subscriptions: tokenId || serial ? [{ dealId: tokenId, invoiceId: serial }] : []
  });

  return {
    ...websocket,
    updates,
    latestUpdate,
    milestoneTimeline,
    clearUpdates: () => {
      setUpdates([]);
      setMilestoneTimeline([]);
    }
  };
};

export default useWebSocket;