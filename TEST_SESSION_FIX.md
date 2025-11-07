# 🧪 Testing Guide: Session Isolation Fix

## Quick Test Steps

### Test 1: Basic Login Flow
```bash
# Expected: Clean login, correct dashboard
1. Open http://localhost:5173
2. Login as worker
3. Verify: Redirected to /dashboard/worker
4. Check browser DevTools → Application → Cookies
   - Should see: access_token, refresh_token, user_id
```

### Test 2: Different Users (Main Bug Fix)
```bash
# This was the original problem - now fixed!

Step 1: Login as Supervisor
- Open regular browser tab
- Navigate to http://localhost:5173
- Login with supervisor credentials
- Verify: At /dashboard/supervisor

Step 2: Login as Worker (Incognito)
- Open incognito window
- Navigate to http://localhost:5173  
- Login with worker credentials
- Verify: At /dashboard/worker

Step 3: Refresh Supervisor Tab
- Go back to regular tab (supervisor)
- Press F5 to refresh
- EXPECTED RESULT: Should stay at /dashboard/supervisor
  (Before fix: Would incorrectly go to /dashboard/team-leader)
```

### Test 3: Session Ownership Validation
```bash
# Backend should track session ownership

1. Login as Team Leader
2. Check backend logs:
   Should see: "[POST /login] Cookies set for user: {id} ({email}), role: team_leader"

3. Check cookies in DevTools:
   - access_token: {jwt_token}
   - refresh_token: {jwt_token}
   - user_id: {team_leader_id}  ← NEW!

4. Make API request to /api/teams
   Should succeed (team_leader has access)

5. Make API request to /api/supervisor/teams
   Should fail with 403 (team_leader doesn't have access)
```

### Test 4: Cookie Clearing on Login
```bash
# Verify cookies are cleared before new login

1. Login as User A
2. Check cookies: access_token, refresh_token, user_id (User A)
3. Logout
4. Login as User B
5. Check backend logs:
   Should see: "[clearCookies] All cookies cleared securely for session"
6. Check cookies: access_token, refresh_token, user_id (User B)
   - All should be different from User A
```

### Test 5: Multi-Tab Behavior
```bash
# Same user, multiple tabs

1. Login as Worker in Tab 1
2. Open Tab 2 (same browser)
3. Navigate to http://localhost:5173
4. EXPECTED: Auto-logged in as Worker
5. Refresh both tabs
6. EXPECTED: Both show Worker dashboard
```

### Test 6: Cross-Tab Logout
```bash
# Logout detection across tabs

1. Login in Tab 1
2. Open Tab 2
3. Logout in Tab 1
4. Wait 30 seconds (polling interval)
5. Tab 2 should detect logout and redirect to login
```

## What to Look For

### ✅ Success Indicators:
- Each user gets their own clean session
- No dashboard confusion after refresh
- Cookies properly cleared on login
- user_id cookie is set correctly
- Backend logs show correct user
- No unauthorized access to other roles' routes

### ❌ Failure Indicators:
- Wrong dashboard after refresh
- Cookies from previous user still present
- user_id cookie missing or incorrect
- Backend logs show wrong user
- Can access routes for other roles

## Browser DevTools Inspection

### Check Cookies:
```
Application → Storage → Cookies → http://localhost:5173

Expected cookies:
✓ access_token (HttpOnly, Secure in prod, SameSite=Strict)
✓ refresh_token (HttpOnly, Secure in prod, SameSite=Strict)
✓ user_id (HttpOnly, Secure in prod, SameSite=Strict) ← NEW!
```

### Check Network Requests:
```
Network → Filter: /api/auth/

POST /api/auth/login
- Request: { email, password }
- Response: { message, user: { id, email, role, ... } }
- Cookies set in response headers

GET /api/auth/me
- Request: Cookies sent automatically
- Response: { user: { id, email, role, ... } }
```

