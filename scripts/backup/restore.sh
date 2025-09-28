#!/bin/bash
set -e

# =============================================================================
# YieldHarvest Restore Script
# =============================================================================
# This script restores PostgreSQL database and uploaded files from backups
# created by the backup script. It can restore from local files or S3.
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration from environment variables
POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_DB=${POSTGRES_DB:-yieldharvest}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

BACKUP_DIR=${BACKUP_DIR:-/backups}
UPLOADS_DIR=${UPLOADS_DIR:-/app/uploads}
S3_BUCKET=${S3_BUCKET}
AWS_REGION=${AWS_REGION:-us-east-1}

# Command line arguments
BACKUP_TIMESTAMP="$1"
RESTORE_SOURCE="${2:-local}"  # local or s3
FORCE_RESTORE="${3:-false}"   # true to skip confirmations

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
    echo "Usage: $0 <backup_timestamp> [source] [force]"
    echo ""
    echo "Arguments:"
    echo "  backup_timestamp  Timestamp of the backup to restore (format: YYYYMMDD_HHMMSS)"
    echo "  source           Source of backup: 'local' or 's3' (default: local)"
    echo "  force            Skip confirmation prompts: 'true' or 'false' (default: false)"
    echo ""
    echo "Examples:"
    echo "  $0 20240115_143022                    # Restore from local backup"
    echo "  $0 20240115_143022 s3                # Restore from S3 backup"
    echo "  $0 20240115_143022 local true        # Restore from local backup without prompts"
    echo ""
    echo "Available local backups:"
    if [ -d "$BACKUP_DIR" ]; then
        ls -la "$BACKUP_DIR" | grep "backup_metadata_" | awk '{print $9}' | sed 's/backup_metadata_//g' | sed 's/.json//g' | sort -r | head -10
    else
        echo "  No backup directory found"
    fi
}

# Check if required environment variables are set
check_environment() {
    log_info "Checking environment variables..."
    
    if [ -z "$POSTGRES_PASSWORD" ]; then
        log_error "POSTGRES_PASSWORD is not set"
        exit 1
    fi
    
    if [ -z "$BACKUP_TIMESTAMP" ]; then
        log_error "Backup timestamp is required"
        show_usage
        exit 1
    fi
    
    log_success "Environment check passed"
}

# Test database connection
test_db_connection() {
    log_info "Testing database connection..."
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" > /dev/null 2>&1; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to database server"
        exit 1
    fi
}

# Download backup from S3 if needed
download_from_s3() {
    if [ "$RESTORE_SOURCE" = "s3" ]; then
        log_info "Downloading backup from S3..."
        
        if [ -z "$S3_BUCKET" ]; then
            log_error "S3_BUCKET is not configured"
            exit 1
        fi
        
        if ! command -v aws &> /dev/null; then
            log_error "AWS CLI is not available"
            exit 1
        fi
        
        # Extract date from timestamp
        backup_date=$(echo "$BACKUP_TIMESTAMP" | cut -c1-8)
        formatted_date="${backup_date:0:4}-${backup_date:4:2}-${backup_date:6:2}"
        
        S3_PREFIX="yieldharvest-backups/$formatted_date"
        
        # Download files
        files_to_download=(
            "db_backup_${BACKUP_TIMESTAMP}.sql.gz"
            "files_backup_${BACKUP_TIMESTAMP}.tar.gz"
            "backup_metadata_${BACKUP_TIMESTAMP}.json"
        )
        
        mkdir -p "$BACKUP_DIR"
        
        for file in "${files_to_download[@]}"; do
            s3_path="s3://$S3_BUCKET/$S3_PREFIX/$file"
            local_path="$BACKUP_DIR/$file"
            
            if aws s3 cp "$s3_path" "$local_path" --region "$AWS_REGION"; then
                log_success "Downloaded: $file"
            else
                log_warning "Failed to download: $file (may not exist)"
            fi
        done
        
        log_success "S3 download completed"
    fi
}

# Verify backup files exist and are valid
verify_backup_files() {
    log_info "Verifying backup files..."
    
    DB_BACKUP_FILE="${BACKUP_DIR}/db_backup_${BACKUP_TIMESTAMP}.sql.gz"
    FILES_BACKUP_FILE="${BACKUP_DIR}/files_backup_${BACKUP_TIMESTAMP}.tar.gz"
    METADATA_FILE="${BACKUP_DIR}/backup_metadata_${BACKUP_TIMESTAMP}.json"
    
    # Check database backup
    if [ ! -f "$DB_BACKUP_FILE" ]; then
        log_error "Database backup file not found: $DB_BACKUP_FILE"
        exit 1
    fi
    
    if ! gzip -t "$DB_BACKUP_FILE" 2>/dev/null; then
        log_error "Database backup file is corrupted"
        exit 1
    fi
    
    log_success "Database backup file verified"
    
    # Check files backup (optional)
    if [ -f "$FILES_BACKUP_FILE" ]; then
        if tar -tzf "$FILES_BACKUP_FILE" >/dev/null 2>&1; then
            log_success "Files backup file verified"
        else
            log_warning "Files backup file is corrupted, skipping files restore"
            FILES_BACKUP_FILE=""
        fi
    else
        log_warning "Files backup not found, skipping files restore"
        FILES_BACKUP_FILE=""
    fi
    
    # Check metadata (optional)
    if [ -f "$METADATA_FILE" ]; then
        if python3 -m json.tool "$METADATA_FILE" >/dev/null 2>&1; then
            log_success "Metadata file verified"
        else
            log_warning "Metadata file is corrupted"
        fi
    else
        log_warning "Metadata file not found"
    fi
}

