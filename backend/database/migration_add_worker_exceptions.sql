-- Migration: Add worker_exceptions table for managing worker exceptions (transfer, accident, etc.)
-- This allows team leaders to exempt workers from daily check-in requirements

CREATE TABLE IF NOT EXISTS worker_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  exception_type VARCHAR(50) NOT NULL CHECK (exception_type IN ('transfer', 'accident', 'injury', 'medical_leave', 'other')),
  reason TEXT,
  start_date DATE NOT NULL,
  end_date DATE, -- NULL means indefinite until manually removed
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL, -- Team leader who created the exception
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE worker_exceptions IS 'Stores exceptions for workers that exempt them from daily check-in requirements';
COMMENT ON COLUMN worker_exceptions.exception_type IS 'Type of exception: transfer, accident, injury, medical_leave, other';
COMMENT ON COLUMN worker_exceptions.reason IS 'Optional detailed reason for the exception';
COMMENT ON COLUMN worker_exceptions.start_date IS 'Date when exception starts';
COMMENT ON COLUMN worker_exceptions.end_date IS 'Date when exception ends (NULL = indefinite)';
COMMENT ON COLUMN worker_exceptions.is_active IS 'Whether the exception is currently active';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_user_id ON worker_exceptions(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_team_id ON worker_exceptions(team_id);
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_is_active ON worker_exceptions(is_active);
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_dates ON worker_exceptions(start_date, end_date);

-- Ensure one active exception per user at a time (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_exceptions_unique_active 
  ON worker_exceptions(user_id) 
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE worker_exceptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Team leaders can view exceptions for their team members
CREATE POLICY "Team leaders can view exceptions for their team"
  ON worker_exceptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = worker_exceptions.team_id 
      AND teams.team_leader_id = auth.uid()
    ) OR
    auth.uid() = user_id OR
    auth.role() = 'service_role'
  );

-- Team leaders can manage exceptions for their team members
CREATE POLICY "Team leaders can manage exceptions for their team"
  ON worker_exceptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = worker_exceptions.team_id 
      AND teams.team_leader_id = auth.uid()
    ) OR
    auth.role() = 'service_role'
  );

-- Workers can view their own exceptions
CREATE POLICY "Workers can view their own exceptions"
  ON worker_exceptions FOR SELECT
  USING (
    auth.uid() = user_id OR
    auth.role() = 'service_role'
  );

-- Service role can do everything
CREATE POLICY "Service role can do everything on worker_exceptions"
  ON worker_exceptions FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_worker_exceptions_updated_at
  BEFORE UPDATE ON worker_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically deactivate expired exceptions (optional - can be run via cron)
CREATE OR REPLACE FUNCTION deactivate_expired_exceptions()
RETURNS void AS $$
BEGIN
  UPDATE worker_exceptions
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

