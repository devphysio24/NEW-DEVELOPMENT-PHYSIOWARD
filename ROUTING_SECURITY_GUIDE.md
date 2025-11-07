# Routing & Security Guide

This document outlines the routing architecture and security measures implemented in the Work Readiness application.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Frontend Routing](#frontend-routing)
3. [Backend API Protection](#backend-api-protection)
4. [Security Features](#security-features)
5. [Adding New Routes](#adding-new-routes)
6. [Testing & Validation](#testing--validation)

---

## Overview

The application uses a **role-based access control (RBAC)** system with the following roles:
- **Worker** - Can submit check-ins and view their own records
- **Team Leader** - Can manage team members and view team analytics
- **Supervisor** - Can manage multiple teams and team leaders
- **WHS Control Center** - Workplace health & safety oversight
- **Executive** - High-level analytics and reporting
- **Clinician** - Medical oversight and health data access

---

## Frontend Routing

### Route Configuration

All frontend routes are centralized in `frontend/src/config/routes.ts`:

```typescript
// Public routes (no authentication)
PUBLIC_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  HOME: '/',
}

// Protected routes by role
PROTECTED_ROUTES = {
  WORKER: {
    DASHBOARD: '/dashboard/worker',
    CHECK_IN: '/dashboard/worker/check-in',
    CHECK_IN_RECORDS: '/dashboard/worker/check-in-records',
  },
  TEAM_LEADER: {
    DASHBOARD: '/dashboard/team-leader',
    CALENDAR: '/dashboard/team-leader/calendar',
    READINESS: '/dashboard/team-leader/readiness',
    ANALYTICS: '/dashboard/team-leader/analytics',
  },
  // ... other roles
}
```

### Protected Route Component

The `ProtectedRoute` component (`frontend/src/components/ProtectedRoute.tsx`) handles:

1. **Authentication Check** - Verifies user is logged in
2. **Role Verification** - Ensures user has required role
3. **Automatic Redirect** - Redirects unauthorized users to their proper dashboard
4. **Loading States** - Shows loading screen while auth state is determined

**Key Features:**
- Memoized for performance
- Prevents route flashing during auth checks
- Logs security violations
- Preserves return path for post-login redirect

### Route Access Control

The `hasRouteAccess()` function validates if a user's role can access a specific route:

```typescript
hasRouteAccess(path: string, userRole: UserRole): boolean
```

### Dashboard Redirect

The `DashboardRedirect` component automatically routes users to their role-specific dashboard based on the `ROLE_ROUTES` mapping.

---

## Backend API Protection

### Middleware Stack

All protected API routes use a layered middleware approach:

```typescript
// 1. Authentication Middleware
authMiddleware  // Verifies JWT token, loads user from DB

// 2. Role-Based Authorization
requireRole(['team_leader', 'supervisor'])  // Restricts access by role
```

### Route Configuration

Backend routes are defined in `backend/src/config/routes.ts`:

```typescript
API_ROUTES = {
  AUTH: { ... },      // Public auth endpoints
  TEAMS: { ... },     // Team management (team_leader)
  CHECKINS: { ... },  // Check-in system (worker, team_leader)
  SUPERVISOR: { ... }, // Supervisor functions
  SCHEDULES: { ... },  // Schedule management
}

ROUTE_ACCESS_CONTROL = {
  '/api/teams': ['team_leader'],
  '/api/checkins/submit': ['worker'],
  '/api/supervisor/teams': ['supervisor'],
  // ... etc
}
```

### Authentication Middleware

Located in `backend/src/middleware/auth.ts`:

**Features:**
- Token extraction from cookies or Authorization header
- Supabase JWT verification
- Role loading from database (with RLS bypass fallback)
- Context attachment for downstream handlers
- Detailed security logging

**Security Measures:**
- Invalid tokens immediately cleared
- No default roles (explicit role required)
- Admin client fallback for RLS issues
- Comprehensive error logging

### Role Authorization

The `requireRole()` middleware:
- Validates user has one of the allowed roles
- Logs all access attempts (granted and denied)
- Returns detailed error messages with required roles
- Tracks request method and path

---

## Security Features

### 1. **Strict Role Validation**
- No default roles - users must have explicit role assignment
- Role loaded fresh from database on each request
- Frontend and backend both validate roles independently

### 2. **Token Management**
- HTTP-only cookies (not accessible via JavaScript)
- Secure flag for HTTPS-only transmission
- SameSite=Strict to prevent CSRF
- Automatic token refresh via `/api/auth/me` endpoint

### 3. **Session Monitoring**
- Frontend polls session every 30 seconds
- Detects user changes across browser tabs
- Automatic logout on session invalidation
- Prevents stale authentication state

### 4. **Security Logging**
- All authentication attempts logged
- Role mismatches logged with user details
- Request/response timing tracked
- Failed access attempts recorded

### 5. **Route Protection**
- Frontend: `ProtectedRoute` component guards all protected pages
- Backend: `authMiddleware` + `requireRole` on all protected endpoints
- Double validation ensures security even if one layer fails

### 6. **Error Handling**
- Custom 404 page for unknown routes
- Custom 403 page for unauthorized access
- Graceful degradation on auth failures
- User-friendly error messages (no sensitive data exposed)

---

## Adding New Routes

### Frontend

1. **Add route to config** (`frontend/src/config/routes.ts`):
```typescript
PROTECTED_ROUTES = {
  NEW_ROLE: {
    NEW_PAGE: '/dashboard/new-role/new-page',
  }
}

ROUTE_ACCESS_CONTROL = {
  '/dashboard/new-role/new-page': [ROLES.NEW_ROLE],
}
```

2. **Add route to App.tsx**:
```typescript
<Route
  path={PROTECTED_ROUTES.NEW_ROLE.NEW_PAGE}
  element={
    <ProtectedRoute requiredRole={ROLES.NEW_ROLE}>
      <NewPage />
    </ProtectedRoute>
  }
/>
```

### Backend

1. **Add route to config** (`backend/src/config/routes.ts`):
```typescript
API_ROUTES = {
  NEW_FEATURE: {
    BASE: '/api/new-feature',
  }
}

ROUTE_ACCESS_CONTROL = {
  '/api/new-feature': ['new_role'],
}
```

2. **Create route handler** (`backend/src/routes/new-feature.ts`):
```typescript
import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../middleware/auth'

const newFeature = new Hono()

newFeature.get('/', 
  authMiddleware, 
  requireRole(['new_role']), 
  async (c) => {
    // Handler logic
  }
)

export default newFeature
```

3. **Register in index.ts**:
```typescript
import newFeature from './routes/new-feature'
app.route('/api/new-feature', newFeature)
```

---

## Testing & Validation

### Manual Testing Checklist

- [ ] **Unauthenticated Access**
  - Try accessing protected routes without login → Should redirect to login
  - Verify public routes (login, register) are accessible

- [ ] **Role-Based Access**
  - Login as each role
  - Try accessing routes for other roles → Should redirect to own dashboard
  - Verify role-specific routes are accessible

- [ ] **Token Expiry**
  - Wait for token to expire
  - Verify automatic refresh works
  - Check logout clears all cookies

- [ ] **Cross-Tab Behavior**
  - Login in one tab
  - Logout in another tab
  - Verify first tab detects logout within 30 seconds

- [ ] **Error Pages**
  - Navigate to non-existent route → Should show 404
  - Try accessing unauthorized route → Should show 403 or redirect

### Backend Testing

```bash
# Test authentication
curl -X GET http://localhost:3000/api/auth/me \
  --cookie "access_token=YOUR_TOKEN"

# Test role protection
curl -X GET http://localhost:3000/api/teams \
  --cookie "access_token=YOUR_TOKEN"
```

### Security Audit Points

1. **Token Security**
   - Tokens stored in HTTP-only cookies ✓
   - No tokens in localStorage ✓
   - Secure flag enabled ✓
   - SameSite=Strict ✓

2. **Role Validation**
   - Both frontend and backend validate ✓
   - No default roles ✓
   - Fresh role loaded from DB ✓

3. **Logging**
   - All access attempts logged ✓
   - Security violations logged ✓
   - PII not logged in production ✓

---

## Performance Optimizations

### Frontend
- **Memoized Components**: `ProtectedRoute` and `DashboardRedirect` use `React.memo()`
- **Context Optimization**: `AuthContext` value is memoized with `useMemo()`
- **Reduced Re-renders**: Loading states prevent component flashing
- **Efficient Polling**: 30-second auth check interval (configurable)

### Backend
- **Admin Client Caching**: Reused admin client for RLS bypass
- **Single DB Query**: Role loaded once per request
- **Efficient Middleware**: Early returns on auth failures
- **Request Logging**: Optional (can be disabled in production)

---

## Troubleshooting

### "Unauthorized" on valid token
- Check token expiry
- Verify user exists in database
- Ensure role is set in users table
- Check RLS policies

### Infinite redirect loop
- Verify role matches route requirements
- Check `ROLE_ROUTES` mapping is correct
- Ensure user has valid role in database

### Role not loading
- Check database connection
- Verify RLS policies allow user to read own role
- Check admin client credentials

### 403 Forbidden errors
- Verify user role matches route requirements
- Check `ROUTE_ACCESS_CONTROL` configuration
- Review backend logs for details

---

## Best Practices

1. **Always use route constants** - Never hardcode route paths
2. **Test with multiple roles** - Verify each role's access patterns
3. **Log security events** - Track unauthorized access attempts
4. **Keep frontend/backend in sync** - Update both route configs together
5. **Use TypeScript** - Leverage type safety for routes and roles
6. **Monitor auth failures** - Set up alerts for repeated failures
7. **Regular security audits** - Review access logs periodically

---

## Migration Notes

### From Old System
If migrating from the old routing system:

1. Replace hardcoded paths with `PUBLIC_ROUTES` and `PROTECTED_ROUTES` constants
2. Update all `<Navigate to="/login" />` to use `PUBLIC_ROUTES.LOGIN`
3. Replace manual role checks with `hasRouteAccess()` function
4. Add `requireRole()` middleware to all protected backend routes
5. Test thoroughly with each role

---

## Support

For questions or issues:
1. Check this guide first
2. Review security logs
3. Test with curl/Postman
4. Check browser console for frontend errors
5. Review backend logs for auth failures

**Last Updated:** November 2025

