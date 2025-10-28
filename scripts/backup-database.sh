#!/bin/bash

# YieldHarvest Database Backup Script
# Automated database backup with rotation and compression

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="${DB_NAME:-yieldharvest_prod}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPRESS="${COMPRESS:-true}"
S3_BUCKET="${S3_BUCKET:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
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

# Backup functions
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

generate_backup_filename() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local filename="${DB_NAME}_backup_${timestamp}.sql"
    
    if [ "$COMPRESS" = "true" ]; then
        filename="${filename}.gz"
    fi
    
    echo "$filename"
}

create_database_backup() {
    local backup_file="$1"
    local backup_path="$BACKUP_DIR/$backup_file"
    
    log_info "Creating database backup: $backup_file"
    
    # Set PGPASSWORD if provided
    if [ -n "$PGPASSWORD" ]; then
        export PGPASSWORD="$PGPASSWORD"
    fi
    
    if [ "$COMPRESS" = "true" ]; then
        # Create compressed backup
        if docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump \
            -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-password --verbose --clean --if-exists --create | gzip > "$backup_path"; then
            log_success "Compressed backup created successfully"
        else
            log_error "Failed to create compressed backup"
            return 1
        fi
    else
        # Create uncompressed backup
        if docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump \
            -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
            --no-password --verbose --clean --if-exists --create > "$backup_path"; then
            log_success "Backup created successfully"
        else
            log_error "Failed to create backup"
            return 1
        fi
    fi
    
    # Get backup file size
    local file_size=$(du -h "$backup_path" | cut -f1)
    log_info "Backup file size: $file_size"
    
    return 0
}

verify_backup() {
    local backup_file="$1"
    local backup_path="$BACKUP_DIR/$backup_file"
    
    log_info "Verifying backup integrity: $backup_file"
    
    if [ ! -f "$backup_path" ]; then
        log_error "Backup file not found: $backup_path"
        return 1
    fi
    
    # Check file size (should be > 0)
    local file_size=$(stat -f%z "$backup_path" 2>/dev/null || stat -c%s "$backup_path" 2>/dev/null || echo "0")
    if [ "$file_size" -eq 0 ]; then
        log_error "Backup file is empty"
        return 1
    fi
    
    # Verify compressed file integrity
    if [ "$COMPRESS" = "true" ]; then
        if gzip -t "$backup_path" 2>/dev/null; then
            log_success "Compressed backup integrity verified"
        else
            log_error "Compressed backup is corrupted"
            return 1
        fi
    else
        # Basic SQL file verification
        if head -n 1 "$backup_path" | grep -q "PostgreSQL database dump" 2>/dev/null; then
            log_success "Backup file format verified"
        else
            log_warning "Backup file format could not be verified"
        fi
    fi
    
    return 0
}

upload_to_s3() {
    local backup_file="$1"
    local backup_path="$BACKUP_DIR/$backup_file"
    
    if [ -z "$S3_BUCKET" ]; then
        log_info "S3 upload skipped (no bucket configured)"
        return 0
    fi
    
    log_info "Uploading backup to S3: s3://$S3_BUCKET/$backup_file"
    
    if command -v aws &> /dev/null; then
        if aws s3 cp "$backup_path" "s3://$S3_BUCKET/$backup_file"; then
            log_success "Backup uploaded to S3 successfully"
        else
            log_error "Failed to upload backup to S3"
            return 1
        fi
    else
        log_warning "AWS CLI not found, skipping S3 upload"
    fi
    
    return 0
}

cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days"
    
    local deleted_count=0
    
    # Find and delete old local backups
    if [ -d "$BACKUP_DIR" ]; then
        while IFS= read -r -d '' file; do
            log_info "Deleting old backup: $(basename "$file")"
            rm "$file"
            ((deleted_count++))
        done < <(find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql*" -type f -mtime +$RETENTION_DAYS -print0 2>/dev/null || true)
    fi
    
    # Clean up old S3 backups
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%d 2>/dev/null || echo "")
        
        if [ -n "$cutoff_date" ]; then
            log_info "Cleaning up S3 backups older than $cutoff_date"
            
            # List and delete old S3 objects
            aws s3api list-objects-v2 --bucket "$S3_BUCKET" --prefix "${DB_NAME}_backup_" --query "Contents[?LastModified<='$cutoff_date'].Key" --output text | while read -r key; do
                if [ -n "$key" ] && [ "$key" != "None" ]; then
                    log_info "Deleting old S3 backup: $key"
                    aws s3 rm "s3://$S3_BUCKET/$key"
                    ((deleted_count++))
                fi
            done
        fi
    fi
    
    if [ $deleted_count -gt 0 ]; then
        log_success "Deleted $deleted_count old backup(s)"
    else
        log_info "No old backups to delete"
    fi
}

