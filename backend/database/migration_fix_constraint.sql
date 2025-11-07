-- Simple and direct migration - run this in Supabase SQL Editor
-- This will definitely fix the constraint issue

-- Step 1: First, let's see what constraints exist (optional - just for info)
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'users'::regclass AND contype = 'c';

-- Step 2: Update existing users with old roles
UPDATE users 
SET role = CASE 
  WHEN role = 'user' THEN 'worker'
  WHEN role = 'manager' THEN 'supervisor'
  WHEN role = 'admin' THEN 'executive'
  ELSE 'worker'
END
WHERE role IN ('user', 'manager', 'admin');

-- Step 3: Drop the constraint by exact name (from your schema)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 4: Add the new constraint
ALTER TABLE users 
  ADD CONSTRAINT users_role_check 
  CHECK (role IN ('worker', 'supervisor', 'whs_control_center', 'executive', 'clinician', 'team_leader'));

-- Step 5: Update default
ALTER TABLE users 
  ALTER COLUMN role SET DEFAULT 'worker';

-- Verify it worked:
SELECT 'Constraint updated successfully!' as status;
SELECT DISTINCT role FROM users;
SELECT column_default FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role';

