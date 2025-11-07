-- Fix orphaned team_members (team members without corresponding user records)
-- Run this in Supabase SQL Editor

-- Check for orphaned team_members
SELECT 
  tm.id as team_member_id,
  tm.user_id,
  tm.team_id,
  CASE 
    WHEN u.id IS NULL THEN '❌ ORPHANED - No user record'
    ELSE '✅ OK - Has user record'
  END as status
FROM team_members tm
LEFT JOIN users u ON tm.user_id = u.id
WHERE u.id IS NULL;

-- Option 1: Delete orphaned team_members (recommended)
-- Uncomment to delete orphaned records:
/*
DELETE FROM team_members
WHERE user_id NOT IN (SELECT id FROM users);
*/

-- Option 2: Check if user_id exists in auth.users but not in public.users
-- This might indicate users that need to be created in public.users table
SELECT 
  tm.id as team_member_id,
  tm.user_id,
  tm.team_id,
  au.email as auth_email
FROM team_members tm
LEFT JOIN users u ON tm.user_id = u.id
LEFT JOIN auth.users au ON tm.user_id = au.id
WHERE u.id IS NULL AND au.id IS NOT NULL;

-- After fixing, verify all team_members have corresponding users:
SELECT 
  COUNT(*) as total_team_members,
  COUNT(u.id) as members_with_users,
  COUNT(*) - COUNT(u.id) as orphaned_members
FROM team_members tm
LEFT JOIN users u ON tm.user_id = u.id;

