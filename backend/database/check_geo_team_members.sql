-- Check team members data for geo@gmail.com
-- Run this in Supabase SQL Editor to diagnose the issue

-- First, find the user_id for geo@gmail.com
SELECT id, email, first_name, last_name, full_name, role
FROM users
WHERE email = 'geo@gmail.com';

-- Find the team for this user (if they're a team leader)
SELECT id, name, team_leader_id
FROM teams
WHERE team_leader_id = (SELECT id FROM users WHERE email = 'geo@gmail.com');

-- Find all team members for geo@gmail.com's team (including user details)
SELECT 
  tm.id as team_member_id,
  tm.team_id,
  tm.user_id,
  tm.compliance_percentage,
  tm.phone,
  u.id as user_table_id,
  u.email,
  u.first_name,
  u.last_name,
  u.full_name,
  u.role
FROM team_members tm
JOIN users u ON tm.user_id = u.id
WHERE tm.team_id = (
  SELECT id FROM teams 
  WHERE team_leader_id = (SELECT id FROM users WHERE email = 'geo@gmail.com')
);

-- Check if team members have first_name and last_name
SELECT 
  tm.id,
  u.email,
  u.first_name,
  u.last_name,
  u.full_name,
  CASE 
    WHEN u.first_name IS NULL OR u.first_name = '' THEN 'MISSING FIRST NAME'
    WHEN u.last_name IS NULL OR u.last_name = '' THEN 'MISSING LAST NAME'
    ELSE 'HAS BOTH NAMES'
  END as name_status
FROM team_members tm
JOIN users u ON tm.user_id = u.id
WHERE tm.team_id = (
  SELECT id FROM teams 
  WHERE team_leader_id = (SELECT id FROM users WHERE email = 'geo@gmail.com')
);

