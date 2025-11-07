import { useState, useEffect, useCallback, useMemo } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './IncidentManagement.css'

interface Incident {
  id: string
  workerId: string
  workerName: string
  workerEmail: string
  teamId: string
  teamName: string
  type: string
  reason: string
  startDate: string
  endDate: string | null
  isActive: boolean
  assignedToWhs: boolean
  clinicianId: string | null
  clinicianName: string | null
  clinicianEmail: string | null
  caseStatus: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface Summary {
  total: number
  active: number
  closed: number
  closedThisMonth: number
  teamMemberCount: number
  byType: Record<string, number>
}

interface Worker {
  id: string
  email: string
  name: string
  teams: Array<{ id: string; name: string; siteLocation: string | null }>
}

export function IncidentManagement() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    active: 0,
    closed: 0,
    closedThisMonth: 0,
    teamMemberCount: 0,
    byType: {},
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentTab, setCurrentTab] = useState<'active' | 'history'>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showReportModal, setShowReportModal] = useState(false)
  const [workers, setWorkers] = useState<Worker[]>([])
  const [reporting, setReporting] = useState(false)
  const [selectedCase, setSelectedCase] = useState<Incident | null>(null)
  const [showCaseDetails, setShowCaseDetails] = useState(false)
  const [showAssignConfirmModal, setShowAssignConfirmModal] = useState(false)
  const [assigningIncident, setAssigningIncident] = useState<Incident | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false)
  const [closingIncident, setClosingIncident] = useState<Incident | null>(null)

  // Report form state
  const [selectedWorker, setSelectedWorker] = useState('')
  const [selectedTeam, setSelectedTeam] = useState('')
  const [incidentType, setIncidentType] = useState('injury')
  const [reason, setReason] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const params = new URLSearchParams({
        page: '1',
        limit: '500', // Get sufficient data for summary (max 1000 allowed)
        status: 'all', // Always get all to match summary counts
        type: filterType,
      })

      // Add cache-busting timestamp to ensure fresh data
      const response = await fetch(`${API_BASE_URL}/api/supervisor/incidents?${params.toString()}&_t=${Date.now()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch incidents')
      }

      const data = await response.json()
      console.log('[IncidentManagement] Fetched data:', {
        incidentsCount: data.incidents?.length || 0,
        summary: data.summary,
      })
      setIncidents(data.incidents || [])
      setSummary(data.summary || summary)
    } catch (err: any) {
      console.error('Error fetching incidents:', err)
      setError(err.message || 'Failed to load incidents')
    } finally {
      setLoading(false)
    }
  }, [filterType])

  const fetchWorkers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/supervisor/incidents/workers`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setWorkers(data.workers || [])
      }
    } catch (err) {
      console.error('Error fetching workers:', err)
    }
  }, [])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  useEffect(() => {
    if (showReportModal) {
      fetchWorkers()
    }
  }, [showReportModal, fetchWorkers])

  const handleReportIncident = async () => {
    if (!selectedWorker || !selectedTeam || !incidentType || !startDate) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setReporting(true)
      setError('')

      const response = await fetch(`${API_BASE_URL}/api/supervisor/incidents`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workerId: selectedWorker,
          teamId: selectedTeam,
          type: incidentType,
          reason,
          startDate,
          endDate: endDate || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to report incident')
      }

      // Reset form
      setSelectedWorker('')
      setSelectedTeam('')
      setIncidentType('injury')
      setReason('')
      setStartDate(new Date().toISOString().split('T')[0])
      setEndDate('')
      setShowReportModal(false)

      // Refresh incidents
      fetchIncidents()
    } catch (err: any) {
      setError(err.message || 'Failed to report incident')
    } finally {
      setReporting(false)
    }
  }

  const handleAssignToWhs = async (incidentId: string) => {
    try {
      setError('')
      const response = await fetch(`${API_BASE_URL}/api/supervisor/incidents/${incidentId}/assign-to-whs`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to assign incident to WHS')
      }

      // Show success message
      setSuccessMessage('Successfully assigned to Case Manager!')
      setShowSuccessMessage(true)
      setShowAssignConfirmModal(false)
      setAssigningIncident(null)
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccessMessage(false)
      }, 3000)
      
      fetchIncidents()
    } catch (err: any) {
      setError(err.message || 'Failed to assign incident to WHS')
      setShowAssignConfirmModal(false)
      setAssigningIncident(null)
    }
  }

  const handleAssignClick = (incident: Incident) => {
    setAssigningIncident(incident)
    setShowAssignConfirmModal(true)
  }

  const handleCloseIncident = async (incidentId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/supervisor/incidents/${incidentId}/close`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to close incident')
      }

      const data = await response.json()
      
      // Show success message with schedule reactivation info
      if (data.reactivatedSchedules > 0) {
        setSuccessMessage(`Case closed successfully. ${data.reactivatedSchedules} schedule(s) were automatically reactivated for this worker.`)
      } else {
        setSuccessMessage('Case closed successfully. Exception has been removed.')
      }
      setShowSuccessMessage(true)
      setShowCloseConfirmModal(false)
      setClosingIncident(null)
      
      // Hide success message after 4 seconds (longer for more info)
      setTimeout(() => {
        setShowSuccessMessage(false)
      }, 4000)
      
      fetchIncidents()
    } catch (err: any) {
      setError(err.message || 'Failed to close incident')
      setShowCloseConfirmModal(false)
      setClosingIncident(null)
    }
  }

  const handleCloseClick = (incident: Incident) => {
    setClosingIncident(incident)
    setShowCloseConfirmModal(true)
  }

  const handleViewCaseDetails = (incident: Incident) => {
    setSelectedCase(incident)
    setShowCaseDetails(true)
  }

  // Render action buttons for incidents
  const renderActionButtons = (incident: Incident, isMobile = false) => (
    <div className="action-buttons">
      {incident.isActive && !incident.assignedToWhs && (
        <button
          onClick={() => handleAssignClick(incident)}
          className="assign-whs-btn"
          title="Assign to WHS Case Manager"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          Assign to Case Manager
        </button>
      )}
      {incident.isActive && incident.assignedToWhs && (
        <span 
          className={`assigned-badge ${isMobile ? 'mobile' : ''}`}
          title="View case details"
          onClick={() => handleViewCaseDetails(incident)}
          style={{ cursor: 'pointer' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          {isMobile ? 'Assigned - View Details' : 'Assigned'}
        </span>
      )}
      {incident.isActive && (
        <button
          onClick={() => handleViewCaseDetails(incident)}
          className="close-btn"
          title={incident.assignedToWhs ? "View case details" : "View case details & close case"}
        >
          {incident.assignedToWhs ? "View Details" : "View Details & Close Case"}
        </button>
      )}
    </div>
  )

  const getCaseStatusLabel = (status: string | null): string => {
    if (!status) return 'NOT STARTED'
    const statusMap: Record<string, string> = {
      'new': 'NEW',
      'triaged': 'TRIAGED',
      'assessed': 'ASSESSED',
      'in_rehab': 'IN REHAB',
      'return_to_work': 'RETURN TO WORK',
      'closed': 'CLOSED'
    }
    return statusMap[status.toLowerCase()] || status.toUpperCase()
  }

  const getCaseStatusColor = (status: string | null): string => {
    if (!status) return '#94A3B8'
    const colorMap: Record<string, string> = {
      'new': '#10B981',
      'triaged': '#3B82F6',
      'assessed': '#8B5CF6',
      'in_rehab': '#14B8A6',
      'return_to_work': '#F59E0B',
      'closed': '#EF4444'
    }
    return colorMap[status.toLowerCase()] || '#64748B'
  }

  const getCaseStatusBg = (status: string | null): string => {
    if (!status) return '#F1F5F9'
    const bgMap: Record<string, string> = {
      'new': '#D1FAE5',
      'triaged': '#DBEAFE',
      'assessed': '#F3E8FF',
      'in_rehab': '#F0FDFA',
      'return_to_work': '#FFFBEB',
      'closed': '#FEE2E2'
    }
    return bgMap[status.toLowerCase()] || '#F1F5F9'
  }

  const getStatusIndex = (status: string | null): number => {
    if (!status) return -1
    const statusOrder = ['triaged', 'assessed', 'in_rehab', 'return_to_work', 'closed']
    return statusOrder.indexOf(status.toLowerCase())
  }

  // Filter incidents based on tab and search
  const filteredIncidents = useMemo(() => {
    const filtered = incidents.filter(incident => {
      // Filter by search query
      const matchesSearch = searchQuery.trim() === '' || 
        incident.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.workerEmail.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Filter by tab (active vs history)
      const matchesTab = currentTab === 'active' ? incident.isActive : !incident.isActive
      
      // Filter by type if not 'all'
      const matchesType = filterType === 'all' || incident.type === filterType
      
      return matchesSearch && matchesTab && matchesType
    })
    
    console.log('[IncidentManagement] Filtered incidents:', {
      total: incidents.length,
      filtered: filtered.length,
      currentTab,
      activeCount: incidents.filter(i => i.isActive).length,
      closedCount: incidents.filter(i => !i.isActive).length,
    })
    
    return filtered
  }, [incidents, searchQuery, currentTab, filterType])

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      injury: 'Injury / Medical',
      medical_leave: 'Sick Leave',
      accident: 'On Leave / RDO',
      transfer: 'Transferred',
      other: 'Not Rostered',
    }
    return labels[type] || type
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      injury: '#EF4444', // Red for Injury / Medical
      medical_leave: '#F59E0B', // Amber for Sick Leave
      accident: '#60A5FA', // Light Blue for On Leave / RDO
      transfer: '#3B82F6', // Blue for Transferred
      other: '#CBD5E1', // Grey for Not Rostered
    }
    return colors[type] || '#64748B'
  }

  const typeOrder = ['medical_leave', 'injury', 'accident', 'transfer', 'other']

  return (
    <DashboardLayout>
      <div className="incident-management">
        {/* Header */}
        <div className="incident-header">
          <div className="incident-header-left">
            <h1 className="incident-title">
              <span className="title-icon">🔔</span>
              Incident Management System
            </h1>
            <p className="incident-subtitle">
              Report, track, and manage worker incidents efficiently
            </p>
          </div>
          <div className="incident-header-actions">
            <button
              onClick={fetchIncidents}
              className="refresh-btn"
              title="Refresh"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="report-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Report New Incident
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="metrics-grid">
          <div className="metric-card metric-total">
            <div className="metric-header">
              <div className="metric-icon-badge" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="metric-label">Total Incidents</div>
                <div className="metric-detail">
                  <span className="metric-detail-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 17 9 11 13 15 21 7" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points="14 7 21 7 21 14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {summary.active} active, {summary.closed} closed
                </div>
              </div>
            </div>
            <div className="metric-value">{summary.total}</div>
          </div>
          <div className="metric-card metric-closed">
            <div className="metric-header">
              <div className="metric-icon-badge" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2L3 14h9l-1 8L21 8h-9l1-6z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="metric-label">Closed This Month</div>
                <div className="metric-detail">
                  <span className="metric-detail-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  Resolved cases
                </div>
              </div>
            </div>
            <div className="metric-value">{summary.closedThisMonth}</div>
          </div>
          <div className="metric-card metric-members">
            <div className="metric-header">
              <div className="metric-icon-badge" aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="metric-label">Team Members</div>
                <div className="metric-detail">
                  <span className="metric-detail-icon" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20c4.418 0 8-3.582 8-8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  At PA Center
                </div>
              </div>
            </div>
            <div className="metric-value">{summary.teamMemberCount}</div>
          </div>
        </div>

        {/* Incidents by Type */}
        <div className="incidents-by-type">
          <div className="section-header">
            <h3 className="section-title">
              <span className="section-icon">📊</span>
              Incidents by Type
            </h3>
          </div>
          <div className="type-breakdown">
            {typeOrder.map(type => {
              const count = summary.byType[type] || 0
              const total = summary.total || 1
              const percentage = (count / total) * 100
              return (
                <div key={type} className="type-item">
                  <div className="type-header">
                    <span className="type-name">{getTypeLabel(type)}</span>
                    <span className="type-count">{count}</span>
                  </div>
                  <div className="type-bar">
                    <div
                      className="type-bar-fill"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: getTypeColor(type),
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Incident List */}
        <div className="incident-list-panel">
          <div className="list-header">
            <div className="list-tabs">
              <button
                className={`tab-btn ${currentTab === 'active' ? 'active' : ''}`}
                onClick={() => setCurrentTab('active')}
              >
                Active Incidents ({summary.active})
              </button>
              <button
                className={`tab-btn ${currentTab === 'history' ? 'active' : ''}`}
                onClick={() => setCurrentTab('history')}
              >
                Incident History ({summary.closed})
              </button>
            </div>
            <div className="list-controls">
              <div className="search-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
                <input
                  type="text"
                  placeholder="Search by worker name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="injury">Injury / Medical</option>
                <option value="medical_leave">Sick Leave</option>
                <option value="accident">On Leave / RDO</option>
                <option value="transfer">Transferred</option>
                <option value="other">Not Rostered</option>
              </select>
            </div>
          </div>

          <div className="list-content">
            {loading ? (
              <Loading message="Loading incidents..." size="medium" />
            ) : filteredIncidents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p className="empty-title">No {currentTab === 'active' ? 'active' : ''} incidents found</p>
                <p className="empty-subtitle">
                  {currentTab === 'active' ? 'All clear! No incidents to display.' : 'No incident history available.'}
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="incident-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Worker</th>
                        <th>Type</th>
                        <th>Team</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Reason</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIncidents.map(incident => (
                        <tr key={incident.id}>
                          <td>
                            <div className="worker-cell">
                              <div className="worker-avatar">
                                {incident.workerName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="worker-name">{incident.workerName}</div>
                                <div className="worker-email">{incident.workerEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className="type-badge"
                              style={{ backgroundColor: getTypeColor(incident.type) }}
                            >
                              {getTypeLabel(incident.type)}
                            </span>
                          </td>
                          <td>{incident.teamName}</td>
                          <td>{new Date(incident.startDate).toLocaleDateString()}</td>
                          <td>{incident.endDate ? new Date(incident.endDate).toLocaleDateString() : 'Ongoing'}</td>
                          <td className="reason-cell">{incident.reason || '-'}</td>
                          <td>
                            {renderActionButtons(incident)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="incident-table-mobile">
                  {filteredIncidents.map(incident => (
                    <div key={incident.id} className="incident-card">
                      <div className="incident-card-header">
                        <div className="worker-avatar">
                          {incident.workerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="incident-card-info">
                          <div className="worker-name">{incident.workerName}</div>
                          <div className="worker-email">{incident.workerEmail}</div>
                        </div>
                        <span
                          className="type-badge"
                          style={{ backgroundColor: getTypeColor(incident.type) }}
                        >
                          {getTypeLabel(incident.type)}
                        </span>
                      </div>
                      <div className="incident-card-body">
                        <div className="incident-card-row">
                          <span className="incident-card-label">Team</span>
                          <span className="incident-card-value">{incident.teamName}</span>
                        </div>
                        <div className="incident-card-row">
                          <span className="incident-card-label">Start Date</span>
                          <span className="incident-card-value">{new Date(incident.startDate).toLocaleDateString()}</span>
                        </div>
                        <div className="incident-card-row">
                          <span className="incident-card-label">End Date</span>
                          <span className="incident-card-value">{incident.endDate ? new Date(incident.endDate).toLocaleDateString() : 'Ongoing'}</span>
                        </div>
                        {incident.reason && (
                          <div className="incident-card-row">
                            <span className="incident-card-label">Reason</span>
                            <span className="incident-card-value">{incident.reason}</span>
                          </div>
                        )}
                      </div>
                      <div className="incident-card-actions">
                        {renderActionButtons(incident, true)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Report New Incident Sidebar */}
        {showReportModal && (
          <>
            <div className="sidebar-overlay" onClick={() => setShowReportModal(false)}></div>
            <div className="sidebar-panel">
              <div className="sidebar-header">
                <div>
                  <h3>Report New Incident</h3>
                </div>
                <button
                  className="sidebar-close"
                  onClick={() => setShowReportModal(false)}
                  aria-label="Close sidebar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="sidebar-body">
                {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
                <div className="form-group">
                  <label>Worker *</label>
                  <select
                    value={selectedWorker}
                    onChange={(e) => {
                      setSelectedWorker(e.target.value)
                      const worker = workers.find(w => w.id === e.target.value)
                      if (worker && worker.teams.length > 0) {
                        setSelectedTeam(worker.teams[0].id)
                      }
                    }}
                    required
                  >
                    <option value="">Select a worker</option>
                    {workers.map(worker => (
                      <option key={worker.id} value={worker.id}>
                        {worker.name} ({worker.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Team *</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    required
                    disabled={!selectedWorker}
                  >
                    <option value="">Select a team</option>
                    {selectedWorker && workers.find(w => w.id === selectedWorker)?.teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name} {team.siteLocation ? `• ${team.siteLocation}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Incident Type *</label>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                    required
                  >
                    <option value="injury">Injury / Medical</option>
                    <option value="medical_leave">Sick Leave</option>
                    <option value="accident">On Leave / RDO</option>
                    <option value="transfer">Transferred</option>
                    <option value="other">Not Rostered</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date (optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                  />
                </div>
                <div className="form-group">
                  <label>Reason / Details</label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Enter incident details..."
                  />
                </div>
              </div>
              <div className="sidebar-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setShowReportModal(false)}
                  disabled={reporting}
                >
                  Cancel
                </button>
                <button
                  className="submit-btn"
                  onClick={handleReportIncident}
                  disabled={reporting}
                >
                  {reporting ? 'Reporting...' : 'Report Incident'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Case Details Sidebar */}
        {showCaseDetails && selectedCase && (
          <>
            <div className="sidebar-overlay" onClick={() => setShowCaseDetails(false)}></div>
            <div className="sidebar-panel">
              <div className="sidebar-header">
                <div>
                  <h3>Case Details</h3>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
                    {selectedCase.workerName}
                  </p>
                </div>
                <button
                  className="sidebar-close"
                  onClick={() => setShowCaseDetails(false)}
                  aria-label="Close sidebar"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="sidebar-body">
                {/* Case Progress */}
                <div style={{ marginBottom: '32px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '20px' }}>
                    Case Progress
                  </h4>
                  <div className="case-progress-container">
                    {['triaged', 'assessed', 'in_rehab', 'return_to_work', 'closed'].map((status, index) => {
                      const currentStatusIndex = getStatusIndex(selectedCase.caseStatus)
                      const isCompleted = currentStatusIndex >= index
                      const isCurrent = currentStatusIndex === index
                      const statusLabel = getCaseStatusLabel(status)
                      const statusColor = isCompleted ? '#27AE60' : '#E0E0E0'
                      const iconColor = isCompleted ? '#FFFFFF' : '#64748B'
                      const lineColor = currentStatusIndex > index ? '#27AE60' : '#E0E0E0'

                      // SVG Icons for each status
                      const getStatusIcon = () => {
                        switch (status) {
                          case 'new':
                            return null // No icon for NEW
                          case 'triaged':
                            return (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                              </svg>
                            )
                          case 'assessed':
                            return (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                              </svg>
                            )
                          case 'in_rehab':
                            return (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                              </svg>
                            )
                          case 'return_to_work':
                            return (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                              </svg>
                            )
                          case 'closed':
                            return (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="15" y1="9" x2="9" y2="15"></line>
                                <line x1="9" y1="9" x2="15" y2="15"></line>
                              </svg>
                            )
                          default:
                            return null
                        }
                      }

                      return (
                        <div key={status} className="case-progress-item-horizontal">
                          <div className="case-progress-step-horizontal">
                            <div
                              className={`case-progress-circle-horizontal ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                              style={{
                                backgroundColor: statusColor,
                              }}
                            >
                              {getStatusIcon()}
                            </div>
                            {index < 4 && (
                              <div
                                className="case-progress-line-horizontal"
                                style={{
                                  backgroundColor: lineColor
                                }}
                              ></div>
                            )}
                          </div>
                          <div className="case-progress-label-horizontal">
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: isCurrent ? 700 : 500,
                                color: '#1E293B',
                                textTransform: 'uppercase',
                                letterSpacing: '0.1px'
                              }}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Case Information */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '16px' }}>
                    Case Information
                  </h4>
                  <div className="case-info-grid">
                    <div className="case-info-item">
                      <label>Current Status</label>
                      <div>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: getCaseStatusBg(selectedCase.caseStatus),
                            color: getCaseStatusColor(selectedCase.caseStatus)
                          }}
                        >
                          {getCaseStatusLabel(selectedCase.caseStatus)}
                        </span>
                      </div>
                    </div>
                    <div className="case-info-item">
                      <label>Worker</label>
                      <div>{selectedCase.workerName}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        {selectedCase.workerEmail}
                      </div>
                    </div>
                    <div className="case-info-item">
                      <label>Team</label>
                      <div>{selectedCase.teamName}</div>
                    </div>
                    <div className="case-info-item">
                      <label>Incident Type</label>
                      <div>
                        <span
                          className="type-badge"
                          style={{ backgroundColor: getTypeColor(selectedCase.type) }}
                        >
                          {getTypeLabel(selectedCase.type)}
                        </span>
                      </div>
                    </div>
                    <div className="case-info-item">
                      <label>Start Date</label>
                      <div>{new Date(selectedCase.startDate).toLocaleDateString()}</div>
                    </div>
                    <div className="case-info-item">
                      <label>End Date</label>
                      <div>{selectedCase.endDate ? new Date(selectedCase.endDate).toLocaleDateString() : 'Ongoing'}</div>
                    </div>
                    {selectedCase.reason && (
                      <div className="case-info-item" style={{ gridColumn: '1 / -1' }}>
                        <label>Reason / Details</label>
                        <div>{selectedCase.reason}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Clinician Assignment */}
                {selectedCase.assignedToWhs && (
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#0F172A', marginBottom: '16px' }}>
                      Clinician Assignment
                    </h4>
                    {selectedCase.clinicianName ? (
                      <div className="case-info-grid">
                        <div className="case-info-item">
                          <label>Assigned Clinician</label>
                          <div style={{ color: '#10B981', fontWeight: 500 }}>
                            {selectedCase.clinicianName}
                          </div>
                          {selectedCase.clinicianEmail && (
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                              {selectedCase.clinicianEmail}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '12px', backgroundColor: '#FEF3C7', borderRadius: '6px', color: '#92400E' }}>
                        <span style={{ fontSize: '13px' }}>No clinician assigned yet</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Close Case Button - Only show if case is active and not assigned to WHS */}
                {selectedCase.isActive && !selectedCase.assignedToWhs && (
                  <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #E2E8F0' }}>
                    <button
                      onClick={() => handleCloseClick(selectedCase)}
                      className="close-case-btn"
                      title="Close incident"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      Close Case
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Assign Confirmation Modal */}
        {showAssignConfirmModal && assigningIncident && (
          <div className="confirm-modal-overlay" onClick={() => setShowAssignConfirmModal(false)}>
            <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-modal-header">
                <div className="confirm-modal-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                </div>
                <h3>Assign to Case Manager</h3>
              </div>
              <div className="confirm-modal-body">
                <p>Are you sure you want to assign this incident to WHS Case Manager?</p>
                <div className="confirm-incident-info">
                  <div className="confirm-info-row">
                    <span className="confirm-info-label">Worker:</span>
                    <span className="confirm-info-value">{assigningIncident.workerName}</span>
                  </div>
                  <div className="confirm-info-row">
                    <span className="confirm-info-label">Type:</span>
                    <span className="confirm-info-value">{getTypeLabel(assigningIncident.type)}</span>
                  </div>
                </div>
                <p className="confirm-warning">This action cannot be undone.</p>
              </div>
              <div className="confirm-modal-footer">
                <button
                  className="confirm-cancel-btn"
                  onClick={() => {
                    setShowAssignConfirmModal(false)
                    setAssigningIncident(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  className="confirm-submit-btn"
                  onClick={() => assigningIncident && handleAssignToWhs(assigningIncident.id)}
                >
                  Yes, Assign
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Case Confirmation Modal */}
        {showCloseConfirmModal && closingIncident && (
          <div className="confirm-modal-overlay" onClick={() => setShowCloseConfirmModal(false)}>
            <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-modal-header">
                <div className="confirm-modal-icon close-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
                <h3>Close Case</h3>
              </div>
              <div className="confirm-modal-body">
                <p>Are you sure you want to close this incident?</p>
                <div className="confirm-incident-info">
                  <div className="confirm-info-row">
                    <span className="confirm-info-label">Worker:</span>
                    <span className="confirm-info-value">{closingIncident.workerName}</span>
                  </div>
                  <div className="confirm-info-row">
                    <span className="confirm-info-label">Type:</span>
                    <span className="confirm-info-value">{getTypeLabel(closingIncident.type)}</span>
                  </div>
                </div>
                <div className="close-warning-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <div>
                    <p className="close-warning-title">Important:</p>
                    <p className="close-warning-text">All worker schedules will be activated again and the exception will be removed. This action cannot be undone.</p>
                  </div>
                </div>
              </div>
              <div className="confirm-modal-footer">
                <button
                  className="confirm-cancel-btn"
                  onClick={() => {
                    setShowCloseConfirmModal(false)
                    setClosingIncident(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  className="confirm-submit-btn close-submit-btn"
                  onClick={() => {
                    if (closingIncident) {
                      handleCloseIncident(closingIncident.id)
                      if (showCaseDetails && selectedCase?.id === closingIncident.id) {
                        setShowCaseDetails(false)
                      }
                    }
                  }}
                >
                  Yes, Close Case
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Message Toast */}
        {showSuccessMessage && (
          <div className="success-toast">
            <div className="success-toast-content">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{successMessage}</span>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

