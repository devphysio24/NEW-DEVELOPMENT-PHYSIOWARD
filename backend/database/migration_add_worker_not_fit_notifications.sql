-- Migration to add 'worker_not_fit_to_work' notification type
-- This allows Team Leaders to be notified when workers submit "Not fit to work" (Red) check-ins
-- Run this in Supabase SQL Editor

BEGIN;

-- Drop the existing CHECK constraint
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with additional notification type
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'incident_assigned', 
  'case_updated', 
  'case_closed', 
  'system',
  'worker_not_fit_to_work'
));

-- Update comment
COMMENT ON COLUMN notifications.type IS 'Type of notification: incident_assigned, case_updated, case_closed, system, worker_not_fit_to_work';

COMMIT;

-- Verify the constraint (optional - remove if not needed)
SELECT 
  constraint_name,
  check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'notifications_type_check';

