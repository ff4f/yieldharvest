# Production Deployment Guide

This guide covers deploying YieldHarvest to production environments with full Hedera integration.

## Prerequisites

### Required Accounts & Services

1. **Hedera Testnet Account**
   - Create account at [Hedera Portal](https://portal.hedera.com/)
   - Fund with HBAR for transactions
   - Note down Account ID and Private Key

2. **Database (PostgreSQL)**
   - Recommended: [Supabase](https://supabase.com/) or [Neon](https://neon.tech/)
   - Alternative: [Railway](https://railway.app/) or [PlanetScale](https://planetscale.com/)

3. **Frontend Hosting**
   - [Vercel](https://vercel.com/) (recommended)
   - Alternative: [Netlify](https://netlify.com/)

4. **Backend Hosting**
   - [Render](https://render.com/) (recommended)
   - Alternative: [Railway](https://railway.app/) or [Fly.io](https://fly.io/)

## Environment Configuration

### Backend Environment Variables

Create `.env.production` file:

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# Hedera Configuration
HEDERA_NETWORK="testnet"
HEDERA_ACCOUNT_ID="0.0.YOUR_ACCOUNT_ID"
HEDERA_PRIVATE_KEY="YOUR_PRIVATE_KEY_HEX"
HEDERA_MIRROR_NODE_URL="https://testnet.mirrornode.hedera.com"

# HTS Token Configuration
HTS_TOKEN_NAME="YieldHarvest Invoice NFT"
HTS_TOKEN_SYMBOL="YHINV"
HTS_TOKEN_MEMO="YieldHarvest Invoice NFT Collection"

# HCS Topic Configuration
HCS_TOPIC_MEMO="YieldHarvest Invoice Status Updates"

# JWT Configuration
JWT_SECRET="your-super-secure-jwt-secret-min-32-chars"
JWT_EXPIRES_IN="7d"

# API Configuration
PORT=3001
NODE_ENV="production"
CORS_ORIGIN="https://your-frontend-domain.vercel.app"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES="application/pdf"

# Logging
LOG_LEVEL="info"

# Health Check
HEALTH_CHECK_TIMEOUT=5000
```

### Frontend Environment Variables

Create `.env.production` file:

```bash
# API Configuration
VITE_API_BASE_URL="https://your-backend-domain.onrender.com"
VITE_API_TIMEOUT=30000

# Hedera Configuration
VITE_HEDERA_NETWORK="testnet"
VITE_HEDERA_MIRROR_NODE_URL="https://testnet.mirrornode.hedera.com"

# HashPack Configuration
VITE_HASHPACK_APP_NAME="YieldHarvest"
VITE_HASHPACK_APP_DESCRIPTION="Invoice Factoring Platform on Hedera"
VITE_HASHPACK_APP_ICON="https://your-frontend-domain.vercel.app/favicon.ico"
VITE_HASHPACK_APP_URL="https://your-frontend-domain.vercel.app"

# Application Configuration
VITE_APP_NAME="YieldHarvest"
VITE_APP_VERSION="1.0.0"
VITE_ENVIRONMENT="production"

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
VITE_ENABLE_PERFORMANCE_MONITORING=true

# HashScan Explorer
VITE_HASHSCAN_BASE_URL="https://hashscan.io/testnet"
```

## Deployment Steps

### 1. Database Setup

#### Using Supabase

1. Create new project at [Supabase](https://supabase.com/)
2. Copy connection string from Settings > Database
3. Update `DATABASE_URL` in environment variables
4. Run migrations:

```bash
npm run db:deploy
```

#### Using Neon

1. Create database at [Neon](https://neon.tech/)
2. Copy connection string
3. Update `DATABASE_URL` in environment variables
4. Run migrations:

```bash
npm run db:deploy
```

### 2. Backend Deployment (Render)

1. **Connect Repository**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New" > "Web Service"
   - Connect your GitHub repository

2. **Configure Service**
   - Name: `yieldharvest-backend`
   - Environment: `Node`
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Instance Type: `Starter` (or higher for production)

3. **Environment Variables**
   - Add all variables from `.env.production`
   - Ensure `PORT` is not set (Render provides this)

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note the service URL

### 3. Frontend Deployment (Vercel)

1. **Connect Repository**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Project**
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

3. **Environment Variables**
   - Add all variables from frontend `.env.production`
   - Update `VITE_API_BASE_URL` with your Render backend URL

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Note the deployment URL

### 4. Hedera Service Initialization

After deployment, initialize Hedera services:

1. **Create HTS Token**
   ```bash
   curl -X POST https://your-backend-domain.onrender.com/api/hedera/token \
     -H "Content-Type: application/json" \
     -d '{
       "name": "YieldHarvest Invoice NFT",
       "symbol": "YHINV",
       "memo": "YieldHarvest Invoice NFT Collection"
     }'
   ```

2. **Create HCS Topic**
   ```bash
   curl -X POST https://your-backend-domain.onrender.com/api/hedera/topic \
     -H "Content-Type: application/json" \
     -d '{
       "memo": "YieldHarvest Invoice Status Updates"
     }'
   ```

3. **Verify Services**
   ```bash
   npm run verify:production
   ```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Backend health
curl https://your-backend-domain.onrender.com/health

# Frontend accessibility
curl https://your-frontend-domain.vercel.app
```

### 2. API Endpoints

```bash
# Test API routes
curl https://your-backend-domain.onrender.com/api/users
curl https://your-backend-domain.onrender.com/api/invoices
curl https://your-backend-domain.onrender.com/api/hedera
```

### 3. Hedera Integration

```bash
# Test Hedera connectivity
curl https://your-backend-domain.onrender.com/api/hedera/status

# Test Mirror Node access
curl https://your-backend-domain.onrender.com/api/hedera/account/balance
```

### 4. Database Connectivity

```bash
# Test database connection
curl https://your-backend-domain.onrender.com/health
# Check services.database.status in response
```

## Monitoring & Maintenance

### 1. Application Monitoring

- **Render**: Built-in metrics and logs
- **Vercel**: Analytics and performance monitoring
- **Uptime Monitoring**: [UptimeRobot](https://uptimerobot.com/) or [Pingdom](https://pingdom.com/)

### 2. Database Monitoring

- **Supabase**: Built-in monitoring dashboard
- **Neon**: Performance insights and query analytics

### 3. Hedera Network Monitoring

- **HashScan**: [https://hashscan.io/testnet](https://hashscan.io/testnet)
- **Mirror Node Status**: [https://status.hedera.com/](https://status.hedera.com/)

### 4. Log Management

```bash
# View Render logs
render logs --service-id your-service-id

# View Vercel logs
vercel logs your-deployment-url
```

## Security Considerations

### 1. Environment Variables

- Never commit `.env` files to version control
- Use secure secret management in production
- Rotate secrets regularly

### 2. Database Security

- Enable SSL connections
- Use connection pooling
- Regular backups
- Monitor for suspicious activity

### 3. API Security

- Enable CORS with specific origins
- Implement rate limiting
- Use HTTPS only
- Monitor API usage

### 4. Hedera Security

- Secure private key storage
- Monitor account balance
- Set up transaction alerts
- Regular key rotation

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check connection string format
   - Verify SSL requirements
   - Check firewall settings

2. **Hedera Connection Errors**
   - Verify account ID and private key
   - Check network configuration
   - Ensure sufficient HBAR balance

3. **CORS Errors**
   - Update `CORS_ORIGIN` environment variable
   - Check frontend domain configuration

4. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Review build logs for specific errors

### Support Resources

- **Hedera Documentation**: [https://docs.hedera.com/](https://docs.hedera.com/)
- **Render Support**: [https://render.com/docs](https://render.com/docs)
- **Vercel Documentation**: [https://vercel.com/docs](https://vercel.com/docs)
- **Project Issues**: [GitHub Issues](https://github.com/your-username/yieldharvest/issues)

## Performance Optimization

### 1. Backend Optimization

- Enable response compression
- Implement caching strategies
- Optimize database queries
- Use connection pooling

### 2. Frontend Optimization

- Enable Vercel Edge Network
- Implement code splitting
- Optimize bundle size
- Use image optimization

### 3. Database Optimization

- Add appropriate indexes
- Monitor query performance
- Implement read replicas if needed
- Regular maintenance tasks

## Scaling Considerations

### 1. Horizontal Scaling

- Multiple backend instances
- Load balancing
- Database read replicas
- CDN for static assets

### 2. Vertical Scaling

- Upgrade instance types
- Increase database resources
- Optimize memory usage
- CPU optimization

### 3. Hedera Scaling

- Multiple Hedera accounts
- Transaction batching
- Efficient HCS usage
- HFS optimization