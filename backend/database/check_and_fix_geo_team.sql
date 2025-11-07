-- Check and fix team members for geo@gmail.com
-- Run this in Supabase SQL Editor

-- First, find geo@gmail.com's user_id and team_id
SELECT 
  u.id as user_id,
  u.email,
  u.role,
  t.id as team_id,
  t.name as team_name
FROM users u
LEFT JOIN teams t ON t.team_leader_id = u.id
WHERE u.email = 'geo@gmail.com';

-- Check all team_members for geo@gmail.com's team
SELECT 
  tm.id as team_member_id,
  tm.user_id,
  tm.team_id,
  tm.compliance_percentage,
  tm.phone,
  CASE 
    WHEN u.id IS NULL THEN '❌ ORPHANED - No user record'
    ELSE '✅ OK - Has user record'
  END as status,
  u.email as user_email,
  u.first_name,
  u.last_name,
  u.full_name
FROM team_members tm
LEFT JOIN users u ON tm.user_id = u.id
WHERE tm.team_id = (
  SELECT t.id FROM teams t
  JOIN users u ON t.team_leader_id = u.id
  WHERE u.email = 'geo@gmail.com'
)
ORDER BY tm.created_at DESC;

-- Check if user_ids exist in auth.users but not in public.users
SELECT 
  tm.id as team_member_id,
  tm.user_id,
  tm.team_id,
  au.email as auth_email,
  CASE 
    WHEN au.id IS NOT NULL AND u.id IS NULL THEN '⚠️ EXISTS IN AUTH.USERS BUT NOT IN PUBLIC.USERS'
    WHEN au.id IS NULL THEN '❌ DOES NOT EXIST IN AUTH.USERS'
    ELSE '✅ OK'
  END as status
FROM team_members tm
LEFT JOIN auth.users au ON tm.user_id = au.id
LEFT JOIN users u ON tm.user_id = u.id
WHERE tm.team_id = (
  SELECT t.id FROM teams t
  JOIN users u ON t.team_leader_id = u.id
  WHERE u.email = 'geo@gmail.com'
);

-- Fix: Create user records for team_members that exist in auth.users but not in public.users
-- Only run this if you see "EXISTS IN AUTH.USERS BUT NOT IN PUBLIC.USERS" status
INSERT INTO users (id, email, role, first_name, last_name, full_name, created_at)
SELECT 
  au.id,
  au.email,
  'worker' as role, -- Default role
  SPLIT_PART(au.email, '@', 1) as first_name, -- Use email prefix as first_name
  '' as last_name, -- Empty last_name
  SPLIT_PART(au.email, '@', 1) as full_name, -- Use email prefix as full_name
  NOW() as created_at
FROM team_members tm
JOIN auth.users au ON tm.user_id = au.id
LEFT JOIN users u ON tm.user_id = u.id
WHERE tm.team_id = (
  SELECT t.id FROM teams t
  JOIN users u ON t.team_leader_id = u.id
  WHERE u.email = 'geo@gmail.com'
)
AND u.id IS NULL -- User doesn't exist in public.users
ON CONFLICT (id) DO NOTHING; -- Don't insert if already exists

-- After fix, verify all team_members have corresponding users
SELECT 
  COUNT(*) as total_team_members,
  COUNT(u.id) as members_with_users,
  COUNT(*) - COUNT(u.id) as orphaned_members
FROM team_members tm
LEFT JOIN users u ON tm.user_id = u.id
WHERE tm.team_id = (
  SELECT t.id FROM teams t
  JOIN users u ON t.team_leader_id = u.id
  WHERE u.email = 'geo@gmail.com'
);

