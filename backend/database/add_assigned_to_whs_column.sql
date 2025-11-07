-- Add assigned_to_whs column to worker_exceptions table
-- This tracks whether an incident has been assigned/approved by supervisor for WHS review

ALTER TABLE worker_exceptions 
ADD COLUMN IF NOT EXISTS assigned_to_whs BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster lookups on assigned_to_whsQ
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_assigned_to_whs 
ON worker_exceptions(assigned_to_whs) 
WHERE assigned_to_whs = true;

-- Add comment
COMMENT ON COLUMN worker_exceptions.assigned_to_whs IS 'Whether the incident has been assigned to WHS by supervisor for review';

