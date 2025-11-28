-- Migration to add profile_image_url column to users table
-- Run this script in Supabase SQL Editor

BEGIN;

-- Add profile_image_url column (nullable - optional field)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT;

-- Add comment to document the field
COMMENT ON COLUMN users.profile_image_url IS 'URL to user profile image stored in Cloudflare R2';

COMMIT;

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'profile_image_url';

