import { useState, useEffect, useCallback, useRef } from 'react';
import { mirrorNodeApi } from '@/services/api';
import { useOptimizedPolling, usePerformanceMonitor } from './usePerformance';

// Global cache for Mirror Node data
const mirrorNodeCache = new Map<string, {
  data: any;
  timestamp: number;
  ttl: number;
}>();

// Cache utilities
const getCacheKey = (queryFn: Function, params?: any) => {
  return `${queryFn.name}_${JSON.stringify(params || {})}`;
};

const getCachedData = (key: string, ttl: number = 30000) => {
  const cached = mirrorNodeCache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: any, ttl: number = 30000) => {
  mirrorNodeCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
};

interface UseMirrorNodeOptions {
  enabled?: boolean;
  refetchInterval?: number;
  retryCount?: number;
  retryDelay?: number;
  enableCaching?: boolean;
  cacheTTL?: number;
  enablePerformanceMonitoring?: boolean;
  adaptivePolling?: boolean;
  throttleRequests?: boolean;
  lazyLoad?: boolean;
}

interface MirrorNodeState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useMirrorNode<T>(
  queryFn: () => Promise<T>,
  options: UseMirrorNodeOptions = {},
  cacheKey?: string
) {
  const {
    enabled = true,
    refetchInterval = 30000, // 30 seconds default
    retryCount = 3,
    retryDelay = 1000,
    enableCaching = true,
    cacheTTL = 30000,
    enablePerformanceMonitoring = false,
    adaptivePolling = false,
    throttleRequests = false,
  } = options;

  const [state, setState] = useState<MirrorNodeState<T>>({
    data: null,
    loading: false,
    error: null,
    lastUpdated: null,
  });

  const retryCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheKeyRef = useRef(cacheKey || getCacheKey(queryFn));
  
  // Performance monitoring
  const { start: startPerf, end: endPerf } = usePerformanceMonitor(
    enablePerformanceMonitoring ? `MirrorNode-${cacheKeyRef.current}` : ''
  );

  const fetchData = useCallback(async (skipCache = false) => {
    if (!enabled) return;

    // Check cache first (unless skipCache is true)
    if (!skipCache && enableCaching) {
      const cachedData = getCachedData(cacheKeyRef.current, cacheTTL);
      if (cachedData) {
        setState({
          data: cachedData,
          loading: false,
          error: null,
          lastUpdated: new Date(),
        });
        return;
      }
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Start performance monitoring
      if (enablePerformanceMonitoring) startPerf();
      
      const data = await queryFn();
      
      // End performance monitoring
      if (enablePerformanceMonitoring) endPerf();
      
      // Cache the data
      if (enableCaching) {
        setCachedData(cacheKeyRef.current, data, cacheTTL);
      }
      
      setState({
        data,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
      retryCountRef.current = 0;
    } catch (error) {
      if (enablePerformanceMonitoring) endPerf();
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (retryCountRef.current < retryCount) {
        retryCountRef.current++;
        setTimeout(() => fetchData(skipCache), retryDelay * retryCountRef.current);
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        retryCountRef.current = 0;
      }
    }
  }, [queryFn, enabled, retryCount, retryDelay, enableCaching, cacheTTL, enablePerformanceMonitoring, startPerf, endPerf]);

  const refetch = useCallback((invalidateCache = true) => {
    retryCountRef.current = 0;
    if (invalidateCache) {
      mirrorNodeCache.delete(cacheKeyRef.current);
    }
    fetchData(true); // Skip cache on manual refetch
  }, [fetchData]);

  // Use optimized polling if adaptive polling is enabled
  const { forceUpdate } = useOptimizedPolling(
    () => fetchData(),
    refetchInterval,
    {
      enabled: enabled && refetchInterval > 0 && adaptivePolling,
      throttle: throttleRequests,
      adaptiveInterval: adaptivePolling,
    }
  );

  useEffect(() => {
    if (enabled) {
      fetchData();

      // Use regular interval if adaptive polling is disabled
      if (refetchInterval > 0 && !adaptivePolling) {
        intervalRef.current = setInterval(fetchData, refetchInterval);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, enabled, refetchInterval, adaptivePolling]);

  return {
    ...state,
    refetch,
    forceUpdate: adaptivePolling ? forceUpdate : refetch,
  };
}

// Specific hooks for common Mirror Node queries
export function useNFTInfo(tokenId: string, serialNumber: string, options?: UseMirrorNodeOptions) {
  return useMirrorNode(
    () => mirrorNodeApi.getNFTInfo(tokenId, serialNumber),
    options
  );
}

export function useNFTsByToken(tokenId: string, limit?: number, options?: UseMirrorNodeOptions) {
  return useMirrorNode(
    () => mirrorNodeApi.getNFTsByToken(tokenId, limit),
    options
  );
}

export function useHCSMessages(topicId: string, filters?: any, options?: UseMirrorNodeOptions) {
  return useMirrorNode(
    () => mirrorNodeApi.getHCSMessages(topicId, filters),
    options
  );
}

export function useAccountInfo(accountId: string, options?: UseMirrorNodeOptions) {
  return useMirrorNode(
    () => mirrorNodeApi.getAccountInfo(accountId),
    options
  );
}

export function useAccountTransactions(
  accountId: string,
  limit?: number,
  order?: 'asc' | 'desc',
  options?: UseMirrorNodeOptions
) {
  return useMirrorNode(
    () => mirrorNodeApi.getAccountTransactions(accountId, limit, order),
    options
  );
}

export function useNetworkStats(options?: UseMirrorNodeOptions) {
  return useMirrorNode(
    () => mirrorNodeApi.getNetworkStats(),
    options
  );
}

export function useDashboardMetrics(options?: UseMirrorNodeOptions) {
  return useMirrorNode(
    () => mirrorNodeApi.getDashboardMetrics(),
    { refetchInterval: 15000, ...options } // More frequent updates for dashboard
  );
}

// Real-time WebSocket-like hook for HCS messages
export function useRealTimeHCSMessages(topicId: string, options?: UseMirrorNodeOptions) {
  const [messages, setMessages] = useState<any[]>([]);
  const [lastSequenceNumber, setLastSequenceNumber] = useState<number>(0);

  const { data, loading, error, refetch } = useHCSMessages(
    topicId,
    { 
      sequenceNumber: `gt:${lastSequenceNumber}`,
      order: 'asc',
      limit: 100
    },
    { refetchInterval: 5000, ...options } // Check for new messages every 5 seconds
  );

  useEffect(() => {
    if (data?.messages && Array.isArray(data.messages)) {
      const newMessages = data.messages.filter(
        (msg: any) => msg.sequence_number > lastSequenceNumber
      );

      if (newMessages.length > 0) {
        setMessages(prev => [...prev, ...newMessages]);
        setLastSequenceNumber(Math.max(...newMessages.map((msg: any) => msg.sequence_number)));
      }
    }
  }, [data, lastSequenceNumber]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastSequenceNumber(0);
  }, []);

  return {
    messages,
    loading,
    error,
    refetch,
    clearMessages,
  };
}

// Hook for generating HashScan links
export function useHashScanLinks() {
  const [links, setLinks] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateLinks = useCallback(async (data: any) => {
    setLoading(true);
    setError(null);

    try {
      const result = await mirrorNodeApi.generateHashScanLinks(data);
      setLinks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate links');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    links,
    loading,
    error,
    generateLinks,
  };
}