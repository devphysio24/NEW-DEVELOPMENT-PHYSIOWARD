/**
 * Notification Utilities
 * Centralized helper functions for creating notifications with consistent data
 */

/**
 * Format user data for notifications
 * Extracts worker/user information in a consistent format
 */
export function formatUserDataForNotification(user: any) {
  const fullName = user?.full_name || 
                  (user?.first_name && user?.last_name 
                    ? `${user.first_name} ${user.last_name}`
                    : null)
  
  return {
    worker_id: user?.id || null,
    worker_name: fullName || user?.email || 'Unknown User',
    worker_email: user?.email || '',
    worker_profile_image_url: user?.profile_image_url || null,
  }
}

/**
 * Get worker data fields for notification (consistent naming)
 */
export function getWorkerNotificationFields(user: any) {
  return formatUserDataForNotification(user)
}


