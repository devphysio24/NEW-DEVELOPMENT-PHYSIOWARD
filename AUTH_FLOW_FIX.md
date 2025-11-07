# Authentication Flow Fix Summary

## Problem
Kapag nag-login ng isang user, nagka-404 errors at naglo-logout ang isa pang user na naka-login sa ibang browser/incognito window.

## Root Causes Identified
1. **Token Refresh Issue**: Hindi gumagana ang `refreshSession()` method ng Supabase kapag service role key ang ginagamit sa backend
2. **Error Handling**: 404 errors sa `/me` endpoint (dapat 401 para sa auth errors)
3. **Logging**: Kulang ng logging para sa debugging

## Solutions Implemented

### 1. Backend Token Refresh (`backend/src/routes/auth.ts`)

#### Added Direct HTTP Token Refresh
- Gumamit ng direct HTTP call sa Supabase Auth API (`/auth/v1/token?grant_type=refresh_token`)
- Hindi na umaasa sa `supabase.auth.refreshSession()` na hindi gumagana sa backend

```typescript
async function refreshAccessToken(refreshToken: string) {
  // Direct HTTP call to Supabase Auth API
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  // ... returns new tokens
}
```

#### Auto-Refresh sa `/api/auth/me`
- Kapag expired ang access token, auto-refresh gamit ang refresh token
- Bago mag-return ng 401 error, sinusubukan muna i-refresh

#### Fixed Error Codes
- Changed 404 → 401 para sa auth errors (kapag user not found sa database)

#### Added Logging
- Console logs para sa token refresh attempts
- Error logging para sa debugging

### 2. Frontend Error Handling (`frontend/src/contexts/AuthContext.tsx`)

#### Improved 401 Handling
- Nililinaw lang ang user state kung may existing user na
- Hindi naglo-logout kapag initial load pa lang

#### Added 404 Error Handling
- Mas graceful na handling ng 404 errors
- Hindi agad nag-clear ng state para sa temporary server issues

#### Better State Management
- Gumamit ng `useRef` para sa user state tracking
- Hindi nag-trigger ng infinite loops sa `useCallback`

## Authentication Flow

### Login Flow
1. User nag-login → `POST /api/auth/login`
2. Backend verifies credentials → Supabase Auth
3. Backend sets cookies (access_token, refresh_token) → HttpOnly, SameSite=Strict
4. Frontend receives response → Updates AuthContext
5. User redirected sa dashboard

### Session Check Flow (`GET /api/auth/me`)
1. Frontend calls `/api/auth/me` every 60 seconds (polling)
2. Backend checks access token from cookie
3. **If valid**: Returns user data
4. **If expired/invalid**: 
   - Tries to refresh using refresh_token
   - If refresh succeeds: Sets new cookies, returns user data
   - If refresh fails: Returns 401, clears cookies
5. Frontend handles response:
   - If 200 OK: Updates user state
   - If 401: Clears state only if may existing user

### Cookie Isolation
- `SameSite: 'Strict'` - Cookies isolated per browser/tab
- Incognito mode has separate cookie jar
- Normal window at incognito window hindi dapat mag-interfere

## Important Notes

### Backend Restart Required
**Kailangan i-restart ang backend server** para mag-take effect ang changes:
```bash
cd backend
npm run dev
```

### Environment Variables
Make sure may `SUPABASE_URL` at `SUPABASE_SERVICE_ROLE_KEY` sa `.env`:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Testing
1. Mag-login ng User A sa normal window
2. Mag-login ng User B sa incognito window  
3. Parehong dapat active ang sessions
4. Check backend console logs para sa token refresh events

## Files Modified
- `backend/src/routes/auth.ts` - Token refresh, error handling, logging
- `frontend/src/contexts/AuthContext.tsx` - Error handling improvements

## Next Steps
1. **Restart backend server**
2. Test multi-user login scenarios
3. Monitor console logs para sa token refresh events
4. Check kung may 404 errors pa rin (should be resolved)

