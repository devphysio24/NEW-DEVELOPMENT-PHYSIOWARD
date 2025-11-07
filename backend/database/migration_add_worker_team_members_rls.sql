-- Migration: Add RLS policy to allow workers to view their own team_members record
-- This fixes the "No team assigned" issue for workers who have team_id

-- Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Workers can view their own team membership" ON team_members;

-- Add policy to allow workers to view their own team_members record
CREATE POLICY "Workers can view their own team membership"
  ON team_members FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = team_members.team_id 
      AND teams.team_leader_id = auth.uid()
    ) OR
    auth.role() = 'service_role'
  );

-- Verify the policy was created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'team_members' 
  AND policyname = 'Workers can view their own team membership';

