import { Context, Next } from 'hono'

/**
 * Security headers middleware
 * Adds security headers to all responses
 */
export async function securityHeaders(c: Context, next: Next) {
  await next()

  // Security headers
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // Remove server information
  c.header('X-Powered-By', '')
  
  // Content Security Policy (adjust based on your needs)
  if (process.env.NODE_ENV === 'production') {
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co;"
    )
  }
}

/**
 * Request size limit middleware
 * Prevents large payload attacks
 */
export async function requestSizeLimit(c: Context, next: Next) {
  const contentLength = c.req.header('content-length')
  
  // Limit request body to 1MB (1048576 bytes)
  const maxSize = 1024 * 1024 // 1MB
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return c.json({ 
      error: 'Request too large',
      message: 'Request body exceeds maximum size limit of 1MB'
    }, 413)
  }

  await next()
}

/**
 * Input sanitization helper
 * Removes potentially dangerous characters
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  
  // Remove null bytes and control characters (except newlines and tabs)
  return input
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string' || !email.trim()) {
    return false
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Validate name (first name, last name)
 * Allows letters, spaces, hyphens, apostrophes
 */
export function isValidName(name: string): boolean {
  if (typeof name !== 'string' || !name.trim()) {
    return false
  }
  
  // Allow letters, spaces, hyphens, apostrophes
  // Max length 100 characters
  const nameRegex = /^[a-zA-Z\s'-]{1,100}$/
  return nameRegex.test(name.trim())
}

/**
 * Validate password strength
 */
export function isValidPassword(password: string): boolean {
  if (typeof password !== 'string') {
    return false
  }
  
  // Minimum 6 characters, maximum 128 characters
  return password.length >= 6 && password.length <= 128
}

/**
 * Rate limiting map (simple in-memory rate limiter)
 * In production, use Redis or similar
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

/**
 * Simple rate limiting middleware
 * Limits requests per IP address
 */
export async function rateLimiter(c: Context, next: Next) {
  // Skip rate limiting for health checks
  if (c.req.path === '/health') {
    await next()
    return
  }

  const clientIP = c.req.header('x-forwarded-for')?.split(',')[0] || 
                   c.req.header('x-real-ip') || 
                   'unknown'
  
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window
  const maxRequests = 100 // 100 requests per minute per IP

  const key = `${clientIP}:${c.req.path}`
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetAt) {
    // Create new rate limit record
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })
    await next()
    return
  }

  if (record.count >= maxRequests) {
    return c.json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    }, 429)
  }

  // Increment count
  record.count++
  rateLimitMap.set(key, record)

  // Clean up old entries periodically (every 5 minutes)
  if (Math.random() < 0.01) { // 1% chance to clean up
    for (const [k, v] of rateLimitMap.entries()) {
      if (now > v.resetAt) {
        rateLimitMap.delete(k)
      }
    }
  }

  await next()
}

