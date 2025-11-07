# Fix "Unknown" Names for Team Members

## Problem
Team members are showing as "Unknown" in the frontend even after restarting the backend.

## Root Cause
Team members in the database don't have `first_name` and `last_name` populated. The frontend displays names based on:
1. `first_name + last_name` (preferred)
2. `full_name` (fallback)
3. `email` (fallback)
4. "Unknown" (if all above are missing/null)

## Solution

### Step 1: Run Fix Migration for ALL Users
First, fix all users in the database:

```sql
-- Run: backend/database/migration_fix_existing_users_names.sql
-- This populates first_name and last_name for ALL users
```

### Step 2: Fix Specific Team Members (if Step 1 didn't work)
If team members still show "Unknown", run this specific fix:

```sql
-- Run: backend/database/fix_geo_team_members_names.sql
-- This specifically fixes team members for geo@gmail.com's team
```

### Step 3: Verify the Fix
Check if names are now populated:

```sql
-- Check team members for geo@gmail.com
SELECT 
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
```

### Step 4: Restart Backend
After running the migrations:

```bash
# Stop backend (Ctrl+C)
cd backend
npm start
```

### Step 5: Refresh Frontend
1. Hard refresh the browser (Ctrl+F5 or Cmd+Shift+R)
2. Or logout and login again
3. Check if names are now displayed correctly

## Quick Manual Fix (if needed)

If you know specific team member emails, you can manually update them:

```sql
-- Example: Update a specific team member
UPDATE users 
SET 
  first_name = 'John',
  last_name = 'Doe',
  full_name = 'John Doe'
WHERE email = 'member@example.com';
```

## Why This Happens

1. **Old data**: Users created before `first_name`/`last_name` columns were added
2. **Auto-create**: Users auto-created during login might not have proper names
3. **Migration not run**: The migration to populate names wasn't executed yet

## Prevention

After fixing, ensure:
1. All new registrations require `first_name` and `last_name` ✅ (already implemented)
2. Team members added via Team Leader dashboard have `first_name` and `last_name` ✅ (already implemented)
3. Auto-created users get `first_name` from email prefix ✅ (already fixed)















