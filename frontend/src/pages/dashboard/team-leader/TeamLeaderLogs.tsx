import { useState, useEffect } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './TeamLeaderLogs.css'

interface LoginLog {
  id: string
  userId: string
  email: string
  role: string
  loginAt: string
  userAgent: string
  userName: string
  userEmail: string
}

interface LogsResponse {
  logs: LoginLog[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

const VERIFICATION_KEY = 'team_leader_logs_verified'
const VERIFICATION_DURATION = 30 * 60 * 1000 // 30 minutes

export function TeamLeaderLogs() {
  const [logsData, setLogsData] = useState<LogsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20
  const [isVerified, setIsVerified] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  // Check if already verified
  useEffect(() => {
    const checkVerification = () => {
      try {
        const stored = sessionStorage.getItem(VERIFICATION_KEY)
        if (stored) {
          const { timestamp } = JSON.parse(stored)
          const now = Date.now()
          if (now - timestamp < VERIFICATION_DURATION) {
            setIsVerified(true)
            return
          } else {
            sessionStorage.removeItem(VERIFICATION_KEY)
          }
        }
      } catch (err) {
        sessionStorage.removeItem(VERIFICATION_KEY)
      }
      setIsVerified(false)
      setShowPasswordModal(true)
    }

    checkVerification()
  }, [])

  const verifyPassword = async () => {
    if (!password.trim()) {
      setVerifyError('Password is required')
      return
    }

    try {
      setVerifying(true)
      setVerifyError('')

      const response = await fetch(`${API_BASE_URL}/api/teams/logs/verify-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Invalid password')
      }

      // Store verification with timestamp
      sessionStorage.setItem(VERIFICATION_KEY, JSON.stringify({ timestamp: Date.now() }))
      setIsVerified(true)
      setShowPasswordModal(false)
      setPassword('')
    } catch (err: any) {
      setVerifyError(err.message || 'Invalid password')
      setPassword('')
    } finally {
      setVerifying(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !verifying) {
      verifyPassword()
    }
  }

  const fetchLogs = async (page: number) => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      })

      const response = await fetch(`${API_BASE_URL}/api/teams/logs?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch logs')
      }

      const data: LogsResponse = await response.json()
      setLogsData(data)
    } catch (err: any) {
      console.error('Error fetching logs:', err)
      setError(err.message || 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isVerified) {
      fetchLogs(currentPage)
    }
  }, [currentPage, isVerified])

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

  // Password verification modal
  if (!isVerified) {
    return (
      <DashboardLayout>
        <div className="team-leader-logs">
          {showPasswordModal && (
            <div className="password-modal-overlay">
              <div className="password-modal">
                <div className="password-modal-header">
                  <h2>Password Verification Required</h2>
                  <p>Please enter your password to access activity logs</p>
                </div>
                <div className="password-modal-body">
                  <div className="password-input-group">
                    <label htmlFor="password-input">Password</label>
                    <input
                      id="password-input"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setVerifyError('')
                      }}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter your password"
                      disabled={verifying}
                      autoFocus
                    />
                    {verifyError && (
                      <div className="password-error">{verifyError}</div>
                    )}
                  </div>
                </div>
                <div className="password-modal-footer">
                  <button
                    onClick={verifyPassword}
                    disabled={verifying || !password.trim()}
                    className="verify-button"
                  >
                    {verifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    )
  }

  if (loading && !logsData) {
    return (
      <DashboardLayout>
        <div className="team-leader-logs">
          <Loading message="Loading logs..." size="medium" />
        </div>
      </DashboardLayout>
    )
  }

  if (error && !logsData) {
    return (
      <DashboardLayout>
        <div className="team-leader-logs">
          <div className="logs-error">
            <p>Error: {error}</p>
            <button onClick={() => fetchLogs(currentPage)} className="retry-button">
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="team-leader-logs">
        {/* Header */}
        <div className="logs-header">
          <div className="logs-header-left">
            <h1 className="logs-title">Activity Logs</h1>
            <p className="logs-subtitle">Track recent login activity and monitor team member access</p>
          </div>
          <button
            onClick={() => fetchLogs(currentPage)}
            className="refresh-button"
            title="Refresh logs"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        {/* Logs Table */}
        <div className="logs-table-card">
          <div className="table-header">
            <h3 className="table-title">Recent Activity</h3>
            {logsData && (
              <p className="table-subtitle">
                {logsData.pagination.total} login{logsData.pagination.total !== 1 ? 's' : ''} recorded
              </p>
            )}
          </div>

          <div className="table-container">
            {logsData && logsData.logs.length === 0 ? (
              <div className="no-logs-message">
                <p>No login activity yet.</p>
              </div>
            ) : (
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Time</th>
                    <th>Device</th>
                  </tr>
                </thead>
                <tbody>
                  {logsData?.logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="member-cell">
                          <div className="member-avatar-small">
                            {log.userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="member-info-cell">
                            <span className="member-name-text">{log.userName}</span>
                            <span className="email-text">{log.userEmail}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="datetime-cell">
                          <div className="time-text">{formatTime(log.loginAt)}</div>
                          <div className="relative-time">{formatRelativeTime(log.loginAt)}</div>
                        </div>
                      </td>
                      <td>
                        <div className="device-cell">
                          <span className="device-text">
                            {log.userAgent ? (
                              log.userAgent.includes('Mobile') || log.userAgent.includes('Android') || log.userAgent.includes('iPhone') 
                                ? '📱 Mobile' 
                                : '💻 Desktop'
                            ) : 'N/A'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {logsData && logsData.pagination.totalPages > 1 && (
            <div className="table-pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={!logsData.pagination.hasPrev || loading}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {logsData.pagination.page} of {logsData.pagination.totalPages}
                {' '}({logsData.pagination.total} total)
              </span>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={!logsData.pagination.hasNext || loading}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

