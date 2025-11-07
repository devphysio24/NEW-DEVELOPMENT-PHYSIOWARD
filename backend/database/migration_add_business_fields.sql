-- Migration to add business registration fields to users table
-- Run this script in Supabase SQL Editor

BEGIN;

-- Add business_name column (nullable - optional field)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS business_name TEXT;

-- Add business_registration_number column (nullable - optional field)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS business_registration_number TEXT;

-- Create index for faster lookups on business_name
CREATE INDEX IF NOT EXISTS idx_users_business_name ON users(business_name);

-- Add comment to document the fields
COMMENT ON COLUMN users.business_name IS 'Business name for users with business registration';
COMMENT ON COLUMN users.business_registration_number IS 'Business registration number (optional)';

COMMIT;

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('business_name', 'business_registration_number');

