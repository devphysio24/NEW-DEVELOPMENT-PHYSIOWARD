-- Fix team members' names for geo@gmail.com's team
-- This will populate first_name and last_name for all team members
-- Run this in Supabase SQL Editor

-- First, let's see what we're working with
SELECT 
  tm.id as team_member_id,
  u.id as user_id,
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
)
ORDER BY u.email;

-- Update all team members' users to have first_name and last_name
UPDATE users u
SET 
  first_name = CASE 
    WHEN u.first_name IS NULL OR u.first_name = '' THEN
      CASE 
        WHEN u.full_name IS NOT NULL AND u.full_name != '' AND position(' ' in u.full_name) > 0 THEN
          SPLIT_PART(u.full_name, ' ', 1)
        WHEN u.full_name IS NOT NULL AND u.full_name != '' THEN
          u.full_name
        ELSE
          SPLIT_PART(u.email, '@', 1)
      END
    ELSE
      u.first_name
  END,
  last_name = CASE 
    WHEN u.last_name IS NULL OR u.last_name = '' THEN
      CASE 
        WHEN u.full_name IS NOT NULL AND u.full_name != '' AND position(' ' in u.full_name) > 0 THEN
          SUBSTRING(u.full_name FROM position(' ' in u.full_name) + 1)
        ELSE
          ''
      END
    ELSE
      u.last_name
  END,
  full_name = CASE
    WHEN (u.full_name IS NULL OR u.full_name = '') AND 
         u.first_name IS NOT NULL AND u.first_name != '' AND 
         u.last_name IS NOT NULL AND u.last_name != '' THEN
      u.first_name || ' ' || u.last_name
    WHEN (u.full_name IS NULL OR u.full_name = '') AND 
         u.first_name IS NOT NULL AND u.first_name != '' THEN
      u.first_name
    WHEN u.full_name IS NULL OR u.full_name = '' THEN
      SPLIT_PART(u.email, '@', 1)
    ELSE
      u.full_name
  END
WHERE u.id IN (
  SELECT tm.user_id 
  FROM team_members tm
  WHERE tm.team_id = (
    SELECT id FROM teams 
    WHERE team_leader_id = (SELECT id FROM users WHERE email = 'geo@gmail.com')
  )
)
AND (u.first_name IS NULL OR u.first_name = '' OR u.last_name IS NULL OR u.last_name = '');

-- Verify the fix
SELECT 
  tm.id as team_member_id,
  u.email,
  u.first_name,
  u.last_name,
  u.full_name,
  CASE 
    WHEN u.first_name IS NULL OR u.first_name = '' THEN '❌ MISSING FIRST NAME'
    WHEN u.last_name IS NULL OR u.last_name = '' THEN '❌ MISSING LAST NAME'
    ELSE '✅ HAS BOTH NAMES'
  END as status
FROM team_members tm
JOIN users u ON tm.user_id = u.id
WHERE tm.team_id = (
  SELECT id FROM teams 
  WHERE team_leader_id = (SELECT id FROM users WHERE email = 'geo@gmail.com')
)
ORDER BY u.email;

