# YieldHarvest - Invoice Factoring Platform on Hedera

🌾 **YieldHarvest** is a decentralized invoice factoring platform built on Hedera Hashgraph, enabling agricultural suppliers to get immediate funding for their invoices through blockchain-verified transactions.

## 🎯 Demo Targets (Hackathon Ready)

✅ **Every invoice is minted as an NFT** via Hedera Token Service (HTS)  
✅ **Invoice documents (PDF)** uploaded to Hedera File Service (HFS)  
✅ **Invoice status changes** recorded to Hedera Consensus Service (HCS)  
✅ **UI renders from Mirror Node/backend** (no dummy data)  
✅ **Wallet connect** (HashPack/Blade) for user-signed transactions  
✅ **Real funding flow** on Hedera testnet  
✅ **Proof-First**: HashScan/Mirror/HFS links exposed in UI  
✅ **Testing & Documentation** complete

## 🏗️ Architecture

### Backend (Node.js + TypeScript)
- **Framework**: Fastify with TypeScript
- **Database**: Prisma + SQLite (dev) / PostgreSQL (prod)
- **Hedera Integration**: 
  - HTS (NFT minting for invoices)
  - HFS (PDF document storage)
  - HCS (status change logging)
  - Mirror Node (data retrieval)
- **Validation**: Zod schemas
- **Logging**: Pino structured logging

### Frontend (React + TypeScript)
- **Framework**: React 18 + Vite
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: Zustand for global state
- **Data Fetching**: React Query (TanStack Query)
- **Wallet**: HashConnect for HashPack integration

### Hedera Services Integration
- **HTS**: Invoice NFTs with metadata
- **HFS**: Secure PDF document storage
- **HCS**: Immutable audit trail
- **Mirror Node**: Real-time data synchronization  

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- HashPack or Blade wallet extension
- Hedera testnet account with HBAR

### 1. Clone and Install

```bash
git clone <repository-url>
cd yieldharvest
npm install
```

### 2. Environment Setup

```bash
# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Required Environment Variables:**

```env
# Hedera Configuration
OPERATOR_ID=0.0.YOUR_ACCOUNT_ID
OPERATOR_KEY=YOUR_PRIVATE_KEY
HEDERA_NETWORK=testnet
MIRROR_NODE_URL=https://testnet.mirrornode.hedera.com

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/yieldharvest

# Security
JWT_SECRET=your-super-secure-jwt-secret-key

# Smart Contract (Optional)
PRIVATE_KEY=0x...
ESCROW_CONTRACT_ADDRESS=0x...
JSON_RPC_URL=https://testnet.hashio.io/api
```

### 3. Database Setup

```bash
# Start PostgreSQL and create database
psql -c "CREATE DATABASE yieldharvest;"

# Run migrations and seed data
cd backend
npm run migrate
npm run seed
```

### 4. Start Development Servers

```bash
# Terminal 1: Backend API
cd backend
npm run dev

# Terminal 2: Frontend React App
cd frontend
npm run dev
```

### 5. Access the Application

**Development:**
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **API Documentation:** http://localhost:3001/docs

**Production:**
- **Frontend:** https://yieldharvest-frontend.vercel.app
- **Backend API:** https://yieldharvest-backend.onrender.com
- **API Documentation:** https://yieldharvest-backend.onrender.com/docs
- **Health Status:** https://yieldharvest-backend.onrender.com/health

## 🏗️ Architecture Overview

### Tech Stack

**Backend:**
- Node.js + TypeScript
- Fastify web framework
- Prisma ORM + PostgreSQL
- Hedera JS SDK
- Zod validation
- Pino logging

**Frontend:**
- React 18 + Vite
- TypeScript
- Tailwind CSS + shadcn/ui
- React Router
- React Query (TanStack Query)
- Zustand state management

**Hedera Integration:**
- **HTS (Token Service):** Invoice NFT minting
- **HFS (File Service):** PDF document storage
- **HCS (Consensus Service):** Event logging
- **Mirror Node:** Real-time data queries
- **Smart Contracts:** Escrow functionality (optional)

### System Flow

```mermaid
graph TD
    A[User Creates Invoice] --> B[Upload PDF to HFS]
    B --> C[Mint Invoice NFT via HTS]
    C --> D[Record Event to HCS]
    D --> E[Store Metadata in DB]
    E --> F[Display in UI via Mirror Node]
    
    F --> G[Investor Funds Invoice]
    G --> H[Create Escrow Contract]
    H --> I[Record Funding Event to HCS]
    I --> J[Update Invoice Status]
    
    J --> K[Invoice Payment Received]
    K --> L[Release Escrow Funds]
    L --> M[Record Payment Event to HCS]
    M --> N[Complete Invoice Lifecycle]
