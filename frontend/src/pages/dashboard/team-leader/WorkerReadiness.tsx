import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './WorkerReadiness.css'

interface CheckInData {
  userId: string
  workerName: string
  workerEmail: string
  workerInitials: string
  hasCheckedIn: boolean
  hasWarmUp: boolean
  hasActiveException: boolean
  exception?: {
    type: string
    reason?: string
    startDate: string
    endDate?: string
  }
  status: 'green' | 'amber' | 'red' | 'pending' | 'exception'
  checkIn?: {
    checkInTime: string
    painLevel: number
    fatigueLevel: number
    stressLevel: number
    sleepQuality: number
    predictedReadiness: string
    additionalNotes?: string
    shiftType?: string
    shiftStartTime?: string
    shiftEndTime?: string
  }
}

interface CheckInsResponse {
  checkIns: CheckInData[]
  statistics: {
    total: number
    completed: number
    pending: number
    green: number
    amber: number
    red: number
    completionRate: number
    withExceptions: number
  }
  dateRange?: {
    startDate: string
    endDate: string
    isSingleDate: boolean
  }
}

export function WorkerReadiness() {
  const { user } = useAuth()
  const [checkInsData, setCheckInsData] = useState<CheckInsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedWorker, setSelectedWorker] = useState<CheckInData | null>(null)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  
  // Get today's date in user's local timezone
  const getLocalToday = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const today = getLocalToday()
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)

  const loadCheckIns = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Validate dates
      if (new Date(startDate) > new Date(endDate)) {
        setError('Start date must be before or equal to end date')
        setLoading(false)
        return
      }
      
      // Build query params for date range filtering
      // Add timestamp to prevent caching and ensure latest data
      const params = new URLSearchParams()
      params.append('startDate', startDate)
      params.append('endDate', endDate)
      params.append('_t', Date.now().toString())
      
      const response = await fetch(`${API_BASE_URL}/api/teams/check-ins?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load worker readiness data')
      }

      const data = await response.json()
      setCheckInsData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load worker readiness data')
    } finally {
      setLoading(false)
    }
  }

  // Check if viewing today (single date = today)
  const isToday = startDate === today && endDate === today

  useEffect(() => {
    if (user) {
      loadCheckIns()
      
      // Auto-refresh every 30 seconds only if viewing today
      if (isToday) {
        const interval = setInterval(() => {
          loadCheckIns()
        }, 30000)

        return () => clearInterval(interval)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, startDate, endDate])


  // Function to reset to today (uses local timezone)
  const resetToToday = () => {
    const todayStr = getLocalToday()
    setStartDate(todayStr)
    setEndDate(todayStr)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'green':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5"/>
          </svg>
        )
      case 'amber':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="5" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="1.5"/>
          </svg>
        )
      case 'red':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="5" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5"/>
          </svg>
        )
      case 'pending':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="5" fill="#CBD5E1" stroke="#FFFFFF" strokeWidth="1.5"/>
          </svg>
        )
      case 'exception':
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 2L10 10H2L6 2Z" fill="#F59E0B"/>
            <path d="M6 7V8.5M6 5.5V6" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round"/>
          </svg>
        )
      default:
        return (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="6" r="2" fill="#94A3B8"/>
          </svg>
        )
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'green':
        return 'Fit to work'
      case 'amber':
        return 'Minor issue'
      case 'red':
        return 'Not fit to work'
      case 'pending':
        return 'Pending'
      case 'exception':
        return 'Exception'
      default:
        return 'Unknown'
    }
  }

  // Memoize sorted check-ins - optimized to prevent unnecessary recalculations
  const sortedCheckIns = useMemo(() => {
    if (!checkInsData?.checkIns) return []
    
    return [...checkInsData.checkIns].sort((a, b) => {
      // Priority: exception > red > amber > green > pending
      const statusOrder: Record<string, number> = {
        exception: 0,
        red: 1,
        amber: 2,
        green: 3,
        pending: 4,
      }
      
      const aOrder = statusOrder[a.status] ?? 5
      const bOrder = statusOrder[b.status] ?? 5
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      
      // If same status, sort by name
      return a.workerName.localeCompare(b.workerName)
    })
  }, [checkInsData?.checkIns])

  return (
    <DashboardLayout>
      <div className="worker-readiness-page">
        <header className="readiness-header">
          <div>
            <h1 className="readiness-title">Worker Readiness</h1>
            <p className="readiness-subtitle">
              Monitor your team's daily check-ins and readiness status
              {checkInsData?.dateRange && !checkInsData.dateRange.isSingleDate && (
                <span className="date-range-indicator">
                  (Viewing data from {new Date(checkInsData.dateRange.startDate).toLocaleDateString()} to {new Date(checkInsData.dateRange.endDate).toLocaleDateString()})
                </span>
              )}
              {checkInsData?.dateRange && checkInsData.dateRange.isSingleDate && !isToday && (
                <span className="date-range-indicator">
                  (Viewing data for {new Date(checkInsData.dateRange.startDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })})
                </span>
              )}
            </p>
          </div>
          <div className="header-actions">
            <button 
              className="refresh-btn" 
              onClick={loadCheckIns}
              disabled={loading}
              title="Refresh data"
            >
              {loading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" opacity="0.5"/>
                  <path d="M12 6V2L8 6L12 10V6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18" strokeDasharray="20 10"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              )} Refresh
            </button>
          </div>
        </header>

        {/* Date Filter Section */}
        <div className="date-filter-section">
          <div className="date-filter-group">
            <label className="date-filter-label">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={endDate}
              className="date-input"
            />
          </div>
          <div className="date-filter-separator">to</div>
          <div className="date-filter-group">
            <label className="date-filter-label">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              max={today}
              className="date-input"
            />
          </div>
          <button 
            className={`date-preset-btn ${isToday ? 'active' : ''}`}
            onClick={resetToToday}
            title="View today's data"
          >
            Today
          </button>
        </div>

        {loading && !checkInsData ? (
          <Loading message="Loading worker readiness data..." size="medium" />
        ) : error ? (
          <div className="readiness-error">
            <p>{error}</p>
            <button onClick={loadCheckIns} className="retry-btn">Try Again</button>
          </div>
        ) : checkInsData ? (
          <>
            {/* Summary Statistics */}
            <div className="readiness-summary">
              <div className="summary-card">
                <div className="summary-value">{checkInsData.statistics.completionRate}%</div>
                <div className="summary-label">Completion Rate</div>
                <div className="summary-detail">
                  {checkInsData.statistics.completed} / {checkInsData.statistics.total} checked in
                </div>
              </div>
              <div className="summary-card status-green">
                <div className="summary-value">{checkInsData.statistics.green}</div>
                <div className="summary-label">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}>
                    <circle cx="5" cy="5" r="4.5" fill="#10B981"/>
                  </svg>
                  Fit to work
                </div>
              </div>
              <div className="summary-card status-amber">
                <div className="summary-value">{checkInsData.statistics.amber}</div>
                <div className="summary-label">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}>
                    <circle cx="5" cy="5" r="4.5" fill="#F59E0B"/>
                  </svg>
                  Minor issue
                </div>
              </div>
              <div className="summary-card status-red">
                <div className="summary-value">{checkInsData.statistics.red}</div>
                <div className="summary-label">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}>
                    <circle cx="5" cy="5" r="4.5" fill="#EF4444"/>
                  </svg>
                  Not fit to work
                </div>
              </div>
              <div className="summary-card status-pending">
                <div className="summary-value">{checkInsData.statistics.pending}</div>
                <div className="summary-label">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}>
                    <circle cx="5" cy="5" r="4.5" fill="#CBD5E1"/>
                  </svg>
                  Pending
                </div>
              </div>
              {checkInsData.statistics.withExceptions > 0 && (
                <div className="summary-card status-exception">
                  <div className="summary-value">{checkInsData.statistics.withExceptions}</div>
                  <div className="summary-label">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}>
                      <path d="M5 2L8.5 8H1.5L5 2Z" fill="#F59E0B"/>
                      <circle cx="5" cy="7" r="0.5" fill="#FFFFFF"/>
                    </svg>
                    On Exception
                  </div>
                </div>
              )}
            </div>

            {/* Workers List */}
            <div className="readiness-list-container">
              <h2 className="readiness-list-title">Team Members</h2>
              
              {sortedCheckIns.length > 0 ? (
                <div className="readiness-table">
                  <div className="readiness-table-header">
                    <div className="col-worker">Worker</div>
                    <div className="col-status">Status</div>
                    <div className="col-time">Check-in Time</div>
                    <div className="col-metrics">Metrics</div>
                    <div className="col-readiness">Readiness</div>
                  </div>
                  
                  <div className="readiness-table-body">
                    {sortedCheckIns.map((checkIn) => (
                      <div 
                        key={checkIn.userId} 
                        className={`readiness-table-row status-${checkIn.status} ${checkIn.hasCheckedIn ? 'clickable' : ''}`}
                        onClick={() => {
                          if (checkIn.hasCheckedIn) {
                            setSelectedWorker(checkIn)
                            setShowDetailsModal(true)
                          }
                        }}
                        style={{ cursor: checkIn.hasCheckedIn ? 'pointer' : 'default' }}
                      >
                        <div className="col-worker">
                          <div className="worker-info">
                            <div className="worker-avatar">
                              {checkIn.workerInitials}
                            </div>
                            <div className="worker-details">
                              <div className="worker-name">{checkIn.workerName}</div>
                              <div className="worker-email">{checkIn.workerEmail}</div>
                              {checkIn.hasActiveException && (
                                <div className="worker-exception">
                                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }}>
                                    <path d="M6 2L10 10H2L6 2Z" fill="#F59E0B"/>
                                    <circle cx="6" cy="7.5" r="0.5" fill="#FFFFFF"/>
                                  </svg>
                                  {checkIn.exception?.type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                  {checkIn.exception?.reason && `: ${checkIn.exception.reason}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="col-status">
                          <span className={`status-badge status-${checkIn.status}`}>
                            {getStatusIcon(checkIn.status)} {getStatusLabel(checkIn.status)}
                          </span>
                        </div>
                        
                        <div className="col-time">
                          {checkIn.hasCheckedIn && checkIn.checkIn ? (
                            <div>
                              <div className="time-value">{checkIn.checkIn.checkInTime || 'N/A'}</div>
                              {checkIn.checkIn.shiftType && (
                                <div className="shift-info">
                                  {checkIn.checkIn.shiftType.charAt(0).toUpperCase() + checkIn.checkIn.shiftType.slice(1)}
                                  {checkIn.checkIn.shiftStartTime && ` ${checkIn.checkIn.shiftStartTime.substring(0, 5)}-${checkIn.checkIn.shiftEndTime?.substring(0, 5)}`}
                                </div>
                              )}
                            </div>
                          ) : checkIn.hasActiveException ? (
                            <span className="exception-text">On Exception</span>
                          ) : (
                            <span className="pending-text">Not checked in</span>
                          )}
                        </div>
                        
                        <div className="col-metrics">
                          {checkIn.hasCheckedIn && checkIn.checkIn ? (
                            <div className="metrics-list">
                              <div className="metric-item">
                                <span className="metric-name">Pain:</span>
                                <span className={`metric-value ${checkIn.checkIn.painLevel >= 5 ? 'high' : checkIn.checkIn.painLevel >= 3 ? 'medium' : 'low'}`}>
                                  {checkIn.checkIn.painLevel}/10
                                </span>
                              </div>
                              <div className="metric-item">
                                <span className="metric-name">Fatigue:</span>
                                <span className={`metric-value ${checkIn.checkIn.fatigueLevel >= 7 ? 'high' : checkIn.checkIn.fatigueLevel >= 5 ? 'medium' : 'low'}`}>
                                  {checkIn.checkIn.fatigueLevel}/10
                                </span>
                              </div>
                              <div className="metric-item">
                                <span className="metric-name">Stress:</span>
                                <span className={`metric-value ${checkIn.checkIn.stressLevel >= 7 ? 'high' : checkIn.checkIn.stressLevel >= 5 ? 'medium' : 'low'}`}>
                                  {checkIn.checkIn.stressLevel}/10
                                </span>
                              </div>
                              <div className="metric-item">
                                <span className="metric-name">Sleep:</span>
                                <span className={`metric-value ${checkIn.checkIn.sleepQuality >= 8 ? 'good' : checkIn.checkIn.sleepQuality >= 6 ? 'medium' : 'low'}`}>
                                  {checkIn.checkIn.sleepQuality}/12
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="no-metrics">-</span>
                          )}
                        </div>
                        
                        <div className="col-readiness">
                          {checkIn.hasCheckedIn && checkIn.checkIn ? (
                            <div className="readiness-info">
                              <span 
                                className={`readiness-badge readiness-${checkIn.checkIn.predictedReadiness.toLowerCase()}`}
                              >
                                {checkIn.checkIn.predictedReadiness === 'Green' ? 'Fit to work' :
                                 checkIn.checkIn.predictedReadiness === 'Yellow' ? 'Minor issue' :
                                 'Not fit to work'}
                              </span>
                              {checkIn.hasWarmUp && (
                                <span className="warmup-badge">✓ Warm-up</span>
                              )}
                              {checkIn.checkIn.additionalNotes && (
                                <div className="notes-tooltip" title={checkIn.checkIn.additionalNotes}>
                                  📝 Notes
                                </div>
                              )}
                              <button 
                                className="view-details-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedWorker(checkIn)
                                  setShowDetailsModal(true)
                                }}
                                title="View Details"
                              >
                                View
                              </button>
                            </div>
                          ) : (
                            <span className="no-readiness">-</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="readiness-empty">
                  <p>No team members found. Add workers to your team to see their readiness status.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="readiness-empty">
            <p>No data available.</p>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedWorker && selectedWorker.checkIn && (
          <div className="details-modal-overlay" onClick={() => setShowDetailsModal(false)}>
            <div className="details-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="details-modal-header">
                <div className="details-worker-info">
                  <div className="details-worker-avatar">
                    {selectedWorker.workerInitials}
                  </div>
                  <div>
                    <h2 className="details-worker-name">{selectedWorker.workerName}</h2>
                    <p className="details-worker-email">{selectedWorker.workerEmail}</p>
                  </div>
                </div>
                <button 
                  className="close-modal-btn"
                  onClick={() => setShowDetailsModal(false)}
                  title="Close"
                >
                  ×
                </button>
              </div>

              <div className="details-modal-body">
                {/* Status Section */}
                <div className="details-section">
                  <h3 className="details-section-title">Status</h3>
                  <div className="details-status-grid">
                    <div className="details-status-item">
                      <span className="details-label">Readiness:</span>
                      <span 
                        className={`readiness-badge readiness-${selectedWorker.checkIn.predictedReadiness.toLowerCase()}`}
                      >
                        {selectedWorker.checkIn.predictedReadiness === 'Green' ? 'Fit to work' :
                         selectedWorker.checkIn.predictedReadiness === 'Yellow' ? 'Minor issue' :
                         'Not fit to work'}
                      </span>
                    </div>
                    <div className="details-status-item">
                      <span className="details-label">Warm-up:</span>
                      <span className={selectedWorker.hasWarmUp ? 'status-complete' : 'status-incomplete'}>
                        {selectedWorker.hasWarmUp ? '✓ Complete' : '✗ Not Completed'}
                      </span>
                    </div>
                    <div className="details-status-item">
                      <span className="details-label">Check-in Time:</span>
                      <span className="details-value">{selectedWorker.checkIn.checkInTime || 'N/A'}</span>
                    </div>
                    {selectedWorker.checkIn.shiftType && (
                      <div className="details-status-item">
                        <span className="details-label">Shift:</span>
                        <span className="details-value">
                          {selectedWorker.checkIn.shiftType.charAt(0).toUpperCase() + selectedWorker.checkIn.shiftType.slice(1)}
                          {selectedWorker.checkIn.shiftStartTime && 
                            ` (${selectedWorker.checkIn.shiftStartTime.substring(0, 5)} - ${selectedWorker.checkIn.shiftEndTime?.substring(0, 5)})`
                          }
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Metrics Section */}
                <div className="details-section">
                  <h3 className="details-section-title">Health Metrics</h3>
                  <div className="details-metrics-grid">
                    <div className="details-metric-card">
                      <div className="details-metric-header">
                        <span className="details-metric-label">Pain Level</span>
                        <span className={`details-metric-value ${selectedWorker.checkIn.painLevel >= 5 ? 'high' : selectedWorker.checkIn.painLevel >= 3 ? 'medium' : 'low'}`}>
                          {selectedWorker.checkIn.painLevel}/10
                        </span>
                      </div>
                      <div className="details-metric-bar">
                        <div 
                          className={`details-metric-fill ${selectedWorker.checkIn.painLevel >= 5 ? 'fill-high' : selectedWorker.checkIn.painLevel >= 3 ? 'fill-medium' : 'fill-low'}`}
                          style={{ width: `${(selectedWorker.checkIn.painLevel / 10) * 100}%` }}
                        />
                      </div>
                      <div className="details-metric-description">
                        {selectedWorker.checkIn.painLevel === 0 && 'No pain'}
                        {selectedWorker.checkIn.painLevel >= 1 && selectedWorker.checkIn.painLevel <= 2 && 'Mild pain'}
                        {selectedWorker.checkIn.painLevel >= 3 && selectedWorker.checkIn.painLevel <= 4 && 'Moderate pain'}
                        {selectedWorker.checkIn.painLevel >= 5 && selectedWorker.checkIn.painLevel <= 7 && 'Moderate to severe pain'}
                        {selectedWorker.checkIn.painLevel >= 8 && 'Severe pain'}
                      </div>
                    </div>

                    <div className="details-metric-card">
                      <div className="details-metric-header">
                        <span className="details-metric-label">Fatigue Level</span>
                        <span className={`details-metric-value ${selectedWorker.checkIn.fatigueLevel >= 7 ? 'high' : selectedWorker.checkIn.fatigueLevel >= 5 ? 'medium' : 'low'}`}>
                          {selectedWorker.checkIn.fatigueLevel}/10
                        </span>
                      </div>
                      <div className="details-metric-bar">
                        <div 
                          className={`details-metric-fill ${selectedWorker.checkIn.fatigueLevel >= 7 ? 'fill-high' : selectedWorker.checkIn.fatigueLevel >= 5 ? 'fill-medium' : 'fill-low'}`}
                          style={{ width: `${(selectedWorker.checkIn.fatigueLevel / 10) * 100}%` }}
                        />
                      </div>
                      <div className="details-metric-description">
                        {selectedWorker.checkIn.fatigueLevel <= 3 && 'Low fatigue'}
                        {selectedWorker.checkIn.fatigueLevel >= 4 && selectedWorker.checkIn.fatigueLevel <= 6 && 'Moderate fatigue'}
                        {selectedWorker.checkIn.fatigueLevel >= 7 && 'High fatigue - may need rest'}
                      </div>
                    </div>

                    <div className="details-metric-card">
                      <div className="details-metric-header">
                        <span className="details-metric-label">Stress Level</span>
                        <span className={`details-metric-value ${selectedWorker.checkIn.stressLevel >= 7 ? 'high' : selectedWorker.checkIn.stressLevel >= 5 ? 'medium' : 'low'}`}>
                          {selectedWorker.checkIn.stressLevel}/10
                        </span>
                      </div>
                      <div className="details-metric-bar">
                        <div 
                          className={`details-metric-fill ${selectedWorker.checkIn.stressLevel >= 7 ? 'fill-high' : selectedWorker.checkIn.stressLevel >= 5 ? 'fill-medium' : 'fill-low'}`}
                          style={{ width: `${(selectedWorker.checkIn.stressLevel / 10) * 100}%` }}
                        />
                      </div>
                      <div className="details-metric-description">
                        {selectedWorker.checkIn.stressLevel <= 3 && 'Low stress'}
                        {selectedWorker.checkIn.stressLevel >= 4 && selectedWorker.checkIn.stressLevel <= 6 && 'Moderate stress'}
                        {selectedWorker.checkIn.stressLevel >= 7 && 'High stress - monitoring recommended'}
                      </div>
                    </div>

                    <div className="details-metric-card">
                      <div className="details-metric-header">
                        <span className="details-metric-label">Sleep Quality</span>
                        <span className={`details-metric-value ${selectedWorker.checkIn.sleepQuality >= 8 ? 'good' : selectedWorker.checkIn.sleepQuality >= 6 ? 'medium' : 'low'}`}>
                          {selectedWorker.checkIn.sleepQuality}/12
                        </span>
                      </div>
                      <div className="details-metric-bar">
                        <div 
                          className={`details-metric-fill ${selectedWorker.checkIn.sleepQuality >= 8 ? 'fill-good' : selectedWorker.checkIn.sleepQuality >= 6 ? 'fill-medium' : 'fill-low'}`}
                          style={{ width: `${(selectedWorker.checkIn.sleepQuality / 12) * 100}%` }}
                        />
                      </div>
                      <div className="details-metric-description">
                        {selectedWorker.checkIn.sleepQuality >= 8 && 'Good sleep quality'}
                        {selectedWorker.checkIn.sleepQuality >= 6 && selectedWorker.checkIn.sleepQuality < 8 && 'Fair sleep quality'}
                        {selectedWorker.checkIn.sleepQuality < 6 && 'Poor sleep quality - may affect performance'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Notes */}
                {selectedWorker.checkIn.additionalNotes && (
                  <div className="details-section">
                    <h3 className="details-section-title">Additional Notes</h3>
                    <div className="details-notes">
                      {selectedWorker.checkIn.additionalNotes}
                    </div>
                  </div>
                )}

                {/* Exception Info */}
                {selectedWorker.hasActiveException && selectedWorker.exception && (
                  <div className="details-section">
                    <h3 className="details-section-title">Exception Information</h3>
                    <div className="details-exception">
                      <div className="details-exception-item">
                        <span className="details-label">Type:</span>
                        <span className="details-value">
                          {selectedWorker.exception.type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </span>
                      </div>
                      {selectedWorker.exception.reason && (
                        <div className="details-exception-item">
                          <span className="details-label">Reason:</span>
                          <span className="details-value">{selectedWorker.exception.reason}</span>
                        </div>
                      )}
                      <div className="details-exception-item">
                        <span className="details-label">Start Date:</span>
                        <span className="details-value">
                          {new Date(selectedWorker.exception.startDate).toLocaleDateString()}
                        </span>
                      </div>
                      {selectedWorker.exception.endDate && (
                        <div className="details-exception-item">
                          <span className="details-label">End Date:</span>
                          <span className="details-value">
                            {new Date(selectedWorker.exception.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

