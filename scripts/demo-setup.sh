#!/bin/bash

# YieldHarvest Demo Setup Script
# Comprehensive setup for hackathon demonstration

set -e

echo "🌾 YieldHarvest Demo Setup - Hedera Hack Africa 2024"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the YieldHarvest root directory"
    exit 1
fi

print_info "Starting YieldHarvest demo setup..."

# 1. Install dependencies
print_info "Installing dependencies..."
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
print_status "Dependencies installed"

# 2. Setup environment files
print_info "Setting up environment files..."

# Backend .env
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    print_warning "Created backend/.env from example - please configure Hedera credentials"
else
    print_status "Backend .env already exists"
fi

# Frontend .env
if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
    print_status "Created frontend/.env from example"
else
    print_status "Frontend .env already exists"
fi

# 3. Database setup
print_info "Setting up database..."
cd backend
npx prisma generate
npx prisma db push
print_status "Database schema applied"

# 4. Seed demo data
print_info "Seeding demo data..."
npx tsx scripts/seed-demo-data.ts
print_status "Demo data seeded successfully"

cd ..

# 5. Build frontend
print_info "Building frontend..."
cd frontend
npm run build
print_status "Frontend built successfully"
cd ..

# 6. Verify setup
print_info "Verifying setup..."

# Check if backend can start
cd backend
timeout 10s npm run dev > /dev/null 2>&1 &
BACKEND_PID=$!
sleep 5

if kill -0 $BACKEND_PID 2>/dev/null; then
    print_status "Backend starts successfully"
    kill $BACKEND_PID
else
    print_warning "Backend may have issues - check logs"
fi

cd ..

# 7. Create demo runbook
print_info "Demo setup completed! 🎉"
echo ""
echo "📋 Next Steps:"
echo "1. Start backend: cd backend && npm run dev"
echo "2. Start frontend: cd frontend && npm run dev"
echo "3. Open http://localhost:3000 in browser"
echo "4. Connect HashPack wallet (testnet)"
echo "5. Follow DEMO_RUNBOOK.md for presentation"
echo ""
echo "🔗 Important Links:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:3001"
echo "- API Docs: http://localhost:3001/docs"
echo "- Health Check: http://localhost:3001/health"
echo ""
echo "📚 Documentation:"
echo "- Demo Runbook: ./DEMO_RUNBOOK.md"
echo "- Production Guide: ./PRODUCTION_GUIDE.md"
echo "- Mirror Node Integration: ./MIRROR_NODE_INTEGRATION.md"
echo ""
print_status "YieldHarvest is ready for demo! 🚀"