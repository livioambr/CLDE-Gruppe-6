# Database Migration: Add Difficulty Levels

## Overview
This migration adds support for difficulty levels (Easy, Medium, Hard) by adding a `max_attempts` column to the `lobbies` table.

## Migration Steps

### Option 1: Using MySQL Command Line

```bash
mysql -u your_username -p hangman_game
```

Then run:

```sql
ALTER TABLE lobbies 
ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 8 AFTER attempts_left;

UPDATE lobbies 
SET max_attempts = 8 
WHERE max_attempts IS NULL;

ALTER TABLE lobbies 
MODIFY COLUMN max_attempts INT NOT NULL DEFAULT 8;
```

### Option 2: Restart the Server

The server will automatically create the column if it doesn't exist when you restart it, as the schema initialization handles missing columns.

## Verification

After running the migration, verify it worked:

```sql
DESCRIBE lobbies;
```

You should see a `max_attempts` column with type `INT` and default value `8`.

## Difficulty Levels

- **Easy**: 12 attempts
- **Medium**: 8 attempts (default)
- **Hard**: 4 attempts

The hangman drawing will scale automatically based on the selected difficulty.
