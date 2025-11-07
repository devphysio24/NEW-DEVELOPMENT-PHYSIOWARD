# ⚠️ URGENT: Run This Migration in Supabase

## Problem
Ang RLS policy ay nagboblock ng INSERT operations kahit service role key ang gamit. Kailangan i-fix ang policy.

## Solution: Run This SQL in Supabase SQL Editor

1. Buksan ang **Supabase Dashboard**
2. Pumunta sa **SQL Editor**
3. I-copy/paste ang SQL code sa baba
4. Click **RUN**

---

## SQL to Run:

```sql
-- Fix RLS policy for users table to allow INSERT operations with service role
-- This allows backend (service role) to auto-create user records

-- Step 1: Drop the existing policy
DROP POLICY IF EXISTS "Service role can do everything" ON users;

-- Step 2: Recreate the policy with both USING and WITH CHECK clauses
-- USING is for SELECT/UPDATE/DELETE, WITH CHECK is for INSERT/UPDATE
CREATE POLICY "Service role can do everything"
  ON users FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 3: Verify the policy was created correctly
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
```

---

## After Running:

1. **Verify** - Dapat makita mo ang policy na may `with_check` clause
2. **Test** - I-restart ang backend at subukan mag-login
3. **Check logs** - Dapat wala na ang "row-level security policy" errors

---

## Expected Result:

After running, dapat makita mo:
- Policy created successfully
- `with_check` column ay may value (hindi null)
- Backend logs ay walang RLS errors

---

## Why This Is Needed:

Ang original policy ay may `USING` clause lang, pero wala ang `WITH CHECK` clause na kailangan para sa INSERT operations. Kaya hindi makapag-insert ang backend kahit service role key ang gamit.

