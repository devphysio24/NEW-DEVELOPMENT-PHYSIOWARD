/**
 * Executive Helper Utilities
 * Centralized functions for executive-related operations to reduce duplication
 */

import { getAdminClient } from './adminClient.js'

export interface ExecutiveBusinessInfo {
  business_name: string
  business_registration_number: string
}

/**
 * Get executive's business information
 * Returns null if executive doesn't have business info or if there's an error
 */
export async function getExecutiveBusinessInfo(
  executiveId: string
): Promise<{ data: ExecutiveBusinessInfo | null; error: string | null }> {
  try {
    const adminClient = getAdminClient()
    const { data: executiveData, error: executiveError } = await adminClient
      .from('users')
      .select('business_name, business_registration_number')
      .eq('id', executiveId)
      .single()

    if (executiveError || !executiveData) {
      console.error('Error fetching executive data:', executiveError)
      return {
        data: null,
        error: executiveError?.message || 'Failed to fetch executive data',
      }
    }

    // Validate executive has business info
    if (!executiveData.business_name || !executiveData.business_registration_number) {
      return {
        data: null,
        error: null, // No error, just missing business info
      }
    }

    return {
      data: {
        business_name: executiveData.business_name,
        business_registration_number: executiveData.business_registration_number,
      },
      error: null,
    }
  } catch (error: any) {
    console.error('Error in getExecutiveBusinessInfo:', error)
    return {
      data: null,
      error: error.message || 'Failed to fetch executive business info',
    }
  }
}

/**
 * Cascade business info update to all users under an executive
 * Updates all supervisors, clinicians, and whs_control_center users with matching business info
 */
export async function cascadeBusinessInfoUpdate(
  oldBusinessName: string,
  oldBusinessRegNumber: string,
  newBusinessName: string,
  newBusinessRegNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Only update if business info actually changed
    if (oldBusinessName === newBusinessName && oldBusinessRegNumber === newBusinessRegNumber) {
      return { success: true }
    }

    const adminClient = getAdminClient()

    // Update all users (supervisors, clinicians, whs_control_center) with matching business info
    const { error: cascadeError } = await adminClient
      .from('users')
      .update({
        business_name: newBusinessName,
        business_registration_number: newBusinessRegNumber,
        updated_at: new Date().toISOString(),
      })
      .in('role', ['supervisor', 'clinician', 'whs_control_center'])
      .eq('business_name', oldBusinessName)
      .eq('business_registration_number', oldBusinessRegNumber)

    if (cascadeError) {
      console.error('Failed to cascade business info update:', cascadeError)
      return {
        success: false,
        error: cascadeError.message,
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error in cascadeBusinessInfoUpdate:', error)
    return {
      success: false,
      error: error.message || 'Failed to cascade business info update',
    }
  }
}

