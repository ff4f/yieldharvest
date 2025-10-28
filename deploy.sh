#!/bin/bash

# YieldHarvest Production Deployment Script
# This script handles the complete deployment process for the YieldHarvest application

set -e  # Exit on any error

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

check_requirements() {
    log_info "Checking deployment requirements..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if environment file exists
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file $ENV_FILE not found. Please create it first."
        exit 1
    fi
    
    log_success "All requirements met"
}

backup_database() {
    log_info "Creating database backup..."
    
    # Create backup directory if it doesn't exist
    mkdir -p backups
    
    # Generate backup filename with timestamp
    BACKUP_FILE="backups/yieldharvest_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Create database backup (if database is running)
    if docker-compose -f $DOCKER_COMPOSE_FILE ps postgres | grep -q "Up"; then
        docker-compose -f $DOCKER_COMPOSE_FILE exec -T postgres pg_dump -U postgres yieldharvest_prod > "$BACKUP_FILE"
        log_success "Database backup created: $BACKUP_FILE"
    else
        log_warning "Database not running, skipping backup"
    fi
}

build_images() {
    log_info "Building Docker images..."
    
    # Load environment variables
    export $(cat $ENV_FILE | grep -v '^#' | xargs)
    
    # Build images
    docker-compose -f $DOCKER_COMPOSE_FILE build --no-cache
    
    log_success "Docker images built successfully"
}

deploy_application() {
    log_info "Deploying application..."
    
    # Stop existing containers
    docker-compose -f $DOCKER_COMPOSE_FILE down
    
    # Start new containers
    docker-compose -f $DOCKER_COMPOSE_FILE up -d
    
    log_success "Application deployed successfully"
}

run_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    sleep 10
    
    # Run Prisma migrations
    docker-compose -f $DOCKER_COMPOSE_FILE exec backend npx prisma migrate deploy
    
    log_success "Database migrations completed"
}

health_check() {
    log_info "Performing health checks..."
    
    # Wait for services to start
    sleep 30
    
    # Check backend health
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        return 1
    fi
    
    # Check frontend health
    if curl -f http://localhost:80/health > /dev/null 2>&1; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    log_success "All health checks passed"
}

cleanup() {
    log_info "Cleaning up unused Docker resources..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    # Remove unused networks
    docker network prune -f
    
    log_success "Cleanup completed"
}

show_status() {
    log_info "Deployment status:"
    echo ""
    docker-compose -f $DOCKER_COMPOSE_FILE ps
    echo ""
    log_info "Application URLs:"
    echo "  Frontend: http://localhost:80"
    echo "  Backend API: http://localhost:3001"
    echo "  API Documentation: http://localhost:3001/docs"
    echo ""
}

# Main deployment process
main() {
    log_info "Starting YieldHarvest production deployment..."
    echo ""
    
    # Check if we're in the right directory
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found. Please run this script from the project root directory."
        exit 1
    fi
    
    # Run deployment steps
    check_requirements
    backup_database
    build_images
    deploy_application
    run_migrations
    
    # Health checks
    if health_check; then
        cleanup
        show_status
        log_success "Deployment completed successfully! 🚀"
    else
        log_error "Deployment failed during health checks"
        log_info "Rolling back..."
        docker-compose -f $DOCKER_COMPOSE_FILE down
        exit 1
    fi
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "status")
        show_status
        ;;
    "logs")
        docker-compose -f $DOCKER_COMPOSE_FILE logs -f "${2:-}"
        ;;
    "stop")
        log_info "Stopping application..."
        docker-compose -f $DOCKER_COMPOSE_FILE down
        log_success "Application stopped"
        ;;
    "restart")
        log_info "Restarting application..."
        docker-compose -f $DOCKER_COMPOSE_FILE restart
        log_success "Application restarted"
        ;;
    "backup")
        backup_database
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        echo "Usage: $0 {deploy|status|logs|stop|restart|backup|cleanup}"
        echo ""
        echo "Commands:"
        echo "  deploy   - Full deployment process (default)"
        echo "  status   - Show deployment status"
        echo "  logs     - Show application logs"
        echo "  stop     - Stop the application"
        echo "  restart  - Restart the application"
        echo "  backup   - Create database backup"
        echo "  cleanup  - Clean up unused Docker resources"
        exit 1
        ;;
esac