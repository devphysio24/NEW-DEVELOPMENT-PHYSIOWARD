-- Migration to fix existing users who don't have first_name and last_name
-- This will populate first_name and last_name for all existing users
-- Run this in Supabase SQL Editor

-- Update all users: set first_name and last_name if they're null or empty
UPDATE users 
SET 
  first_name = CASE 
    WHEN first_name IS NULL OR first_name = '' THEN
      CASE 
        WHEN full_name IS NOT NULL AND full_name != '' AND position(' ' in full_name) > 0 THEN
          SPLIT_PART(full_name, ' ', 1)
        WHEN full_name IS NOT NULL AND full_name != '' THEN
          full_name
        ELSE
          SPLIT_PART(email, '@', 1)
      END
    ELSE
      first_name
  END,
  last_name = CASE 
    WHEN last_name IS NULL OR last_name = '' THEN
      CASE 
        WHEN full_name IS NOT NULL AND full_name != '' AND position(' ' in full_name) > 0 THEN
          SUBSTRING(full_name FROM position(' ' in full_name) + 1)
        ELSE
          ''
      END
    ELSE
      last_name
  END,
  full_name = CASE
    WHEN (full_name IS NULL OR full_name = '') AND 
         first_name IS NOT NULL AND first_name != '' AND 
         last_name IS NOT NULL AND last_name != '' THEN
      first_name || ' ' || last_name
    WHEN (full_name IS NULL OR full_name = '') AND 
         first_name IS NOT NULL AND first_name != '' THEN
      first_name
    WHEN full_name IS NULL OR full_name = '' THEN
      SPLIT_PART(email, '@', 1)
    ELSE
      full_name
  END;

-- Verify the update
SELECT 
  id,
  email,
  first_name,
  last_name,
  full_name,
  role
FROM users
ORDER BY created_at DESC
LIMIT 20;

-- Show count of users with proper names
SELECT 
  CASE 
    WHEN (first_name IS NULL OR first_name = '') AND (last_name IS NULL OR last_name = '') THEN 'No Names'
    WHEN first_name IS NULL OR first_name = '' THEN 'Missing First Name'
    WHEN last_name IS NULL OR last_name = '' THEN 'Missing Last Name'
    ELSE 'Has Both Names'
  END as status,
  COUNT(*) as count
FROM users
GROUP BY status;
