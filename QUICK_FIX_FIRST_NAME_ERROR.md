# Quick Fix: first_name Column Error

## Error
```
Could not find the 'first_name' column of 'users' in the schema cache
```

## Cause
The `first_name` and `last_name` columns don't exist in your Supabase database yet. The code is trying to insert these columns, but they haven't been created.

## Solution

### Step 1: Run Migration in Supabase

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy and paste this SQL script:

```sql
-- Add first_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'first_name') THEN
    ALTER TABLE users ADD COLUMN first_name TEXT;
    RAISE NOTICE 'Added first_name column to users table';
  ELSE
    RAISE NOTICE 'first_name column already exists';
  END IF;
END $$;

-- Add last_name column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'last_name') THEN
    ALTER TABLE users ADD COLUMN last_name TEXT;
    RAISE NOTICE 'Added last_name column to users table';
  ELSE
    RAISE NOTICE 'last_name column already exists';
  END IF;
END $$;

-- For existing users: try to split full_name into first_name and last_name
-- If full_name exists, split it; otherwise use email prefix
UPDATE users 
SET 
  first_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' AND position(' ' in full_name) > 0 THEN
      SPLIT_PART(full_name, ' ', 1)
    WHEN full_name IS NOT NULL AND full_name != '' THEN
      full_name
    ELSE
      SPLIT_PART(email, '@', 1)
  END,
  last_name = CASE 
    WHEN full_name IS NOT NULL AND full_name != '' AND position(' ' in full_name) > 0 THEN
      SUBSTRING(full_name FROM position(' ' in full_name) + 1)
    ELSE
      ''
  END
WHERE first_name IS NULL OR last_name IS NULL;
```

3. Click **RUN** to execute the script
4. Verify it worked:
```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name IN ('first_name', 'last_name', 'full_name')
ORDER BY column_name;
```

### Step 2: Refresh Supabase Schema Cache

Sometimes Supabase's schema cache needs to be refreshed:

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Scroll down to **Schema Cache**
3. Click **Refresh Schema Cache** (if available)
   
OR

Wait 1-2 minutes for the cache to refresh automatically after running the migration.

### Step 3: Restart Backend

After running the migration:

```bash
# Stop the backend (Ctrl+C)
# Then restart it
cd backend
npm start
```

### Step 4: Verify

Try registering a new user or making a request again. The error should be gone.

## Alternative: If Migration Already Ran

If you already ran the migration but still get the error, it might be a schema cache issue. Try:

1. **Wait 2-3 minutes** - Supabase cache sometimes takes time to refresh
2. **Check if columns exist**:
   ```sql
   SELECT * FROM information_schema.columns 
   WHERE table_name = 'users' 
     AND column_name IN ('first_name', 'last_name');
   ```
3. If columns exist but still getting error, restart your backend and try again

## Verification Query

After migration, verify your users have first_name and last_name:

```sql
SELECT id, email, first_name, last_name, full_name 
FROM users 
LIMIT 10;
```

---

## Additional Fix: Phone Column Error

If you get an error like:
```
column users.phone does not exist
```

This is because `phone` is stored in the `team_members` table, NOT the `users` table.

### Fix: Remove phone from users table (if it exists)

Run this in Supabase SQL Editor:

```sql
-- Remove phone column from users table if it exists
ALTER TABLE users DROP COLUMN IF EXISTS phone;
```

**Note:** Phone numbers belong in the `team_members` table, not the `users` table. This is the correct structure.

