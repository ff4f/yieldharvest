import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Shield, Zap, Globe, TrendingUp } from 'lucide-react';

const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">YH</span>
            </div>
            <span className="text-xl font-bold text-gray-900">YieldHarvest</span>
          </div>
          
          <div className="space-x-4">
            <Link to="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>
            <Link to="/invoices">
              <Button variant="outline">Invoices</Button>
            </Link>
            <Link to="/investors">
              <Button variant="outline">Funding</Button>
            </Link>
            <Link to="/login">
              <Button variant="outline">Login</Button>
            </Link>
            <Link to="/connect-wallet">
              <Button>Connect Wallet</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Decentralized Invoice Financing
          <span className="text-blue-600"> on Hedera</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Transform your invoices into NFTs, access instant funding, and participate in a transparent, 
          blockchain-powered supply chain finance ecosystem.
        </p>
        
        <div className="space-x-4">
          <Link to="/connect-wallet">
            <Button size="lg" className="px-8">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Button variant="outline" size="lg" className="px-8">
            Learn More
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why Choose YieldHarvest?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Built on Hedera's enterprise-grade blockchain for maximum security, speed, and sustainability.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card>
            <CardHeader>
              <Shield className="h-12 w-12 text-blue-600 mb-4" />
              <CardTitle>Secure & Transparent</CardTitle>
              <CardDescription>
                Every transaction recorded on Hedera's immutable ledger with full audit trails.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="h-12 w-12 text-green-600 mb-4" />
              <CardTitle>Lightning Fast</CardTitle>
              <CardDescription>
                Sub-second finality and low fees powered by Hedera's hashgraph consensus.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Globe className="h-12 w-12 text-purple-600 mb-4" />
              <CardTitle>Global Access</CardTitle>
              <CardDescription>
                Connect suppliers and investors worldwide through decentralized finance.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <TrendingUp className="h-12 w-12 text-orange-600 mb-4" />
              <CardTitle>Better Returns</CardTitle>
              <CardDescription>
                Competitive rates and automated settlements for optimal capital efficiency.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-20 bg-white rounded-lg mx-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-gray-600">
            Simple steps to unlock your invoice value
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-blue-600">1</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload Invoice</h3>
            <p className="text-gray-600">
              Upload your invoice and mint it as an NFT on Hedera Token Service
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-green-600">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Get Funded</h3>
            <p className="text-gray-600">
              Investors review and fund your invoice through smart contracts
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-purple-600">3</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Automatic Settlement</h3>
            <p className="text-gray-600">
              Payments are automatically distributed when invoices are paid
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 text-center text-gray-600">
        <p>&copy; 2024 YieldHarvest. Built on Hedera Hashgraph.</p>
      </footer>
    </div>
  );
};

export default Landing;