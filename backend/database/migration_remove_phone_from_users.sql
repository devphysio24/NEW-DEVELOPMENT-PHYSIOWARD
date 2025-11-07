-- Migration to remove phone column from users table if it exists
-- Phone is stored in team_members table, not users table
-- Run this in Supabase SQL Editor

-- Check if phone column exists and remove it (it shouldn't be in users table)
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

-- Verify phone is NOT in users table
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'phone';

-- Verify phone IS in team_members table
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns
WHERE table_name = 'team_members' 
  AND column_name = 'phone';

