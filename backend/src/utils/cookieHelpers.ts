/**
 * Get SameSite cookie value for authentication
 * In production (cross-origin), always use 'None' for both mobile and desktop
 * In development (same-origin), use 'Lax'
 */
export function getCookieSameSite(userAgent: string | undefined): 'None' | 'Lax' {
  const isProduction = process.env.NODE_ENV === 'production'
  
  // In production, frontend (Vercel) and backend (Render) are different domains
  // So we need SameSite=None for cross-origin cookies to work
  // This applies to both mobile and desktop
  if (isProduction) return 'None'
  
  // In development, same-origin, so Lax is fine
  return 'Lax'
}

/**
 * Check if Partitioned attribute should be used
 * Required for SameSite=None; Secure cookies in modern browsers to prevent blocking
 * See: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#partitioned
 */
export function shouldUsePartitioned(): boolean {
  const isProduction = process.env.NODE_ENV === 'production'
  // Only use Partitioned in production when SameSite=None (cross-origin)
  // This prevents cookies from being blocked by modern browsers
  return isProduction
}

