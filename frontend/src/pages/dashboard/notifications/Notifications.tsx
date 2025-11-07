import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { useAuth } from '../../../contexts/AuthContext'
import { useNotifications } from '../../../hooks/useNotifications'
import './Notifications.css'

export function Notifications() {
  const { role } = useAuth()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

  // Use centralized notifications hook with higher limit for full history
  // Enable for WHS Control Center, Team Leaders, Clinicians, Workers, and Supervisors
  const notificationsEnabled = role === 'whs_control_center' || role === 'team_leader' || role === 'clinician' || role === 'worker' || role === 'supervisor'
  const {
    notifications,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications(role, notificationsEnabled, { limit: 100, autoFetch: true, pollInterval: 0 }) // No polling on page

  // Memoize filtered notifications for performance
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notif => {
      if (filter === 'unread') return !notif.is_read
      if (filter === 'read') return notif.is_read
      return true
    })
  }, [notifications, filter])

  // Memoize unread count calculation
  const unreadCountDisplay = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <DashboardLayout>
      <div className="notifications-page">
        <div className="notifications-header">
          <div>
            <h1 className="notifications-title">Notifications</h1>
            <p className="notifications-subtitle">
              {unreadCountDisplay > 0 ? `${unreadCountDisplay} unread notification${unreadCountDisplay > 1 ? 's' : ''}` : 'All caught up!'}
            </p>
          </div>
          {unreadCountDisplay > 0 && (
            <button className="mark-all-read-btn" onClick={markAllAsRead}>
              Mark all as read
            </button>
          )}
        </div>

        <div className="notifications-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCountDisplay})
          </button>
          <button
            className={`filter-btn ${filter === 'read' ? 'active' : ''}`}
            onClick={() => setFilter('read')}
          >
            Read ({notifications.length - unreadCountDisplay})
          </button>
        </div>

        {loading ? (
          <Loading message="Loading notifications..." size="medium" />
        ) : error ? (
          <div className="notifications-error">
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchNotifications}>
              Retry
            </button>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.3 }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <h3>No notifications</h3>
            <p>{filter === 'unread' ? "You're all caught up! No unread notifications." : filter === 'read' ? 'No read notifications yet.' : 'No notifications yet.'}</p>
          </div>
        ) : (
          <div className="notifications-list">
            {filteredNotifications.map((notification) => {
              const handleNotificationClick = () => {
                if (!notification.is_read) {
                  markAsRead(notification.id)
                }
                
                // Navigate based on notification type and role
                if ((notification.data as any)?.appointment_id && role === 'worker') {
                  navigate('/dashboard/worker/appointments')
                } else if (notification.type === 'incident_assigned') {
                  navigate('/dashboard/whs-control-center')
                } else if (notification.type === 'case_assigned_to_clinician') {
                  navigate('/dashboard/clinician')
                } else if (notification.type === 'case_closed') {
                  // For supervisors, go to incident management when case is closed
                  if (role === 'supervisor') {
                    navigate('/dashboard/supervisor/incidents')
                  } else {
                    // For WHS, stay on notifications page or go to WHS dashboard
                    navigate('/dashboard/whs-control-center')
                  }
                } else {
                  // Default: stay on notifications page
                  // No navigation needed
                }
              }

              return (
              <div
                key={notification.id}
                className={`notification-card ${!notification.is_read ? 'unread' : ''}`}
                onClick={handleNotificationClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleNotificationClick()
                  }
                }}
                style={{ cursor: !notification.is_read ? 'pointer' : 'default' }}
              >
                <div className="notification-icon">
                  {notification.type === 'incident_assigned' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 11l3 3L22 4"></path>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                  ) : notification.type === 'case_assigned_to_clinician' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#10B981' }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                  ) : notification.type === 'case_closed' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#10B981' }}>
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : notification.type === 'worker_not_fit_to_work' ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ef4444' }}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                  ) : (notification.data as any)?.appointment_id ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#3B82F6' }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                  )}
                </div>
                <div className="notification-content">
                  <div className="notification-header-row">
                    <h3 className="notification-title">{notification.title}</h3>
                    {!notification.is_read && <div className="notification-dot"></div>}
                  </div>
                  <p className="notification-message">{notification.message}</p>
                  
                  {/* Worker Not Fit to Work Details */}
                  {notification.type === 'worker_not_fit_to_work' && notification.data && (
                    <div className="notification-details-panel">
                      {notification.data.worker_name && (
                        <div className="notification-detail">
                          <strong>Worker:</strong> {notification.data.worker_name}
                          {notification.data.worker_email && (
                            <span style={{ color: '#666', marginLeft: '8px' }}>({notification.data.worker_email})</span>
                          )}
                        </div>
                      )}
                      {notification.data.team_name && (
                        <div className="notification-detail">
                          <strong>Team:</strong> {notification.data.team_name}
                        </div>
                      )}
                      {notification.data.check_in_date && (
                        <div className="notification-detail">
                          <strong>Check-In Date:</strong> {new Date(notification.data.check_in_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          {notification.data.check_in_time && (
                            <span style={{ marginLeft: '8px' }}>at {notification.data.check_in_time}</span>
                          )}
                        </div>
                      )}
                      <div className="notification-metrics-grid">
                        {notification.data.pain_level !== undefined && (
                          <div className="notification-metric">
                            <strong>Pain Level:</strong> {notification.data.pain_level}/10
                          </div>
                        )}
                        {notification.data.fatigue_level !== undefined && (
                          <div className="notification-metric">
                            <strong>Fatigue Level:</strong> {notification.data.fatigue_level}/10
                          </div>
                        )}
                        {notification.data.stress_level !== undefined && (
                          <div className="notification-metric">
                            <strong>Stress Level:</strong> {notification.data.stress_level}/10
                          </div>
                        )}
                        {notification.data.sleep_quality !== undefined && (
                          <div className="notification-metric">
                            <strong>Sleep Quality:</strong> {notification.data.sleep_quality}/12
                          </div>
                        )}
                      </div>
                      {notification.data.additional_notes && (
                        <div className="notification-detail notification-notes">
                          <strong>Additional Notes:</strong>
                          <p style={{ marginTop: '4px', color: '#666' }}>{notification.data.additional_notes}</p>
                        </div>
                      )}
                      {notification.data.shift_start_time && notification.data.shift_end_time && (
                        <div className="notification-detail">
                          <strong>Shift:</strong> {notification.data.shift_start_time} → {notification.data.shift_end_time}
                          {notification.data.shift_type && (
                            <span style={{ marginLeft: '8px', color: '#666' }}>({notification.data.shift_type})</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Incident Report Details (System notification with incident data) */}
                  {notification.type === 'system' && notification.data?.incident_type && (
                    <div className="notification-details-panel">
                      <div className="notification-detail">
                        <strong>Worker:</strong> {notification.data.worker_name}
                        {notification.data.worker_email && (
                          <span style={{ color: '#666', marginLeft: '8px' }}>({notification.data.worker_email})</span>
                        )}
                      </div>
                      {notification.data.team_name && (
                        <div className="notification-detail">
                          <strong>Team:</strong> {notification.data.team_name}
                        </div>
                      )}
                      <div className="notification-detail">
                        <strong>Incident Type:</strong> {(notification.data as any).incident_type_label || notification.data.incident_type}
                      </div>
                      {notification.data.supervisor_name && (
                        <div className="notification-detail">
                          <strong>Reported By:</strong> {notification.data.supervisor_name}
                          {(notification.data as any).supervisor_email && (
                            <span style={{ color: '#666', marginLeft: '8px' }}>({(notification.data as any).supervisor_email})</span>
                          )}
                        </div>
                      )}
                      {(notification.data as any).start_date && (
                        <div className="notification-detail">
                          <strong>Start Date:</strong> {new Date((notification.data as any).start_date).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                      )}
                      {(notification.data as any).end_date ? (
                        <div className="notification-detail">
                          <strong>End Date:</strong> {new Date((notification.data as any).end_date).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </div>
                      ) : (notification.data as any).end_date === null && (
                        <div className="notification-detail">
                          <strong>End Date:</strong> Ongoing
                        </div>
                      )}
                      {(notification.data as any).reason && (
                        <div className="notification-detail notification-notes">
                          <strong>Reason/Details:</strong>
                          <p style={{ marginTop: '4px', color: '#666' }}>{(notification.data as any).reason}</p>
                        </div>
                      )}
                      {(notification.data as any).schedules_deactivated !== undefined && (notification.data as any).schedules_deactivated > 0 && (
                        <div className="notification-detail">
                          <strong>Schedules Deactivated:</strong> {(notification.data as any).schedules_deactivated} schedule(s)
                        </div>
                      )}
                      <div className="notification-detail" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E5E7EB', color: '#EF4444', fontWeight: '500' }}>
                        ⚠️ This exception cannot be modified until the supervisor closes the incident.
                      </div>
                    </div>
                  )}
                  
                  {/* Appointment Details */}
                  {(notification.data as any)?.appointment_id && (
                    <div className="notification-appointment-details">
                      {(notification.data as any)?.appointment_date && (
                        <div className="notification-detail">
                          <strong>Date:</strong> {new Date((notification.data as any).appointment_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      {(notification.data as any)?.appointment_time && (
                        <div className="notification-detail">
                          <strong>Time:</strong> {(() => {
                            const [hour, min] = (notification.data as any).appointment_time.split(':')
                            const hourNum = parseInt(hour)
                            return `${hourNum % 12 || 12}:${min} ${hourNum >= 12 ? 'PM' : 'AM'}`
                          })()}
                        </div>
                      )}
                      {notification.data?.case_number && (
                        <div className="notification-case">
                          <strong>Case:</strong> {notification.data.case_number}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Case Closed Details */}
                  {notification.type === 'case_closed' && notification.data && (
                    <div className="notification-details-panel" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      {notification.data.case_number && (
                        <div className="notification-detail">
                          <strong>Case Number:</strong> {notification.data.case_number}
                        </div>
                      )}
                      {notification.data.worker_name && (
                        <div className="notification-detail">
                          <strong>Worker:</strong> {notification.data.worker_name}
                          {notification.data.worker_email && (
                            <span style={{ color: '#666', marginLeft: '8px' }}>({notification.data.worker_email})</span>
                          )}
                        </div>
                      )}
                      {notification.data.team_name && (
                        <div className="notification-detail">
                          <strong>Team:</strong> {notification.data.team_name}
                        </div>
                      )}
                      {notification.data.site_location && (
                        <div className="notification-detail">
                          <strong>Site Location:</strong> {notification.data.site_location}
                        </div>
                      )}
                      {notification.data.status_label && (
                        <div className="notification-detail">
                          <strong>Status:</strong> <span style={{ color: '#10B981', fontWeight: '600' }}>{notification.data.status_label}</span>
                        </div>
                      )}
                      {notification.data.approved_by && (
                        <div className="notification-detail">
                          <strong>Approved By:</strong> {notification.data.approved_by}
                          {notification.data.clinician_name && notification.data.clinician_name !== notification.data.approved_by && (
                            <span style={{ color: '#666', marginLeft: '8px' }}>(Clinician: {notification.data.clinician_name})</span>
                          )}
                        </div>
                      )}
                      {notification.data.approved_at && (
                        <div className="notification-detail">
                          <strong>Approved At:</strong> {new Date(notification.data.approved_at).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                      {role === 'supervisor' && (
                        <div className="notification-detail" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #BBF7D0', color: '#059669', fontWeight: '500' }}>
                          ✅ Case has been closed. Worker schedules are now active again.
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Incident Details - Only show if not appointment and not case_closed */}
                  {!(notification.data as any)?.appointment_id && notification.data?.case_number && notification.type !== 'case_closed' && (
                    <div className="notification-case">
                      <strong>Case:</strong> {notification.data.case_number}
                    </div>
                  )}
                  {notification.type !== 'worker_not_fit_to_work' && notification.type !== 'system' && notification.type !== 'case_closed' && notification.data?.worker_name && (
                    <div className="notification-detail">
                      <strong>Worker:</strong> {notification.data.worker_name}
                    </div>
                  )}
                  {notification.type !== 'worker_not_fit_to_work' && notification.type !== 'system' && notification.type !== 'case_closed' && notification.data?.team_name && (
                    <div className="notification-detail">
                      <strong>Team:</strong> {notification.data.team_name}
                    </div>
                  )}
                  <div className="notification-time">{formatDate(notification.created_at)}</div>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

