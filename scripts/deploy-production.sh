#!/bin/bash
set -e

# =============================================================================
# YieldHarvest Production Deployment Script
# =============================================================================
# This script automates the deployment of YieldHarvest to production
# environment using Docker Compose.
#
# Prerequisites:
# - Docker and Docker Compose installed
# - Production environment variables configured
# - SSL certificates available (if using HTTPS)
# - Hedera mainnet accounts and smart contracts deployed
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="yieldharvest"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups"
LOG_DIR="./logs"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file $ENV_FILE not found. Please create it from .env.production template."
        exit 1
    fi
    
    # Check Docker Compose file
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_error "Docker Compose file $DOCKER_COMPOSE_FILE not found."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Validate environment variables
validate_environment() {
    log_info "Validating environment variables..."
    
    # Source environment file
    set -a
    source "$ENV_FILE"
    set +a
    
    # Check critical variables
    required_vars=(
        "DATABASE_URL"
        "JWT_SECRET"
        "HEDERA_OPERATOR_ID"
        "HEDERA_OPERATOR_KEY"
        "HEDERA_NETWORK"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ] || [[ "${!var}" == *"CHANGE_ME"* ]]; then
            log_error "Environment variable $var is not properly configured"
            exit 1
        fi
    done
    
    log_success "Environment validation passed"
}

# Create necessary directories
setup_directories() {
    log_info "Setting up directories..."
    
    directories=(
        "$BACKUP_DIR"
        "$LOG_DIR"
        "./nginx/ssl"
        "./monitoring/grafana/dashboards"
        "./monitoring/grafana/provisioning"
    )
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    log_success "Directory setup completed"
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache
    
    if [ $? -eq 0 ]; then
        log_success "Docker images built successfully"
    else
        log_error "Failed to build Docker images"
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Start only the database first
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres redis
    
    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 30
    
    # Run migrations
    docker-compose -f "$DOCKER_COMPOSE_FILE" run --rm backend npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
        log_success "Database migrations completed"
    else
        log_error "Database migrations failed"
        exit 1
    fi
}

# Deploy application
deploy_application() {
    log_info "Deploying application..."
    
    # Stop existing containers
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    # Start all services
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    if [ $? -eq 0 ]; then
        log_success "Application deployed successfully"
    else
        log_error "Application deployment failed"
        exit 1
    fi
}

# Health check
health_check() {
    log_info "Performing health checks..."
    
    # Wait for services to start
    sleep 60
    
    # Check backend health
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        log_success "Backend health check passed"
    else
        log_warning "Backend health check failed"
    fi
    
    # Check frontend health
    if curl -f http://localhost/health > /dev/null 2>&1; then
        log_success "Frontend health check passed"
    else
        log_warning "Frontend health check failed"
    fi
    
    # Check database connection
    if docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_isready > /dev/null 2>&1; then
        log_success "Database health check passed"
    else
        log_warning "Database health check failed"
    fi
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo ""
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
    echo ""
    
    log_info "Application URLs:"
    echo "  Frontend: http://localhost (or your domain)"
    echo "  Backend API: http://localhost:3001"
    echo "  Grafana: http://localhost:3000"
    echo "  Prometheus: http://localhost:9090"
    echo ""
    
    log_info "Useful Commands:"
    echo "  View logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f [service]"
    echo "  Stop services: docker-compose -f $DOCKER_COMPOSE_FILE down"
    echo "  Restart service: docker-compose -f $DOCKER_COMPOSE_FILE restart [service]"
    echo "  Scale service: docker-compose -f $DOCKER_COMPOSE_FILE up -d --scale backend=3"
}

# Backup current deployment
backup_current() {
    if [ "$1" = "--backup" ]; then
        log_info "Creating backup of current deployment..."
        
        timestamp=$(date +"%Y%m%d_%H%M%S")
        backup_file="$BACKUP_DIR/deployment_backup_$timestamp.tar.gz"
        
        # Create backup
        tar -czf "$backup_file" \
            --exclude="node_modules" \
            --exclude="dist" \
            --exclude=".git" \
            --exclude="logs" \
            --exclude="backups" \
            .
        
        log_success "Backup created: $backup_file"
    fi
}

# Rollback deployment
rollback() {
    log_warning "Rolling back deployment..."
    
    # Stop current deployment
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    # Find latest backup
    latest_backup=$(ls -t "$BACKUP_DIR"/deployment_backup_*.tar.gz 2>/dev/null | head -n1)
    
    if [ -n "$latest_backup" ]; then
        log_info "Restoring from backup: $latest_backup"
        tar -xzf "$latest_backup"
        log_success "Rollback completed"
    else
        log_error "No backup found for rollback"
        exit 1
    fi
}

# Main deployment function
main() {
    echo "=============================================================================="
    echo "                    YieldHarvest Production Deployment"
    echo "=============================================================================="
    echo ""
    
    # Parse command line arguments
    case "$1" in
        "--rollback")
            rollback
            exit 0
            ;;
        "--health-check")
            health_check
            exit 0
            ;;
        "--status")
            show_status
            exit 0
            ;;
    esac
    
    # Create backup if requested
    backup_current "$1"
    
    # Run deployment steps
    check_prerequisites
    validate_environment
    setup_directories
    build_images
    run_migrations
    deploy_application
    health_check
    show_status
    
    echo ""
    log_success "🎉 YieldHarvest has been successfully deployed to production!"
    echo ""
    log_info "Next steps:"
    echo "  1. Configure your domain DNS to point to this server"
    echo "  2. Set up SSL certificates for HTTPS"
    echo "  3. Configure monitoring alerts"
    echo "  4. Set up automated backups"
    echo "  5. Test all functionality thoroughly"
    echo ""
}

# Handle script interruption
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Run main function with all arguments
main "$@"