-- Migration to update from old schema to new schema with worker role
-- Run this ENTIRE script at once in Supabase SQL Editor

BEGIN;

-- Step 1: Check current constraint (for debugging - will show error if doesn't exist, that's OK)
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'users'::regclass AND contype = 'c';

-- Step 2: Update existing users with old roles first
UPDATE users 
SET role = CASE 
  WHEN role = 'user' THEN 'worker'
  WHEN role = 'manager' THEN 'supervisor'
  WHEN role = 'admin' THEN 'executive'
  ELSE 'worker'
END
WHERE role IN ('user', 'manager', 'admin') OR role NOT IN ('worker', 'supervisor', 'whs_control_center', 'executive', 'clinician', 'team_leader');

-- Step 3: Drop ALL check constraints on the role column (in case there are multiple or differently named ones)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%role%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Step 4: Add the new check constraint with all valid roles
ALTER TABLE public.users 
  ADD CONSTRAINT users_role_check 
  CHECK (role IN ('worker', 'supervisor', 'whs_control_center', 'executive', 'clinician', 'team_leader'));

-- Step 5: Update the default role to 'worker'
ALTER TABLE public.users 
  ALTER COLUMN role SET DEFAULT 'worker';

-- Step 6: Verify the constraint was created
-- This should return the new constraint definition
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.users'::regclass 
AND contype = 'c' 
AND conname = 'users_role_check';

COMMIT;

-- After running, verify with:
-- SELECT DISTINCT role FROM users;
-- SELECT column_default FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role';
