import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { API_BASE_URL } from '../config/api'
import { PUBLIC_ROUTES } from '../config/routes'
import { useNavigate } from 'react-router-dom'

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
type User = NonNullable<Session>['user']

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  role: string | null
  setRole: (role: string | null) => void
  refreshAuth: () => Promise<void>
  first_name: string | null
  last_name: string | null
  full_name: string | null
  phone: string | null
  business_name: string | null
  business_registration_number: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/* @refresh reset */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [first_name, setFirstName] = useState<string | null>(null)
  const [last_name, setLastName] = useState<string | null>(null)
  const [full_name, setFullName] = useState<string | null>(null)
  const [phone, setPhone] = useState<string | null>(null)
  const [business_name, setBusinessName] = useState<string | null>(null)
  const [business_registration_number, setBusinessRegistrationNumber] = useState<string | null>(null)
  const navigate = useNavigate()
  const userRef = useRef<User | null>(null) // Track user state without causing re-renders

  // Update ref when user changes
  useEffect(() => {
    userRef.current = user
  }, [user])

  const fetchUserAndRole = useCallback(async (isInitialLoad = false) => {
    try {
      // Use backend API to get user info (includes role) - cookies only, no localStorage
      // The /me endpoint now automatically handles token refresh if needed
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include', // Important: sends cookies
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache', // Force fresh data
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.user) {
          // Create a minimal user object for compatibility
          const userObj: User = {
            id: data.user.id,
            email: data.user.email || '',
            created_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            confirmation_sent_at: undefined,
            recovery_sent_at: undefined,
            email_change_sent_at: undefined,
            new_email: undefined,
            invited_at: undefined,
            action_link: undefined,
            email_confirmed_at: new Date().toISOString(),
            phone: undefined,
            confirmed_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
            role: 'authenticated',
            updated_at: new Date().toISOString(),
          }
          
          // CRITICAL: Detect if user changed (different user logged in)
          // This should NOT happen if using different browsers (cookies are isolated)
          // This WILL happen if using same browser different tabs (cookies are shared)
          if (userRef.current && userRef.current.id !== userObj.id) {
            console.error(`[AuthContext] 🚨 SECURITY: User changed from ${userRef.current.id} (${userRef.current.email}) to ${userObj.id} (${userObj.email})`)
            console.error(`[AuthContext] Old role was stored in state, new role: ${data.user.role}`)
            console.error(`[AuthContext] If you're using DIFFERENT browsers, this is a BUG! Cookies should be isolated.`)
            console.error(`[AuthContext] If you're using SAME browser different tabs, this is EXPECTED (cookies are shared).`)
            // Different user logged in - update the state to reflect the new user
            // This is normal if they logged in on another tab in same browser
          }
          
          setUser(userObj)
          // Don't default to 'worker' - if role is missing, set to null and let the system handle it
          setRole(data.user.role || null)
          setFirstName(data.user.first_name || null)
          setLastName(data.user.last_name || null)
          setFullName(data.user.full_name || null)
          setPhone(data.user.phone || null)
          setBusinessName(data.user.business_name || null)
          setBusinessRegistrationNumber(data.user.business_registration_number || null)
          console.log(`[AuthContext] User session updated: ${userObj.id} (${userObj.email}), role: ${data.user.role || 'null'}, name: ${data.user.first_name || ''} ${data.user.last_name || ''}, business: ${data.user.business_name || 'none'}, isInitialLoad: ${isInitialLoad}`)
          
          // Create a minimal session object for compatibility
          setSession({
            access_token: '', // Not needed - we use cookies
            refresh_token: '', // Not needed - we use cookies
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer',
            user: userObj,
          })
          return // Success - exit early
        } else {
          // No user in response - only clear state if we had a user AND it's initial load
          // Don't clear during polling to prevent false logouts
            if (userRef.current && isInitialLoad) {
              console.log('No user in response during initial load - clearing state')
              setUser(null)
              setRole(null)
              setFirstName(null)
              setLastName(null)
              setFullName(null)
              setPhone(null)
              setBusinessName(null)
              setBusinessRegistrationNumber(null)
              setSession(null)
            }
          // During polling, just keep existing state
        }
      } else if (response.status === 401) {
        // Unauthorized - The /me endpoint already tried to refresh the token
        // Only clear state on initial load, not during polling
        // This prevents clearing state when another user logs in on different browser
          if (userRef.current && isInitialLoad) {
            console.log(`[AuthContext] Session invalidated during initial load - clearing user state. Current user: ${userRef.current.id} (${userRef.current.email})`)
            setRole(null)
            setUser(null)
            setFirstName(null)
            setLastName(null)
            setFullName(null)
            setPhone(null)
            setBusinessName(null)
            setSession(null)
        } else if (userRef.current && !isInitialLoad) {
          // During polling, log but don't clear - might be temporary
          console.warn(`[AuthContext] Got 401 during polling for user: ${userRef.current.id} (${userRef.current.email}), but keeping state - will retry next poll`)
        }
      } else if (response.status === 404) {
        // 404 errors should not happen for /me endpoint, but handle gracefully
        console.warn('Unexpected 404 from /api/auth/me')
        // Don't clear state for 404 - might be temporary server issue
      } else {
        // Unknown error - don't clear state if it's a server error
        // Only clear if we get a specific forbidden error AND it's initial load
          if (response.status === 403 && isInitialLoad) {
            console.log('Access forbidden during initial load - clearing user state')
            setRole(null)
            setUser(null)
            setFirstName(null)
            setLastName(null)
            setFullName(null)
            setPhone(null)
            setBusinessName(null)
            setSession(null)
          }
        // For other errors (500, network, etc.), keep existing state
        // This prevents false logouts due to temporary server issues
      }
    } catch (error: any) {
      // Network errors or fetch failures - don't clear state
      // This prevents false logouts due to network issues
      // Only log the error, keep existing user state
      if (error?.message?.includes('Failed to fetch')) {
        // Network error - keep existing state
        console.warn('Network error checking auth status, keeping existing state:', error.message)
      } else {
        console.error('Error fetching user and role:', error)
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    let refreshInterval: ReturnType<typeof setInterval> | null = null

    // Initial load - check backend cookie only (no localStorage)
    // Pass isInitialLoad=true to allow clearing state if needed
    // ALWAYS fetch fresh user data on mount to ensure correct user
    console.log('[AuthContext] Initial mount - fetching user from backend...')
    fetchUserAndRole(true).then(() => {
      if (isMounted) {
        setLoading(false)
        console.log('[AuthContext] Initial user fetch complete')
      }
    })

    // Poll backend cookie every 60 seconds to check session validity
    // This ensures user data stays fresh without excessive polling
    refreshInterval = setInterval(() => {
      if (isMounted) {
        console.log('[AuthContext] Polling user session...')
        fetchUserAndRole(false)
      }
    }, 60000) // Check every 60 seconds

    return () => {
      isMounted = false
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [fetchUserAndRole])

  const signOut = async () => {
    try {
      // Ensure any localStorage/sessionStorage is cleared (safety measure)
      // Even though we don't use it, some libraries might write to it
      try {
        localStorage.clear()
        sessionStorage.clear()
      } catch (e) {
        // Ignore errors (might not be available in all contexts)
      }

      // Call backend logout to clear cookies (cookies only, no localStorage)
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Important: sends cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local state only (cookies cleared by backend)
      setUser(null)
      setSession(null)
      setRole(null)
      setFirstName(null)
      setLastName(null)
      setFullName(null)
      setPhone(null)
      navigate(PUBLIC_ROUTES.LOGIN)
    }
  }

  // Wrapper for refreshAuth to always use initial load behavior
  const refreshAuth = useCallback(async () => {
    await fetchUserAndRole(true)
  }, [fetchUserAndRole])

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      user,
      session,
      loading,
      signOut,
      role,
      setRole,
      refreshAuth,
      first_name,
      last_name,
      full_name,
      phone,
      business_name,
      business_registration_number,
    }),
    [user, session, loading, signOut, role, setRole, refreshAuth, first_name, last_name, full_name, phone, business_name, business_registration_number]
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

/* @refresh reset */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

