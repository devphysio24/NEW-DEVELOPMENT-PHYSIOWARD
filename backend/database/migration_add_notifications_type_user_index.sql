-- Migration: Add composite index for notifications type + user_id queries
-- Optimizes queries for case_assigned_to_clinician notifications by clinician
-- This significantly improves performance for clinician performance endpoint

CREATE INDEX IF NOT EXISTS idx_notifications_type_user_id 
ON notifications(type, user_id)
WHERE type = 'case_assigned_to_clinician';

COMMENT ON INDEX idx_notifications_type_user_id IS 'Composite index for efficient lookups of case_assigned_to_clinician notifications by user_id';

