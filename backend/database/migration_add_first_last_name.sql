-- Migration to add first_name and last_name columns to users table
-- Run this in Supabase SQL Editor

-- Add first_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'first_name') THEN
    ALTER TABLE users ADD COLUMN first_name TEXT;
    RAISE NOTICE 'Added first_name column to users table';
  ELSE
    RAISE NOTICE 'first_name column already exists';
  END IF;
END $$;

-- Add last_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'last_name') THEN
    ALTER TABLE users ADD COLUMN last_name TEXT;
    RAISE NOTICE 'Added last_name column to users table';
  ELSE
    RAISE NOTICE 'last_name column already exists';
  END IF;
END $$;

-- For existing users: try to split full_name into first_name and last_name
-- If full_name exists, split it; otherwise use email prefix
UPDATE users 
SET 
  first_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' AND position(' ' in full_name) > 0 THEN
      SPLIT_PART(full_name, ' ', 1)
    WHEN full_name IS NOT NULL AND full_name != '' THEN
      full_name
    ELSE
      SPLIT_PART(email, '@', 1)
  END,
  last_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' AND position(' ' in full_name) > 0 THEN
      SUBSTRING(full_name FROM position(' ' in full_name) + 1)
    ELSE
      ''
  END
WHERE first_name IS NULL OR last_name IS NULL;

-- Verify the columns were added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name IN ('first_name', 'last_name', 'full_name')
ORDER BY column_name;

-- Remove phone column from users table if it exists (phone belongs in team_members table)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'users' AND column_name = 'phone') THEN
    ALTER TABLE users DROP COLUMN phone;
    RAISE NOTICE 'Removed phone column from users table (phone belongs in team_members table)';
  ELSE
    RAISE NOTICE 'phone column does not exist in users table - that is correct';
  END IF;
END $$;

-- Show sample data
SELECT 
  id,
  email,
  first_name,
  last_name,
  full_name,
  role
FROM users
LIMIT 10;

