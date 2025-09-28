import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { toast } from 'sonner'

// Pages
import Dashboard from '@/pages/Dashboard'
import Invoices from '@/pages/Invoices'
import CreateInvoice from '@/pages/CreateInvoice'
import InvoiceDetail from '@/pages/InvoiceDetail'
import Investors from '@/pages/Investors'
import Settings from '@/pages/Settings'

// Components
import Layout from '@/components/Layout'
import { WalletProvider } from '@/contexts/WalletContext'
import ErrorBoundary from '@/components/ErrorBoundary'

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
          <Router>
            <Layout>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/invoices/create" element={<CreateInvoice />} />
                  <Route path="/invoices/:id" element={<InvoiceDetail />} />
                  <Route path="/investors" element={<Investors />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </ErrorBoundary>
            </Layout>
          </Router>
          <Toaster position="top-right" richColors expand={true} />
        </WalletProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App