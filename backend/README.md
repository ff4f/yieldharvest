# YieldHarvest Backend

Backend API untuk platform YieldHarvest yang mengintegrasikan Hedera Hashgraph untuk invoice factoring dengan NFT, file storage, dan consensus service.

## 🚀 Features

### Core Services
- **Invoice Management**: CRUD operations untuk invoice dengan status tracking
- **User Management**: Authentication, authorization, dan role-based access control
- **Funding Management**: Pengelolaan funding untuk invoice factoring
- **Milestone Tracking**: Tracking milestone pembayaran dan progress

### Hedera Integration
- **HTS (Hedera Token Service)**: Minting invoice sebagai NFT dengan metadata lengkap
- **HFS (Hedera File Service)**: Upload dan storage dokumen PDF invoice
- **HCS (Hedera Consensus Service)**: Recording status changes dan events
- **Mirror Node Integration**: Real-time data reading dari Hedera network

### InvoiceHederaService
Service terintegrasi yang menggabungkan semua operasi Hedera dalam satu workflow:

```typescript
// Membuat invoice dengan full Hedera integration
const result = await invoiceHederaService.createInvoiceWithHedera({
  invoiceNumber: 'INV-001',
  supplierId: 'supplier_123',
  buyerId: 'buyer_123',
  amount: 1000.00,
  currency: 'USD',
  dueDate: new Date(),
  description: 'Invoice description',
  pdfBuffer: pdfFileBuffer,
  pdfFilename: 'invoice.pdf'
});

// Result includes:
// - invoice: Database record
// - nftResult: HTS minting result
// - fileResult: HFS upload result  
// - hcsResult: HCS message result
```

## 📡 API Endpoints

### Invoice Endpoints

#### POST /api/invoices/with-hedera
Membuat invoice dengan full Hedera integration menggunakan InvoiceHederaService.

**Request**: Multipart form data
```
invoiceNumber: string
supplierId: string
buyerId: string
amount: string (number)
currency: string (3 chars)
dueDate: string (ISO datetime)
description?: string
pdfFile: File (PDF)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "invoice_id",
      "invoiceNumber": "INV-001",
      "amount": 1000.00,
      "status": "ISSUED",
      "nftTokenId": "0.0.123456",
      "nftSerialNumber": "1",
      "fileId": "0.0.789012",
      "fileHash": "sha384_hash",
      "topicId": "0.0.345678"
    },
    "hedera": {
      "nft": {
        "tokenId": "0.0.123456",
        "serialNumber": "1",
        "transactionId": "0.0.123@1234567890.123456789"
      },
      "file": {
        "fileId": "0.0.789012",
        "transactionId": "0.0.123@1234567890.123456790",
        "fileHashSha384": "sha384_hash"
      },
      "hcs": {
        "transactionId": "0.0.123@1234567890.123456791",
        "sequenceNumber": "1"
      },
      "hashScanUrls": {
        "nft": "https://hashscan.io/testnet/token/0.0.123456/1",
        "file": "https://hashscan.io/testnet/transaction/0.0.123@1234567890.123456790",
        "topic": "https://hashscan.io/testnet/topic/0.0.345678"
      }
    }
  }
}
```

#### POST /api/invoices
Endpoint original untuk membuat invoice (direct Hedera calls).

#### GET /api/invoices
Mendapatkan semua invoice dengan filtering dan pagination.

#### GET /api/invoices/:id
Mendapatkan detail invoice berdasarkan ID.

#### PUT /api/invoices/:id/status
Update status invoice dengan HCS recording.

### Hedera Endpoints

#### GET /api/hedera/health
Cek koneksi ke Hedera network.

#### POST /api/hedera/tokens
Membuat NFT token baru untuk invoice.

#### POST /api/hedera/topics
Membuat topic baru untuk HCS.

#### GET /api/hedera/transactions/:id
Mendapatkan detail transaksi dari Mirror Node.

## 🛠 Development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Hedera Testnet Account

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/yieldharvest"

# Hedera Configuration
HEDERA_NETWORK="testnet"
HEDERA_ACCOUNT_ID="0.0.123456"
HEDERA_PRIVATE_KEY="302e020100300506032b657004220420..."
MIRROR_NODE_URL="https://testnet.mirrornode.hedera.com"

# Invoice Configuration
INVOICE_TOKEN_ID="0.0.123456"  # NFT Token ID for invoices
INVOICE_TOPIC_ID="0.0.789012"  # HCS Topic ID for invoice events

# JWT
JWT_SECRET="your-jwt-secret"
JWT_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="development"
```

### Installation
```bash
npm install
```

### Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed database
npm run seed
```

### Running
```bash
# Development
npm run dev

# Production
npm run build
npm start

# Tests
npm test
npm run test:e2e
```

## 🏗 Architecture

### Service Layer
- **InvoiceService**: Core invoice operations
- **InvoiceHederaService**: Hedera-integrated invoice operations
- **HederaService**: Low-level Hedera SDK operations
- **UserService**: User management
- **FundingService**: Funding operations

### Middleware
- **Authentication**: JWT-based auth
- **Authorization**: Role-based access control
- **Validation**: Zod schema validation
- **Error Handling**: Centralized error handling

### Database
- **Prisma ORM**: Type-safe database operations
- **PostgreSQL**: Primary database
- **Migrations**: Version-controlled schema changes

## 🔗 Hedera Integration Details

### NFT Metadata Structure
```json
{
  "invoiceId": "invoice_uuid",
  "invoiceNumber": "INV-001",
  "amount": "1000.00",
  "currency": "USD",
  "dueDate": "2024-01-01T00:00:00.000Z",
  "supplierId": "supplier_id",
  "buyerId": "buyer_id",
  "fileId": "0.0.789012",
  "fileHash": "sha384_hash"
}
```

### HCS Message Structure
```json
{
  "tokenId": "0.0.123456",
  "serialNumber": "1",
  "status": "issued",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "fileHash": "sha384_hash",
  "amount": "1000.00",
  "currency": "USD"
}
```

### Proof-First Approach
Setiap operasi menghasilkan HashScan links untuk verifikasi:
- **NFT**: `https://hashscan.io/testnet/token/{tokenId}/{serialNumber}`
- **File**: `https://hashscan.io/testnet/transaction/{transactionId}`
- **Topic**: `https://hashscan.io/testnet/topic/{topicId}`

## 📊 Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test:coverage
```

## 🚀 Deployment

### Docker
```bash
docker build -t yieldharvest-backend .
docker run -p 3001:3001 yieldharvest-backend
```

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Hedera accounts funded
- [ ] SSL certificates installed
- [ ] Monitoring configured
- [ ] Backup strategy implemented

## 📝 API Documentation

Swagger documentation tersedia di `/docs` ketika server berjalan.

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details.