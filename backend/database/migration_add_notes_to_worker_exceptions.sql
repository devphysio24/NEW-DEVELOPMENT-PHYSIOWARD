-- Migration: Add notes column to worker_exceptions table
-- This allows storing additional case information including case_status

ALTER TABLE worker_exceptions
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN worker_exceptions.notes IS 'Additional notes and metadata for the case, can store JSON data including case_status';

-- Add index for faster lookups on notes (useful if we need to search by case status)
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_notes 
ON worker_exceptions(notes)
WHERE notes IS NOT NULL;

