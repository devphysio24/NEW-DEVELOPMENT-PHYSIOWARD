/**
 * Secure JSON parsing utility with error handling
 */

/**
 * Safely parses JSON response from fetch API
 */
export async function safeJsonParse<T = any>(response: Response): Promise<T | null> {
  try {
    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()
    
    if (!contentType.includes('application/json')) {
      console.error('Response is not JSON. Content-Type:', contentType)
      return null
    }

    if (!text?.trim()) return null

    return JSON.parse(text.replace(/^\uFEFF/, '').trim()) as T
  } catch (error) {
    console.error('JSON parse error:', error)
    return null
  }
}

/**
 * Handles API response with error handling
 */
export async function handleApiResponse<T = any>(
  response: Response
): Promise<{ success: boolean; data?: T; error?: string }> {
  const data = await safeJsonParse<T>(response)
  
  if (!data) {
    return {
      success: false,
      error: response.statusText || 'Invalid response format'
    }
  }

  if (!response.ok) {
    return {
      success: false,
      error: (data as any).error || response.statusText || 'Request failed'
    }
  }

  return { success: true, data }
}

/**
 * Sanitizes string input
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return ''
  return input.trim().replace(/[<>]/g, '').slice(0, 1000)
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Validates business registration number format
 */
export function isValidBusinessRegNumber(regNumber: string): boolean {
  if (!regNumber || typeof regNumber !== 'string') return false
  return /^[A-Za-z0-9\s\-]{3,50}$/.test(regNumber.trim())
}

