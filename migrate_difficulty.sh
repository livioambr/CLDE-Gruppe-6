#!/bin/bash

# Migration Script: Add max_attempts column to lobbies table
# This script adds support for difficulty levels

echo "🔧 Starting database migration..."

# Database credentials from .env or defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-hangman_game}"

# SQL commands
SQL_COMMANDS="
USE ${DB_NAME};

-- Add max_attempts column if it doesn't exist
ALTER TABLE lobbies 
ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 8 AFTER attempts_left;

-- Update existing lobbies to have max_attempts = 8 (medium difficulty)
UPDATE lobbies 
SET max_attempts = 8 
WHERE max_attempts IS NULL;

-- Make the column NOT NULL after setting defaults
ALTER TABLE lobbies 
MODIFY COLUMN max_attempts INT NOT NULL DEFAULT 8;

SELECT 'Migration completed successfully!' AS status;
"

# Execute migration
if [ -z "$DB_PASSWORD" ]; then
    # No password
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -e "$SQL_COMMANDS"
else
    # With password
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASSWORD" -e "$SQL_COMMANDS"
fi

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "📊 The max_attempts column has been added to the lobbies table."
else
    echo "❌ Migration failed. Please check your database credentials."
    exit 1
fi
