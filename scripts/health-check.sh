#!/bin/bash

# YieldHarvest Health Check Script
# Simple health monitoring for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="${DOMAIN:-your-domain.com}"
API_DOMAIN="${API_DOMAIN:-api.your-domain.com}"
TIMEOUT="${TIMEOUT:-10}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
EMAIL_RECIPIENT="${EMAIL_RECIPIENT:-}"

# Health check results
HEALTHY_SERVICES=0
UNHEALTHY_SERVICES=0
TOTAL_SERVICES=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[HEALTHY]${NC} $1"
    ((HEALTHY_SERVICES++))
}

log_error() {
    echo -e "${RED}[UNHEALTHY]${NC} $1"
    ((UNHEALTHY_SERVICES++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Notification functions
send_slack_notification() {
    local message="$1"
    local color="$2"
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\", \"color\":\"$color\"}" \
            "$SLACK_WEBHOOK" > /dev/null 2>&1
    fi
}

send_email_notification() {
    local subject="$1"
    local message="$2"
    
    if [ -n "$EMAIL_RECIPIENT" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "$subject" "$EMAIL_RECIPIENT"
    fi
}

# Health check functions
check_service() {
    ((TOTAL_SERVICES++))
    local service_name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    log_info "Checking $service_name..."
    
    local response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" || echo "000")
    
    if [ "$response_code" = "$expected_status" ]; then
        log_success "$service_name is healthy (HTTP $response_code)"
        return 0
    else
        log_error "$service_name is unhealthy (HTTP $response_code)"
        return 1
    fi
}

check_backend_health() {
    check_service "Backend API" "https://$API_DOMAIN/health"
}

check_frontend_health() {
    check_service "Frontend" "https://$DOMAIN/"
}

check_database_health() {
    check_service "Database Health" "https://$API_DOMAIN/health/database"
}

check_hedera_health() {
    check_service "Hedera Services" "https://$API_DOMAIN/health/hedera"
}

check_mirror_node() {
    check_service "Mirror Node" "https://testnet.mirrornode.hedera.com/api/v1/network/nodes"
}

check_container_status() {
    log_info "Checking container status..."
    
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        local running_containers=$(docker-compose -f docker-compose.prod.yml ps | grep "Up" | wc -l)
        log_success "Containers are running ($running_containers active)"
        ((HEALTHY_SERVICES++))
    else
        log_error "Some containers are not running"
        docker-compose -f docker-compose.prod.yml ps
        ((UNHEALTHY_SERVICES++))
    fi
    ((TOTAL_SERVICES++))
}

check_disk_space() {
    log_info "Checking disk space..."
    
    local disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -lt 80 ]; then
        log_success "Disk space is healthy (${disk_usage}% used)"
        ((HEALTHY_SERVICES++))
    elif [ "$disk_usage" -lt 90 ]; then
        log_warning "Disk space is getting low (${disk_usage}% used)"
        ((HEALTHY_SERVICES++))
    else
        log_error "Disk space is critically low (${disk_usage}% used)"
        ((UNHEALTHY_SERVICES++))
    fi
    ((TOTAL_SERVICES++))
}

check_memory_usage() {
    log_info "Checking memory usage..."
    
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [ "$memory_usage" -lt 80 ]; then
        log_success "Memory usage is healthy (${memory_usage}% used)"
        ((HEALTHY_SERVICES++))
    elif [ "$memory_usage" -lt 90 ]; then
        log_warning "Memory usage is getting high (${memory_usage}% used)"
        ((HEALTHY_SERVICES++))
    else
        log_error "Memory usage is critically high (${memory_usage}% used)"
        ((UNHEALTHY_SERVICES++))
    fi
    ((TOTAL_SERVICES++))
}

# Main health check function
run_health_check() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "======================================"
    echo "YieldHarvest Health Check"
    echo "======================================"
    echo "Timestamp: $timestamp"
    echo "Domain: $DOMAIN"
    echo "API Domain: $API_DOMAIN"
    echo ""
    
    # Application health checks
    check_backend_health
    check_frontend_health
    check_database_health
    check_hedera_health
    check_mirror_node
    
    # Infrastructure health checks
    check_container_status
    check_disk_space
    check_memory_usage
    
    echo ""
    echo "======================================"
    echo "Health Check Summary"
    echo "======================================"
    echo "Total Services: $TOTAL_SERVICES"
    echo "Healthy: $HEALTHY_SERVICES"
    echo "Unhealthy: $UNHEALTHY_SERVICES"
    echo ""
    
    # Determine overall health status
    if [ $UNHEALTHY_SERVICES -eq 0 ]; then
        echo -e "${GREEN}✅ All services are healthy!${NC}"
        
        # Send success notification (optional)
        if [ "$1" = "--notify-success" ]; then
            send_slack_notification "✅ YieldHarvest: All services healthy ($timestamp)" "good"
            send_email_notification "YieldHarvest Health Check - All Good" "All services are healthy as of $timestamp"
        fi
        
        exit 0
    else
        echo -e "${RED}❌ $UNHEALTHY_SERVICES service(s) are unhealthy!${NC}"
        
        # Send failure notification
        local message="❌ YieldHarvest: $UNHEALTHY_SERVICES/$TOTAL_SERVICES services unhealthy ($timestamp)"
        send_slack_notification "$message" "danger"
        send_email_notification "YieldHarvest Health Check - Issues Detected" "$message"
        
        exit 1
    fi
}

# Quick check function (minimal output)
run_quick_check() {
    local backend_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "https://$API_DOMAIN/health" || echo "000")
    local frontend_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "https://$DOMAIN/" || echo "000")
    
    if [ "$backend_status" = "200" ] && [ "$frontend_status" = "200" ]; then
        echo "HEALTHY"
        exit 0
    else
        echo "UNHEALTHY (Backend: $backend_status, Frontend: $frontend_status)"
        exit 1
    fi
}

