# First Name and Last Name Update

## Summary
Updated the registration and user management system to use separate `first_name` and `last_name` fields instead of just `full_name`.

## Changes Made

### 1. Database Schema
- Added `first_name` and `last_name` columns to `users` table
- Kept `full_name` for backward compatibility (auto-derived from first_name + last_name)
- Created migration script: `backend/database/migration_add_first_last_name.sql`

### 2. Backend Updates
- **Registration (`/api/auth/register`)**: Now requires `first_name` and `last_name`
- **Login (`/api/auth/login`)**: Returns `first_name`, `last_name`, and `full_name`
- **Get User (`/api/auth/me`)**: Returns `first_name`, `last_name`, and `full_name`
- **Token Refresh (`/api/auth/refresh`)**: Returns `first_name`, `last_name`, and `full_name`
- **Auto-create users**: Sets `first_name` from email prefix if not provided
- **Teams API**: Updated to handle `first_name` and `last_name` when adding/updating team members

### 3. Frontend Updates
- **Registration Form**: Added required `First Name` and `Last Name` input fields
- **AuthContext**: Stores and provides `first_name`, `last_name`, and `full_name`
- **TeamLeaderDashboard**: 
  - Displays `first_name + last_name` instead of just `full_name`
  - Updated Add/Edit member forms to use `first_name` and `last_name` fields
  - Updated `getInitials` function to use first and last name initials

## Migration Steps

### Step 1: Run Database Migration
1. Go to Supabase Dashboard → SQL Editor
2. Run: `backend/database/migration_add_first_last_name.sql`
   - This adds `first_name` and `last_name` columns
   - Populates existing users: splits `full_name` if available, otherwise uses email prefix

### Step 2: Update Existing Users (if needed)
If you want to ensure all users have proper first_name and last_name:
```sql
-- Review existing users
SELECT id, email, first_name, last_name, full_name 
FROM users 
WHERE first_name IS NULL OR last_name IS NULL;

-- Manually update specific users if needed
UPDATE users 
SET first_name = 'John', last_name = 'Doe', full_name = 'John Doe'
WHERE email = 'john@example.com';
```

### Step 3: Restart Backend
```bash
cd backend
npm run build
npm start
```

## Important Notes

1. **Backward Compatibility**: 
   - `full_name` is still stored and returned for backward compatibility
   - Auto-derived from `first_name + last_name` if not set
   - Display logic prefers `first_name + last_name` over `full_name`

2. **Registration**:
   - `first_name` and `last_name` are **REQUIRED** during registration
   - Cannot register without providing both fields

3. **Existing Users**:
   - Migration script will populate `first_name` and `last_name` for existing users
   - Uses `full_name` if available (splits on space)
   - Falls back to email prefix if `full_name` is empty

4. **Team Members**:
   - When adding team members, `first_name` and `last_name` are required
   - Phone number is still stored in `team_members` table (not `users` table)

5. **Auto-created Users**:
   - Users auto-created during login (if they exist in Supabase Auth but not in database) will have:
     - `first_name` = email prefix
     - `last_name` = empty string
     - `full_name` = email prefix

## Verification Checklist

- [ ] Database migration executed successfully
- [ ] `first_name` and `last_name` columns exist in `users` table
- [ ] Existing users have `first_name` and `last_name` populated
- [ ] Registration form shows First Name and Last Name fields
- [ ] Registration requires both first_name and last_name
- [ ] Team Leader dashboard displays names correctly (first_name + last_name)
- [ ] Add/Edit team member forms use first_name and last_name
- [ ] Names display correctly throughout the application















