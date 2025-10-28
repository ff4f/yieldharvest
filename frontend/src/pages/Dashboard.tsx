import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  PieChart,
  Activity,
  ExternalLink,
  Plus,
  FileText,
  Wallet
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { useDashboardMetrics, useNetworkStats } from '@/hooks/useMirrorNode'
import { useMilestoneUpdates } from '@/hooks/useWebSocket'
import { LoadingState } from '@/components/LoadingState'
import { ErrorState } from '@/components/ErrorState'
import { ProofPill } from '@/components/ProofPill'
import { WalletGuard } from '@/components/WalletGuard'
import { RoleGuard } from '@/components/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { useWallet } from '@/contexts/WalletContext'
import { Invoice } from '@/types/api'

const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const { accountId, network } = useWallet()
  const { data: invoicesResponse, isLoading, error } = useInvoices()
  const { data: mirrorMetrics } = useDashboardMetrics()
  const { data: networkStats } = useNetworkStats()
  const [recentUpdates, setRecentUpdates] = useState<any[]>([])

  // WebSocket for real-time updates
  useMilestoneUpdates(
    undefined, // tokenId - listen to all deals
    undefined, // serial - listen to all invoices
    (update: any) => {
      console.log('Real-time update received:', update)
      setRecentUpdates(prev => [update, ...prev.slice(0, 9)]) // Keep last 10 updates
    }
  )

  // Calculate stats from Mirror Node metrics and invoice data
  const getStats = () => {
    const invoices = invoicesResponse?.data || []
    const metrics = mirrorMetrics

    // Use Mirror Node metrics if available, fallback to invoice data
    const totalInvoices = metrics?.totalNFTs || invoicesResponse?.pagination?.total || invoices.length
    const totalHCSMessages = metrics?.totalHCSMessages || 0
    const fundedInvoices = invoices.filter(inv => inv.status === 'FUNDED')
    const totalFunded = fundedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0)
    const successRate = totalInvoices > 0 ? Math.round((fundedInvoices.length / totalInvoices) * 100) : 0

    return [
      {
        title: 'Total Invoices (NFTs)',
        value: totalInvoices.toString(),
        description: `${invoices.filter(inv => inv.status === 'ISSUED').length} pending`,
        icon: FileText,
        color: 'text-blue-600',
        proof: metrics?.hashScanLinks?.token ? {
          type: 'token' as const,
          url: metrics.hashScanLinks.token,
          label: 'View on HashScan'
        } : undefined
      },
      {
        title: 'Total Funded',
        value: `$${totalFunded.toLocaleString()}`,
        description: `${fundedInvoices.length} invoices funded`,
        icon: DollarSign,
        color: 'text-green-600'
      },
      {
        title: 'HCS Messages',
        value: totalHCSMessages.toString(),
        description: 'Blockchain events recorded',
        icon: Activity,
        color: 'text-purple-600',
        proof: metrics?.hashScanLinks?.topic ? {
          type: 'topic' as const,
          url: metrics.hashScanLinks.topic,
          label: 'View Topic'
        } : undefined
      },
      {
        title: 'Success Rate',
        value: `${successRate}%`,
        description: 'Funding success rate',
        icon: TrendingUp,
        color: 'text-orange-600'
      }
    ]
  }

  const stats = getStats()

  // Get recent invoices from real data
  const recentInvoices = invoicesResponse?.data?.slice(0, 5).map(invoice => ({
    id: invoice.id,
    company: invoice.supplier?.name || 'Unknown Supplier',
    invoiceNumber: invoice.invoiceNumber,
    amount: parseFloat(invoice.amount),
    dueDate: invoice.dueDate,
    status: invoice.status
  })) || []

  // Handle loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's an overview of your invoice factoring activity.
            </p>
          </div>
        </div>
        <LoadingState variant="card" />
      </div>
    )
  }

  // Handle error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's an overview of your invoice factoring activity.
            </p>
          </div>
        </div>
        <ErrorState 
          variant="card"
          title="Failed to load dashboard data"
          description="Unable to fetch invoice data. Please try again."
          error={error as Error}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  return (
    <WalletGuard requireNetwork="testnet">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name || accountId}! Here's an overview of your invoice factoring activity.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Connected to:</span>
              <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{accountId}</span>
              <span className="text-xs text-muted-foreground">on {network}</span>
            </div>
          </div>
          <RoleGuard requiredRoles={['SUPPLIER', 'ADMIN']}>
            <Link to="/invoices/create">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Invoice
              </Button>
            </Link>
          </RoleGuard>
        </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats?.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
                {stat.proof && (
                  <div className="mt-2">
                    <ProofPill
                      {...stat.proof}
                      variant="compact"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Real-time Updates */}
      {recentUpdates.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              Real-time Updates
            </CardTitle>
            <CardDescription>
              Live blockchain activity from Mirror Node
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentUpdates.slice(0, 5).map((update, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {update.type || 'Blockchain Update'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {update.timestamp ? new Date(update.timestamp).toLocaleTimeString() : 'Just now'}
                      </p>
                    </div>
                  </div>
                  {update.transactionId && (
                    <a
                      href={`https://hashscan.io/testnet/transaction/${update.transactionId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Network Stats */}
      {networkStats && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Hedera Network Status
            </CardTitle>
            <CardDescription>
              Real-time network statistics from Mirror Node
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {networkStats.currentBlock?.toLocaleString() || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">Current Block</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {networkStats.tps?.toFixed(1) || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">TPS</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {networkStats.totalTransactions?.toLocaleString() || 'N/A'}
                </p>
                <p className="text-xs text-gray-500">Total Transactions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {networkStats.networkUtilization?.toFixed(1) || 'N/A'}%
                </p>
                <p className="text-xs text-gray-500">Network Utilization</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Invoices</CardTitle>
            <CardDescription>
              Your latest invoice factoring activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInvoices.length > 0 ? (
                recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {invoice.company}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(invoice.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${invoice.amount.toLocaleString()}</p>
                      <p className={`text-xs ${
                        invoice.status === 'FUNDED' ? 'text-green-600' :
                        invoice.status === 'PAID' ? 'text-blue-600' :
                        'text-yellow-600'
                      }`}>
                        {invoice.status}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating your first invoice.</p>
                  <div className="mt-6">
                    <Link to="/invoices/create">
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Invoice
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/invoices/create" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Create New Invoice
              </Button>
            </Link>
            <Link to="/invoices" className="block">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                View All Invoices
              </Button>
            </Link>
            <Link to="/investors" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Manage Investors
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
    </WalletGuard>
  )
}

export default Dashboard