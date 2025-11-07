-- Migration to add recurring schedule pattern support to worker_schedules table
-- This allows creating one schedule record for recurring patterns (e.g., Mon-Fri)
-- instead of creating individual records for each date
-- Run this in Supabase SQL Editor

BEGIN;

-- Add columns for recurring schedule patterns
ALTER TABLE worker_schedules 
ADD COLUMN IF NOT EXISTS day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
ADD COLUMN IF NOT EXISTS effective_date DATE,
ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Make scheduled_date nullable (required only for single-date schedules)
-- First, we need to drop the NOT NULL constraint if it exists
-- Note: PostgreSQL doesn't allow direct ALTER COLUMN ... DROP NOT NULL if constraint is named
-- So we use ALTER COLUMN to set it nullable
ALTER TABLE worker_schedules
ALTER COLUMN scheduled_date DROP NOT NULL;

-- Drop existing check constraint if it exists
ALTER TABLE worker_schedules
DROP CONSTRAINT IF EXISTS check_schedule_date_or_day;

ALTER TABLE worker_schedules
ADD CONSTRAINT check_schedule_date_or_day 
CHECK (
  (scheduled_date IS NOT NULL AND day_of_week IS NULL) OR
  (scheduled_date IS NULL AND day_of_week IS NOT NULL)
);

-- Update unique constraint to support both modes
-- For single-date schedules: unique per worker, date, and start_time
-- For recurring schedules: unique per worker, day_of_week, and start_time
-- Try to drop the unique constraint (it might have different names)
ALTER TABLE worker_schedules
DROP CONSTRAINT IF EXISTS worker_schedules_worker_id_scheduled_date_start_time_key;

-- Also try common auto-generated constraint names
DO $$ 
BEGIN
  -- Drop unique constraint if it exists with auto-generated name
  EXECUTE (
    SELECT 'ALTER TABLE worker_schedules DROP CONSTRAINT IF EXISTS ' || 
           constraint_name || ';'
    FROM information_schema.table_constraints 
    WHERE table_name = 'worker_schedules' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%worker_id%'
      AND constraint_name LIKE '%scheduled_date%'
    LIMIT 1
  );
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore if constraint doesn't exist
END $$;

-- Create separate unique constraints for each mode
CREATE UNIQUE INDEX IF NOT EXISTS worker_schedules_unique_single_date 
ON worker_schedules(worker_id, scheduled_date, start_time) 
WHERE scheduled_date IS NOT NULL AND day_of_week IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS worker_schedules_unique_recurring 
ON worker_schedules(worker_id, day_of_week, start_time) 
WHERE day_of_week IS NOT NULL AND scheduled_date IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN worker_schedules.day_of_week IS 'Day of week for recurring schedules (0=Sunday, 1=Monday, ..., 6=Saturday). NULL for single-date schedules.';
COMMENT ON COLUMN worker_schedules.effective_date IS 'Start date for recurring schedule pattern';
COMMENT ON COLUMN worker_schedules.expiry_date IS 'End date for recurring schedule pattern';

-- Create index for recurring pattern queries
CREATE INDEX IF NOT EXISTS idx_worker_schedules_day_of_week ON worker_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_worker_schedules_effective_date ON worker_schedules(effective_date);
CREATE INDEX IF NOT EXISTS idx_worker_schedules_expiry_date ON worker_schedules(expiry_date);

COMMIT;

-- Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'worker_schedules'
  AND column_name IN ('day_of_week', 'effective_date', 'expiry_date')
ORDER BY ordinal_position;

