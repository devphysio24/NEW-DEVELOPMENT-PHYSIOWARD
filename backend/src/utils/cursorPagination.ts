/**
 * Cursor Pagination Utilities
 * 
 * Provides type-safe cursor encoding/decoding for pagination.
 * Uses base64 encoding for URL-safe cursor strings.
 */

export interface CursorData {
  id?: string
  loginAt?: string
  login_at?: string
  createdAt?: string
  created_at?: string
  [key: string]: string | undefined
}

/**
 * Encode cursor data to a base64 string
 * @param data - The cursor data to encode
 * @returns Base64-encoded cursor string
 */
export function encodeCursor(data: CursorData): string {
  try {
    return Buffer.from(JSON.stringify(data)).toString('base64')
  } catch (error) {
    throw new Error('Failed to encode cursor: Invalid data provided')
  }
}

/**
 * Decode a base64 cursor string to cursor data
 * @param cursor - The base64-encoded cursor string
 * @returns Decoded cursor data or null if invalid
 */
export function decodeCursor(cursor: string): CursorData | null {
  if (!cursor || typeof cursor !== 'string') {
    return null
  }

  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
    const data = JSON.parse(decoded) as CursorData
    
    // Validate that we got an object
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return null
    }
    
    return data
  } catch (error) {
    // Invalid cursor format - return null to start from beginning
    return null
  }
}

/**
 * Extract date from cursor data for filtering
 * Tries multiple common date field names
 * @param cursorData - Decoded cursor data
 * @returns Date string or null if not found
 */
export function extractCursorDate(cursorData: CursorData | null): string | null {
  if (!cursorData) {
    return null
  }

  // Try common date field names in order of preference
  // Supports both camelCase and snake_case conventions
  const dateFields = ['loginAt', 'login_at', 'createdAt', 'created_at', 'updatedAt', 'updated_at']
  
  for (const field of dateFields) {
    const dateValue = cursorData[field]
    if (dateValue && typeof dateValue === 'string') {
      return dateValue
    }
  }
  
  return null
}

