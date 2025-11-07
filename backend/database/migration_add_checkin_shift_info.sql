-- Migration: Add shift-aware columns to daily_checkins table
-- Run this in your Supabase SQL Editor

-- Add new columns for shift information
ALTER TABLE daily_checkins 
ADD COLUMN IF NOT EXISTS check_in_time TIME,
ADD COLUMN IF NOT EXISTS shift_start_time TIME,
ADD COLUMN IF NOT EXISTS shift_end_time TIME,
ADD COLUMN IF NOT EXISTS shift_type VARCHAR(20) CHECK (shift_type IN ('morning', 'afternoon', 'night', 'flexible', NULL));

-- Add comment for documentation
COMMENT ON COLUMN daily_checkins.check_in_time IS 'Time when the check-in was submitted';
COMMENT ON COLUMN daily_checkins.shift_start_time IS 'Start time of the worker''s shift for this day';
COMMENT ON COLUMN daily_checkins.shift_end_time IS 'End time of the worker''s shift for this day';
COMMENT ON COLUMN daily_checkins.shift_type IS 'Type of shift: morning, afternoon, night, or flexible (no shift)';

-- Create index for shift-based queries
CREATE INDEX IF NOT EXISTS idx_daily_checkins_shift_type ON daily_checkins(shift_type);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_check_in_time ON daily_checkins(check_in_time);