```

## 📋 API Documentation

### Core Endpoints

#### Invoices
```http
POST   /api/invoices              # Create new invoice
GET    /api/invoices              # List invoices
GET    /api/invoices/:id          # Get invoice details
PUT    /api/invoices/:id          # Update invoice
DELETE /api/invoices/:id          # Delete invoice
POST   /api/invoices/:id/upload   # Upload invoice PDF
```

#### Hedera Operations
```http
POST   /api/hedera/mint-nft       # Mint invoice NFT
POST   /api/hedera/upload-file    # Upload to HFS
POST   /api/hedera/submit-message # Submit to HCS
GET    /api/hedera/nft/:tokenId   # Get NFT details
GET    /api/hedera/file/:fileId   # Get file info
```

#### Funding
```http
POST   /api/fundings              # Create funding offer
GET    /api/fundings              # List fundings
POST   /api/fundings/:id/accept   # Accept funding
POST   /api/fundings/:id/release  # Release escrow
```

### Authentication

All API endpoints require JWT authentication:

```http
Authorization: Bearer <jwt_token>
```

Get token via:
```http
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password"
}
```

## 🧪 Testing

### Run All Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e

# Smoke tests (production readiness)
npm run test:smoke

# Production verification
npm run verify:production
```

### Test Coverage

- **Unit Tests:** Services, utilities, middleware
- **Integration Tests:** API endpoints, database operations
- **E2E Tests:** Complete user workflows
- **Security Tests:** Authentication, authorization, input validation

### Test Data

Use the seeder to create test data:

```bash
cd backend
npm run seed
```

This creates:
- Test users with different roles
- Sample invoices in various states
- Mock funding offers
- Hedera testnet transactions

## 🔐 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Session management

### Input Validation
- Zod schema validation
- SQL injection prevention
- XSS protection
- CSRF protection

### File Upload Security
- MIME type validation
- File size limits
- Malicious content detection
- Secure file storage

### Hedera Security
- Private key encryption
- Transaction signing
- Consensus verification
- Immutable audit trails

## 🌐 Deployment

### Production Environment

**Live Production URLs:**
- **Frontend:** https://yieldharvest-frontend.vercel.app
- **Backend:** https://yieldharvest-backend.onrender.com
- **API Docs:** https://yieldharvest-backend.onrender.com/docs

**Backend Deployment (Render):**

```bash
# Build production bundle
npm run build

# Start production server
npm start

# Verify deployment
npm run verify:production
```

**Frontend Deployment (Vercel):**

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

**Detailed Deployment Guide:** See [docs/production-deployment.md](./docs/production-deployment.md)

### Environment Configuration

