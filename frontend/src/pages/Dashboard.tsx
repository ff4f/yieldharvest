import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, TrendingUp, DollarSign, FileText, Users, Loader2, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInvoices } from '@/hooks/useInvoices'
import { LoadingState } from '@/components/LoadingState'
import { ErrorState } from '@/components/ErrorState'
import { Invoice } from '@/types/api'

const Dashboard: React.FC = () => {
  const { data: invoicesResponse, isLoading, error } = useInvoices()

  // Calculate stats from real data
  const getStats = () => {
    if (!invoicesResponse?.data) return null

    const invoices = invoicesResponse.data
    const totalInvoices = invoicesResponse.pagination?.total || invoices.length
    const fundedInvoices = invoices.filter(inv => inv.status === 'FUNDED')
    const totalFunded = fundedInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0)
    const uniqueInvestors = new Set(fundedInvoices.map(inv => inv.supplierId)).size
    const successRate = totalInvoices > 0 ? Math.round((fundedInvoices.length / totalInvoices) * 100) : 0

    return [
      {
        title: 'Total Invoices',
        value: totalInvoices.toString(),
        description: `${invoices.filter(inv => inv.status === 'ISSUED').length} pending`,
        icon: FileText,
        color: 'text-blue-600'
      },
      {
        title: 'Total Funded',
        value: `$${totalFunded.toLocaleString()}`,
        description: `${fundedInvoices.length} invoices funded`,
        icon: DollarSign,
        color: 'text-green-600'
      },
      {
        title: 'Active Investors',
        value: uniqueInvestors.toString(),
        description: 'Unique funding sources',
        icon: Users,
        color: 'text-purple-600'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's an overview of your invoice factoring activity.
          </p>
        </div>
        <Link to="/invoices/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </Link>
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
              </CardContent>
            </Card>
          )
        })}
      </div>

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
  )
}

export default Dashboard