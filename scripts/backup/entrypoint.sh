#!/bin/bash
set -e

# =============================================================================
# YieldHarvest Backup Service Entrypoint
# =============================================================================
# This script serves as the entrypoint for the backup service container.
# It handles scheduled backups, one-time backups, and restore operations.
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_SCHEDULE=${BACKUP_SCHEDULE:-"0 2 * * *"}  # Default: 2 AM daily
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}
HEALTH_CHECK_PORT=${HEALTH_CHECK_PORT:-8080}
LOG_LEVEL=${LOG_LEVEL:-INFO}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Show usage information
show_usage() {
    echo "YieldHarvest Backup Service"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  scheduler    Start the backup scheduler (default)"
    echo "  backup       Run a one-time backup"
    echo "  restore      Restore from backup"
    echo "  list         List available backups"
    echo "  cleanup      Clean up old backups"
    echo "  health       Start health check server only"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_SCHEDULE        Cron schedule for backups (default: '0 2 * * *')"
    echo "  BACKUP_RETENTION_DAYS  Days to keep backups (default: 7)"
    echo "  HEALTH_CHECK_PORT      Port for health check server (default: 8080)"
    echo "  LOG_LEVEL              Log level: DEBUG, INFO, WARNING, ERROR (default: INFO)"
    echo ""
    echo "Examples:"
    echo "  $0 scheduler                    # Start scheduled backups"
    echo "  $0 backup                       # Run immediate backup"
    echo "  $0 restore 20240115_143022      # Restore specific backup"
    echo "  $0 list                         # List available backups"
}

# Initialize environment
init_environment() {
    log_info "Initializing backup service environment..."
    
    # Create necessary directories
    mkdir -p /backups
    mkdir -p /app/logs
    
    # Set permissions
    chown -R backup:backup /backups
    chown -R backup:backup /app
    
    # Create log file
    touch /app/logs/backup.log
    chown backup:backup /app/logs/backup.log
    
    log_success "Environment initialized"
}

