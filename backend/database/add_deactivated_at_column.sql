-- Add deactivated_at column to worker_exceptions table
-- This tracks when an exception was deactivated/removed for historical analytics accuracy

ALTER TABLE worker_exceptions
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster lookups on deactivated_at
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_deactivated_at
ON worker_exceptions(deactivated_at)
WHERE deactivated_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN worker_exceptions.deactivated_at IS 'Timestamp when the exception was deactivated/removed. NULL if still active or never deactivated.';

-- Update existing inactive exceptions to have deactivated_at = updated_at if updated_at exists and is_active = false
-- This ensures historical accuracy for existing data
UPDATE worker_exceptions
SET deactivated_at = updated_at
WHERE is_active = false 
  AND deactivated_at IS NULL 
  AND updated_at IS NOT NULL;

