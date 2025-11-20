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

