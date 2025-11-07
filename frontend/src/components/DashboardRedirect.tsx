import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getDashboardRoute, PUBLIC_ROUTES } from '../config/routes'
import type { UserRole } from '../types/roles'
import { memo } from 'react'

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

export const DashboardRedirect = memo(function DashboardRedirect() {
  const { user, loading, role } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    console.log('[DashboardRedirect] No user - redirecting to login')
    return <Navigate to={PUBLIC_ROUTES.LOGIN} replace />
  }

  // Wait for role to load if we have a user but no role yet
  if (user && !role) {
    console.log('[DashboardRedirect] User exists but role not loaded yet - waiting...')
    return <LoadingScreen />
  }

  // Only redirect if we have a valid role
  if (!role) {
    console.error('[DashboardRedirect] User exists but no role found - redirecting to login')
    return <Navigate to={PUBLIC_ROUTES.LOGIN} replace />
  }

  // Redirect to role-specific dashboard
  const redirectPath = getDashboardRoute(role as UserRole)
  console.log(`[DashboardRedirect] Redirecting user ${user.email} with role '${role}' to ${redirectPath}`)
  
  return <Navigate to={redirectPath} replace />
})
