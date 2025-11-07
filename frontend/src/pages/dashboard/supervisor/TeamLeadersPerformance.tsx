import { useState, useEffect } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './TeamLeadersPerformance.css'

interface TeamLeaderPerformance {
  id: string
  name: string
  email: string
  teamId: string | null
  teamName: string
  siteLocation: string | null
  expectedDays: number
  actualDays: number
  completionRate: number
  status: 'on_track' | 'at_risk' | 'off_track'
  variance: number
  varianceText: string
  lastCheckIn: string | null
  scheduleEffective: string | null
  scheduleExpiry: string | null
  weeklyAttendanceRate: number
  totalCheckIns: number
  totalMembers: number
  totalScheduledDays: number
}

interface PerformanceData {
  teamLeaders: TeamLeaderPerformance[]
  dateRange: {
    startDate: string
    endDate: string
  }
  summary: {
    total: number
    onTrack: number
    atRisk: number
    offTrack: number
    avgCompletionRate: number
  }
}

export function TeamLeadersPerformance() {
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    return startOfMonth.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [sortBy, setSortBy] = useState<'name' | 'completionRate'>('completionRate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        startDate,
        endDate,
      })
      
      const response = await fetch(`${API_BASE_URL}/api/supervisor/team-leaders/performance?${params}`, {
        credentials: 'include',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load team leader performance data')
      }
      
      const result = await response.json()
      setData(result)
    } catch (err: any) {
      console.error('Error loading team leader performance:', err)
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: 'name' | 'completionRate') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const sortedTeamLeaders = data?.teamLeaders ? [...data.teamLeaders].sort((a, b) => {
    let aVal: string | number
    let bVal: string | number

    switch (sortBy) {
      case 'name':
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
        break
      case 'completionRate':
        aVal = a.completionRate
        bVal = b.completionRate
        break
      default:
        return 0
    }

    if (typeof aVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal)
    } else {
      return sortOrder === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    }
  }) : []

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'on_track':
        return 'status-badge status-on-track'
      case 'at_risk':
        return 'status-badge status-at-risk'
      case 'off_track':
        return 'status-badge status-off-track'
      default:
        return 'status-badge'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'on_track':
        return 'On Track'
      case 'at_risk':
        return 'At Risk'
      case 'off_track':
        return 'Off Track'
      default:
        return status
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatDateRange = () => {
    if (!data) return ''
    return `${formatDate(data.dateRange.startDate)} - ${formatDate(data.dateRange.endDate)}`
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="team-leaders-performance-container">
          <Loading message="Loading team leader performance data..." size="medium" />
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="team-leaders-performance-container">
          <div className="error-state">
            <p>Error: {error}</p>
            <button onClick={loadData} className="btn-primary">Retry</button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="team-leaders-performance-container">
        {/* Header */}
        <div className="performance-header">
          <div className="header-left">
            <h1>Team Leaders Performance</h1>
            <p className="date-range-display">
              📅 {formatDateRange()}
            </p>
          </div>
          <div className="header-right">
            <div className="date-filters">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="date-input"
                max={endDate}
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="date-input"
                min={startDate}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {data && (
          <div className="summary-cards">
            <div className="summary-card">
              <div className="summary-label">Total Team Leaders</div>
              <div className="summary-value">{data.summary.total}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">On Track</div>
              <div className="summary-value summary-green">{data.summary.onTrack}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">At Risk</div>
              <div className="summary-value summary-yellow">{data.summary.atRisk}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Off Track</div>
              <div className="summary-value summary-red">{data.summary.offTrack}</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">Avg Completion</div>
              <div className="summary-value">{data.summary.avgCompletionRate}%</div>
            </div>
          </div>
        )}

        {/* Table */}
        {!data || data.teamLeaders.length === 0 ? (
          <div className="empty-state">
            <p>No team leaders found for this period.</p>
          </div>
        ) : (
          <div className="performance-table-container">
            <table className="performance-table">
              <thead>
                <tr>
                  <th 
                    className={`sortable ${sortBy === 'name' ? `sorted-${sortOrder}` : ''}`}
                    onClick={() => handleSort('name')}
                  >
                    Team Leader
                    {sortBy === 'name' && (
                      <span className="sort-indicator">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th>Team</th>
                  <th>Total Members</th>
                  <th>Status</th>
                  <th 
                    className={`sortable ${sortBy === 'completionRate' ? `sorted-${sortOrder}` : ''}`}
                    onClick={() => handleSort('completionRate')}
                  >
                    Completion
                    {sortBy === 'completionRate' && (
                      <span className="sort-indicator">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                  <th>Total Scheduled Days</th>
                  <th>Progress</th>
                  <th>Schedule Period</th>
                  <th>Last Check-In</th>
                </tr>
              </thead>
              <tbody>
                {sortedTeamLeaders.map((leader) => (
                  <tr key={leader.id}>
                    <td>
                      <div className="team-leader-info">
                        <div className="team-leader-name">{leader.name}</div>
                        <div className="team-leader-email">{leader.email}</div>
                      </div>
                    </td>
                    <td>
                      <div className="team-info">
                        <div className="team-name">{leader.teamName}</div>
                        {leader.siteLocation && (
                          <div className="site-location">{leader.siteLocation}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="single-value-cell">
                        <span className="total-members">{leader.totalMembers}</span>
                      </div>
                    </td>
                    <td>
                      <div className="single-value-cell">
                        <span className={getStatusBadgeClass(leader.status)}>
                          {getStatusText(leader.status)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="single-value-cell">
                        <span className="completion-percentage">{leader.completionRate}%</span>
                      </div>
                    </td>
                    <td>
                      <div className="scheduled-days-cell">
                        <span className="days-count">{leader.totalScheduledDays}</span>
                        {leader.scheduleEffective && (
                          <div className="scheduled-days-note">
                            {leader.scheduleEffective && leader.scheduleExpiry ? (
                              <span className="schedule-range-small">
                                {formatDate(leader.scheduleEffective)} - {formatDate(leader.scheduleExpiry)}
                              </span>
                            ) : leader.scheduleEffective ? (
                              <span className="schedule-range-small">
                                From {formatDate(leader.scheduleEffective)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-bar-container">
                          <div 
                            className={`progress-bar ${
                              leader.completionRate >= 90 ? 'progress-green' :
                              leader.completionRate >= 70 ? 'progress-yellow' :
                              'progress-red'
                            }`}
                            style={{ width: `${Math.min(leader.completionRate, 100)}%` }}
                          />
                        </div>
                        <span className={`variance-text ${
                          leader.variance > 0 ? 'variance-positive' :
                          leader.variance < 0 ? 'variance-negative' :
                          'variance-neutral'
                        }`}>
                          {leader.varianceText}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="schedule-period">
                        {leader.scheduleEffective || leader.scheduleExpiry ? (
                          <>
                            <div className="schedule-date-range">
                              {leader.scheduleEffective && (
                                <span className="schedule-from">
                                  From: {formatDate(leader.scheduleEffective)}
                                </span>
                              )}
                              {leader.scheduleExpiry && (
                                <span className="schedule-until">
                                  Until: {formatDate(leader.scheduleExpiry)}
                                </span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="no-expiry">No schedule dates</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="single-value-cell">
                        {leader.lastCheckIn ? (
                          <span className="last-checkin">
                            {formatDate(leader.lastCheckIn)}
                          </span>
                        ) : (
                          <span className="no-checkin">No check-ins</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Additional Metrics Sections */}
        {data && data.teamLeaders.length > 0 && (
          <div className="additional-metrics">
            {/* Weekly Attendance Rate */}
            <div className="metrics-section">
              <h2>Weekly Attendance Rate</h2>
              <div className="metrics-grid">
                {data.teamLeaders.map((leader) => (
                  <div key={`weekly-${leader.id}`} className="metric-card">
                    <div className="metric-header">
                      <div className="metric-title">{leader.name}</div>
                      <div className="metric-team">{leader.teamName}</div>
                    </div>
                    <div className="metric-value">{leader.weeklyAttendanceRate}%</div>
                    <div className="metric-progress">
                      <div 
                        className="metric-progress-bar"
                        style={{ width: `${Math.min(leader.weeklyAttendanceRate, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Department Performance */}
            <div className="metrics-section">
              <h2>Department Performance</h2>
              <div className="department-stats">
                <div className="department-stat-card">
                  <div className="stat-label">Overall Compliance</div>
                  <div className="stat-value">{data.summary.avgCompletionRate}%</div>
                  <div className="stat-description">Average completion rate across all teams</div>
                </div>
                <div className="department-stat-card">
                  <div className="stat-label">Teams On Track</div>
                  <div className="stat-value stat-green">{data.summary.onTrack}</div>
                  <div className="stat-description">Out of {data.summary.total} total teams</div>
                </div>
                <div className="department-stat-card">
                  <div className="stat-label">Teams At Risk</div>
                  <div className="stat-value stat-yellow">{data.summary.atRisk}</div>
                  <div className="stat-description">Requiring attention</div>
                </div>
                <div className="department-stat-card">
                  <div className="stat-label">Teams Off Track</div>
                  <div className="stat-value stat-red">{data.summary.offTrack}</div>
                  <div className="stat-description">Critical action needed</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
