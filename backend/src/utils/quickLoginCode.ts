import { getAdminClient } from './adminClient.js'

/**
 * Generates a unique 6-digit quick login code
 * Retries if code already exists (very unlikely)
 */
export async function generateUniqueQuickLoginCode(): Promise<string> {
  const adminClient = getAdminClient()
  const maxAttempts = 10
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate 6-digit code (100000-999999)
    // Using random ensures good distribution
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    
    // Check if code already exists
    const { data: existing } = await adminClient
      .from('users')
      .select('id')
      .eq('quick_login_code', code)
      .single()
    
    if (!existing) {
      console.log(`[generateUniqueQuickLoginCode] Generated unique code: ${code}`)
      return code
    }
    
    // If code exists, try again
    console.warn(`[generateUniqueQuickLoginCode] Code ${code} already exists, retrying... (attempt ${attempt + 1}/${maxAttempts})`)
  }
  
  // Fallback: use timestamp-based code if all attempts fail (extremely rare)
  const timestampCode = Date.now().toString().slice(-6)
  console.warn(`[generateUniqueQuickLoginCode] Using fallback timestamp code: ${timestampCode}`)
  return timestampCode
}

/**
 * Validates quick login code format
 * Accepts either:
 * - Old format: 6 digits (100000-999999)
 * - New format: lastname-number (e.g., delapiedra-232939)
 */
export function isValidQuickLoginCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false
  }
  const trimmedCode = code.trim()
  
  // Old format: 6 digits only
  const oldFormatRegex = /^\d{6}$/
  if (oldFormatRegex.test(trimmedCode)) {
    return true
  }
  
  // New format: lastname-number (e.g., delapiedra-232939)
  // Allows alphanumeric characters, dash, then numbers
  const newFormatRegex = /^[a-z0-9]+-[0-9]+$/i
  return newFormatRegex.test(trimmedCode)
}

/**
 * Generates a unique PIN in format "lastname-randomnumber" (e.g., "delapiedra-232939")
 * Optimized to prevent duplicates with multiple retry attempts and timestamp fallback
 */
export async function generateUniquePinCode(lastName: string): Promise<string> {
  const adminClient = getAdminClient()
  const maxAttempts = 30 // Increased attempts for better uniqueness
  
  // Sanitize last name: lowercase, remove spaces and special chars, keep only alphanumeric
  const sanitizedLastName = (lastName || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 20) // Limit length
  
  if (!sanitizedLastName) {
    throw new Error('Last name is required to generate PIN')
  }
  
  // Try multiple random numbers to ensure uniqueness
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random 6-digit number
    const randomNumber = Math.floor(100000 + Math.random() * 900000).toString()
    const pinCode = `${sanitizedLastName}-${randomNumber}`
    
    // Check if code already exists in database (optimized query with index)
    const { data: existing, error: checkError } = await adminClient
      .from('users')
      .select('id')
      .eq('quick_login_code', pinCode)
      .maybeSingle()
    
    if (checkError) {
      console.error(`[generateUniquePinCode] Error checking PIN: ${checkError.message}`)
      // Continue to next attempt on error
      continue
    }
    
    if (!existing) {
      console.log(`[generateUniquePinCode] Generated unique PIN: ${pinCode} (attempt ${attempt + 1})`)
      return pinCode
    }
    
    // If code exists, try again with different random number
    if (attempt < maxAttempts - 1) {
      console.warn(`[generateUniquePinCode] PIN ${pinCode} already exists, retrying... (attempt ${attempt + 1}/${maxAttempts})`)
    }
  }
  
  // Fallback: use timestamp + random suffix if all attempts fail (extremely rare)
  const timestampSuffix = Date.now().toString().slice(-6)
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  const fallbackPin = `${sanitizedLastName}-${timestampSuffix}${randomSuffix.slice(-3)}`
  
  // Final uniqueness check for fallback
  const { data: existingFallback } = await adminClient
    .from('users')
    .select('id')
    .eq('quick_login_code', fallbackPin)
    .maybeSingle()
  
  if (existingFallback) {
    // Last resort: add more randomness
    const lastResortPin = `${sanitizedLastName}-${Date.now()}${Math.floor(Math.random() * 10000)}`
    console.warn(`[generateUniquePinCode] Using last resort PIN: ${lastResortPin}`)
    return lastResortPin
  }
  
  console.warn(`[generateUniquePinCode] Using fallback timestamp PIN: ${fallbackPin}`)
  return fallbackPin
}

