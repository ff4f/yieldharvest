#!/bin/bash
set -e

# =============================================================================
# YieldHarvest Deployment Verification Script
# =============================================================================
# This script verifies that all components of YieldHarvest are deployed
# correctly and functioning as expected in production environment.
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_URL=${APP_URL:-"http://localhost"}
API_URL=${API_URL:-"http://localhost:3001"}
TIMEOUT=${TIMEOUT:-30}
VERBOSE=${VERBOSE:-false}
SKIP_EXTERNAL=${SKIP_EXTERNAL:-false}

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_test() {
    echo -e "${PURPLE}[TEST]${NC} $1"
}

log_skip() {
    echo -e "${CYAN}[SKIP]${NC} $1"
}

# Test helper functions
start_test() {
    local test_name="$1"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_test "$test_name"
}

pass_test() {
    local message="$1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    log_success "$message"
}

fail_test() {
    local message="$1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    log_error "$message"
}

skip_test() {
    local message="$1"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    log_skip "$message"
}

# HTTP request helper
make_request() {
    local url="$1"
    local method="${2:-GET}"
    local expected_status="${3:-200}"
    local timeout="${4:-$TIMEOUT}"
    
    if [ "$VERBOSE" = "true" ]; then
        log_info "Making $method request to: $url"
    fi
    
    local response
    local status_code
    
    response=$(curl -s -w "\n%{http_code}" -X "$method" -m "$timeout" "$url" 2>/dev/null || echo "\nERROR")
    status_code=$(echo "$response" | tail -n1)
    
    if [ "$status_code" = "ERROR" ]; then
        return 1
    elif [ "$status_code" = "$expected_status" ]; then
        return 0
    else
        if [ "$VERBOSE" = "true" ]; then
            log_warning "Expected status $expected_status, got $status_code"
        fi
        return 1
    fi
}

# Check if service is running
check_service_running() {
    local service_name="$1"
    local container_name="$2"
    
    start_test "Checking if $service_name is running"
    
    if docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        pass_test "$service_name is running"
        return 0
    else
        fail_test "$service_name is not running"
        return 1
    fi
}

# Check service health
check_service_health() {
    local service_name="$1"
    local health_url="$2"
    
    start_test "Checking $service_name health endpoint"
    
    if make_request "$health_url" "GET" "200" 10; then
        pass_test "$service_name health check passed"
        return 0
    else
        fail_test "$service_name health check failed"
        return 1
    fi
}

# Check database connectivity
check_database() {
    start_test "Checking database connectivity"
    
    if make_request "$API_URL/api/health/db" "GET" "200" 15; then
        pass_test "Database is accessible"
        return 0
    else
        fail_test "Database is not accessible"
        return 1
    fi
}

# Check Hedera connectivity
check_hedera_connectivity() {
    if [ "$SKIP_EXTERNAL" = "true" ]; then
        skip_test "Hedera connectivity (external check skipped)"
        return 0
    fi
    
    start_test "Checking Hedera network connectivity"
    
    if make_request "$API_URL/api/health/hedera" "GET" "200" 20; then
        pass_test "Hedera network is accessible"
        return 0
    else
        fail_test "Hedera network is not accessible"
        return 1
    fi
}

# Check API endpoints
check_api_endpoints() {
    local endpoints=(
        "/api/health:200"
        "/api/auth/status:200"
        "/api/invoices:401"  # Should require auth
        "/api/users:401"     # Should require auth
    )
    
    for endpoint_config in "${endpoints[@]}"; do
        local endpoint=$(echo "$endpoint_config" | cut -d':' -f1)
        local expected_status=$(echo "$endpoint_config" | cut -d':' -f2)
        
        start_test "Checking API endpoint: $endpoint"
        
        if make_request "$API_URL$endpoint" "GET" "$expected_status" 10; then
            pass_test "API endpoint $endpoint responded correctly"
        else
            fail_test "API endpoint $endpoint failed"
        fi
    done
}

