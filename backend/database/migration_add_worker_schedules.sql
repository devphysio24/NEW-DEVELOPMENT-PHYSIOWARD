-- Migration to add worker_schedules table
-- Team Leaders can create schedules for their workers
-- Run this in Supabase SQL Editor

BEGIN;

-- Create worker_schedules table
CREATE TABLE IF NOT EXISTS worker_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL, -- Specific date, not just day of week
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  check_in_window_start TIME, -- Optional: custom check-in window start
  check_in_window_end TIME,   -- Optional: custom check-in window end
  project_id UUID, -- Optional: which project this schedule is for
  created_by UUID NOT NULL REFERENCES users(id), -- Team leader who created it
  approved_by UUID REFERENCES users(id), -- Supervisor (optional approval)
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (end_time > start_time), -- Ensure end time is after start time
  UNIQUE(worker_id, scheduled_date, start_time) -- One schedule per worker per date/time
);

-- Enable Row Level Security
ALTER TABLE worker_schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Team leaders can view worker schedules in their team" ON worker_schedules;
DROP POLICY IF EXISTS "Team leaders can manage worker schedules in their team" ON worker_schedules;
DROP POLICY IF EXISTS "Workers can view their own schedules" ON worker_schedules;
DROP POLICY IF EXISTS "Supervisors can view worker schedules in their teams" ON worker_schedules;
DROP POLICY IF EXISTS "Service role can do everything on worker schedules" ON worker_schedules;

-- Policies

-- Workers can view their own schedules
CREATE POLICY "Workers can view their own schedules"
  ON worker_schedules FOR SELECT
  USING (auth.uid() = worker_id);

-- Team leaders can view worker schedules in their team
CREATE POLICY "Team leaders can view worker schedules in their team"
  ON worker_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = worker_schedules.team_id
      AND teams.team_leader_id = auth.uid()
    ) OR
    auth.role() = 'service_role'
  );

-- Team leaders can manage (INSERT/UPDATE/DELETE) worker schedules in their team
CREATE POLICY "Team leaders can manage worker schedules in their team"
  ON worker_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = worker_schedules.team_id
      AND teams.team_leader_id = auth.uid()
    ) OR
    auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = worker_schedules.team_id
      AND teams.team_leader_id = auth.uid()
    ) OR
    auth.role() = 'service_role'
  );

-- Supervisors can view worker schedules in their teams
CREATE POLICY "Supervisors can view worker schedules in their teams"
  ON worker_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = worker_schedules.team_id
      AND teams.supervisor_id = auth.uid()
    ) OR
    auth.role() = 'service_role'
  );

-- Service role can do everything
CREATE POLICY "Service role can do everything on worker schedules"
  ON worker_schedules FOR ALL
  USING (auth.role() = 'service_role');

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_worker_schedules_updated_at ON worker_schedules;
CREATE TRIGGER update_worker_schedules_updated_at
  BEFORE UPDATE ON worker_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_worker_schedules_worker_id ON worker_schedules(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_schedules_team_id ON worker_schedules(team_id);
CREATE INDEX IF NOT EXISTS idx_worker_schedules_date ON worker_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_worker_schedules_active ON worker_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_worker_schedules_worker_date ON worker_schedules(worker_id, scheduled_date, is_active);
CREATE INDEX IF NOT EXISTS idx_worker_schedules_created_by ON worker_schedules(created_by);

COMMIT;

-- Verify the table was created
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'worker_schedules'
ORDER BY ordinal_position;

