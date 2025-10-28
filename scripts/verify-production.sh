#!/bin/bash

# YieldHarvest Production Verification Script
# This script automates the verification of production deployment

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
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-80}"
TIMEOUT="${TIMEOUT:-30}"

# Test credentials (should be set via environment variables)
TEST_EMAIL="${TEST_EMAIL:-test@example.com}"
TEST_PASSWORD="${TEST_PASSWORD:-SecurePassword123!}"

# Verification results
PASSED_TESTS=0
FAILED_TESTS=0
TOTAL_TESTS=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

test_start() {
    ((TOTAL_TESTS++))
    log_info "Testing: $1"
}

# Test functions
test_container_health() {
    test_start "Container Health"
    
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_success "All containers are running"
    else
        log_error "Some containers are not running"
        docker-compose -f docker-compose.prod.yml ps
    fi
}

test_backend_health() {
    test_start "Backend Health Endpoint"
    
    if curl -f -s --max-time $TIMEOUT "https://$API_DOMAIN/health" > /dev/null; then
        log_success "Backend health endpoint is responding"
    else
        log_error "Backend health endpoint is not responding"
    fi
}

test_frontend_health() {
    test_start "Frontend Accessibility"
    
    if curl -f -s --max-time $TIMEOUT "https://$DOMAIN/" > /dev/null; then
        log_success "Frontend is accessible"
    else
        log_error "Frontend is not accessible"
    fi
}

test_database_connection() {
    test_start "Database Connection"
    
    if docker-compose -f docker-compose.prod.yml exec -T backend npx prisma db pull > /dev/null 2>&1; then
        log_success "Database connection is working"
    else
        log_error "Database connection failed"
    fi
}

test_ssl_certificate() {
    test_start "SSL Certificate"
    
    if echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -dates > /dev/null 2>&1; then
        log_success "SSL certificate is valid"
    else
        log_error "SSL certificate is invalid or missing"
    fi
}

