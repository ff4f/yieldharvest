# YieldHarvest Production Deployment Guide

## 🎯 Overview

This guide provides comprehensive instructions for deploying YieldHarvest to production, including all necessary configurations, monitoring, and maintenance procedures.

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **RAM**: Minimum 8GB, Recommended 16GB+
- **CPU**: Minimum 4 cores, Recommended 8+ cores
- **Storage**: Minimum 100GB SSD, Recommended 500GB+ SSD
- **Network**: Stable internet connection with public IP

### Required Software
- Docker 24.0+
- Docker Compose 2.20+
- Git 2.30+
- OpenSSL 1.1.1+
- Nginx (if not using containerized version)

### External Services
- **Domain & SSL**: Valid domain with SSL certificate
- **Email Service**: SMTP provider (SendGrid, AWS SES, etc.)
- **Backup Storage**: AWS S3 or compatible storage
- **Monitoring**: Optional external monitoring service

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/yieldharvest.git
cd yieldharvest

# Copy production environment file
cp .env.production .env

# Edit environment variables
nano .env
```

### 2. Configure Environment

Edit `.env` file with your production values:

```bash
# Application
NODE_ENV=production
APP_NAME="YieldHarvest"
APP_URL=https://your-domain.com
API_URL=https://api.your-domain.com

# Database
DATABASE_URL=postgresql://username:password@postgres:5432/yieldharvest
POSTGRES_DB=yieldharvest
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_secure_password

# Hedera Configuration
HEDERA_NETWORK=testnet  # or mainnet
HEDERA_ACCOUNT_ID=0.0.YOUR_ACCOUNT
HEDERA_PRIVATE_KEY=your_private_key

# Security
JWT_SECRET=your_jwt_secret_key_min_32_chars
ENCRYPTION_KEY=your_encryption_key_32_chars

# Email
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your_email@domain.com
SMTP_PASS=your_email_password

# Backup
S3_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
```

### 3. Deploy

```bash
# Make deployment script executable
chmod +x scripts/deploy-production.sh

# Run deployment
./scripts/deploy-production.sh
```

### 4. Verify Deployment

```bash
# Run verification script
chmod +x scripts/verify-deployment.sh
./scripts/verify-deployment.sh --app-url https://your-domain.com --api-url https://api.your-domain.com
```

## 🏗️ Detailed Deployment

### Infrastructure Setup

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application directory
sudo mkdir -p /opt/yieldharvest
sudo chown $USER:$USER /opt/yieldharvest
```

#### 2. SSL Certificate Setup

```bash
# Using Let's Encrypt with Certbot
sudo apt install certbot python3-certbot-nginx -y

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com -d api.your-domain.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### 3. Firewall Configuration

```bash
# Configure UFW
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### Application Deployment

#### 1. Environment Configuration

Create production environment file:

```bash
# Copy template
cp .env.production .env.local

# Generate secrets
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env.local
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env.local
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env.local
```

#### 2. Database Setup

```bash
# Start database first
docker-compose -f docker-compose.prod.yml up -d postgres redis

# Wait for database to be ready
sleep 30

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run db:migrate

# Seed initial data
docker-compose -f docker-compose.prod.yml exec backend npm run db:seed
```

#### 3. Application Services

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Monitoring Setup

#### 1. Prometheus Configuration

The monitoring stack includes:
- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **Loki**: Log aggregation
- **Promtail**: Log collection

```bash
# Access Grafana
open http://your-domain.com:3000
# Default: admin/admin (change immediately)

# Access Prometheus
open http://your-domain.com:9090
```

#### 2. Alerting Setup

Configure alerts in `monitoring/prometheus.yml`:

```yaml
rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Backup Configuration

#### 1. Automated Backups

The backup service runs automatically:

```bash
# Check backup service
docker-compose -f docker-compose.prod.yml logs backup

# Manual backup
docker-compose -f docker-compose.prod.yml exec backup /app/backup.sh

# List backups
docker-compose -f docker-compose.prod.yml exec backup /app/entrypoint.sh list
```

#### 2. Restore Procedure

```bash
# List available backups
docker-compose -f docker-compose.prod.yml exec backup /app/entrypoint.sh list

# Restore from backup
docker-compose -f docker-compose.prod.yml exec backup /app/entrypoint.sh restore 20240115_143022

