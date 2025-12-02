/**
 * Image Validation Utility
 * Validates image files for upload
 */

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate image file for upload
 * @param file - File object to validate
 * @returns Validation result with error message if invalid
 */
export function validateImageFile(file: File): ValidationResult {
  // Check if file exists
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB` 
    }
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return { 
      valid: false, 
      error: `Invalid file type: ${file.type}. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}` 
    }
  }

  // Check file extension if filename is available
  if (file.name) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension && !ALLOWED_EXTENSIONS.includes(extension)) {
      return { 
        valid: false, 
        error: `Invalid file extension: .${extension}. Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}` 
      }
    }
  }

  return { valid: true }
}

/**
 * Get safe file extension from filename or MIME type
 * @param filename - Original filename
 * @param mimeType - Optional MIME type as fallback
 * @returns Safe file extension (without dot)
 */
export function getSafeExtension(filename: string, mimeType?: string): string {
  // Try to get extension from filename
  if (filename) {
    const parts = filename.split('.')
    if (parts.length > 1) {
      const ext = parts.pop()?.toLowerCase()
      if (ext && ALLOWED_EXTENSIONS.includes(ext)) {
        return ext
      }
    }
  }

  // Fallback to MIME type
  if (mimeType) {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    }
    const ext = mimeToExt[mimeType.toLowerCase()]
    if (ext) {
      return ext
    }
  }

  // Default to jpg
  return 'jpg'
}

/**
 * Check if a URL is a valid image URL
 * @param url - URL to check
 * @returns True if URL appears to be an image
 */
export function isImageUrl(url: string): boolean {
  if (!url) return false
  
  const lowerUrl = url.toLowerCase()
  return ALLOWED_EXTENSIONS.some(ext => 
    lowerUrl.endsWith(`.${ext}`) || 
    lowerUrl.includes(`.${ext}?`) ||
    lowerUrl.includes(`/${ext}/`)
  )
}
