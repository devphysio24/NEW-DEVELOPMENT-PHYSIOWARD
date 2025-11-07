-- Migration to add daily check-in fields to worker_schedules table
-- This allows schedules to require daily check-ins with specific time ranges
-- Run this in Supabase SQL Editor

BEGIN;

-- Add new columns for daily check-in requirement
ALTER TABLE worker_schedules 
ADD COLUMN IF NOT EXISTS requires_daily_checkin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS daily_checkin_start_time TIME,
ADD COLUMN IF NOT EXISTS daily_checkin_end_time TIME;

-- Add comment for documentation
COMMENT ON COLUMN worker_schedules.requires_daily_checkin IS 'Whether this schedule requires the worker to perform daily check-in';
COMMENT ON COLUMN worker_schedules.daily_checkin_start_time IS 'Start time for daily check-in window (required if requires_daily_checkin is true)';
COMMENT ON COLUMN worker_schedules.daily_checkin_end_time IS 'End time for daily check-in window (required if requires_daily_checkin is true)';

-- Add constraint: if requires_daily_checkin is true, both times must be provided
ALTER TABLE worker_schedules
DROP CONSTRAINT IF EXISTS check_daily_checkin_times;

ALTER TABLE worker_schedules
ADD CONSTRAINT check_daily_checkin_times 
CHECK (
  (requires_daily_checkin = false) OR 
  (requires_daily_checkin = true AND daily_checkin_start_time IS NOT NULL AND daily_checkin_end_time IS NOT NULL AND daily_checkin_end_time > daily_checkin_start_time)
);

-- Create index for queries filtering by daily check-in requirement
CREATE INDEX IF NOT EXISTS idx_worker_schedules_requires_checkin ON worker_schedules(requires_daily_checkin);

COMMIT;

-- Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'worker_schedules'
  AND column_name IN ('requires_daily_checkin', 'daily_checkin_start_time', 'daily_checkin_end_time')
ORDER BY ordinal_position;

