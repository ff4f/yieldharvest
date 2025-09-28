#!/bin/bash
set -e

# =============================================================================
# YieldHarvest Backup Script
# =============================================================================
# This script creates backups of the PostgreSQL database and uploaded files
# and optionally uploads them to AWS S3 for long-term storage.
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
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Generate timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE=$(date +"%Y-%m-%d")

# Backup file names
DB_BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"
FILES_BACKUP_FILE="${BACKUP_DIR}/files_backup_${TIMESTAMP}.tar.gz"
METADATA_FILE="${BACKUP_DIR}/backup_metadata_${TIMESTAMP}.json"

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

# Check if required environment variables are set
check_environment() {
    log_info "Checking environment variables..."
    
    if [ -z "$POSTGRES_PASSWORD" ]; then
        log_error "POSTGRES_PASSWORD is not set"
        exit 1
    fi
    
    log_success "Environment check passed"
}

# Test database connection
test_db_connection() {
    log_info "Testing database connection..."
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to database"
        exit 1
    fi
}

# Create database backup
backup_database() {
    log_info "Creating database backup..."
    
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    # Create database dump with compression
    if pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
        --verbose --clean --if-exists --create --format=plain \
        | gzip > "$DB_BACKUP_FILE"; then
        
        # Get file size
        DB_SIZE=$(stat -c%s "$DB_BACKUP_FILE" 2>/dev/null || stat -f%z "$DB_BACKUP_FILE" 2>/dev/null || echo "unknown")
        
        log_success "Database backup created: $DB_BACKUP_FILE (Size: $DB_SIZE bytes)"
    else
        log_error "Database backup failed"
        exit 1
    fi
}

# Create files backup
backup_files() {
    log_info "Creating files backup..."
    
    if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A $UPLOADS_DIR 2>/dev/null)" ]; then
        if tar -czf "$FILES_BACKUP_FILE" -C "$(dirname $UPLOADS_DIR)" "$(basename $UPLOADS_DIR)"; then
            
            # Get file size
            FILES_SIZE=$(stat -c%s "$FILES_BACKUP_FILE" 2>/dev/null || stat -f%z "$FILES_BACKUP_FILE" 2>/dev/null || echo "unknown")
            
            log_success "Files backup created: $FILES_BACKUP_FILE (Size: $FILES_SIZE bytes)"
        else
            log_error "Files backup failed"
            exit 1
        fi
    else
        log_warning "No files to backup in $UPLOADS_DIR"
        FILES_SIZE="0"
    fi
}

