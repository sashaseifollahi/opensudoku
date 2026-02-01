#!/bin/bash
set -e

# Sudoku Arena Database Backup Script
# Add to crontab: 0 */6 * * * /var/www/sudoku-arena/sudoku-arena/scripts/backup.sh

APP_DIR="/var/www/sudoku-arena/sudoku-arena"
BACKUP_DIR="/var/backups/sudoku-arena"
DB_FILE="$APP_DIR/data/sudoku-arena.db"
MAX_BACKUPS=30  # Keep last 30 backups

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/sudoku-arena_$TIMESTAMP.db"

# Copy database (SQLite safe copy)
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# Compress backup
gzip "$BACKUP_FILE"

echo "Backup created: ${BACKUP_FILE}.gz"

# Remove old backups (keep last MAX_BACKUPS)
cd $BACKUP_DIR
ls -t *.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm --

echo "Backup complete. Current backups:"
ls -lh $BACKUP_DIR/*.gz 2>/dev/null | tail -5
