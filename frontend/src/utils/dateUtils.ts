/**
 * Get today's date in YYYY-MM-DD format
 * @returns Today's date string
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get start of week date string (Sunday)
 * @returns Start of week date string
 */
export function getStartOfWeekDateString(): string {
  const startOfWeek = new Date()
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
  return startOfWeek.toISOString().split('T')[0]
}

