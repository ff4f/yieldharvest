import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = process.env.NODE_ENV === 'production' 
  ? 'wss://api.yieldharvest.com/ws/milestones'
  : 'ws://localhost:3000/ws/milestones';

const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;
const PING_INTERVAL = 30000;

export const useWebSocket = (options = {}) => {
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
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const subscriptionsRef = useRef(new Set());

  // Send message to WebSocket
  const sendMessage = useCallback((message) => {
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
  const subscribe = useCallback((dealId, invoiceId) => {
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
  const unsubscribe = useCallback((dealId, invoiceId) => {
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
          const subscription = JSON.parse(subscriptionStr);
          sendMessage({
            type: 'subscribe',
            ...subscription
          });
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
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    stopPingInterval();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
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
export const useMilestoneUpdates = (dealId, invoiceId, onUpdate) => {
  const [updates, setUpdates] = useState([]);
  const [latestUpdate, setLatestUpdate] = useState(null);

  const handleMessage = useCallback((message) => {
    if (message.type === 'milestone_created' || 
        message.type === 'milestone_updated' || 
        message.type === 'deal_progress' ||
        message.type === 'hcs_message') {
      
      // Check if update is relevant to our deal/invoice
      if ((dealId && message.dealId === dealId) || 
          (invoiceId && message.invoiceId === invoiceId)) {
        
        setLatestUpdate(message);
        setUpdates(prev => [message, ...prev.slice(0, 49)]); // Keep last 50 updates
        onUpdate?.(message);
      }
    }
  }, [dealId, invoiceId, onUpdate]);

  const websocket = useWebSocket({
    onMessage: handleMessage,
    subscriptions: [{ dealId, invoiceId }]
  });

  return {
    ...websocket,
    updates,
    latestUpdate,
    clearUpdates: () => setUpdates([])
  };
};

export default useWebSocket;