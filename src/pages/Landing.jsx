import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import Icon from "../components/AppIcon";
import Button from "../components/ui/Button";

function Stat({ value, label }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-semibold text-primary">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Feature({ iconName, title, desc }) {
  return (
    <div className="rounded-lg bg-card border border-border p-6 hover:shadow-institutional transition-all duration-300">
      <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
        <Icon name={iconName} size={24} />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function Step({ step, title, desc }) {
  return (
    <div className="rounded-lg bg-card border border-border p-5 text-center">
      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center mx-auto mb-3">
        {step}
      </div>
      <h4 className="font-semibold text-foreground mb-2">{title}</h4>
      <p className="text-muted-foreground text-sm">{desc}</p>
    </div>
  );
}

function Proof({ title, desc }) {
  return (
    <div className="rounded-lg bg-card border border-border p-6">
      <h4 className="text-foreground font-semibold mb-2">{title}</h4>
      <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <Helmet>
        <title>YieldHarvest — Every Invoice. Every Milestone. On Hedera.</title>
        <meta name="description" content="Close the $2.5T trade finance gap with definitive proofs on Hedera: HTS transfers, HCS milestones, and Merkle-anchored auditability." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-lg">
                <Icon name="TrendingUp" size={24} color="white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-semibold text-foreground">YieldHarvest</span>
                <span className="text-xs text-muted-foreground">DeFi Supply Chain Finance</span>
              </div>
            </Link>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Features</a>
              <a href="#how" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">How it works</a>
              <a href="#proof" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Proof</a>
            </nav>
            <div className="flex items-center gap-3">
              <Button asChild variant="default" size="sm">
                <Link to="/dashboard">
                  <Icon name="ArrowRight" size={16} className="mr-2" />
                  Enter Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20 mb-6">
                <Icon name="Shield" size={14} className="mr-2" />
                Built on Hedera • HTS • HCS • HFS
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground mb-6">
                Close the $2.5T Trade Finance Gap — With 3 Proofs on Hedera.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                90–120 days → 9s. $500k pilot = 100 invoices → $10M liquidity for SMEs.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Button asChild size="lg">
                  <Link to="/dashboard">
                    <Icon name="BarChart3" size={20} className="mr-2" />
                    Explore Deals
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="#proof">
                    <Icon name="Shield" size={20} className="mr-2" />
                    See Proof
                  </a>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl bg-card border border-border px-6 py-4 shadow-sm">
                  <Stat value="$2.5T" label="Finance Gap" />
                </div>
                <div className="rounded-xl bg-card border border-border px-6 py-4 shadow-sm">
                  <Stat value="90→9s" label="Settlement" />
                </div>
                <div className="rounded-xl bg-card border border-border px-6 py-4 shadow-sm">
                  <Stat value="8–18%" label="APY Range" />
                </div>
                <div className="rounded-xl bg-card border border-border px-6 py-4 shadow-sm">
                  <Stat value="$500k→$10M" label="Scale Target" />
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-accent/20 blur-2xl rounded-3xl" />
              <div className="relative rounded-2xl bg-card border border-border p-8 shadow-institutional">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-success/10 rounded-lg p-4 text-center">
                    <Icon name="TrendingUp" size={24} className="text-success mx-auto mb-2" />
                    <div className="text-sm font-medium text-foreground">$500k → $10M</div>
                    <div className="text-xs text-muted-foreground">Scale Target</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-4 text-center">
                    <Icon name="Clock" size={24} className="text-primary mx-auto mb-2" />
                    <div className="text-sm font-medium text-foreground">90 → 9s</div>
                    <div className="text-xs text-muted-foreground">Settlement</div>
                  </div>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Containerized Agri Exports</span>
                    <Icon name="Package" size={16} className="text-muted-foreground" />
                  </div>
                  <div className="text-xs text-muted-foreground">Real-time milestone tracking with HCS consensus</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem & Solution */}
        <section className="py-16 lg:py-24 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-6">The Problem</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Icon name="AlertTriangle" size={20} className="text-warning mt-1" />
                    <p className="text-muted-foreground">$2.5T global trade finance gap leaves SMEs without access to working capital for growth.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Icon name="AlertTriangle" size={20} className="text-warning mt-1" />
                    <p className="text-muted-foreground">Duplicate invoices, document fraud, and manual processes create risk and inefficiency.</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Icon name="AlertTriangle" size={20} className="text-warning mt-1" />
                    <p className="text-muted-foreground">Extended payment cycles create cash flow problems and limit business expansion.</p>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-6">The Solution</h2>
                <div className="bg-card border border-border rounded-lg p-6">
                  <h3 className="font-semibold text-foreground mb-4">HTS NFT + HFS Docs + HCS Milestones + Delivery-anchored Settlement</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Icon name="CheckCircle" size={16} className="text-success" />
                      <span className="text-sm text-muted-foreground">Immutable invoice NFTs on Hedera Token Service</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Icon name="CheckCircle" size={16} className="text-success" />
                      <span className="text-sm text-muted-foreground">Milestone consensus via Hedera Consensus Service</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Icon name="CheckCircle" size={16} className="text-success" />
                      <span className="text-sm text-muted-foreground">Automated settlement based on delivery proof</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16 lg:py-24 bg-muted/30 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4">3 Definitive Proofs on Hedera</h2>
              <p className="text-muted-foreground">
                Mint NFT invoices, record milestones on HCS, and anchor evidence to Merkle root for comprehensive auditability.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Feature
                iconName="Shield"
                title="HTS Transfer Proof"
                desc="Funding creates immutable HTS token transfer proof with HashScan verification for undeniable financing records."
              />
              <Feature
                iconName="Clock"
                title="HCS Milestones"
                desc="Every delivery milestone posted to HCS creates timestamped consensus proof for real-time tracking."
              />
              <Feature
                iconName="Network"
                title="Anchored Merkle"
                desc="All evidence summarized in Merkle root and anchored to HCS for complete end-to-end auditability."
              />
              <Feature
                iconName="Workflow"
                title="Delivery-Anchored"
                desc="Payments tied to delivery proof — reducing risk and accelerating cash flow cycles."
              />
              <Feature
                iconName="BarChart3"
                title="Institutional-Ready"
                desc="Ready to scale with institutional partners through auditable architecture and proven consensus."
              />
              <Feature
                iconName="FileText"
                title="Docs & Traceability"
                desc="Critical documents tracked and verified to prevent duplication and fraud in trade finance."
              />
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how" className="py-16 lg:py-24 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4">How It Works</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                5 steps to transform trade finance with definitive proofs on Hedera
              </p>
            </div>
            
            <div className="grid lg:grid-cols-5 gap-6 mb-12">
              <Step step="1" title="Mint NFT Invoice" desc="Every invoice minted as NFT on HTS." />
              <Step step="2" title="Fund HTS Transfer" desc="Funding recorded as HTS transfer." />
              <Step step="3" title="Track HCS Milestones" desc="Delivery milestones posted to HCS." />
              <Step step="4" title="Settle Auto Payment" desc="Automatic payment when proof fulfilled." />
              <Step step="5" title="Anchor Merkle Proof" desc="Merkle root for comprehensive audit trail." />
            </div>

            <div className="bg-card border border-border rounded-lg p-8">
              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-2xl font-semibold text-foreground mb-2">$1.9T</div>
                  <div className="text-sm text-muted-foreground">Global Agri Trade</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-foreground mb-2">$120B</div>
                  <div className="text-sm text-muted-foreground">Africa Gap</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-foreground mb-2">$10M → $1B</div>
                  <div className="text-sm text-muted-foreground">Y1 Target → 3Y Vision</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Proof */}
        <section id="proof" className="py-16 lg:py-24 bg-muted/30 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4">Definitive Proofs</h2>
              <p className="text-muted-foreground">
                Three complementary proofs that lock in funding, milestones, and settlement with mathematical certainty.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <Proof 
                title="Funding = HTS Transfer" 
                desc="HTS token transfer provides undeniable proof of funding with HashScan verification and immutable records." 
              />
              <Proof 
                title="Milestones on HCS" 
                desc="Posting to Hedera Consensus Service provides objective timestamping and consensus-backed milestone tracking." 
              />
              <Proof 
                title="Merkle Anchoring" 
                desc="Entire audit trail summarized in Merkle root for comprehensive auditability and mathematical proof integrity." 
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 lg:py-20 border-t border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 border border-border p-8 sm:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h3 className="text-foreground text-2xl font-semibold mb-4">Ready to close the trade finance gap?</h3>
                  <p className="text-muted-foreground mb-6">
                    Try the live demo now and see how proofs on Hedera accelerate cash flow and reduce risk.
                  </p>
                  <div className="text-sm text-muted-foreground">
                    Live testnet demo + open repo + clickable proofs. Ready to scale with institutional partners.
                  </div>
                </div>
                <div className="flex md:justify-end gap-4">
                  <Button asChild size="lg">
                  <Link to="/dashboard">
                    <Icon name="BarChart3" size={20} className="mr-2" />
                    Enter Main Dashboard
                  </Link>
                </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/supplier-portal-dashboard">
                      <Icon name="Users" size={20} className="mr-2" />
                      Supplier Portal
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-border bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                  <Icon name="TrendingUp" size={16} color="white" />
                </div>
                <span className="text-muted-foreground text-sm">© {new Date().getFullYear()} YieldHarvest</span>
              </div>
              <div className="text-muted-foreground text-sm">
                Built with Hedera • HTS • HCS • HFS
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}