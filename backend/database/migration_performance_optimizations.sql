-- Performance Optimization Migration
-- Adds comprehensive indexes for frequently queried tables and columns
-- Improves query performance for analytics, check-ins, schedules, and exceptions

BEGIN;

-- ============================================
-- Daily Check-Ins Optimizations
-- ============================================

-- Composite index for user_id + check_in_date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date 
ON daily_checkins(user_id, check_in_date DESC);

-- Composite index for team_id + check_in_date (for team analytics)
CREATE INDEX IF NOT EXISTS idx_daily_checkins_team_date 
ON daily_checkins(team_id, check_in_date DESC);

-- Index for date range queries (analytics)
CREATE INDEX IF NOT EXISTS idx_daily_checkins_date_range 
ON daily_checkins(check_in_date DESC, created_at DESC);

-- Composite index for user_id + date + readiness (worker stats)
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date_readiness 
ON daily_checkins(user_id, check_in_date DESC, predicted_readiness);

-- Index for analytics queries filtering by readiness
CREATE INDEX IF NOT EXISTS idx_daily_checkins_readiness_date 
ON daily_checkins(predicted_readiness, check_in_date DESC);

-- ============================================
-- Worker Schedules Optimizations
-- ============================================

-- Composite index for recurring schedule lookups (day_of_week + date range)
CREATE INDEX IF NOT EXISTS idx_worker_schedules_recurring_lookup 
ON worker_schedules(worker_id, day_of_week, effective_date, expiry_date, is_active)
WHERE day_of_week IS NOT NULL;

-- Composite index for date range queries on scheduled_date
CREATE INDEX IF NOT EXISTS idx_worker_schedules_date_active 
ON worker_schedules(scheduled_date DESC, is_active)
WHERE scheduled_date IS NOT NULL;

-- Composite index for team analytics (team_id + date ranges)
CREATE INDEX IF NOT EXISTS idx_worker_schedules_team_active 
ON worker_schedules(team_id, is_active, scheduled_date, day_of_week);

-- Index for effective_date queries (recurring schedules)
CREATE INDEX IF NOT EXISTS idx_worker_schedules_effective 
ON worker_schedules(effective_date, expiry_date, day_of_week, is_active);

-- Partial index for active recurring schedules only
CREATE INDEX IF NOT EXISTS idx_worker_schedules_active_recurring 
ON worker_schedules(worker_id, day_of_week, effective_date)
WHERE is_active = true AND day_of_week IS NOT NULL;

-- ============================================
-- Worker Exceptions Optimizations
-- ============================================

-- Composite index for date range queries (most common)
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_date_range 
ON worker_exceptions(start_date, end_date, is_active);

-- Index for active exceptions lookup (frequently queried)
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_active_user 
ON worker_exceptions(user_id, is_active, start_date, end_date)
WHERE is_active = true;

-- Composite index for team leader exception queries
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_team_active 
ON worker_exceptions(team_id, is_active, exception_type, start_date);

-- Index for exception type filtering
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_type_date 
ON worker_exceptions(exception_type, is_active, start_date DESC);

-- Index for WHS assigned cases
CREATE INDEX IF NOT EXISTS idx_worker_exceptions_whs_assigned 
ON worker_exceptions(assigned_to_whs, is_active, created_at DESC)
WHERE assigned_to_whs = true;

-- ============================================
-- Team Members Optimizations
-- ============================================

-- Index for team_id lookups (very frequent)
CREATE INDEX IF NOT EXISTS idx_team_members_team_user 
ON team_members(team_id, user_id);

-- Index for reverse lookup (user_id -> team_id)
CREATE INDEX IF NOT EXISTS idx_team_members_user_team 
ON team_members(user_id, team_id);

-- ============================================
-- Warm-ups Optimizations
-- ============================================

-- Composite index for user_id + date (daily lookups)
CREATE INDEX IF NOT EXISTS idx_warm_ups_user_date 
ON warm_ups(user_id, warm_up_date DESC);

-- Index for team analytics
CREATE INDEX IF NOT EXISTS idx_warm_ups_team_date 
ON warm_ups(team_id, warm_up_date DESC);

-- ============================================
-- Incidents Optimizations
-- ============================================

-- Composite index for date + type queries
CREATE INDEX IF NOT EXISTS idx_incidents_date_type 
ON incidents(incident_date DESC, incident_type);

-- Index for team analytics
CREATE INDEX IF NOT EXISTS idx_incidents_team_date 
ON incidents(team_id, incident_date DESC);

-- ============================================
-- Users Optimizations
-- ============================================

-- Index for email lookups (if not already exists)
CREATE INDEX IF NOT EXISTS idx_users_email 
ON users(email);

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role 
ON users(role);

-- ============================================
-- Teams Optimizations
-- ============================================

-- Index for team_leader_id lookups (very frequent)
CREATE INDEX IF NOT EXISTS idx_teams_leader_id 
ON teams(team_leader_id);

-- Index for supervisor_id lookups
CREATE INDEX IF NOT EXISTS idx_teams_supervisor_id 
ON teams(supervisor_id);

-- ============================================
-- Login Logs Optimizations (if exists)
-- ============================================

-- Composite index for user_id + date (if login_logs table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'login_logs') THEN
    CREATE INDEX IF NOT EXISTS idx_login_logs_user_login_at 
    ON login_logs(user_id, login_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_login_logs_role_login_at 
    ON login_logs(role, login_at DESC);
  END IF;
END $$;

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================

-- Check all indexes created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'daily_checkins',
  'worker_schedules',
  'worker_exceptions',
  'team_members',
  'warm_ups',
  'incidents',
  'users',
  'teams'
)
AND schemaname = 'public'
ORDER BY tablename, indexname;

