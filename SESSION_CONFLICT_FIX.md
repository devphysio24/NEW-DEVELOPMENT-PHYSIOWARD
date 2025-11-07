# 🔒 Session Conflict Fix - Multiple User Login Issue

## Problem Description

**Issue:** Pag nag-login ng ibang user (e.g., worker) sa iba browser/tab, yung naka-login na supervisor sa original tab ay biglang nag-switch ng role at napupunta sa team-leader dashboard.

**Root Cause:**
- Cookies are shared across ALL TABS in the same browser (regular mode)
- Pag nag-login ng bagong user, nag-overwrite ng cookies
- Old tab still has old user state in memory
- Pag nag-refresh or navigate, nag-fetch ng new user data from cookie pero hindi agad na-detect

## Solution Implemented ✅

### 1. **Faster Polling Interval**
Changed from 30 seconds to **10 seconds** for faster session change detection:

```typescript
// Poll backend cookie every 10 seconds to check session validity
refreshInterval = setInterval(() => {
  if (isMounted) {
    console.log('[AuthContext] Polling user session...')
    fetchUserAndRole(false)
  }
}, 10000) // Check every 10 seconds for faster session change detection
```

**Why:** Mas mabilis ma-detect kung nag-change ang user sa cookies.

### 2. **Visibility Change Listener**
Added event listener for tab visibility changes:

```typescript
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible' && user) {
    console.log('[AuthContext] Tab became visible - checking session...')
    fetchUserAndRole(false)
  }
}

document.addEventListener('visibilitychange', handleVisibilityChange)
```

**Why:** Pag bumalik ka sa tab, automatic na mag-check ng session.

### 3. **Window Focus Listener**
Added event listener for window focus:

```typescript
const handleFocus = () => {
  if (user) {
    console.log('[AuthContext] Window focused - checking session...')
    fetchUserAndRole(false)
  }
}

window.addEventListener('focus', handleFocus)
```

**Why:** Pag nag-click ka sa window, automatic na mag-check ng session.

### 4. **Enhanced User Change Detection**
Improved the security alert with better messaging:

```typescript
// CRITICAL: Detect if user changed (different user logged in - even in same browser)
if (userRef.current && userRef.current.id !== userObj.id) {
  console.error(`[AuthContext] 🚨 SECURITY ALERT: User changed from ${userRef.current.id} (${userRef.current.email}) to ${userObj.id} (${userObj.email}) - forcing logout!`)
  
  // Clear all state
  setUser(null)
  setRole(null)
  setFirstName(null)
  setLastName(null)
  setFullName(null)
  setPhone(null)
  setSession(null)
  
  // Show alert to user
  alert('Your session has been replaced by another user login. Please log in again.')
  
  navigate(PUBLIC_ROUTES.LOGIN, { replace: true })
  return // Exit early
}
```

**Why:** User will be immediately notified and forced to re-login.

### 5. **Force Fresh Data**
Added `Cache-Control: no-cache` header to force fresh data:

```typescript
const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
  method: 'GET',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache', // Force fresh data
  },
})
```

**Why:** Prevents browser from caching old user data.

## How It Works Now

### Scenario: Supervisor naka-login, then Worker logs in on another tab

1. **Worker logs in** → Backend clears old cookies, sets new cookies for Worker
2. **Supervisor tab detects change** (within 10 seconds or when tab gets focus):
   - Fetches `/api/auth/me` with new cookies
   - Gets Worker's user data
   - Detects user ID changed (Supervisor ID ≠ Worker ID)
   - Shows alert: "Your session has been replaced by another user login"
   - Clears all state
   - Redirects to login page
3. **Supervisor must re-login** to continue

### Multiple Detection Points:
- ✅ Every 10 seconds (polling)
- ✅ When tab becomes visible (visibilitychange)
- ✅ When window gets focus (focus event)
- ✅ On page refresh (initial load)

## Testing Steps

1. **Open Browser A** - Login as Supervisor (a2424@gmail.com)
2. **Open Browser B** (or incognito) - Login as Worker
3. **Go back to Browser A**:
   - Click on the window (triggers focus check)
   - OR wait 10 seconds (polling)
   - OR switch to another tab and back (visibility check)
4. **Expected Result:** Alert appears, redirected to login

## Important Notes

⚠️ **This is expected behavior** - Only ONE user can be logged in per browser at a time.

If you need multiple users logged in simultaneously:
- Use different browsers (Chrome + Firefox)
- Use incognito/private mode
- Use different browser profiles

## Files Modified

- `frontend/src/contexts/AuthContext.tsx`
  - Reduced polling interval: 30s → 10s
  - Added visibility change listener
  - Added window focus listener
  - Enhanced user change detection
  - Added cache-control header
  - Improved alert messaging

## Security Benefits

1. ✅ Prevents session hijacking
2. ✅ Immediate detection of user changes
3. ✅ Clear user notification
4. ✅ Forced re-authentication
5. ✅ Multiple detection mechanisms (defense in depth)