# JSON output function
run_json_check() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local backend_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "https://$API_DOMAIN/health" || echo "000")
    local frontend_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "https://$DOMAIN/" || echo "000")
    local database_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "https://$API_DOMAIN/health/database" || echo "000")
    local hedera_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "https://$API_DOMAIN/health/hedera" || echo "000")
    
    local overall_status="healthy"
    if [ "$backend_status" != "200" ] || [ "$frontend_status" != "200" ] || [ "$database_status" != "200" ] || [ "$hedera_status" != "200" ]; then
        overall_status="unhealthy"
    fi
    
    cat << EOF
{
  "timestamp": "$timestamp",
  "status": "$overall_status",
  "services": {
    "backend": {
      "status": "$backend_status",
      "healthy": $([ "$backend_status" = "200" ] && echo "true" || echo "false")
    },
    "frontend": {
      "status": "$frontend_status",
      "healthy": $([ "$frontend_status" = "200" ] && echo "true" || echo "false")
    },
    "database": {
      "status": "$database_status",
      "healthy": $([ "$database_status" = "200" ] && echo "true" || echo "false")
    },
    "hedera": {
      "status": "$hedera_status",
      "healthy": $([ "$hedera_status" = "200" ] && echo "true" || echo "false")
    }
  }
}
EOF
}

# Help function
show_help() {
    echo "YieldHarvest Health Check Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [MODE]"
    echo ""
    echo "Modes:"
    echo "  (default)                  Full health check with detailed output"
    echo "  --quick                    Quick check with minimal output"
    echo "  --json                     JSON formatted output"
    echo ""
    echo "Options:"
    echo "  -d, --domain DOMAIN        Set the frontend domain (default: your-domain.com)"
    echo "  -a, --api-domain DOMAIN    Set the API domain (default: api.your-domain.com)"
    echo "  -t, --timeout SECONDS      Set request timeout (default: 10)"
    echo "  --notify-success           Send notifications even when all services are healthy"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DOMAIN                     Frontend domain"
    echo "  API_DOMAIN                 API domain"
    echo "  TIMEOUT                    Request timeout in seconds"
    echo "  SLACK_WEBHOOK              Slack webhook URL for notifications"
    echo "  EMAIL_RECIPIENT            Email address for notifications"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Full health check"
    echo "  $0 --quick                            # Quick check"
    echo "  $0 --json                             # JSON output"
    echo "  $0 --notify-success                   # Notify on success too"
    echo "  $0 -d myapp.com -a api.myapp.com     # Custom domains"
    echo ""
    echo "Exit Codes:"
    echo "  0    All services healthy"
    echo "  1    One or more services unhealthy"
    echo ""
}

# Parse command line arguments
MODE="full"
NOTIFY_SUCCESS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -a|--api-domain)
            API_DOMAIN="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --quick)
            MODE="quick"
            shift
            ;;
        --json)
            MODE="json"
            shift
            ;;
        --notify-success)
            NOTIFY_SUCCESS=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
case $MODE in
    "quick")
        run_quick_check
        ;;
    "json")
        run_json_check
        ;;
    "full"|*)
        if [ "$NOTIFY_SUCCESS" = true ]; then
            run_health_check --notify-success
        else
            run_health_check
        fi
        ;;
esac