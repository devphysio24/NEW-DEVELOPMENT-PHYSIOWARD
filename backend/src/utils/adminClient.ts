import { createClient } from '@supabase/supabase-js'

/**
 * Centralized admin client factory
 * Creates a Supabase admin client that bypasses RLS
 * Reuse this function instead of defining getAdminClient in each route file
 */
export function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