# Show backup information
show_backup_info() {
    log_info "Backup Information:"
    
    if [ -f "$METADATA_FILE" ]; then
        echo "  Timestamp: $(python3 -c "import json; print(json.load(open('$METADATA_FILE'))['backup_timestamp'])" 2>/dev/null || echo 'Unknown')"
        echo "  Date: $(python3 -c "import json; print(json.load(open('$METADATA_FILE'))['backup_date'])" 2>/dev/null || echo 'Unknown')"
        echo "  Database: $(python3 -c "import json; print(json.load(open('$METADATA_FILE'))['database']['database'])" 2>/dev/null || echo 'Unknown')"
        echo "  DB Size: $(python3 -c "import json; print(json.load(open('$METADATA_FILE'))['database']['backup_size'])" 2>/dev/null || echo 'Unknown') bytes"
        echo "  Files Size: $(python3 -c "import json; print(json.load(open('$METADATA_FILE'))['files']['backup_size'])" 2>/dev/null || echo 'Unknown') bytes"
    else
        echo "  Timestamp: $BACKUP_TIMESTAMP"
        echo "  Database backup: $(basename $DB_BACKUP_FILE)"
        echo "  Files backup: $(basename $FILES_BACKUP_FILE)"
    fi
    echo ""
}

# Confirm restore operation
confirm_restore() {
    if [ "$FORCE_RESTORE" != "true" ]; then
        log_warning "⚠️  This operation will COMPLETELY REPLACE the current database and files!"
        log_warning "⚠️  All current data will be PERMANENTLY LOST!"
        echo ""
        read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
        
        if [ "$confirmation" != "yes" ]; then
            log_info "Restore operation cancelled by user"
            exit 0
        fi
    fi
}

# Create database backup before restore
create_pre_restore_backup() {
    log_info "Creating pre-restore backup..."
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    PRE_RESTORE_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    PRE_RESTORE_FILE="${BACKUP_DIR}/pre_restore_backup_${PRE_RESTORE_TIMESTAMP}.sql.gz"
    
    if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        --verbose --clean --if-exists --create --format=plain \
        | gzip > "$PRE_RESTORE_FILE"; then
        
        log_success "Pre-restore backup created: $PRE_RESTORE_FILE"
    else
        log_warning "Failed to create pre-restore backup (continuing anyway)"
    fi
}

# Restore database
restore_database() {
    log_info "Restoring database..."
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    # Drop existing connections to the database
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres -c "
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();
    " 2>/dev/null || true
    
    # Restore database
    if gunzip -c "$DB_BACKUP_FILE" | psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d postgres; then
        log_success "Database restored successfully"
    else
        log_error "Database restore failed"
        exit 1
    fi
}

# Restore files
restore_files() {
    if [ -n "$FILES_BACKUP_FILE" ] && [ -f "$FILES_BACKUP_FILE" ]; then
        log_info "Restoring files..."
        
        # Backup existing files
        if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A $UPLOADS_DIR 2>/dev/null)" ]; then
            BACKUP_UPLOADS_DIR="${UPLOADS_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
            mv "$UPLOADS_DIR" "$BACKUP_UPLOADS_DIR"
            log_info "Existing files backed up to: $BACKUP_UPLOADS_DIR"
        fi
        
        # Create uploads directory
        mkdir -p "$(dirname $UPLOADS_DIR)"
        
        # Extract files
        if tar -xzf "$FILES_BACKUP_FILE" -C "$(dirname $UPLOADS_DIR)"; then
            log_success "Files restored successfully"
        else
            log_error "Files restore failed"
            # Restore backup if available
            if [ -d "$BACKUP_UPLOADS_DIR" ]; then
                mv "$BACKUP_UPLOADS_DIR" "$UPLOADS_DIR"
                log_info "Restored original files due to restore failure"
            fi
            exit 1
        fi
    else
        log_info "No files backup to restore"
    fi
}

# Verify restore
verify_restore() {
    log_info "Verifying restore..."
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    # Check database connectivity
    if psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" >/dev/null 2>&1; then
        log_success "Database is accessible"
    else
        log_error "Database is not accessible after restore"
        exit 1
    fi
    
    # Check table count
    table_count=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
        SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
    " 2>/dev/null | tr -d ' ' || echo "0")
    
    log_info "Database contains $table_count tables"
    
    # Check files directory
    if [ -d "$UPLOADS_DIR" ]; then
        file_count=$(find "$UPLOADS_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
        log_info "Files directory contains $file_count files"
    fi
    
    log_success "Restore verification completed"
}

# Main restore function
main() {
    echo "=============================================================================="
    echo "                    YieldHarvest Restore Process Started"
    echo "                         $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=============================================================================="
    
    # Check arguments
    if [ -z "$BACKUP_TIMESTAMP" ]; then
        show_usage
        exit 1
    fi
    
    # Run restore steps
    check_environment
    test_db_connection
    download_from_s3
    verify_backup_files
    show_backup_info
    confirm_restore
    create_pre_restore_backup
    restore_database
    restore_files
    verify_restore
    
    echo ""
    log_success "🎉 Restore process completed successfully!"
    echo ""
    log_info "Restore Summary:"
    echo "  Backup timestamp: $BACKUP_TIMESTAMP"
    echo "  Source: $RESTORE_SOURCE"
    echo "  Database: Restored"
    if [ -n "$FILES_BACKUP_FILE" ]; then
        echo "  Files: Restored"
    else
        echo "  Files: Skipped (no backup available)"
    fi
    echo ""
    log_info "Important: Please verify your application functionality after restore"
}

# Handle script interruption
trap 'log_error "Restore process interrupted"; exit 1' INT TERM

# Run main function
main "$@"