test_security_headers() {
    test_start "Security Headers"
    
    local headers=$(curl -I -s --max-time $TIMEOUT "https://$DOMAIN/")
    local missing_headers=()
    
    if ! echo "$headers" | grep -q "X-Frame-Options"; then
        missing_headers+=("X-Frame-Options")
    fi
    
    if ! echo "$headers" | grep -q "X-Content-Type-Options"; then
        missing_headers+=("X-Content-Type-Options")
    fi
    
    if ! echo "$headers" | grep -q "Strict-Transport-Security"; then
        missing_headers+=("Strict-Transport-Security")
    fi
    
    if [ ${#missing_headers[@]} -eq 0 ]; then
        log_success "All security headers are present"
    else
        log_error "Missing security headers: ${missing_headers[*]}"
    fi
}

test_cors_configuration() {
    test_start "CORS Configuration"
    
    local cors_response=$(curl -s --max-time $TIMEOUT \
        -H "Origin: https://$DOMAIN" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Authorization" \
        -X OPTIONS "https://$API_DOMAIN/api/invoices")
    
    if echo "$cors_response" | grep -q "Access-Control-Allow-Origin"; then
        log_success "CORS is properly configured"
    else
        log_error "CORS configuration is missing or incorrect"
    fi
}

test_mirror_node_connectivity() {
    test_start "Hedera Mirror Node Connectivity"
    
    if curl -f -s --max-time $TIMEOUT "https://testnet.mirrornode.hedera.com/api/v1/network/nodes" > /dev/null; then
        log_success "Mirror Node is accessible"
    else
        log_error "Mirror Node is not accessible"
    fi
}

test_api_authentication() {
    test_start "API Authentication"
    
    # Test registration endpoint
    local register_response=$(curl -s --max-time $TIMEOUT \
        -X POST "https://$API_DOMAIN/api/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"verify-$(date +%s)@example.com\",
            \"password\": \"$TEST_PASSWORD\",
            \"firstName\": \"Test\",
            \"lastName\": \"User\",
            \"role\": \"SUPPLIER\"
        }")
    
    if echo "$register_response" | grep -q "success"; then
        log_success "User registration is working"
    else
        log_error "User registration failed"
    fi
}

test_api_endpoints() {
    test_start "API Endpoints"
    
    # Test health endpoint
    if curl -f -s --max-time $TIMEOUT "https://$API_DOMAIN/health" > /dev/null; then
        log_success "API health endpoint is working"
    else
        log_error "API health endpoint failed"
    fi
    
    # Test database health endpoint
    if curl -f -s --max-time $TIMEOUT "https://$API_DOMAIN/health/database" > /dev/null; then
        log_success "Database health endpoint is working"
    else
        log_error "Database health endpoint failed"
    fi
    
    # Test Hedera health endpoint
    if curl -f -s --max-time $TIMEOUT "https://$API_DOMAIN/health/hedera" > /dev/null; then
        log_success "Hedera health endpoint is working"
    else
        log_error "Hedera health endpoint failed"
    fi
}

test_static_assets() {
    test_start "Static Assets Loading"
    
    local html_content=$(curl -s --max-time $TIMEOUT "https://$DOMAIN/")
    
    # Extract CSS and JS file paths from HTML
    local css_files=$(echo "$html_content" | grep -o '/assets/[^"]*\.css' | head -1)
    local js_files=$(echo "$html_content" | grep -o '/assets/[^"]*\.js' | head -1)
    
    if [ -n "$css_files" ] && curl -f -s --max-time $TIMEOUT "https://$DOMAIN$css_files" > /dev/null; then
        log_success "CSS assets are loading"
    else
        log_error "CSS assets failed to load"
    fi
    
    if [ -n "$js_files" ] && curl -f -s --max-time $TIMEOUT "https://$DOMAIN$js_files" > /dev/null; then
        log_success "JavaScript assets are loading"
    else
        log_error "JavaScript assets failed to load"
    fi
}

test_response_times() {
    test_start "Response Times"
    
    # Test API response time
    local api_time=$(curl -w "%{time_total}" -o /dev/null -s --max-time $TIMEOUT "https://$API_DOMAIN/health")
    local api_time_ms=$(echo "$api_time * 1000" | bc -l | cut -d. -f1)
    
    if [ "$api_time_ms" -lt 500 ]; then
        log_success "API response time is acceptable (${api_time_ms}ms)"
    else
        log_warning "API response time is slow (${api_time_ms}ms)"
    fi
    
    # Test frontend response time
    local frontend_time=$(curl -w "%{time_total}" -o /dev/null -s --max-time $TIMEOUT "https://$DOMAIN/")
    local frontend_time_ms=$(echo "$frontend_time * 1000" | bc -l | cut -d. -f1)
    
    if [ "$frontend_time_ms" -lt 3000 ]; then
        log_success "Frontend response time is acceptable (${frontend_time_ms}ms)"
    else
        log_warning "Frontend response time is slow (${frontend_time_ms}ms)"
    fi
}

test_log_format() {
    test_start "Log Format"
    
    local logs=$(docker-compose -f docker-compose.prod.yml logs --tail=10 backend 2>/dev/null || echo "")
    
    if echo "$logs" | grep -q '"level"'; then
        log_success "Logs are in structured JSON format"
    else
        log_warning "Logs may not be in structured format"
    fi
}

# Main verification function
run_verification() {
    echo "======================================"
    echo "YieldHarvest Production Verification"
    echo "======================================"
    echo ""
    echo "Domain: $DOMAIN"
    echo "API Domain: $API_DOMAIN"
    echo "Timeout: ${TIMEOUT}s"
    echo ""
    
    log_info "Starting verification tests..."
    echo ""
    
    # Infrastructure tests
    echo "🏗️  Infrastructure Tests"
    echo "------------------------"
    test_container_health
    test_database_connection
    echo ""
    
    # Application tests
    echo "🚀 Application Tests"
    echo "-------------------"
    test_backend_health
    test_frontend_health
    test_api_endpoints
    test_static_assets
    echo ""
    
    # Security tests
    echo "🔐 Security Tests"
    echo "----------------"
    test_ssl_certificate
    test_security_headers
    test_cors_configuration
    echo ""
    
    # Integration tests
    echo "🔗 Integration Tests"
    echo "-------------------"
    test_mirror_node_connectivity
    test_api_authentication
    echo ""
    
    # Performance tests
    echo "⚡ Performance Tests"
    echo "-------------------"
    test_response_times
    echo ""
    
    # Monitoring tests
    echo "📊 Monitoring Tests"
    echo "------------------"
    test_log_format
    echo ""
    
    # Summary
    echo "======================================"
    echo "Verification Summary"
    echo "======================================"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ All tests passed! Production deployment is verified.${NC}"
        exit 0
    else
        echo -e "${RED}❌ $FAILED_TESTS test(s) failed. Please review and fix issues.${NC}"
        exit 1
    fi
}

# Help function
show_help() {
    echo "YieldHarvest Production Verification Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --domain DOMAIN        Set the frontend domain (default: your-domain.com)"
    echo "  -a, --api-domain DOMAIN    Set the API domain (default: api.your-domain.com)"
    echo "  -t, --timeout SECONDS      Set request timeout (default: 30)"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DOMAIN                     Frontend domain"
    echo "  API_DOMAIN                 API domain"
    echo "  TIMEOUT                    Request timeout in seconds"
    echo "  TEST_EMAIL                 Test user email"
    echo "  TEST_PASSWORD              Test user password"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Use default settings"
    echo "  $0 -d myapp.com -a api.myapp.com     # Custom domains"
    echo "  $0 -t 60                              # Custom timeout"
    echo ""
}

# Parse command line arguments
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

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    if ! command -v openssl &> /dev/null; then
        missing_deps+=("openssl")
    fi
    
    if ! command -v bc &> /dev/null; then
        missing_deps+=("bc")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        echo "Please install the missing dependencies and try again."
        exit 1
    fi
}

# Main execution
main() {
    check_dependencies
    run_verification
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi