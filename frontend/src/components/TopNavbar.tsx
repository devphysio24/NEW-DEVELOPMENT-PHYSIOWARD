import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PUBLIC_ROUTES } from '../config/routes'
import { useNotifications } from '../hooks/useNotifications'
import './TopNavbar.css'

interface TopNavbarProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

export function TopNavbar({ onToggleSidebar, sidebarOpen }: TopNavbarProps) {
  const { user, signOut, first_name, last_name, full_name, role } = useAuth()
  const navigate = useNavigate()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)

  // Use centralized notifications hook
  // Enable for WHS Control Center, Team Leaders, Clinicians, Workers, and Supervisors
  const notificationsEnabled = role === 'whs_control_center' || role === 'team_leader' || role === 'clinician' || role === 'worker' || role === 'supervisor'
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    fetchNotifications,
    markAsRead: markNotificationAsRead,
    markAllAsRead,
  } = useNotifications(role, notificationsEnabled, { limit: 50, pollInterval: 30000 })

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const getUserInitials = () => {
    if (first_name && last_name) {
      return `${first_name[0]}${last_name[0]}`.toUpperCase()
    }
    if (first_name) {
      return first_name[0].toUpperCase()
    }
    if (user?.email) {
      const parts = user.email.split('@')[0].split('.')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return user.email[0].toUpperCase()
    }
    return 'U'
  }

  const getUserDisplayName = () => {
    return full_name || (first_name && last_name ? `${first_name} ${last_name}` : null) || first_name || user?.email?.split('@')[0] || 'User'
  }

  const handleSignOut = async () => {
    await signOut()
    navigate(PUBLIC_ROUTES.LOGIN)
  }

  return (
    <nav className={`top-navbar ${!sidebarOpen ? 'expanded' : ''}`}>
      <div className="top-navbar-left">
        {/* Sidebar Toggle Button */}
        <button 
          className="navbar-menu-toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </>
            )}
          </svg>
        </button>
        
        <div className="navbar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
          </svg>
          <span className="navbar-brand">WorkReadiness</span>
        </div>
      </div>

      <div className="top-navbar-center">
        <div className="navbar-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21l-4.35-4.35"></path>
          </svg>
          <input 
            type="text" 
            placeholder="Search (Ctrl + K)" 
            className="navbar-search-input"
          />
        </div>
      </div>

      <div className="top-navbar-right">
        {/* Notifications */}
        {(role === 'whs_control_center' || role === 'team_leader' || role === 'clinician' || role === 'worker' || role === 'supervisor') && (
          <div className="navbar-notification-wrapper" ref={notificationRef}>
            <button 
              className="navbar-icon-btn navbar-notification-btn" 
              aria-label="Notifications"
              onClick={() => {
                setShowNotifications(!showNotifications)
                if (!showNotifications && notificationsEnabled) {
                  fetchNotifications()
                }
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && (
                <span className="navbar-notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div className="navbar-notifications-dropdown">
                <div className="navbar-notifications-header">
                  <h3>Notifications</h3>
                  <div className="navbar-notifications-header-actions">
                    {unreadCount > 0 && (
                      <button 
                        className="navbar-mark-all-read-btn"
                        onClick={markAllAsRead}
                      >
                        Mark all as read
                      </button>
                    )}
                    <button 
                      className="navbar-view-all-btn"
                      onClick={() => {
                        navigate('/dashboard/notifications')
                        setShowNotifications(false)
                      }}
                    >
                      View all
                    </button>
                  </div>
                </div>
                <div className="navbar-notifications-list">
                  {notificationsLoading ? (
                    <div className="navbar-notifications-loading">
                      <p>Loading notifications...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="navbar-notifications-empty">
                      <p>No notifications</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`navbar-notification-item ${!notification.is_read ? 'unread' : ''}`}
                        onClick={() => {
                          if (!notification.is_read) {
                            markNotificationAsRead(notification.id)
                          }
                          // Navigate to relevant page based on notification type
                          if (notification.type === 'incident_assigned') {
                            navigate('/dashboard/whs-control-center')
                            setShowNotifications(false)
                          } else if (notification.type === 'case_assigned_to_clinician') {
                            // For clinicians, go to clinician dashboard
                            navigate('/dashboard/clinician')
                            setShowNotifications(false)
                          } else if (notification.type === 'case_closed') {
                            // For supervisors, go to incident management when case is closed
                            if (role === 'supervisor') {
                              navigate('/dashboard/supervisor')
                              setShowNotifications(false)
                            } else {
                              navigate('/dashboard/notifications')
                              setShowNotifications(false)
                            }
                          } else if (notification.type === 'worker_not_fit_to_work') {
                            // For team leaders, go to notifications page to see details
                            navigate('/dashboard/notifications')
                            setShowNotifications(false)
                          } else if (notification.data?.appointment_id && role === 'worker') {
                            // For workers with appointment notifications, go to appointments page
                            navigate('/dashboard/worker/appointments')
                            setShowNotifications(false)
                          } else {
                            // For other notification types, go to notifications page
                            navigate('/dashboard/notifications')
                            setShowNotifications(false)
                          }
                        }}
                      >
                        <div className="navbar-notification-icon">
                          {notification.type === 'incident_assigned' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 11l3 3L22 4"></path>
                              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                            </svg>
                          ) : notification.type === 'case_assigned_to_clinician' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#10B981' }}>
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                          ) : notification.type === 'case_closed' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#10B981' }}>
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          ) : notification.type === 'worker_not_fit_to_work' ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#ef4444' }}>
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="8" x2="12" y2="12"></line>
                              <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                          ) : notification.data?.appointment_id ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#3B82F6' }}>
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="16" x2="12" y2="12"></line>
                              <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                          )}
                        </div>
                        <div className="navbar-notification-content">
                          <div className="navbar-notification-title">{notification.title}</div>
                          <div className="navbar-notification-message">{notification.message}</div>
                          {notification.data?.case_number && (
                            <div className="navbar-notification-case">
                              Case: <strong>{notification.data.case_number}</strong>
                            </div>
                          )}
                          {notification.data?.worker_name && notification.type === 'worker_not_fit_to_work' && (
                            <div className="navbar-notification-case" style={{ color: '#ef4444' }}>
                              Worker: <strong>{notification.data.worker_name}</strong>
                            </div>
                          )}
                          <div className="navbar-notification-time">
                            {new Date(notification.created_at).toLocaleString()}
                          </div>
                        </div>
                        {!notification.is_read && (
                          <div className="navbar-notification-dot"></div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Calendar */}
        <button className="navbar-icon-btn" aria-label="Calendar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </button>

        {/* Profile Menu */}
        <div className="navbar-profile" ref={menuRef}>
          <button 
            className="navbar-profile-btn"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="User menu"
          >
            <div className="navbar-profile-avatar">
              {getUserInitials()}
            </div>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              className={`navbar-profile-chevron ${showProfileMenu ? 'open' : ''}`}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          {showProfileMenu && (
            <div className="navbar-profile-menu">
              <div className="navbar-profile-menu-header">
                <div className="navbar-profile-menu-avatar">
                  {getUserInitials()}
                </div>
                <div className="navbar-profile-menu-info">
                  <div className="navbar-profile-menu-name">
                    {getUserDisplayName()}
                  </div>
                  <div className="navbar-profile-menu-email">
                    {user?.email || 'No email'}
                  </div>
                  <div className="navbar-profile-menu-role">
                    {role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'User'}
                  </div>
                </div>
              </div>

              <div className="navbar-profile-menu-divider"></div>

              <div className="navbar-profile-menu-items">
                <button 
                  className="navbar-profile-menu-item"
                  onClick={() => {
                    setShowProfileMenu(false)
                    navigate('/dashboard/profile')
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span>Profile</span>
                </button>

                <div className="navbar-profile-menu-divider"></div>

                <button 
                  className="navbar-profile-menu-item navbar-profile-menu-item-danger"
                  onClick={handleSignOut}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