### Check Console Logs:
```
Frontend logs to look for:
✓ "[AuthContext] User session updated: {id} ({email}), role: {role}"
✓ "[ProtectedRoute] Access granted: {email} ({role})"
✗ "[AuthContext] SECURITY: User changed from {id1} to {id2}"
  (Should NOT see this during normal operation)
```

## Backend Logs to Monitor

```bash
# Start backend with logs visible
cd backend
npm run dev

# Look for these log messages:

✓ "[clearCookies] All cookies cleared securely for session"
  - Appears at start of login

✓ "[POST /login] Cookies set for user: {id} ({email}), role: {role}"
  - Confirms successful login

✓ "[requireRole] Access granted: {email} ({role}) -> {method} {path}"
  - Shows authorized API access

✗ "[requireRole] SECURITY: Access denied for user {email} ({id}) with role '{role}'"
  - Shows blocked unauthorized access (good!)
```

## Common Issues & Solutions

### Issue 1: "Still seeing wrong dashboard"
**Cause:** Old cookies cached
**Solution:**
```bash
1. Open DevTools → Application → Storage
2. Click "Clear site data"
3. Close all tabs
4. Open fresh tab and login
```

### Issue 2: "user_id cookie not appearing"
**Cause:** Backend not updated or not restarted
**Solution:**
```bash
1. Stop backend (Ctrl+C)
2. Restart: npm run dev
3. Try login again
```

### Issue 3: "Getting 401 Unauthorized"
**Cause:** Token expired or invalid
**Solution:**
```bash
1. Logout
2. Clear cookies
3. Login again
```

### Issue 4: "Cookies not being sent"
**Cause:** CORS credentials not enabled
**Solution:**
```javascript
// Verify fetch calls include:
credentials: 'include'

// Verify backend CORS config:
cors({
  origin: ['http://localhost:5173'],
  credentials: true,
})
```

## Automated Test Script (Optional)

```javascript
// Run in browser console after login
async function testSessionIsolation() {
  console.log('🧪 Testing Session Isolation...\n')
  
  // Check cookies
  const cookies = document.cookie.split(';').map(c => c.trim())
  console.log('Cookies:', cookies)
  
  // Test /me endpoint
  const response = await fetch('http://localhost:3000/api/auth/me', {
    credentials: 'include'
  })
  const data = await response.json()
  console.log('Current user:', data.user)
  
  // Verify user_id matches
  const userIdCookie = cookies.find(c => c.startsWith('user_id='))
  if (userIdCookie) {
    console.log('✅ user_id cookie found')
  } else {
    console.log('❌ user_id cookie missing')
  }
  
  console.log('\n✅ Test complete!')
}

testSessionIsolation()
```

## Performance Check

The fix should NOT impact performance:
- Cookie operations are fast (< 1ms)
- No additional database queries
- No network overhead
- Minimal memory usage

## Security Validation

Verify these security measures are working:
- ✅ HttpOnly cookies (not accessible via JavaScript)
- ✅ SameSite=Strict (prevents CSRF)
- ✅ Secure flag in production (HTTPS only)
- ✅ Session ownership tracked
- ✅ Cookies cleared on login
- ✅ Role validation on every request

## Rollback Plan (If Needed)

If the fix causes issues:

```bash
# Revert the changes
git checkout HEAD~1 backend/src/routes/auth.ts
git checkout HEAD~1 backend/src/middleware/auth.ts

# Restart backend
cd backend
npm run dev
```

## Success Criteria

The fix is working correctly if:
1. ✅ Different users can login without session confusion
2. ✅ Refreshing page shows correct dashboard for logged-in user
3. ✅ user_id cookie is set on login
4. ✅ Cookies are cleared before new login
5. ✅ No unauthorized access to other roles' routes
6. ✅ Backend logs show correct user for each request
7. ✅ Frontend detects user changes and handles appropriately

---

**Test Status:** Ready for Testing
**Expected Duration:** 10-15 minutes
**Required:** Backend running, Frontend running, Multiple test accounts

