import { Context, Next } from 'hono'
import { getCookie, getSignedCookie } from 'hono/cookie'
import { supabase } from '../lib/supabase.js'
import { getAdminClient } from '../utils/adminClient.js'

export interface User {
  id: string
  email: string
  role: string
}

export type AuthVariables = {
  user?: User
}

// Cookie names
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id', // Track which user owns this session
} as const

// Get token from cookies or Authorization header
function getToken(c: Context): string | null {
  // Try to get from secure cookie first (more secure)
  const cookieToken = getCookie(c, COOKIE_NAMES.ACCESS_TOKEN)
  if (cookieToken) {
    return cookieToken
  }

  // Fallback to Authorization header
  const authHeader = c.req.header('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  return null
}

export async function authMiddleware(c: Context<{ Variables: AuthVariables }>, next: Next) {
  try {
    const token = getToken(c)
    
    if (!token) {
      return c.json({ error: 'Unauthorized: No token provided' }, 401)
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      // Clear invalid cookies
      c.header('Set-Cookie', `${COOKIE_NAMES.ACCESS_TOKEN}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)
      c.header('Set-Cookie', `${COOKIE_NAMES.REFRESH_TOKEN}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)
      return c.json({ error: 'Unauthorized: Invalid token' }, 401)
    }

    // Get user role from database - try with regular client first
    let { data: userData, error: dbError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    // If query failed, try with admin client to bypass RLS
    if (dbError || !userData) {
      const adminClient = getAdminClient()
      const { data: adminUserData, error: adminError } = await adminClient
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (adminUserData) {
        // User exists in database - use their actual role
        userData = adminUserData
      } else {
        // User truly doesn't exist in database
        console.error(`[authMiddleware] User ${user.id} (${user.email}) not found in database`)
        return c.json({ error: 'Unauthorized: User not found' }, 401)
      }
    }

    // Ensure role exists - if not, this is a data integrity issue
    if (!userData || !userData.role) {
      console.error(`[authMiddleware] User ${user.id} (${user.email}) has no role assigned`)
      return c.json({ error: 'Unauthorized: User role not configured' }, 401)
    }

    // Attach user info to context with actual role from database
    c.set('user', {
      id: user.id,
      email: user.email || '',
      role: userData.role, // Use actual role, no default
    })

    await next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return c.json({ error: 'Unauthorized: Token verification failed' }, 401)
  }
}

export function requireRole(allowedRoles: string[]) {
  return async (c: Context<{ Variables: AuthVariables }>, next: Next) => {
    const user = c.get('user')
    const path = c.req.path
    const method = c.req.method

    if (!user) {
      console.error(`[requireRole] No user in context for ${method} ${path}`)
      return c.json({ error: 'Unauthorized: User not found in context' }, 401)
    }

    if (!allowedRoles.includes(user.role)) {
      console.error(
        `[requireRole] SECURITY: Access denied for user ${user.email} (${user.id}) ` +
        `with role '${user.role}' attempting ${method} ${path}. ` +
        `Required roles: ${allowedRoles.join(', ')}`
      )
      return c.json(
        { 
          error: 'Forbidden: Insufficient permissions',
          required_roles: allowedRoles,
          your_role: user.role
        },
        403
      )
    }

    console.log(
      `[requireRole] Access granted: ${user.email} (${user.role}) -> ${method} ${path}`
    )

    await next()
  }
}

/**
 * Middleware to log all incoming requests with authentication info
 */
export async function requestLogger(c: Context<{ Variables: AuthVariables }>, next: Next) {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  const user = c.get('user')
  
  console.log(
    `[Request] ${method} ${path} | User: ${user ? `${user.email} (${user.role})` : 'anonymous'}`
  )
  
  await next()
  
  const duration = Date.now() - start
  console.log(
    `[Response] ${method} ${path} | Status: ${c.res.status} | Duration: ${duration}ms`
  )
}