# Restore from S3
docker-compose -f docker-compose.prod.yml exec backup /app/entrypoint.sh restore 20240115_143022 s3
```

## 🔧 Configuration

### Environment Variables

#### Core Application

| Variable | Description | Required | Default |
|----------|-------------|----------|----------|
| `NODE_ENV` | Environment mode | Yes | `production` |
| `APP_NAME` | Application name | Yes | `YieldHarvest` |
| `APP_URL` | Frontend URL | Yes | - |
| `API_URL` | Backend API URL | Yes | - |
| `PORT` | Backend port | No | `3001` |

#### Database

| Variable | Description | Required | Default |
|----------|-------------|----------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `POSTGRES_DB` | Database name | Yes | `yieldharvest` |
| `POSTGRES_USER` | Database user | Yes | - |
| `POSTGRES_PASSWORD` | Database password | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |

#### Hedera Network

| Variable | Description | Required | Default |
|----------|-------------|----------|----------|
| `HEDERA_NETWORK` | Network (testnet/mainnet) | Yes | `testnet` |
| `HEDERA_ACCOUNT_ID` | Account ID | Yes | - |
| `HEDERA_PRIVATE_KEY` | Private key | Yes | - |
| `HEDERA_MIRROR_NODE_URL` | Mirror node URL | No | Auto-detected |

#### Security

| Variable | Description | Required | Default |
|----------|-------------|----------|----------|
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `ENCRYPTION_KEY` | Data encryption key | Yes | - |
| `SESSION_SECRET` | Session secret | Yes | - |
| `BCRYPT_ROUNDS` | Password hashing rounds | No | `12` |

### SSL/TLS Configuration

#### 1. Certificate Management

```bash
# Check certificate expiry
sudo certbot certificates

# Renew certificates
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal
```

#### 2. Nginx Configuration

The production setup includes optimized Nginx configuration:

- **Security headers**: XSS protection, content type options
- **Compression**: Gzip for static assets
- **Caching**: Optimized cache headers
- **Rate limiting**: Protection against abuse
- **SSL/TLS**: Strong cipher suites and HSTS

### Performance Tuning

#### 1. Database Optimization

```sql
-- PostgreSQL configuration
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
SELECT pg_reload_conf();
```

#### 2. Application Optimization

```bash
# Node.js optimization
export NODE_OPTIONS="--max-old-space-size=2048"
export UV_THREADPOOL_SIZE=128

# PM2 cluster mode (if using PM2)
npm install -g pm2
pm2 start ecosystem.config.js --env production
```

## 📊 Monitoring & Observability

### Metrics Collection

#### 1. Application Metrics

- **HTTP requests**: Response times, status codes, throughput
- **Database**: Connection pool, query performance
- **Hedera**: Transaction success rates, network latency
- **Business**: Invoice counts, funding amounts, user activity

#### 2. Infrastructure Metrics

- **System**: CPU, memory, disk usage
- **Docker**: Container health, resource usage
- **Network**: Bandwidth, connection counts

### Log Management

#### 1. Log Levels

- **ERROR**: Application errors, failed transactions
- **WARN**: Performance issues, deprecated features
- **INFO**: Business events, user actions
- **DEBUG**: Detailed execution flow (development only)

#### 2. Log Aggregation

Logs are collected by Promtail and stored in Loki:

```bash
# Query logs
curl -G -s "http://localhost:3100/loki/api/v1/query" \
  --data-urlencode 'query={job="yieldharvest-backend"}' \
  --data-urlencode 'limit=100'
```

### Alerting

#### 1. Critical Alerts

- **Service Down**: Any core service unavailable
- **Database Issues**: Connection failures, high latency
- **Hedera Network**: Transaction failures, network issues
- **High Error Rate**: >5% error rate for 5 minutes
- **Resource Exhaustion**: >90% CPU/memory for 10 minutes

#### 2. Warning Alerts

- **Performance Degradation**: Response time >2s
- **Disk Space**: >80% disk usage
- **Certificate Expiry**: SSL certificate expires in 30 days
- **Backup Failures**: Backup job failures

## 🔒 Security

### Security Checklist

#### 1. Application Security

- [ ] Environment variables secured
- [ ] JWT secrets rotated regularly
- [ ] Input validation implemented
- [ ] SQL injection protection
- [ ] XSS protection enabled
- [ ] CSRF protection configured
- [ ] Rate limiting implemented
- [ ] File upload restrictions

#### 2. Infrastructure Security

- [ ] Firewall configured
- [ ] SSH key-based authentication
- [ ] Regular security updates
- [ ] Container security scanning
- [ ] Network segmentation
- [ ] Backup encryption
- [ ] Log monitoring
- [ ] Intrusion detection

#### 3. Hedera Security

- [ ] Private keys secured
- [ ] Account permissions minimized
- [ ] Transaction signing verified
- [ ] Network connectivity secured
- [ ] Mirror node authentication

### Security Maintenance

#### 1. Regular Tasks

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Rotate secrets (monthly)
./scripts/rotate-secrets.sh

# Security scan
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image yieldharvest-backend:latest
```

