-- Teams and Team Members Schema
-- Run this in your Supabase SQL Editor after users table exists

-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  site_location TEXT,
  team_leader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_leader_id) -- One team per team leader
);

-- Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compliance_percentage INTEGER DEFAULT 100 CHECK (compliance_percentage >= 0 AND compliance_percentage <= 100),
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id) -- One member per team
);

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Team leaders can view their own teams" ON teams;
DROP POLICY IF EXISTS "Team leaders can manage their own teams" ON teams;
DROP POLICY IF EXISTS "Service role can do everything on teams" ON teams;

DROP POLICY IF EXISTS "Team leaders can view their team members" ON team_members;
DROP POLICY IF EXISTS "Team leaders can manage their team members" ON team_members;
DROP POLICY IF EXISTS "Service role can do everything on team_members" ON team_members;

-- Teams policies
-- Team leaders can view their own teams
CREATE POLICY "Team leaders can view their own teams"
  ON teams FOR SELECT
  USING (
    auth.uid() = team_leader_id OR
    auth.role() = 'service_role'
  );

-- Team leaders can manage their own teams
CREATE POLICY "Team leaders can manage their own teams"
  ON teams FOR ALL
  USING (auth.uid() = team_leader_id)
  WITH CHECK (auth.uid() = team_leader_id);

-- Service role can do everything
CREATE POLICY "Service role can do everything on teams"
  ON teams FOR ALL
  USING (auth.role() = 'service_role');

-- Team members policies
-- Team leaders can view their team members
CREATE POLICY "Team leaders can view their team members"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = team_members.team_id 
      AND teams.team_leader_id = auth.uid()
    ) OR
    auth.role() = 'service_role'
  );

-- Team leaders can manage their team members
CREATE POLICY "Team leaders can manage their team members"
  ON team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = team_members.team_id 
      AND teams.team_leader_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams 
      WHERE teams.id = team_members.team_id 
      AND teams.team_leader_id = auth.uid()
    )
  );

-- Service role can do everything
CREATE POLICY "Service role can do everything on team_members"
  ON team_members FOR ALL
  USING (auth.role() = 'service_role');

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_members_updated_at ON team_members;
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_team_leader_id ON teams(team_leader_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);

-- Add phone and full_name to users table if not exists (optional enhancement)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'full_name') THEN
    ALTER TABLE users ADD COLUMN full_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'phone') THEN
    ALTER TABLE users ADD COLUMN phone TEXT;
  END IF;
END $$;

