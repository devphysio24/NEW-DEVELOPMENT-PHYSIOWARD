-- Fix user role for a2424@gmail.com
-- This user should be 'supervisor' not 'team_leader'

-- First, check current role
SELECT id, email, role, first_name, last_name, full_name 
FROM users 
WHERE email = 'a2424@gmail.com';

-- Update role to supervisor
UPDATE users 
SET role = 'supervisor' 
WHERE email = 'a2424@gmail.com';

-- Verify the change
SELECT id, email, role, first_name, last_name, full_name 
FROM users 
WHERE email = 'a2424@gmail.com';