#### 2. Incident Response

1. **Detection**: Monitor alerts and logs
2. **Assessment**: Determine impact and scope
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threats
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Update procedures

## 🚨 Troubleshooting

### Common Issues

#### 1. Service Won't Start

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# View service logs
docker-compose -f docker-compose.prod.yml logs service-name

# Check resource usage
docker stats

# Restart service
docker-compose -f docker-compose.prod.yml restart service-name
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
docker-compose -f docker-compose.prod.yml exec backend npm run db:test

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Reset database connection pool
docker-compose -f docker-compose.prod.yml restart backend
```

#### 3. Hedera Network Issues

```bash
# Test Hedera connectivity
curl -X GET "$API_URL/api/health/hedera"

# Check account balance
curl -X GET "https://testnet.mirrornode.hedera.com/api/v1/accounts/$HEDERA_ACCOUNT_ID"

# Verify network status
curl -X GET "https://testnet.mirrornode.hedera.com/api/v1/network/nodes"
```

#### 4. Performance Issues

```bash
# Check resource usage
docker stats --no-stream

# Analyze slow queries
docker-compose -f docker-compose.prod.yml exec postgres \
  psql -U $POSTGRES_USER -d $POSTGRES_DB -c \
  "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check application metrics
curl -X GET "$API_URL/metrics"
```

### Emergency Procedures

#### 1. Service Recovery

```bash
# Quick restart all services
docker-compose -f docker-compose.prod.yml restart

# Rollback to previous version
git checkout previous-stable-tag
./scripts/deploy-production.sh

# Emergency maintenance mode
echo "maintenance" > /tmp/maintenance.flag
```

#### 2. Data Recovery

```bash
# Restore from latest backup
./scripts/backup/restore.sh $(ls -t /backups/backup_metadata_*.json | head -1 | sed 's/.*metadata_//;s/.json//')

# Restore from S3
./scripts/backup/restore.sh TIMESTAMP s3

# Point-in-time recovery
# (Requires WAL archiving setup)
```

## 📈 Scaling

### Horizontal Scaling

#### 1. Load Balancer Setup

```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  nginx-lb:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
    depends_on:
      - backend-1
      - backend-2
      - backend-3

  backend-1:
    extends:
      file: docker-compose.prod.yml
      service: backend
    environment:
      - INSTANCE_ID=1

  backend-2:
    extends:
      file: docker-compose.prod.yml
      service: backend
    environment:
      - INSTANCE_ID=2

  backend-3:
    extends:
      file: docker-compose.prod.yml
      service: backend
    environment:
      - INSTANCE_ID=3
```

#### 2. Database Scaling

```bash
# Read replicas
docker-compose -f docker-compose.scale.yml up -d postgres-replica

# Connection pooling
docker-compose -f docker-compose.scale.yml up -d pgbouncer
```

### Vertical Scaling

#### 1. Resource Allocation

```yaml
# Increase container resources
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

#### 2. Performance Optimization

```bash
# Enable Node.js clustering
export NODE_OPTIONS="--max-old-space-size=4096"
export UV_THREADPOOL_SIZE=256

# Database tuning
export POSTGRES_SHARED_BUFFERS=512MB
export POSTGRES_EFFECTIVE_CACHE_SIZE=2GB
```

## 📚 Additional Resources

### Documentation

- [API Documentation](./docs/api.md)
- [Database Schema](./docs/database.md)
- [Hedera Integration](./docs/hedera.md)
- [Security Guide](./docs/security.md)

### External Links

- [Hedera Documentation](https://docs.hedera.com/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [PostgreSQL Performance](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Node.js Production](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

### Support

- **Issues**: [GitHub Issues](https://github.com/your-org/yieldharvest/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/yieldharvest/discussions)
- **Security**: security@your-domain.com
- **Support**: support@your-domain.com

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintainer**: YieldHarvest Team