# Fix for "Unknown" Names and Cache Issue

## Problem
- Team members showing as "Unknown" after logout/login
- Need to restart backend for names to appear
- Orphaned team_members (records without corresponding users)

## Root Cause
1. **Orphaned team_members**: Some `team_members` records have `user_id` values that don't exist in the `users` table
2. **Supabase relationship join not working**: The `users:user_id(...)` syntax wasn't returning data
3. **Cache/timing issue**: Data sometimes works after restart, suggesting a caching or race condition

## Fixes Applied

### 1. Manual User Data Fetch
Changed from relationship join to manual fetch:
- Before: `users:user_id(...)` (not working)
- After: Manual fetch using `Promise.all` to get user data for each member

### 2. Filter Orphaned Members
Added filtering to exclude team members without valid user data:
- Members with `users: null` are filtered out
- Logs warning for orphaned records

### 3. Better Error Handling
- Detailed logging for debugging
- Graceful handling of missing user records

## Steps to Fix

### Step 1: Clean Up Orphaned Team Members

Run this in Supabase SQL Editor:

```sql
-- Check for orphaned team_members
SELECT 
  tm.id as team_member_id,
  tm.user_id,
  tm.team_id,
  CASE 
    WHEN u.id IS NULL THEN '❌ ORPHANED - No user record'
    ELSE '✅ OK - Has user record'
  END as status
FROM team_members tm
LEFT JOIN users u ON tm.user_id = u.id
WHERE u.id IS NULL;

-- Delete orphaned team_members (recommended)
DELETE FROM team_members
WHERE user_id NOT IN (SELECT id FROM users);
```

### Step 2: Restart Backend

```bash
cd backend
npm start
```

### Step 3: Test

1. Login as team leader
2. Check Team Leader dashboard - should show names
3. Logout
4. Login again - should still show names (no restart needed)

## Why This Happens

Orphaned team_members can occur if:
1. User was deleted from `users` table but `team_members` record wasn't cleaned up
2. Transaction failed partway (user created in auth but not in users table)
3. Manual database manipulation

## Prevention

The code now:
- ✅ Filters out orphaned members automatically
- ✅ Uses manual fetch (more reliable than relationship joins)
- ✅ Has better error handling and logging

## Verification

After restart, check backend logs. You should see:
```
[GET /teams] ✅ Member <user_id>: email=<email>, first_name="...", last_name="...", full_name="..."
```

Not:
```
[GET /teams] ⚠️ ORPHANED: User <user_id> not found...
[GET /teams] Filtering out member <user_id> - no user data found
```















