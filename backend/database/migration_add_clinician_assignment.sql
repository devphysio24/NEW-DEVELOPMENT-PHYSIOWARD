-- Migration: Add clinician assignment to worker_exceptions
-- Allows WHS to assign cases to specific clinicians

ALTER TABLE worker_exceptions
ADD COLUMN IF NOT EXISTS clinician_id UUID REFERENCES users(id) ON DELETE SET NULL;

COMMENT ON COLUMN worker_exceptions.clinician_id IS 'Clinician assigned to handle this case. NULL if not yet assigned.';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_clinician_id ON worker_exceptions(clinician_id);

-- Update notifications type to include clinician_assigned
ALTER TABLE notifications 
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'incident_assigned', 
  'case_updated', 
  'case_closed', 
  'system',
  'worker_not_fit_to_work',
  'case_assigned_to_clinician'
));

COMMENT ON COLUMN notifications.type IS 'Type of notification: incident_assigned, case_updated, case_closed, system, worker_not_fit_to_work, case_assigned_to_clinician';

