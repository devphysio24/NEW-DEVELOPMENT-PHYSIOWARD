-- Create notifications table for WHS notification system
-- Tracks notifications sent to WHS when supervisors assign incidents

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('incident_assigned', 'case_updated', 'case_closed', 'system')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional data like incident_id, case_number, etc.
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE notifications IS 'Stores notifications for users, primarily WHS notifications when incidents are assigned';
COMMENT ON COLUMN notifications.type IS 'Type of notification: incident_assigned, case_updated, case_closed, system';
COMMENT ON COLUMN notifications.data IS 'Additional JSON data like incident_id, case_number, supervisor_name, etc.';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read';
COMMENT ON COLUMN notifications.read_at IS 'Timestamp when notification was read';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Service role can do everything
CREATE POLICY "Service role can do everything on notifications"
  ON notifications FOR ALL
  USING (auth.role() = 'service_role');

