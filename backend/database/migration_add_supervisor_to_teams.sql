-- Migration: Add supervisor_id to teams table
-- This links teams to supervisors, allowing supervisors to see workers from teams under them

-- Step 1: Add supervisor_id column to teams table (nullable initially for existing teams)
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_supervisor_id ON teams(supervisor_id);

-- Step 3: Update RLS policies to allow supervisors to view teams assigned to them
DROP POLICY IF EXISTS "Supervisors can view their assigned teams" ON teams;
CREATE POLICY "Supervisors can view their assigned teams"
  ON teams FOR SELECT
  USING (
    auth.uid() = supervisor_id OR
    auth.uid() = team_leader_id OR
    auth.role() = 'service_role'
  );

-- Step 4: Update team_members RLS to allow supervisors to view members of their teams
DROP POLICY IF EXISTS "Supervisors can view members of their teams" ON team_members;
CREATE POLICY "Supervisors can view members of their teams"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = team_members.team_id 
      AND teams.supervisor_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = team_members.team_id 
      AND teams.team_leader_id = auth.uid()
    ) OR
    auth.role() = 'service_role'
  );

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'teams' 
  AND column_name = 'supervisor_id';