# Test restore function
test_restore() {
    local backup_file="$1"
    local backup_path="$BACKUP_DIR/$backup_file"
    local test_db_name="${DB_NAME}_restore_test"
    
    log_info "Testing backup restore: $backup_file"
    
    # Create test database
    if docker-compose -f docker-compose.prod.yml exec -T postgres createdb \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db_name" 2>/dev/null; then
        log_info "Test database created: $test_db_name"
    else
        log_warning "Test database already exists or creation failed"
    fi
    
    # Restore backup to test database
    if [ "$COMPRESS" = "true" ]; then
        if gunzip -c "$backup_path" | docker-compose -f docker-compose.prod.yml exec -T postgres psql \
            -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db_name" > /dev/null 2>&1; then
            log_success "Backup restore test successful"
        else
            log_error "Backup restore test failed"
            return 1
        fi
    else
        if docker-compose -f docker-compose.prod.yml exec -T postgres psql \
            -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$test_db_name" < "$backup_path" > /dev/null 2>&1; then
            log_success "Backup restore test successful"
        else
            log_error "Backup restore test failed"
            return 1
        fi
    fi
    
    # Clean up test database
    docker-compose -f docker-compose.prod.yml exec -T postgres dropdb \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$test_db_name" 2>/dev/null || true
    
    return 0
}

# Main backup function
run_backup() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local start_time=$(date +%s)
    
    echo "======================================"
    echo "YieldHarvest Database Backup"
    echo "======================================"
    echo "Timestamp: $timestamp"
    echo "Database: $DB_NAME"
    echo "Host: $DB_HOST:$DB_PORT"
    echo "User: $DB_USER"
    echo "Backup Directory: $BACKUP_DIR"
    echo "Retention: $RETENTION_DAYS days"
    echo "Compression: $COMPRESS"
    echo ""
    
    # Create backup directory
    create_backup_dir
    
    # Generate backup filename
    local backup_file=$(generate_backup_filename)
    
    # Create database backup
    if ! create_database_backup "$backup_file"; then
        send_slack_notification "❌ YieldHarvest: Database backup failed ($timestamp)" "danger"
        exit 1
    fi
    
    # Verify backup
    if ! verify_backup "$backup_file"; then
        send_slack_notification "❌ YieldHarvest: Database backup verification failed ($timestamp)" "danger"
        exit 1
    fi
    
    # Test restore (optional)
    if [ "$1" = "--test-restore" ]; then
        if ! test_restore "$backup_file"; then
            send_slack_notification "❌ YieldHarvest: Database backup restore test failed ($timestamp)" "danger"
            exit 1
        fi
    fi
    
    # Upload to S3
    upload_to_s3 "$backup_file"
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "======================================"
    echo "Backup Summary"
    echo "======================================"
    echo "Backup File: $backup_file"
    echo "Location: $BACKUP_DIR/$backup_file"
    echo "Duration: ${duration}s"
    echo ""
    
    log_success "Database backup completed successfully!"
    
    # Send success notification
    local message="✅ YieldHarvest: Database backup completed successfully ($backup_file) - Duration: ${duration}s"
    send_slack_notification "$message" "good"
}

# List backups function
list_backups() {
    echo "======================================"
    echo "Available Database Backups"
    echo "======================================"
    echo ""
    
    if [ -d "$BACKUP_DIR" ]; then
        echo "Local Backups:"
        echo "-------------"
        find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql*" -type f -exec ls -lh {} \; | \
            awk '{print $9, "(" $5 ")", $6, $7, $8}' | sort -r
        echo ""
    else
        echo "No local backup directory found."
        echo ""
    fi
    
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        echo "S3 Backups:"
        echo "----------"
        aws s3 ls "s3://$S3_BUCKET/" --recursive | grep "${DB_NAME}_backup_" | \
            awk '{print $4, "(" $3 ")", $1, $2}' | sort -r
    fi
}

