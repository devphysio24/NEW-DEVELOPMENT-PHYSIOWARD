import { getAdminClient } from './adminClient.js'

/**
 * Ensures a user record exists in the database.
 * If user exists in Supabase Auth but not in database, auto-creates a user record.
 * This is a shared utility to avoid code duplication across endpoints.
 * 
 * @param userId - The user ID from Supabase Auth
 * @param email - The user's email
 * @returns User data or null if creation failed
 */
export async function ensureUserRecordExists(userId: string, email: string): Promise<{
  id: string
  email: string
  role: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
} | null> {
  const adminClient = getAdminClient()
  
  // Check if user record exists
  const { data: existingUser, error: fetchError } = await adminClient
    .from('users')
    .select('id, email, role, first_name, last_name, full_name')
    .eq('id', userId)
    .single()
  
  if (existingUser && !fetchError) {
    return existingUser
  }
  
  // User doesn't exist in database - auto-create with default role
  if (fetchError && fetchError.code === 'PGRST116') {
    console.log(`[ensureUserRecordExists] User exists in Supabase Auth but not in database. Auto-creating user record: ${userId}`)
    
    // Use email prefix as name if not available
    const emailPrefix = email?.split('@')[0] || 'User'
    
    const { data: newUser, error: createError } = await adminClient
      .from('users')
      .insert([
        {
          id: userId,
          email: email,
          role: 'worker', // Default role
          first_name: emailPrefix,
          last_name: '', // Empty for auto-created users
          full_name: emailPrefix, // Set for backward compatibility
          created_at: new Date().toISOString(),
        },
      ])
      .select('id, email, role, first_name, last_name, full_name')
      .single()
    
    if (createError || !newUser) {
      console.error('[ensureUserRecordExists] Failed to auto-create user record:', createError)
      return null
    }
    
    console.log('[ensureUserRecordExists] User record auto-created successfully:', newUser.id)
    return newUser
  }
  
  // Other error occurred
  console.error('[ensureUserRecordExists] Error checking user existence:', fetchError)
  return null
}

