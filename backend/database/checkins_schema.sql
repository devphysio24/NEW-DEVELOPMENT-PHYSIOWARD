-- Daily Check-Ins and Warm-Ups Schema
-- Run this in your Supabase SQL Editor

-- Create daily_checkins table
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  pain_level INTEGER NOT NULL DEFAULT 0 CHECK (pain_level >= 0 AND pain_level <= 10),
  fatigue_level INTEGER NOT NULL DEFAULT 0 CHECK (fatigue_level >= 0 AND fatigue_level <= 10),
  sleep_quality INTEGER NOT NULL DEFAULT 0 CHECK (sleep_quality >= 0 AND sleep_quality <= 12),
  stress_level INTEGER NOT NULL DEFAULT 0 CHECK (stress_level >= 0 AND stress_level <= 10),
  additional_notes TEXT,
  predicted_readiness TEXT NOT NULL CHECK (predicted_readiness IN ('Green', 'Yellow', 'Red')),
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, check_in_date) -- One check-in per user per day
);

-- Create warm_ups table
CREATE TABLE IF NOT EXISTS warm_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  warm_up_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, warm_up_date) -- One warm-up per user per day
);

-- Create incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('incident', 'near_miss')),
  description TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  incident_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE warm_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own check-ins" ON daily_checkins;
DROP POLICY IF EXISTS "Users can create their own check-ins" ON daily_checkins;
DROP POLICY IF EXISTS "Supervisors can view team check-ins" ON daily_checkins;
DROP POLICY IF EXISTS "Service role can do everything on check-ins" ON daily_checkins;

DROP POLICY IF EXISTS "Users can view their own warm-ups" ON warm_ups;
DROP POLICY IF EXISTS "Users can create their own warm-ups" ON warm_ups;
DROP POLICY IF EXISTS "Supervisors can view team warm-ups" ON warm_ups;
DROP POLICY IF EXISTS "Service role can do everything on warm-ups" ON warm_ups;

DROP POLICY IF EXISTS "Users can view incidents" ON incidents;
DROP POLICY IF EXISTS "Users can create incidents" ON incidents;
DROP POLICY IF EXISTS "Supervisors can view team incidents" ON incidents;
DROP POLICY IF EXISTS "Service role can do everything on incidents" ON incidents;

-- Daily Check-Ins policies
CREATE POLICY "Users can view their own check-ins"
  ON daily_checkins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own check-ins"
  ON daily_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Supervisors can view team check-ins"
  ON daily_checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE tm.user_id = daily_checkins.user_id
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND u.role = 'supervisor'
      )
    ) OR
    auth.role() = 'service_role'
  );

CREATE POLICY "Service role can do everything on check-ins"
  ON daily_checkins FOR ALL
  USING (auth.role() = 'service_role');

-- Warm-Ups policies
CREATE POLICY "Users can view their own warm-ups"
  ON warm_ups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own warm-ups"
  ON warm_ups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own warm-ups"
  ON warm_ups FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Supervisors can view team warm-ups"
  ON warm_ups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      WHERE tm.user_id = warm_ups.user_id
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND u.role = 'supervisor'
      )
    ) OR
    auth.role() = 'service_role'
  );

CREATE POLICY "Service role can do everything on warm-ups"
  ON warm_ups FOR ALL
  USING (auth.role() = 'service_role');

-- Incidents policies
CREATE POLICY "Users can view incidents"
  ON incidents FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('supervisor', 'executive', 'whs_control_center')
    ) OR
    auth.role() = 'service_role'
  );

CREATE POLICY "Users can create incidents"
  ON incidents FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Supervisors can view team incidents"
  ON incidents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = incidents.team_id
      AND EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND u.role = 'supervisor'
      )
    ) OR
    auth.role() = 'service_role'
  );

CREATE POLICY "Service role can do everything on incidents"
  ON incidents FOR ALL
  USING (auth.role() = 'service_role');

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_daily_checkins_updated_at ON daily_checkins;
CREATE TRIGGER update_daily_checkins_updated_at
  BEFORE UPDATE ON daily_checkins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_warm_ups_updated_at ON warm_ups;
CREATE TRIGGER update_warm_ups_updated_at
  BEFORE UPDATE ON warm_ups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_incidents_updated_at ON incidents;
CREATE TRIGGER update_incidents_updated_at
  BEFORE UPDATE ON incidents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_id ON daily_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_team_id ON daily_checkins(team_id);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_date ON daily_checkins(check_in_date);
CREATE INDEX IF NOT EXISTS idx_warm_ups_user_id ON warm_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_warm_ups_team_id ON warm_ups(team_id);
CREATE INDEX IF NOT EXISTS idx_warm_ups_date ON warm_ups(warm_up_date);
CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_incidents_team_id ON incidents(team_id);
CREATE INDEX IF NOT EXISTS idx_incidents_date ON incidents(incident_date);