# Create backup metadata
create_metadata() {
    log_info "Creating backup metadata..."
    
    # Get database statistics
    export PGPASSWORD="$POSTGRES_PASSWORD"
    
    DB_STATS=$(psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "
        SELECT json_build_object(
            'total_tables', COUNT(*),
            'total_size', pg_size_pretty(pg_database_size('$POSTGRES_DB'))
        )
        FROM information_schema.tables 
        WHERE table_schema = 'public';
    " 2>/dev/null || echo '{"total_tables": "unknown", "total_size": "unknown"}')
    
    # Create metadata JSON
    cat > "$METADATA_FILE" << EOF
{
    "backup_timestamp": "$TIMESTAMP",
    "backup_date": "$DATE",
    "backup_type": "full",
    "database": {
        "host": "$POSTGRES_HOST",
        "port": $POSTGRES_PORT,
        "database": "$POSTGRES_DB",
        "user": "$POSTGRES_USER",
        "backup_file": "$(basename $DB_BACKUP_FILE)",
        "backup_size": "$DB_SIZE",
        "statistics": $DB_STATS
    },
    "files": {
        "source_directory": "$UPLOADS_DIR",
        "backup_file": "$(basename $FILES_BACKUP_FILE)",
        "backup_size": "$FILES_SIZE"
    },
    "environment": {
        "hostname": "$(hostname)",
        "backup_script_version": "1.0.0",
        "retention_days": $RETENTION_DAYS
    }
}
EOF
    
    log_success "Metadata created: $METADATA_FILE"
}

# Upload to S3 (if configured)
upload_to_s3() {
    if [ -n "$S3_BUCKET" ]; then
        log_info "Uploading backups to S3..."
        
        # Check AWS CLI availability
        if ! command -v aws &> /dev/null; then
            log_warning "AWS CLI not available, skipping S3 upload"
            return
        fi
        
        # Upload files
        S3_PREFIX="yieldharvest-backups/$DATE"
        
        for file in "$DB_BACKUP_FILE" "$FILES_BACKUP_FILE" "$METADATA_FILE"; do
            if [ -f "$file" ]; then
                filename=$(basename "$file")
                s3_path="s3://$S3_BUCKET/$S3_PREFIX/$filename"
                
                if aws s3 cp "$file" "$s3_path" --region "$AWS_REGION"; then
                    log_success "Uploaded: $filename -> $s3_path"
                else
                    log_error "Failed to upload: $filename"
                fi
            fi
        done
        
        log_success "S3 upload completed"
    else
        log_info "S3_BUCKET not configured, skipping S3 upload"
    fi
}

# Clean old backups
cleanup_old_backups() {
    log_info "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    # Local cleanup
    if [ -d "$BACKUP_DIR" ]; then
        find "$BACKUP_DIR" -name "*_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
        find "$BACKUP_DIR" -name "*_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
        find "$BACKUP_DIR" -name "backup_metadata_*.json" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
        
        log_success "Local cleanup completed"
    fi
    
    # S3 cleanup (if configured)
    if [ -n "$S3_BUCKET" ] && command -v aws &> /dev/null; then
        log_info "Cleaning up old S3 backups..."
        
        # Calculate cutoff date
        cutoff_date=$(date -d "$RETENTION_DAYS days ago" +"%Y-%m-%d" 2>/dev/null || date -v-${RETENTION_DAYS}d +"%Y-%m-%d" 2>/dev/null || echo "")
        
        if [ -n "$cutoff_date" ]; then
            # List and delete old objects
            aws s3 ls "s3://$S3_BUCKET/yieldharvest-backups/" --recursive --region "$AWS_REGION" | \
            while read -r line; do
                # Extract date and key from S3 ls output
                backup_date=$(echo "$line" | awk '{print $1}')
                key=$(echo "$line" | awk '{print $4}')
                
                if [ "$backup_date" \< "$cutoff_date" ]; then
                    aws s3 rm "s3://$S3_BUCKET/$key" --region "$AWS_REGION" && \
                    log_info "Deleted old S3 backup: $key"
                fi
            done
        fi
        
        log_success "S3 cleanup completed"
    fi
}

# Verify backup integrity
verify_backup() {
    log_info "Verifying backup integrity..."
    
    # Verify database backup
    if [ -f "$DB_BACKUP_FILE" ]; then
        if gzip -t "$DB_BACKUP_FILE" 2>/dev/null; then
            log_success "Database backup integrity verified"
        else
            log_error "Database backup is corrupted"
            exit 1
        fi
    fi
    
    # Verify files backup
    if [ -f "$FILES_BACKUP_FILE" ]; then
        if tar -tzf "$FILES_BACKUP_FILE" >/dev/null 2>&1; then
            log_success "Files backup integrity verified"
        else
            log_error "Files backup is corrupted"
            exit 1
        fi
    fi
    
    # Verify metadata
    if [ -f "$METADATA_FILE" ]; then
        if python3 -m json.tool "$METADATA_FILE" >/dev/null 2>&1; then
            log_success "Metadata file is valid JSON"
        else
            log_warning "Metadata file is not valid JSON"
        fi
    fi
}

# Update health check file
update_health_check() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup completed successfully" > /tmp/backup_healthy
}

# Main backup function
main() {
    echo "=============================================================================="
    echo "                    YieldHarvest Backup Process Started"
    echo "                         $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=============================================================================="
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Run backup steps
    check_environment
    test_db_connection
    backup_database
    backup_files
    create_metadata
    verify_backup
    upload_to_s3
    cleanup_old_backups
    update_health_check
    
    echo ""
    log_success "🎉 Backup process completed successfully!"
    echo ""
    log_info "Backup Summary:"
    echo "  Database backup: $(basename $DB_BACKUP_FILE)"
    echo "  Files backup: $(basename $FILES_BACKUP_FILE)"
    echo "  Metadata: $(basename $METADATA_FILE)"
    echo "  Location: $BACKUP_DIR"
    if [ -n "$S3_BUCKET" ]; then
        echo "  S3 Bucket: s3://$S3_BUCKET/yieldharvest-backups/$DATE/"
    fi
    echo ""
}

# Handle script interruption
trap 'log_error "Backup process interrupted"; exit 1' INT TERM

# Run main function
main "$@"