# Restore function
restore_backup() {
    local backup_file="$1"
    local backup_path="$BACKUP_DIR/$backup_file"
    local target_db="${2:-$DB_NAME}"
    
    if [ -z "$backup_file" ]; then
        log_error "Backup file not specified"
        echo "Usage: $0 --restore BACKUP_FILE [TARGET_DB]"
        exit 1
    fi
    
    # Check if backup file exists locally
    if [ ! -f "$backup_path" ]; then
        log_info "Backup file not found locally, checking S3..."
        
        if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
            log_info "Downloading backup from S3..."
            if aws s3 cp "s3://$S3_BUCKET/$backup_file" "$backup_path"; then
                log_success "Backup downloaded from S3"
            else
                log_error "Failed to download backup from S3"
                exit 1
            fi
        else
            log_error "Backup file not found and S3 not configured"
            exit 1
        fi
    fi
    
    echo "======================================"
    echo "Database Restore"
    echo "======================================"
    echo "Backup File: $backup_file"
    echo "Target Database: $target_db"
    echo ""
    
    log_warning "This will overwrite the target database!"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Starting database restore..."
    
    # Drop and recreate target database
    log_info "Recreating target database..."
    docker-compose -f docker-compose.prod.yml exec -T postgres dropdb \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$target_db" 2>/dev/null || true
    
    docker-compose -f docker-compose.prod.yml exec -T postgres createdb \
        -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$target_db"
    
    # Restore backup
    if [ "$COMPRESS" = "true" ] && [[ "$backup_file" == *.gz ]]; then
        log_info "Restoring compressed backup..."
        if gunzip -c "$backup_path" | docker-compose -f docker-compose.prod.yml exec -T postgres psql \
            -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db"; then
            log_success "Database restore completed successfully!"
        else
            log_error "Database restore failed"
            exit 1
        fi
    else
        log_info "Restoring uncompressed backup..."
        if docker-compose -f docker-compose.prod.yml exec -T postgres psql \
            -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" < "$backup_path"; then
            log_success "Database restore completed successfully!"
        else
            log_error "Database restore failed"
            exit 1
        fi
    fi
}

# Help function
show_help() {
    echo "YieldHarvest Database Backup Script"
    echo ""
    echo "Usage: $0 [OPTIONS] [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  (default)                  Create database backup"
    echo "  --list                     List available backups"
    echo "  --restore BACKUP_FILE      Restore from backup file"
    echo "  --test-restore             Create backup and test restore"
    echo ""
    echo "Options:"
    echo "  --backup-dir DIR           Backup directory (default: ./backups)"
    echo "  --db-name NAME             Database name (default: yieldharvest_prod)"
    echo "  --db-user USER             Database user (default: postgres)"
    echo "  --db-host HOST             Database host (default: localhost)"
    echo "  --db-port PORT             Database port (default: 5432)"
    echo "  --retention-days DAYS      Backup retention in days (default: 7)"
    echo "  --no-compress              Disable compression"
    echo "  --s3-bucket BUCKET         S3 bucket for remote backup"
    echo "  -h, --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_DIR                 Backup directory"
    echo "  DB_NAME                    Database name"
    echo "  DB_USER                    Database user"
    echo "  DB_HOST                    Database host"
    echo "  DB_PORT                    Database port"
    echo "  PGPASSWORD                 Database password"
    echo "  RETENTION_DAYS             Backup retention in days"
    echo "  COMPRESS                   Enable/disable compression (true/false)"
    echo "  S3_BUCKET                  S3 bucket name"
    echo "  SLACK_WEBHOOK              Slack webhook URL for notifications"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Create backup"
    echo "  $0 --test-restore                     # Create backup and test restore"
    echo "  $0 --list                             # List available backups"
    echo "  $0 --restore backup_20240115.sql.gz  # Restore from backup"
    echo "  $0 --s3-bucket my-backups            # Backup with S3 upload"
    echo ""
}

# Parse command line arguments
COMMAND="backup"
RESTORE_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --backup-dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --db-name)
            DB_NAME="$2"
            shift 2
            ;;
        --db-user)
            DB_USER="$2"
            shift 2
            ;;
        --db-host)
            DB_HOST="$2"
            shift 2
            ;;
        --db-port)
            DB_PORT="$2"
            shift 2
            ;;
        --retention-days)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        --no-compress)
            COMPRESS="false"
            shift
            ;;
        --s3-bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        --list)
            COMMAND="list"
            shift
            ;;
        --restore)
            COMMAND="restore"
            RESTORE_FILE="$2"
            shift 2
            ;;
        --test-restore)
            COMMAND="test-restore"
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
case $COMMAND in
    "list")
        list_backups
        ;;
    "restore")
        restore_backup "$RESTORE_FILE"
        ;;
    "test-restore")
        run_backup --test-restore
        ;;
    "backup"|*)
        run_backup
        ;;
esac