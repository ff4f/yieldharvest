FROM alpine:3.18

# Install required packages
RUN apk add --no-cache \
    postgresql-client \
    aws-cli \
    curl \
    bash \
    dcron \
    tzdata \
    && rm -rf /var/cache/apk/*

# Create backup user
RUN addgroup -g 1001 -S backup && \
    adduser -S backup -u 1001 -G backup

# Set working directory
WORKDIR /app

# Copy backup scripts
COPY backup.sh /app/backup.sh
COPY restore.sh /app/restore.sh
COPY entrypoint.sh /app/entrypoint.sh

# Make scripts executable
RUN chmod +x /app/*.sh

# Create backup directory
RUN mkdir -p /backups && \
    chown -R backup:backup /backups /app

# Switch to backup user
USER backup

# Set timezone
ENV TZ=UTC

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD test -f /tmp/backup_healthy || exit 1

# Entry point
ENTRYPOINT ["/app/entrypoint.sh"]