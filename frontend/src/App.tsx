import { BrowserRouter as Router } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner'

// Unified routing
import AppRoutes from '@/Routes'

// Components
import ScrollToTop from '@/components/ScrollToTop'
import ErrorBoundary from '@/components/ErrorBoundary'

// Contexts
import { WalletProvider } from '@/contexts/WalletContext'
import { AuthProvider } from '@/contexts/AuthContext'

// Create a client with enhanced error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.message?.includes('4')) return false;
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: any) => {
        // Global error handling for mutations (already handled in hooks)
        console.error('Mutation error:', error);
      },
    },
  },
})

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WalletProvider>
          <AuthProvider>
            <Router>
              <ScrollToTop />
              <AppRoutes />
              <Toaster />
            </Router>
          </AuthProvider>
        </WalletProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App