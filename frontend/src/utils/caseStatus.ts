/**
 * Case Status Constants and Utilities
 * Centralized status configuration for consistency across frontend
 */

// Status display labels (must match backend STATUS_DISPLAY_MAP)
export const STATUS_LABELS: Record<string, string> = {
  'NEW CASE': 'NEW CASE',
  'ACTIVE': 'ACTIVE',
  'TRIAGED': 'TRIAGED',
  'ASSESSED': 'ASSESSED',
  'IN REHAB': 'IN REHAB',
  'RETURN TO WORK': 'RETURN TO WORK',
  'CLOSED': 'CLOSED',
} as const

// Status color configuration (consistent color scheme)
export const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'NEW CASE': { bg: '#DBEAFE', color: '#3B82F6' }, // Blue
  'TRIAGED': { bg: '#E9D5FF', color: '#8B5CF6' }, // Purple
  'ASSESSED': { bg: '#FEF3C7', color: '#F59E0B' }, // Amber
  'IN REHAB': { bg: '#D1FAE5', color: '#10B981' }, // Green
  'RETURN TO WORK': { bg: '#CFFAFE', color: '#06B6D4' }, // Cyan
  'ACTIVE': { bg: '#FEF3C7', color: '#F59E0B' }, // Amber (fallback)
  'CLOSED': { bg: '#F3F4F6', color: '#6B7280' }, // Gray
} as const

// Status priority order for sorting (lower number = higher priority)
export const STATUS_PRIORITY: Record<string, number> = {
  'NEW CASE': 1,
  'TRIAGED': 2,
  'ASSESSED': 3,
  'IN REHAB': 4,
  'RETURN TO WORK': 5,
  'ACTIVE': 6,
  'CLOSED': 7,
} as const

// Default status style (fallback)
const DEFAULT_STATUS_STYLE = { bg: '#F3F4F6', color: '#6B7280' }

/**
 * Get status display label
 * @param status - Status value
 * @returns Display label or status if not found
 */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

/**
 * Get status style (background and text color)
 * @param status - Status value
 * @returns Style object with bg and color properties
 */
export function getStatusStyle(status: string): { bg: string; color: string } {
  return STATUS_COLORS[status] || DEFAULT_STATUS_STYLE
}

/**
 * Get status priority for sorting
 * @param status - Status value
 * @returns Priority number (lower = higher priority)
 */
export function getStatusPriority(status: string): number {
  return STATUS_PRIORITY[status] || 99
}

/**
 * Convert status style to React inline style object
 * @param status - Status value
 * @returns React style object with backgroundColor and color
 */
export function getStatusInlineStyle(status: string): React.CSSProperties {
  const style = getStatusStyle(status)
  return {
    backgroundColor: style.bg,
    color: style.color,
  }
}

