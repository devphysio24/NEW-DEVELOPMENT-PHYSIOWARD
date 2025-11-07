# Logout Security and "Unknown" Name Fix

## Summary of Changes

### 1. ✅ Secure Logout Implementation

**Fixed:** Cookies are now securely cleared when user clicks logout.

**Changes Made:**
- Enhanced `clearCookies()` function in `backend/src/routes/auth.ts`
- Added detailed logging for logout events
- Cookies are deleted immediately using `maxAge: 0`
- Both `ACCESS_TOKEN` and `REFRESH_TOKEN` cookies are cleared

**How it works:**
1. User clicks "Logout" button in dashboard
2. Frontend calls `/api/auth/logout` endpoint
3. Backend securely clears both cookies with `maxAge: 0`
4. Frontend clears local state (user, role, full_name, phone)
5. User is redirected to login page

**Security Features:**
- `httpOnly: true` - Cookies cannot be accessed by JavaScript
- `sameSite: 'Strict'` - Prevents CSRF attacks
- `secure: true` in production - Only sent over HTTPS
- `path: '/'` - Ensures cookies are cleared for entire app

### 2. ✅ "Unknown" Name Fix

**Fixed:** Users will now display their name instead of "Unknown".

**Database Changes Required:**
Since you already have the `full_name` column, just run:
```sql
-- File: backend/database/migration_populate_full_name.sql
```

This will:
- Update existing users: set `full_name` to email prefix (part before @) if NULL or empty

**Backend Changes:**
- Updated all auth endpoints (`/login`, `/me`, `/refresh`) to:
  - Select `full_name` and `phone` from database
  - Return `full_name` and `phone` in responses
  - Auto-create users with `full_name` set to email prefix

**Frontend Changes:**
- Updated `AuthContext` to store and provide `full_name` and `phone`
- These are now available via `useAuth()` hook

## Steps to Apply

### Step 1: Populate full_name for Existing Users

Since you already have the `full_name` column, you just need to populate it:

1. Go to Supabase Dashboard → SQL Editor
2. Open and run: `backend/database/migration_populate_full_name.sql`
   - This will set `full_name` to email prefix for users who don't have a name
3. Verify names were populated:
   ```sql
   SELECT email, full_name, role 
   FROM users 
   LIMIT 10;
   ```

### Step 2: Restart Backend

```bash
cd backend
npm run build
npm start
```

### Step 3: Test Logout

1. Login to the application
2. Click "Logout" button
3. Verify:
   - Cookies are cleared (check browser DevTools → Application → Cookies)
   - User is redirected to login page
   - No authentication errors

### Step 4: Test Name Display

1. After running the migration, existing users will have `full_name` set to their email prefix
2. New users created during login will automatically get `full_name` from email prefix
3. Team Leader dashboard should now show names instead of "Unknown"
4. To set custom names, update the `users` table:
   ```sql
   UPDATE users SET full_name = 'John Doe' WHERE email = 'john@example.com';
   ```

**Note:** Phone numbers are stored in the `team_members` table (not `users` table), which is the correct structure based on your schema.

## Code Changes Summary

### Backend (`backend/src/routes/auth.ts`)
- ✅ Enhanced `clearCookies()` function
- ✅ Added logout logging
- ✅ Updated all `SELECT` queries to include `full_name, phone`
- ✅ Updated all responses to include `full_name, phone`
- ✅ Auto-create users with `full_name` from email prefix

### Frontend (`frontend/src/contexts/AuthContext.tsx`)
- ✅ Added `full_name` and `phone` state
- ✅ Store `full_name` and `phone` from backend response
- ✅ Clear `full_name` and `phone` on logout
- ✅ Provide `full_name` and `phone` via context

### Database Schema (`backend/database/schema.sql`)
- ✅ Added `full_name TEXT` column
- ✅ Added `phone TEXT` column

## Important Notes

1. **Cookie Clearing:** The `maxAge: 0` setting tells browsers to immediately delete the cookie. This is the standard way to clear cookies securely.

2. **Name Fallback:** If `full_name` is null or empty, the app will:
   - Use email prefix (part before @) as display name
   - Show "User" if email is also missing

3. **Existing Users:** After running the migration, existing users will have their `full_name` set to their email prefix. You can update these manually if needed.

4. **Team Members:** The Team Leader dashboard already queries `full_name` from the database. Once the migration is run, names should display correctly.

## Verification Checklist

- [ ] Database migration executed successfully
- [ ] `full_name` and `phone` columns exist in `users` table
- [ ] Existing users have `full_name` set
- [ ] Logout clears cookies correctly
- [ ] No "Unknown" names in Team Leader dashboard
- [ ] New users get `full_name` automatically
- [ ] Phone numbers display correctly (if provided)

