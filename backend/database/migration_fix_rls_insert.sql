-- Fix RLS policy for users table to allow INSERT operations with service role
-- Run this in Supabase SQL Editor

-- Drop the existing policy
DROP POLICY IF EXISTS "Service role can do everything" ON users;

-- Recreate the policy with both USING and WITH CHECK clauses
-- USING is for SELECT/UPDATE/DELETE, WITH CHECK is for INSERT/UPDATE
CREATE POLICY "Service role can do everything"
  ON users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Verify the policy was created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'users' AND policyname = 'Service role can do everything';