**Production Environment Variables:**

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
JWT_SECRET=production-secret
OPERATOR_ID=0.0.PROD_ACCOUNT
OPERATOR_KEY=PROD_PRIVATE_KEY
HEDERA_NETWORK=mainnet  # or testnet
```

### Health Checks

```http
GET /health              # Basic health check
GET /health/detailed     # Detailed system status
```

## 📊 Monitoring & Logging

### Structured Logging

- **Pino** for high-performance JSON logging
- **Correlation IDs** for request tracing
- **Audit logs** for security events
- **Performance metrics** for optimization

### Error Handling

- Comprehensive error classification
- User-friendly error messages
- Automatic error reporting
- Graceful degradation

## 🔗 Hedera Integration Details

### Live Hedera Proofs

**Sample HashScan Links (Testnet):**
- **Invoice NFT Collection:** [0.0.123456](https://hashscan.io/testnet/token/0.0.123456)
- **Sample Invoice NFT:** [0.0.123456/1](https://hashscan.io/testnet/token/0.0.123456/1)
- **Invoice PDF on HFS:** [0.0.789012](https://hashscan.io/testnet/file/0.0.789012)
- **Status Update Topic:** [0.0.345678](https://hashscan.io/testnet/topic/0.0.345678)
- **Funding Transaction:** [0.0.901234](https://hashscan.io/testnet/transaction/0.0.901234)

**Mirror Node Queries:**
- **Account Balance:** https://testnet.mirrornode.hedera.com/api/v1/accounts/0.0.YOUR_ACCOUNT
- **Token Info:** https://testnet.mirrornode.hedera.com/api/v1/tokens/0.0.123456
- **Topic Messages:** https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.345678/messages

### Token Service (HTS)

**Invoice NFT Schema:**
```json
{
  "name": "YieldHarvest Invoice #12345",
  "description": "Invoice from Acme Corp to Beta Ltd",
  "image": "ipfs://...",
  "properties": {
    "invoiceNumber": "INV-12345",
    "amount": "10000.00",
    "currency": "USD",
    "dueDate": "2024-03-15",
    "issuer": "Acme Corp",
    "debtor": "Beta Ltd",
    "hfsFileId": "0.0.789012",
    "hcsTopicId": "0.0.345678"
  }
}
```

### File Service (HFS)

**File Upload Process:**
1. Validate PDF document
2. Generate file hash (SHA-256)
3. Upload to HFS
4. Store file ID and hash
5. Link to invoice record

### Consensus Service (HCS)

**Event Types:**
- `INVOICE_CREATED`
- `INVOICE_FUNDED`
- `INVOICE_PAID`
- `ESCROW_CREATED`
- `ESCROW_RELEASED`

**Message Format:**
```json
{
  "eventType": "INVOICE_CREATED",
  "timestamp": "2024-01-15T10:30:00Z",
  "invoiceId": "inv_123",
  "nftTokenId": "0.0.789",
  "fileId": "0.0.456",
  "amount": "10000.00",
  "hash": "sha256:..."
}
```

## 🎯 Demo Runbook

### Quick Demo Flow

1. **Visit Production App:** https://yieldharvest-frontend.vercel.app
2. **Connect HashPack Wallet** (testnet)
3. **Create Invoice** → PDF uploaded to HFS → NFT minted via HTS
4. **View HashScan Proof:** Click NFT link to see on-chain proof
5. **Fund Invoice** → Escrow created → Status recorded to HCS
6. **Complete Payment** → Funds released → Final status update

**Every step shows live HashScan/Mirror Node links for verification!**

See [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md) for detailed step-by-step guide.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow conventional commits
- Ensure all tests pass

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Support

- **Documentation:** [docs/](./docs/)
- **Production Deployment:** [docs/production-deployment.md](./docs/production-deployment.md)
- **Issues:** GitHub Issues
- **Live Demo:** https://yieldharvest-frontend.vercel.app
- **API Status:** https://yieldharvest-backend.onrender.com/health
- **Hedera Testnet:** https://portal.hedera.com/
- **HashScan Explorer:** https://hashscan.io/testnet

---

**Built for Hedera Hack Africa 2024** 🌍

Demonstrating the power of Hedera Hashgraph for enterprise-grade financial applications with full on-chain transparency and cryptographic proofs.
