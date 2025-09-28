import React from 'react';
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string;
  onRetry?: () => void;
  retryLabel?: string;
  showDetails?: boolean;
  variant?: 'card' | 'inline' | 'minimal';
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading data. Please try again.',
  error,
  onRetry,
  retryLabel = 'Try Again',
  showDetails = false,
  variant = 'card',
  className = '',
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : error;
  const isNetworkError = errorMessage?.toLowerCase().includes('network') || 
                        errorMessage?.toLowerCase().includes('fetch');

  const Icon = isNetworkError ? WifiOff : AlertCircle;
  const iconColor = isNetworkError ? 'text-orange-600' : 'text-red-600';
  const bgColor = isNetworkError ? 'bg-orange-100' : 'bg-red-100';

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <span>{errorMessage || description}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 p-4 border border-red-200 rounded-lg bg-red-50 ${className}`}>
        <Icon className={`h-5 w-5 ${iconColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">{title}</p>
          <p className="text-sm text-red-700">{description}</p>
          {showDetails && errorMessage && (
            <p className="text-xs text-red-600 mt-1 font-mono">{errorMessage}</p>
          )}
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-3 w-3" />
            {retryLabel}
          </Button>
        )}
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className={className}>
      <CardHeader className="text-center">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${bgColor}`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showDetails && errorMessage && (
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-sm font-medium text-gray-900">Error Details:</p>
            <p className="mt-1 text-xs text-gray-600 font-mono">{errorMessage}</p>
          </div>
        )}
        {onRetry && (
          <Button onClick={onRetry} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Network-specific error component
export function NetworkError({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <ErrorState
      title="Connection Problem"
      description="Unable to connect to the server. Please check your internet connection and try again."
      error="Network error"
      onRetry={onRetry}
      retryLabel="Reconnect"
      variant="inline"
      className={className}
    />
  );
}

// Empty state component
export function EmptyState({
  title = 'No data found',
  description = 'There are no items to display.',
  action,
  className = '',
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <AlertCircle className="h-6 w-6 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      {action}
    </div>
  );
}