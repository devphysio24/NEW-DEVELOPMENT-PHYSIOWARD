import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getDashboardRoute, hasRouteAccess, PUBLIC_ROUTES } from '../config/routes'
import type { UserRole } from '../types/roles'
import { memo } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: string
}

// Loading component - memoized to prevent unnecessary re-renders
const LoadingScreen = memo(() => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    flexDirection: 'column',
    gap: '16px'
  }}>
    <div className="spinner" style={{
      width: '48px',
      height: '48px',
      border: '4px solid #f3f3f3',
      borderTop: '4px solid #667eea',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <p style={{ color: '#4a5568', fontSize: '14px' }}>Loading...</p>
  </div>
))

LoadingScreen.displayName = 'LoadingScreen'

export const ProtectedRoute = memo(function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, role } = useAuth()
  const location = useLocation()

  // Show loading screen while authentication state is being determined
  if (loading) {
    return <LoadingScreen />
  }

  // No user - redirect to login with return path
  if (!user) {
    console.log('[ProtectedRoute] No user found - redirecting to login')
    return <Navigate to={PUBLIC_ROUTES.LOGIN} state={{ from: location }} replace />
  }

  console.log(`[ProtectedRoute] User ${user.email} (${user.id}) accessing ${location.pathname}. Role: ${role}, Required: ${requiredRole}`)

  // STRICT ROLE VALIDATION: If a role is required, we MUST have it loaded and it MUST match
  if (requiredRole) {
    // If role hasn't loaded yet, wait (don't allow access)
    if (!role) {
      console.warn(`[ProtectedRoute] Role required (${requiredRole}) but not loaded yet. Waiting...`)
      return <LoadingScreen />
    }

    // Check if user has access to this route
    if (!hasRouteAccess(location.pathname, role as UserRole)) {
      console.error(
        `[ProtectedRoute] SECURITY: Access denied! User ${user.email} (${user.id}) with role '${role}' ` +
        `attempted to access '${requiredRole}' route at ${location.pathname}. Redirecting to proper dashboard.`
      )
      
      // Redirect to user's proper dashboard
      const redirectPath = getDashboardRoute(role as UserRole)
      return <Navigate to={redirectPath} replace />
    }

    // Role matches - allow access
    console.log(`[ProtectedRoute] Access granted: User ${user.email} has required role '${requiredRole}'`)
  } else {
    // No specific role required, but user must be authenticated
    // Wait for role to load to prevent flashing
    if (!role) {
      return <LoadingScreen />
    }
  }

  return <>{children}</>
})