# Health check server
start_health_server() {
    log_info "Starting health check server on port $HEALTH_CHECK_PORT..."
    
    # Simple HTTP server for health checks
    python3 -c "
import http.server
import socketserver
import json
import os
from datetime import datetime

class HealthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            # Check backup service health
            health_data = {
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'service': 'backup-service',
                'version': '1.0.0',
                'backup_dir': '/backups',
                'backup_dir_exists': os.path.exists('/backups'),
                'last_backup': self.get_last_backup_time()
            }
            
            self.wfile.write(json.dumps(health_data).encode())
        elif self.path == '/metrics':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            
            # Prometheus metrics
            metrics = self.get_metrics()
            self.wfile.write(metrics.encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def get_last_backup_time(self):
        try:
            import glob
            backup_files = glob.glob('/backups/backup_metadata_*.json')
            if backup_files:
                latest_file = max(backup_files, key=os.path.getctime)
                return datetime.fromtimestamp(os.path.getctime(latest_file)).isoformat()
            return None
        except:
            return None
    
    def get_metrics(self):
        try:
            import glob
            backup_count = len(glob.glob('/backups/db_backup_*.sql.gz'))
            backup_dir_size = sum(os.path.getsize(f) for f in glob.glob('/backups/*') if os.path.isfile(f))
            
            metrics = f'''# HELP backup_count Total number of database backups
# TYPE backup_count gauge
backup_count {backup_count}

# HELP backup_dir_size_bytes Total size of backup directory in bytes
# TYPE backup_dir_size_bytes gauge
backup_dir_size_bytes {backup_dir_size}

# HELP backup_service_up Backup service status
# TYPE backup_service_up gauge
backup_service_up 1
'''
            return metrics
        except Exception as e:
            return f'# Error generating metrics: {str(e)}\n'
    
    def log_message(self, format, *args):
        # Suppress default logging
        pass

with socketserver.TCPServer(('', $HEALTH_CHECK_PORT), HealthHandler) as httpd:
    httpd.serve_forever()
" &
    
    HEALTH_PID=$!
    echo $HEALTH_PID > /tmp/health_server.pid
    
    log_success "Health check server started (PID: $HEALTH_PID)"
}

# Stop health server
stop_health_server() {
    if [ -f /tmp/health_server.pid ]; then
        HEALTH_PID=$(cat /tmp/health_server.pid)
        if kill -0 $HEALTH_PID 2>/dev/null; then
            kill $HEALTH_PID
            rm -f /tmp/health_server.pid
            log_info "Health check server stopped"
        fi
    fi
}

# Run backup
run_backup() {
    log_info "Starting backup process..."
    
    if su - backup -c "/app/backup.sh"; then
        log_success "Backup completed successfully"
        return 0
    else
        log_error "Backup failed"
        return 1
    fi
}

# Run restore
run_restore() {
    local backup_timestamp="$1"
    local source="${2:-local}"
    local force="${3:-false}"
    
    if [ -z "$backup_timestamp" ]; then
        log_error "Backup timestamp is required for restore"
        return 1
    fi
    
    log_info "Starting restore process for backup: $backup_timestamp"
    
    if su - backup -c "/app/restore.sh '$backup_timestamp' '$source' '$force'"; then
        log_success "Restore completed successfully"
        return 0
    else
        log_error "Restore failed"
        return 1
    fi
}

# List backups
list_backups() {
    log_info "Available backups:"
    
    if [ -d "/backups" ]; then
        echo ""
        echo "Local Backups:"
        echo "==============="
        
        # List metadata files and extract information
        for metadata_file in /backups/backup_metadata_*.json; do
            if [ -f "$metadata_file" ]; then
                timestamp=$(basename "$metadata_file" | sed 's/backup_metadata_//g' | sed 's/.json//g')
                
                if command -v python3 &> /dev/null; then
                    backup_date=$(python3 -c "import json; print(json.load(open('$metadata_file'))['backup_date'])" 2>/dev/null || echo "Unknown")
                    db_size=$(python3 -c "import json; print(json.load(open('$metadata_file'))['database']['backup_size'])" 2>/dev/null || echo "Unknown")
                    files_size=$(python3 -c "import json; print(json.load(open('$metadata_file'))['files']['backup_size'])" 2>/dev/null || echo "Unknown")
                    
                    echo "  $timestamp - $backup_date (DB: ${db_size} bytes, Files: ${files_size} bytes)"
                else
                    echo "  $timestamp"
                fi
            fi
        done | sort -r
        
        if [ ! -f "/backups/backup_metadata_*.json" ]; then
            echo "  No backups found"
        fi
    else
        echo "  Backup directory not found"
    fi
    
    echo ""
}

# Cleanup old backups
cleanup_backups() {
    log_info "Cleaning up backups older than $BACKUP_RETENTION_DAYS days..."
    
    if su - backup -c "find /backups -name 'backup_metadata_*.json' -mtime +$BACKUP_RETENTION_DAYS -delete"; then
        su - backup -c "find /backups -name 'db_backup_*.sql.gz' -mtime +$BACKUP_RETENTION_DAYS -delete"
        su - backup -c "find /backups -name 'files_backup_*.tar.gz' -mtime +$BACKUP_RETENTION_DAYS -delete"
        log_success "Cleanup completed"
    else
        log_warning "Cleanup encountered some issues"
    fi
}

# Start scheduler
start_scheduler() {
    log_info "Starting backup scheduler with schedule: $BACKUP_SCHEDULE"
    
    # Start health check server
    start_health_server
    
    # Create crontab for backup user
    echo "$BACKUP_SCHEDULE /app/backup.sh >> /app/logs/backup.log 2>&1" | su - backup -c "crontab -"
    
    # Start cron daemon
    service cron start
    
    log_success "Backup scheduler started"
    
    # Keep container running and monitor
    while true; do
        sleep 60
        
        # Check if cron is still running
        if ! pgrep cron > /dev/null; then
            log_error "Cron daemon stopped, restarting..."
            service cron start
        fi
        
        # Check if health server is still running
        if [ -f /tmp/health_server.pid ]; then
            HEALTH_PID=$(cat /tmp/health_server.pid)
            if ! kill -0 $HEALTH_PID 2>/dev/null; then
                log_warning "Health server stopped, restarting..."
                start_health_server
            fi
        fi
    done
}

# Signal handlers
handle_shutdown() {
    log_info "Received shutdown signal, cleaning up..."
    
    # Stop health server
    stop_health_server
    
    # Stop cron
    service cron stop 2>/dev/null || true
    
    log_info "Backup service stopped"
    exit 0
}

# Set up signal handlers
trap handle_shutdown SIGTERM SIGINT

# Main function
main() {
    local command="${1:-scheduler}"
    
    echo "=============================================================================="
    echo "                    YieldHarvest Backup Service"
    echo "                         $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=============================================================================="
    
    # Initialize environment
    init_environment
    
    case "$command" in
        "scheduler")
            start_scheduler
            ;;
        "backup")
            start_health_server
            run_backup
            exit_code=$?
            stop_health_server
            exit $exit_code
            ;;
        "restore")
            run_restore "$2" "$3" "$4"
            exit $?
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_backups
            ;;
        "health")
            start_health_server
            log_info "Health check server running. Press Ctrl+C to stop."
            wait
            ;;
        "help"|"--help"|"-h")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"