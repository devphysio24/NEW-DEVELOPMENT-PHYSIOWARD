/**
 * Case Status Utilities
 * Centralized status mapping and validation for security and consistency
 */

// Valid internal status values (from database/API)
export const VALID_CASE_STATUSES = ['new', 'triaged', 'assessed', 'in_rehab', 'return_to_work', 'closed'] as const
export type CaseStatus = typeof VALID_CASE_STATUSES[number]

// Display status labels (for UI)
export const STATUS_DISPLAY_MAP: Record<CaseStatus, string> = {
  'new': 'NEW CASE',
  'triaged': 'TRIAGED',
  'assessed': 'ASSESSED',
  'in_rehab': 'IN REHAB',
  'return_to_work': 'RETURN TO WORK',
  'closed': 'CLOSED'
} as const

/**
 * Validate if a status is valid
 * @param status - Status to validate
 * @returns true if valid, false otherwise
 */
export function isValidCaseStatus(status: string): status is CaseStatus {
  return VALID_CASE_STATUSES.includes(status as CaseStatus)
}

/**
 * Extract case_status from notes field securely
 * @param notes - Notes field value (can be JSON string or plain text)
 * @returns Case status or null if not found/invalid
 */
export function getCaseStatusFromNotes(notes: any): CaseStatus | null {
  if (!notes || typeof notes !== 'string') {
    return null
  }

  try {
    const notesData = JSON.parse(notes)
    
    // Security: Validate that case_status exists and is a valid status
    if (notesData && typeof notesData === 'object' && 'case_status' in notesData) {
      const status = notesData.case_status
      
      // Validate status is a string and is a valid case status
      if (typeof status === 'string' && isValidCaseStatus(status)) {
        return status
      }
    }
    
    return null
  } catch (error) {
    // Notes is not JSON or invalid JSON - ignore safely
    return null
  }
}

/**
 * Map case status to display status with fallback logic
 * @param caseStatusFromNotes - Status from notes field
 * @param isInRehab - Whether case has active rehab plan
 * @param isCurrentlyActive - Whether case is currently active
 * @returns Display status string
 */
export function mapCaseStatusToDisplay(
  caseStatusFromNotes: CaseStatus | null,
  isInRehab: boolean,
  isCurrentlyActive: boolean
): string {
  // Priority 1: Use status from notes if available
  if (caseStatusFromNotes) {
    return STATUS_DISPLAY_MAP[caseStatusFromNotes]
  }
  
  // Priority 2: Check if in rehab
  if (isInRehab) {
    return STATUS_DISPLAY_MAP['in_rehab']
  }
  
  // Priority 3: Check if active
  if (isCurrentlyActive) {
    return STATUS_DISPLAY_MAP['new']
  }
  
  // Default: Closed
  return STATUS_DISPLAY_MAP['closed']
}

