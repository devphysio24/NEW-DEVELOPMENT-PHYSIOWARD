import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { PUBLIC_ROUTES, isPublicRoute, getDashboardRoute } from '../config/routes'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService } from '../services/authService'
import { apiClient, isApiError } from '../lib/apiClient'

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']
type User = NonNullable<Session>['user']

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  role: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  phone: string | null
  business_name: string | null
  business_registration_number: string | null
  signOut: () => Promise<void>
  setRole: (role: string | null) => void
  refreshAuth: () => Promise<void>
  setUserFromLogin: (userData: { id: string; email: string; role: string; first_name?: string; last_name?: string; full_name?: string }) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/* @refresh reset */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    user: null as User | null,
    session: null as Session | null,
    role: null as string | null,
    first_name: null as string | null,
    last_name: null as string | null,
    full_name: null as string | null,
    phone: null as string | null,
    business_name: null as string | null,
    business_registration_number: null as string | null,
  })
  const [loading, setLoading] = useState(true)

  const navigate = useNavigate()
  const location = useLocation()
  const userRef = useRef<User | null>(null)
  const isLoggedOutRef = useRef(false) // Track logout state to prevent requests
  const abortControllerRef = useRef<AbortController | null>(null) // Cancel pending requests on logout

  // 🧩 Utility: safe API call with graceful error handling
  const safeApiCall = useCallback(async () => {
    // Don't make requests if user is logged out
    if (isLoggedOutRef.current) {
      return { data: null, error: 401 }
    }
    
    // Create new AbortController for this request
    const controller = new AbortController()
    abortControllerRef.current = controller
    
    try {
      const result = await apiClient.get(
        '/api/auth/me',
        {
          signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache' },
        }
      )
      
      // Clear controller after request completes
      abortControllerRef.current = null
      
      if (isApiError(result)) {
        // Silently handle 401 errors (user is logged out)
        if (result.error.status === 401) {
          return { error: 401, data: null }
        }
        return { error: result.error.status || 'network', data: null }
      }
      
      return { data: result.data, error: null }
    } catch (err: any) {
      // Clear controller on error
      abortControllerRef.current = null
      
      // Don't log AbortError (request was cancelled intentionally)
      if (err.name === 'AbortError') {
        return { data: null, error: 'aborted' }
      }
      
      // Only log network errors if user is not logged out
      if (!isLoggedOutRef.current) {
        console.warn('[Auth] Network error:', (err as Error).message)
      }
      return { data: null, error: 'network' }
    }
  }, [])

  // ⚡ Core: Fetch user + role from backend
  const fetchUserAndRole = useCallback(
    async ({
      isInitialLoad = false,
      force = false,
    }: { isInitialLoad?: boolean; force?: boolean } = {}) => {
      // Don't fetch if user is logged out
      if (isLoggedOutRef.current) {
        return
      }

      const path = location.pathname
      const isPublic = isPublicRoute(path)

      // SECURITY: Always check authentication on initial load, even on public routes
      // This ensures we detect if user is already logged in (has cookies) and redirect them
      // Only skip check if it's not initial load, not forced, and we're on a public route with no user
      if (isPublic && !userRef.current && !force && !isInitialLoad) {
        if (import.meta.env.DEV)
          console.log(`[Auth] Skipping check on public route: ${path}`)
        return
      }

      const { data, error } = await safeApiCall()

      // Silently handle 401 errors (user is logged out or session expired)
      if (error === 401 || !data?.user) {
        // Only update state if not already logged out
        if (!isLoggedOutRef.current) {
          // IMPORTANT: On initial load, check if token exists in localStorage
          // If token exists, don't clear user state immediately - might be a timing issue
          if (isInitialLoad) {
            const hasToken = localStorage.getItem('auth_token')
            if (hasToken && hasToken.trim().length > 0) {
              // Token exists but API call failed - likely timing issue or token needs refresh
              // Don't clear user state immediately, let retry logic handle it
              console.warn('[Auth] Initial load failed but token exists in localStorage - will retry')
              // Don't return - let the code continue to handle retry
              // But don't clear state yet
              if (userRef.current) {
                // User exists in ref - keep it
                return
              }
              // No user in ref but token exists - might be expired, but don't clear immediately
              // The ProtectedRoute will show loading while we retry
              return
            }
          }
          
          // IMPORTANT: Don't clear user state on initial load if user already exists
          // This prevents clearing user state right after login (mobile cookie timing issue)
          // If user exists in state, keep it and let subsequent requests verify
          if (isInitialLoad && userRef.current) {
            // User exists but API call failed - likely cookie timing issue on mobile
            // Don't clear user state, just log warning
            if (import.meta.env.DEV) {
              console.warn('[Auth] Initial load failed but user exists - likely cookie timing issue, keeping user state')
            }
            return
          }
          
          if (isInitialLoad) {
            setState((s) => ({
              ...s,
              user: null,
              session: null,
              role: null,
              first_name: null,
              last_name: null,
              full_name: null,
              phone: null,
              business_name: null,
              business_registration_number: null,
            }))
          }
        }
        return
      }

      // ✅ Construct new user/session objects
      const userObj: User = {
        id: data.user.id,
        email: data.user.email || '',
        created_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        confirmed_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
        role: 'authenticated',
        updated_at: new Date().toISOString(),
      }

      const newSession: Session = {
        access_token: '',
        refresh_token: '',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: userObj,
      }

      userRef.current = userObj
      // Reset logout flag when user successfully authenticates
      isLoggedOutRef.current = false

      const userRole = data.user.role || null

      setState({
        user: userObj,
        session: newSession,
        role: userRole,
        first_name: data.user.first_name || null,
        last_name: data.user.last_name || null,
        full_name: data.user.full_name || null,
        phone: data.user.phone || null,
        business_name: data.user.business_name || null,
        business_registration_number:
          data.user.business_registration_number || null,
      })

      // SECURITY: Redirect authenticated users away from public routes (login/register)
      // Only redirect on initial load to prevent redirect loops
      if (isInitialLoad && isPublic && userRole) {
        const dashboardRoute = getDashboardRoute(userRole as any)
        if (dashboardRoute && dashboardRoute !== path) {
          if (import.meta.env.DEV) {
            console.log(`[Auth] Redirecting authenticated user from ${path} to ${dashboardRoute}`)
          }
          // Use replace to prevent back button from going to login
          navigate(dashboardRoute, { replace: true })
        }
      }
    },
    [location.pathname, safeApiCall, navigate]
  )

  // 🕒 Initial + Polling Logic
  useEffect(() => {
    let mounted = true
    let interval: ReturnType<typeof setInterval>

    // On initial load, check if token exists in localStorage
    // If token exists, retry a few times before giving up
    const initialLoad = async () => {
      const hasToken = localStorage.getItem('auth_token')
      if (hasToken && hasToken.trim().length > 0) {
        // Token exists - retry up to 3 times with delays
        let retries = 3
        while (retries > 0 && mounted) {
          try {
            await fetchUserAndRole({ isInitialLoad: true, force: true })
            // If we got user data, break
            if (userRef.current) {
              break
            }
            // Wait before retry (increasing delay)
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)))
            retries--
          } catch (err) {
            console.warn('[Auth] Initial load retry failed:', err)
            await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)))
            retries--
          }
        }
      } else {
        // No token - just do normal fetch
        await fetchUserAndRole({ isInitialLoad: true })
      }
    }

    initialLoad().finally(() => {
      if (mounted) setLoading(false)
    })

    const poll = () => {
      // Don't poll if user is logged out
      if (isLoggedOutRef.current) {
        return
      }
      const path = location.pathname
      if (userRef.current || !isPublicRoute(path)) {
        fetchUserAndRole()
      }
    }

    interval = setInterval(poll, 60000)

    // Only refresh on visibility change if user is on a public route or not authenticated
    // This prevents unnecessary refreshes when switching tabs on dashboard pages
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Only poll if user is not authenticated or on a public route
        // This prevents dashboard from refreshing when switching tabs
        const path = location.pathname
        if (!userRef.current || isPublicRoute(path)) {
          poll()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      mounted = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchUserAndRole, location.pathname])

  // 🚪 Logout handler
  const signOut = useCallback(async () => {
    // Mark as logged out immediately to prevent any further requests
    isLoggedOutRef.current = true
    userRef.current = null
    
    // Cancel any pending fetch requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    
    // Clear state immediately to prevent any UI flashing
    setState({
      user: null,
      session: null,
      role: null,
      first_name: null,
      last_name: null,
      full_name: null,
      phone: null,
      business_name: null,
      business_registration_number: null,
    })
    
    try {
      // Clear browser storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Call logout endpoint to clear server-side cookies
      try {
        await authService.logout()
      } catch (err) {
        // Silently handle logout request errors
        console.warn('[Auth] Logout request failed:', err)
      }
    } catch (err) {
      // Silently handle logout errors
      console.warn('[Auth] Logout error:', err)
    } finally {
      // Force full page reload to /login to ensure clean state
      // This clears any cached data and ensures fresh login
      window.location.href = PUBLIC_ROUTES.LOGIN
    }
  }, [])

  const refreshAuth = useCallback(async () => {
    // Retry logic for mobile - cookies might need time to be processed
    let retries = 3
    let lastError = null
    
    while (retries > 0) {
      try {
        await fetchUserAndRole({ force: true })
        // If successful, check if we got user data
        if (userRef.current) {
          return // Success - user is loaded
        }
        // If no user but no error, wait and retry
        await new Promise(resolve => setTimeout(resolve, 500))
        retries--
      } catch (error) {
        lastError = error
        await new Promise(resolve => setTimeout(resolve, 500))
        retries--
      }
    }
    
    // If all retries failed, log but don't throw (let ProtectedRoute handle it)
    if (lastError) {
      console.warn('[refreshAuth] Failed after retries:', lastError)
    }
  }, [fetchUserAndRole])

  // Set user state directly from login response (before cookies are fully processed)
  const setUserFromLogin = useCallback((userData: { id: string; email: string; role: string; first_name?: string; last_name?: string; full_name?: string }) => {
    const userObj: User = {
      id: userData.id,
      email: userData.email,
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      confirmed_at: new Date().toISOString(),
      last_sign_in_at: new Date().toISOString(),
      role: 'authenticated',
      updated_at: new Date().toISOString(),
    }

    const newSession: Session = {
      access_token: '',
      refresh_token: '',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: userObj,
    }

    userRef.current = userObj
    isLoggedOutRef.current = false

    const fullName = userData.full_name || 
                     (userData.first_name && userData.last_name 
                       ? `${userData.first_name} ${userData.last_name}` 
                       : userData.email?.split('@')[0] || 'User')

    setState({
      user: userObj,
      session: newSession,
      role: userData.role,
      first_name: userData.first_name || null,
      last_name: userData.last_name || null,
      full_name: fullName,
      phone: null,
      business_name: null,
      business_registration_number: null,
    })
  }, [])

  // 🧠 Stable context value
  const contextValue = useMemo<AuthContextType>(
    () => ({
      ...state,
      loading,
      signOut,
      setRole: (role) => setState((s) => ({ ...s, role })),
      refreshAuth,
      setUserFromLogin,
    }),
    [state, loading, signOut, refreshAuth, setUserFromLogin]
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

/* @refresh reset */
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
