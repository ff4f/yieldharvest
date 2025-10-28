import React, { Suspense, useState, useEffect } from 'react';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';

interface LazyMirrorDataProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}

// Intersection Observer hook for lazy loading
function useIntersectionObserver(
  threshold = 0.1,
  rootMargin = '50px'
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [element, setElement] = useState<Element | null>(null);

  useEffect(() => {
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [element, threshold, rootMargin]);

  return { isIntersecting, setElement };
}

// Lazy Mirror Data Component
export function LazyMirrorData({
  children,
  fallback = <LoadingState message="Loading Mirror Node data..." variant="skeleton" />,
  errorFallback = <ErrorState title="Failed to load Mirror Node data" />,
  threshold = 0.1,
  rootMargin = '50px'
}: LazyMirrorDataProps) {
  const { isIntersecting, setElement } = useIntersectionObserver(threshold, rootMargin);
  const [hasError, setHasError] = useState(false);

  // Error boundary functionality
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('Mirror Node')) {
        setHasError(true);
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return <>{errorFallback}</>;
  }

  return (
    <div ref={setElement} className="min-h-[100px]">
      {isIntersecting ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
}

// HOC for lazy loading Mirror Node components
export function withLazyMirrorData<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<LazyMirrorDataProps, 'children'>
) {
  return function LazyMirrorDataWrapper(props: P) {
    return (
      <LazyMirrorData {...options}>
        <Component {...props} />
      </LazyMirrorData>
    );
  };
}

// Lazy loading for specific Mirror Node data types
export const LazyNFTData = ({ children, ...props }: Omit<LazyMirrorDataProps, 'fallback'>) => (
  <LazyMirrorData
    fallback={<LoadingState message="Loading NFT data..." variant="skeleton" />}
    {...props}
  >
    {children}
  </LazyMirrorData>
);

export const LazyHCSData = ({ children, ...props }: Omit<LazyMirrorDataProps, 'fallback'>) => (
  <LazyMirrorData
    fallback={<LoadingState message="Loading consensus messages..." variant="skeleton" />}
    {...props}
  >
    {children}
  </LazyMirrorData>
);

export const LazyAccountData = ({ children, ...props }: Omit<LazyMirrorDataProps, 'fallback'>) => (
  <LazyMirrorData
    fallback={<LoadingState message="Loading account data..." variant="skeleton" />}
    {...props}
  >
    {children}
  </LazyMirrorData>
);

export const LazyTransactionData = ({ children, ...props }: Omit<LazyMirrorDataProps, 'fallback'>) => (
  <LazyMirrorData
    fallback={<LoadingState message="Loading transaction data..." variant="skeleton" />}
    {...props}
  >
    {children}
  </LazyMirrorData>
);