# Check frontend accessibility
check_frontend() {
    start_test "Checking frontend accessibility"
    
    if make_request "$APP_URL" "GET" "200" 15; then
        pass_test "Frontend is accessible"
        return 0
    else
        fail_test "Frontend is not accessible"
        return 1
    fi
}

# Check static assets
check_static_assets() {
    local assets=(
        "/favicon.ico"
        "/manifest.json"
    )
    
    for asset in "${assets[@]}"; do
        start_test "Checking static asset: $asset"
        
        if make_request "$APP_URL$asset" "GET" "200" 10; then
            pass_test "Static asset $asset is accessible"
        else
            fail_test "Static asset $asset is not accessible"
        fi
    done
}

# Check SSL/TLS (if HTTPS)
check_ssl() {
    if [[ "$APP_URL" == https://* ]]; then
        start_test "Checking SSL/TLS certificate"
        
        local domain=$(echo "$APP_URL" | sed 's|https://||' | sed 's|/.*||')
        
        if echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null; then
            pass_test "SSL/TLS certificate is valid"
        else
            fail_test "SSL/TLS certificate check failed"
        fi
    else
        skip_test "SSL/TLS check (not using HTTPS)"
    fi
}

# Check monitoring endpoints
check_monitoring() {
    local monitoring_endpoints=(
        "$API_URL/metrics:200"
        "$API_URL/api/health/detailed:200"
    )
    
    for endpoint_config in "${monitoring_endpoints[@]}"; do
        local endpoint=$(echo "$endpoint_config" | cut -d':' -f1)
        local expected_status=$(echo "$endpoint_config" | cut -d':' -f2)
        
        start_test "Checking monitoring endpoint: $(basename $endpoint)"
        
        if make_request "$endpoint" "GET" "$expected_status" 10; then
            pass_test "Monitoring endpoint $(basename $endpoint) is working"
        else
            fail_test "Monitoring endpoint $(basename $endpoint) failed"
        fi
    done
}

# Check backup service
check_backup_service() {
    start_test "Checking backup service"
    
    if docker ps --format "table {{.Names}}" | grep -q "yieldharvest-backup"; then
        # Check backup service health
        if make_request "http://localhost:8080/health" "GET" "200" 10; then
            pass_test "Backup service is running and healthy"
        else
            fail_test "Backup service is running but unhealthy"
        fi
    else
        fail_test "Backup service is not running"
    fi
}

# Check log aggregation
check_logging() {
    start_test "Checking log aggregation"
    
    if docker ps --format "table {{.Names}}" | grep -q "loki"; then
        if make_request "http://localhost:3100/ready" "GET" "200" 10; then
            pass_test "Log aggregation (Loki) is working"
        else
            fail_test "Log aggregation (Loki) is not responding"
        fi
    else
        skip_test "Log aggregation (Loki not running)"
    fi
}

# Check metrics collection
check_metrics() {
    start_test "Checking metrics collection"
    
    if docker ps --format "table {{.Names}}" | grep -q "prometheus"; then
        if make_request "http://localhost:9090/-/healthy" "GET" "200" 10; then
            pass_test "Metrics collection (Prometheus) is working"
        else
            fail_test "Metrics collection (Prometheus) is not responding"
        fi
    else
        skip_test "Metrics collection (Prometheus not running)"
    fi
}

# Performance test
performance_test() {
    if [ "$SKIP_EXTERNAL" = "true" ]; then
        skip_test "Performance test (external check skipped)"
        return 0
    fi
    
    start_test "Basic performance test"
    
    local start_time=$(date +%s%N)
    
    if make_request "$API_URL/api/health" "GET" "200" 5; then
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
        
        if [ $duration -lt 1000 ]; then  # Less than 1 second
            pass_test "Performance test passed (${duration}ms response time)"
        else
            log_warning "Performance test completed but slow (${duration}ms response time)"
            pass_test "Performance test passed with warning"
        fi
    else
        fail_test "Performance test failed"
    fi
}

# Security headers check
check_security_headers() {
    start_test "Checking security headers"
    
    local response_headers
    response_headers=$(curl -s -I "$APP_URL" 2>/dev/null || echo "")
    
    local required_headers=(
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
    )
    
    local missing_headers=()
    
    for header in "${required_headers[@]}"; do
        if ! echo "$response_headers" | grep -qi "$header"; then
            missing_headers+=("$header")
        fi
    done
    
    if [ ${#missing_headers[@]} -eq 0 ]; then
        pass_test "All required security headers are present"
    else
        log_warning "Missing security headers: ${missing_headers[*]}"
        fail_test "Some security headers are missing"
    fi
}

# Show usage
show_usage() {
    echo "YieldHarvest Deployment Verification Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --app-url URL        Frontend URL (default: http://localhost)"
    echo "  --api-url URL        Backend API URL (default: http://localhost:3001)"
    echo "  --timeout SECONDS    Request timeout (default: 30)"
    echo "  --verbose            Enable verbose output"
    echo "  --skip-external      Skip external service checks"
    echo "  --help               Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  APP_URL              Frontend URL"
    echo "  API_URL              Backend API URL"
    echo "  TIMEOUT              Request timeout in seconds"
    echo "  VERBOSE              Enable verbose output (true/false)"
    echo "  SKIP_EXTERNAL        Skip external checks (true/false)"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --app-url)
            APP_URL="$2"
            shift 2
            ;;
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --skip-external)
            SKIP_EXTERNAL=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main verification function
main() {
    echo "=============================================================================="
    echo "                    YieldHarvest Deployment Verification"
    echo "                         $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=============================================================================="
    echo ""
    log_info "Frontend URL: $APP_URL"
    log_info "API URL: $API_URL"
    log_info "Timeout: ${TIMEOUT}s"
    log_info "Skip External: $SKIP_EXTERNAL"
    echo ""
    
    # Infrastructure checks
    echo "🏗️  Infrastructure Checks"
    echo "─────────────────────────"
    check_service_running "PostgreSQL" "postgres"
    check_service_running "Redis" "redis"
    check_service_running "Backend API" "yieldharvest-backend"
    check_service_running "Frontend" "yieldharvest-frontend"
    echo ""
    
    # Health checks
    echo "🏥 Health Checks"
    echo "─────────────────"
    check_service_health "Backend API" "$API_URL/api/health"
    check_database
    check_hedera_connectivity
    echo ""
    
    # API checks
    echo "🔌 API Endpoint Checks"
    echo "──────────────────────"
    check_api_endpoints
    echo ""
    
    # Frontend checks
    echo "🌐 Frontend Checks"
    echo "──────────────────"
    check_frontend
    check_static_assets
    check_ssl
    echo ""
    
    # Monitoring checks
    echo "📊 Monitoring Checks"
    echo "────────────────────"
    check_monitoring
    check_backup_service
    check_logging
    check_metrics
    echo ""
    
    # Performance and security
    echo "🚀 Performance & Security"
    echo "─────────────────────────"
    performance_test
    check_security_headers
    echo ""
    
    # Summary
    echo "=============================================================================="
    echo "                           Verification Summary"
    echo "=============================================================================="
    echo ""
    log_info "Total Tests: $TOTAL_TESTS"
    log_success "Passed: $PASSED_TESTS"
    
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "Failed: $FAILED_TESTS"
    fi
    
    if [ $SKIPPED_TESTS -gt 0 ]; then
        log_warning "Skipped: $SKIPPED_TESTS"
    fi
    
    echo ""
    
    # Calculate success rate
    local success_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        success_rate=$(( (PASSED_TESTS * 100) / (TOTAL_TESTS - SKIPPED_TESTS) ))
    fi
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_success "🎉 All tests passed! Deployment verification successful (${success_rate}% success rate)"
        echo ""
        log_info "Your YieldHarvest application is ready for production!"
        exit 0
    else
        log_error "❌ Some tests failed! Please review the issues above (${success_rate}% success rate)"
        echo ""
        log_info "Please fix the failing tests before considering the deployment complete."
        exit 1
    fi
}

# Check dependencies
if ! command -v curl &> /dev/null; then
    log_error "curl is required but not installed"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    log_error "docker is required but not installed"
    exit 1
fi

# Run main function
main