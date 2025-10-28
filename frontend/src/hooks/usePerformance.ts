import { useCallback, useRef, useEffect, useState } from 'react';

// Debounce hook for delaying function execution
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

// Throttle hook for limiting function execution frequency
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    },
    [callback, delay]
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

// Debounced value hook
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Performance monitoring hook
export function usePerformanceMonitor(name: string) {
  const startTimeRef = useRef<number>();

  const start = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const end = useCallback(() => {
    if (startTimeRef.current) {
      const duration = performance.now() - startTimeRef.current;
      console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
      return duration;
    }
    return 0;
  }, [name]);

  const measure = useCallback((fn: () => void) => {
    start();
    fn();
    return end();
  }, [start, end]);

  return { start, end, measure };
}

// Memory usage monitoring
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}

// Optimized Mirror Node polling hook
export function useOptimizedPolling(
  callback: () => void,
  interval: number,
  options: {
    enabled?: boolean;
    throttle?: boolean;
    debounce?: boolean;
    adaptiveInterval?: boolean;
  } = {}
) {
  const {
    enabled = true,
    throttle = false,
    debounce = false,
    adaptiveInterval = false,
  } = options;

  const intervalRef = useRef<NodeJS.Timeout>();
  const currentIntervalRef = useRef(interval);
  const errorCountRef = useRef(0);

  // Apply throttling or debouncing if requested
  const optimizedCallback = throttle
    ? useThrottle(callback, interval / 2)
    : debounce
    ? useDebounce(callback, interval / 2)
    : callback;

  useEffect(() => {
    if (!enabled) return;

    const poll = async () => {
      try {
        await optimizedCallback();
        
        // Reset error count on success
        errorCountRef.current = 0;
        
        // Adaptive interval: reduce interval on success
        if (adaptiveInterval && currentIntervalRef.current > interval) {
          currentIntervalRef.current = Math.max(
            interval,
            currentIntervalRef.current * 0.9
          );
        }
      } catch (error) {
        errorCountRef.current++;
        
        // Adaptive interval: increase interval on error
        if (adaptiveInterval) {
          currentIntervalRef.current = Math.min(
            interval * 5, // Max 5x the original interval
            currentIntervalRef.current * 1.5
          );
        }
        
        console.warn(`Polling error (${errorCountRef.current}):`, error);
      }

      // Schedule next poll
      intervalRef.current = setTimeout(poll, currentIntervalRef.current);
    };

    // Start polling
    poll();

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [enabled, optimizedCallback, interval, adaptiveInterval]);

  const forceUpdate = useCallback(() => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
    }
    optimizedCallback();
  }, [optimizedCallback]);

  return { forceUpdate, currentInterval: currentIntervalRef.current };
}