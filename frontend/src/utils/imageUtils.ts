/**
 * Image URL Utilities
 * Centralized handling of profile image URLs with security and optimization
 */

import { API_BASE_URL } from '../config/api'
import { API_ROUTES } from '../config/apiRoutes'

/**
 * Get profile image URL with proxy fallback
 * Security: Uses backend proxy for R2 images to avoid CORS issues
 * Performance: URL contains timestamp from filename, no need for cache busting
 * 
 * @param profileImageUrl - The stored profile image URL from database
 * @param userId - User ID for proxy endpoint
 * @returns Optimized image URL or null
 */
export function getProfileImageUrl(
  profileImageUrl: string | null | undefined,
  userId: string | null | undefined
): string | null {
  if (!profileImageUrl) return null
  
  // Security: Validate URL format to prevent XSS
  try {
    new URL(profileImageUrl)
  } catch {
    console.error('[ImageUtils] Invalid URL format:', profileImageUrl)
    return null
  }
  
  // If URL contains R2 public domain, use proxy as fallback
  // This works even if DNS hasn't propagated and avoids CORS issues
  if (profileImageUrl.includes('.r2.dev') && userId) {
    // Use proxy endpoint that serves images through backend
    // Extract timestamp from filename for cache busting
    // Format: profile-{uuid}-{timestamp}-{random}.{ext}
    const timestampMatch = profileImageUrl.match(/-(\d+)-[a-z0-9]+\.(jpg|jpeg|png|gif|webp)$/i)
    const timestamp = timestampMatch ? timestampMatch[1] : Date.now()
    
    return `${API_BASE_URL}${API_ROUTES.AUTH.PROFILE_IMAGE_PROXY(userId)}?v=${timestamp}`
  }
  
  // For other URLs (custom domains, CDN), use directly
  // Extract timestamp from filename for cache busting
  const timestampMatch = profileImageUrl.match(/-(\d+)-[a-z0-9]+\.(jpg|jpeg|png|gif|webp)$/i)
  const timestamp = timestampMatch ? timestampMatch[1] : ''
  
  if (timestamp) {
    const separator = profileImageUrl.includes('?') ? '&' : '?'
    return `${profileImageUrl}${separator}v=${timestamp}`
  }
  
  return profileImageUrl
}

/**
 * Check if image URL is from R2 storage
 * Used for conditional logic (e.g., different caching strategies)
 */
export function isR2Url(url: string | null | undefined): boolean {
  if (!url) return false
  return url.includes('.r2.dev') || url.includes('r2.cloudflarestorage.com')
}

/**
 * Validate image file on client side before upload
 * Security: Client-side validation as first line of defense
 * Note: Server-side validation is still required
 */
export interface ImageValidation {
  valid: boolean
  error?: string
}

export function validateImageFile(file: File): ImageValidation {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.'
    }
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size exceeds 5MB. Please choose a smaller image.'
    }
  }

  // Validate file extension
  const extension = file.name.split('.').pop()?.toLowerCase()
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp']
  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: 'Invalid file extension. Allowed: jpg, jpeg, png, gif, webp'
    }
  }

  return { valid: true }
}

