-- Migration: Add return to work fields to worker_exceptions table
-- Adds return_to_work_duty_type and return_to_work_date columns

-- Add return_to_work_duty_type column (VARCHAR, can be 'modified' or 'full')
ALTER TABLE worker_exceptions
ADD COLUMN IF NOT EXISTS return_to_work_duty_type VARCHAR(20);

-- Add return_to_work_date column (DATE)
ALTER TABLE worker_exceptions
ADD COLUMN IF NOT EXISTS return_to_work_date DATE;

-- Add comment to columns
COMMENT ON COLUMN worker_exceptions.return_to_work_duty_type IS 'Type of duty when returning to work: modified or full';
COMMENT ON COLUMN worker_exceptions.return_to_work_date IS 'Date when worker returns to work';

-- OPTIMIZATION: Add index on return_to_work_date for faster queries when filtering by return date
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_return_to_work_date 
ON worker_exceptions(return_to_work_date) 
WHERE return_to_work_date IS NOT NULL;

-- OPTIMIZATION: Add index on return_to_work_duty_type for faster queries when filtering by duty type
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_return_to_work_duty_type 
ON worker_exceptions(return_to_work_duty_type) 
WHERE return_to_work_duty_type IS NOT NULL;

