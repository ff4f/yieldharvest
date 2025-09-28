#!/bin/sh
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "${GREEN}🚀 Starting YieldHarvest Backend...${NC}"

# Function to wait for database
wait_for_db() {
    echo "${YELLOW}⏳ Waiting for database connection...${NC}"
    
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if npx prisma db push --accept-data-loss > /dev/null 2>&1; then
            echo "${GREEN}✅ Database connection established${NC}"
            return 0
        fi
        
        echo "${YELLOW}⏳ Attempt $attempt/$max_attempts - Database not ready, waiting...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "${RED}❌ Failed to connect to database after $max_attempts attempts${NC}"
    exit 1
}

# Function to run database migrations
run_migrations() {
    echo "${YELLOW}🔄 Running database migrations...${NC}"
    
    if npx prisma migrate deploy; then
        echo "${GREEN}✅ Database migrations completed${NC}"
    else
        echo "${RED}❌ Database migrations failed${NC}"
        exit 1
    fi
}

# Function to seed database (if needed)
seed_database() {
    if [ "$SEED_DATABASE" = "true" ]; then
        echo "${YELLOW}🌱 Seeding database...${NC}"
        
        if npm run seed; then
            echo "${GREEN}✅ Database seeding completed${NC}"
        else
            echo "${YELLOW}⚠️  Database seeding failed (continuing anyway)${NC}"
        fi
    fi
}

# Function to validate environment
validate_environment() {
    echo "${YELLOW}🔍 Validating environment variables...${NC}"
    
    required_vars="DATABASE_URL HEDERA_OPERATOR_ID HEDERA_OPERATOR_KEY JWT_SECRET"
    
    for var in $required_vars; do
        if [ -z "$(eval echo \$$var)" ]; then
            echo "${RED}❌ Required environment variable $var is not set${NC}"
            exit 1
        fi
    done
    
    echo "${GREEN}✅ Environment validation passed${NC}"
}

# Function to check Hedera connectivity
check_hedera_connectivity() {
    echo "${YELLOW}🌐 Checking Hedera network connectivity...${NC}"
    
    if node -e "
        const { Client } = require('@hashgraph/sdk');
        const client = Client.forName(process.env.HEDERA_NETWORK || 'testnet');
        client.setOperator(process.env.HEDERA_OPERATOR_ID, process.env.HEDERA_OPERATOR_KEY);
        client.ping().then(() => {
            console.log('Hedera connectivity: OK');
            process.exit(0);
        }).catch((err) => {
            console.error('Hedera connectivity failed:', err.message);
            process.exit(1);
        });
    "; then
        echo "${GREEN}✅ Hedera network connectivity verified${NC}"
    else
        echo "${YELLOW}⚠️  Hedera network connectivity check failed (continuing anyway)${NC}"
    fi
}

# Function to start the application
start_application() {
    echo "${GREEN}🎯 Starting application server...${NC}"
    echo "${GREEN}📍 Environment: $NODE_ENV${NC}"
    echo "${GREEN}🌐 Network: ${HEDERA_NETWORK:-testnet}${NC}"
    echo "${GREEN}🔗 Port: ${PORT:-3001}${NC}"
    
    exec node dist/index.js
}

# Main execution flow
main() {
    # Validate environment first
    validate_environment
    
    # Wait for database
    wait_for_db
    
    # Run migrations
    run_migrations
    
    # Seed database if requested
    seed_database
    
    # Check Hedera connectivity
    check_hedera_connectivity
    
    # Start the application
    start_application
}

# Handle signals gracefully
trap 'echo "${YELLOW}🛑 Received shutdown signal, stopping gracefully...${NC}"; exit 0' TERM INT

# Run main function
main