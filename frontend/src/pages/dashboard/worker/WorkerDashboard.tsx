import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { API_BASE_URL } from '../../../config/api'
import './WorkerDashboard.css'

interface ShiftInfo {
  hasShift: boolean
  shiftType: 'morning' | 'afternoon' | 'night' | 'flexible'
  shiftStart?: string
  shiftEnd?: string
  checkInWindow: {
    windowStart: string
    windowEnd: string
    recommendedStart: string
    recommendedEnd: string
  }
  scheduleSource?: 'team_leader' | 'none' | 'flexible'
  requiresDailyCheckIn?: boolean
  date?: string
  dayName?: string
  formattedDate?: string
}

// Helper function to format case status for display
const getCaseStatusLabel = (caseStatus?: string): string => {
  if (!caseStatus) return ''
  const statusMap: Record<string, string> = {
    'new': 'NEW CASE',
    'triaged': 'TRIAGED',
    'assessed': 'ASSESSED',
    'in_rehab': 'IN REHAB',
    'return_to_work': 'RETURN TO WORK',
    'closed': 'CLOSED'
  }
  return statusMap[caseStatus] || caseStatus.toUpperCase()
}

// Helper function to get case status color
const getCaseStatusColor = (caseStatus?: string): string => {
  if (!caseStatus) return '#6b7280'
  const colorMap: Record<string, string> = {
    'new': '#3b82f6', // Blue
    'triaged': '#8b5cf6', // Purple
    'assessed': '#f59e0b', // Amber
    'in_rehab': '#10b981', // Green
    'return_to_work': '#06b6d4', // Cyan
    'closed': '#6b7280' // Gray
  }
  return colorMap[caseStatus] || '#6b7280'
}

// Helper function to format time (HH:MM to 12-hour format)
const formatTime = (timeStr: string): string => {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function WorkerDashboard() {
  const { user, first_name, full_name, business_name } = useAuth()
  const navigate = useNavigate()
  
  // State management
  const [todayProgress, setTodayProgress] = useState(0)
  const [streakDays] = useState(7)
  const [userName, setUserName] = useState(first_name || full_name || user?.email?.split('@')[0] || 'User')
  const [teamSite, setTeamSite] = useState<string | null>(null)
  const [hasWarmUp, setHasWarmUp] = useState(false)
  const [hasCheckedIn, setHasCheckedIn] = useState(false)
  const [hasActiveException, setHasActiveException] = useState(false)
  const [exceptionInfo, setExceptionInfo] = useState<{
    exception_type?: string
    reason?: string
    start_date?: string
    end_date?: string
    case_status?: string
  } | null>(null)
  const [checkInStatus, setCheckInStatus] = useState<{
    hasCheckedIn: boolean
    hasActiveException?: boolean
    exception?: {
      exception_type?: string
      reason?: string
      start_date?: string
      end_date?: string
      case_status?: string
    } | null
    checkIn: {
      check_in_time?: string
      predicted_readiness?: string
      shift_type?: string
    } | null
  } | null>(null)
  const [hasAssignedSchedule, setHasAssignedSchedule] = useState(false)
  const [nextShiftInfo, setNextShiftInfo] = useState<ShiftInfo | null>(null)
  const [nextWarmUpTime, setNextWarmUpTime] = useState<Date | null>(null)
  const [timeUntilNext, setTimeUntilNext] = useState<string>('')

  // Update countdown timer every minute
  useEffect(() => {
    if (!nextWarmUpTime) return

    const updateCountdown = () => {
      const now = new Date()
      const diff = nextWarmUpTime.getTime() - now.getTime()
      
      if (diff <= 0) {
        setTimeUntilNext('Available now')
        return
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      
      if (hours > 0) {
        setTimeUntilNext(`${hours}h ${minutes}m`)
      } else {
        setTimeUntilNext(`${minutes}m`)
      }
    }

    // Update immediately
    updateCountdown()

    // Update every minute
    const interval = setInterval(updateCountdown, 60000)

    return () => clearInterval(interval)
  }, [nextWarmUpTime])

  // Calculate today's progress based on check-in and warm-up
  const calculateProgress = (checkedIn: boolean, warmUpComplete: boolean): number => {
    if (checkedIn && warmUpComplete) return 100
    if (checkedIn || warmUpComplete) return 50
    return 0
  }

  // Pure helper functions - no memoization needed
  const formatNextWarmUpTime = (date: Date): string => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    const isTomorrow = date.getDate() === tomorrow.getDate() && 
                       date.getMonth() === tomorrow.getMonth() && 
                       date.getFullYear() === tomorrow.getFullYear()
    
    if (isTomorrow) {
      return `Tomorrow at ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`
    }
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    })
  }

  const getTimeUntilNextWarmUp = (nextTime: Date): string => {
    const now = new Date()
    const diff = nextTime.getTime() - now.getTime()
    
    if (diff <= 0) return 'Available now'
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  // Calculate next daily warm-up time (next day at 6 AM)
  const calculateNextWarmUpTime = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(6, 0, 0, 0)
    return tomorrow
  }

  // Load dashboard data - memoized because used in useEffect dependency
  const loadDashboardData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/checkins/dashboard`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load dashboard data')
      }

      const data = await response.json()

      // Set team info
      if (data.team?.displayName) {
        setTeamSite(data.team.displayName)
      } else {
        setTeamSite(null)
      }

      // Set check-in status
      if (data.checkIn) {
        const checkInData = data.checkIn
        setHasCheckedIn(checkInData.hasCheckedIn || false)
        setHasActiveException(checkInData.hasActiveException || false)
        setExceptionInfo(checkInData.exception || null)
        setCheckInStatus({
          hasCheckedIn: checkInData.hasCheckedIn || false,
          hasActiveException: checkInData.hasActiveException,
          exception: checkInData.exception,
          checkIn: checkInData.checkIn
        })
        
        // Set warm-up status
        if (checkInData.warmUp) {
          setHasWarmUp(checkInData.warmUp.completed || false)
        }

        // Calculate progress
        setTodayProgress(calculateProgress(checkInData.hasCheckedIn || false, checkInData.warmUp?.completed || false))
      }

      // Set shift info
      if (data.shift) {
        // Today's schedule
        if (data.shift.today) {
          const hasSchedule = data.shift.today.scheduleSource === 'team_leader'
          setHasAssignedSchedule(hasSchedule)
        }
        
        // Next shift info
        if (data.shift.next) {
          setNextShiftInfo(data.shift.next)
        }
      }
    } catch (error) {
      console.error('[WorkerDashboard] Error loading dashboard data:', error)
      setTeamSite(null)
      setHasCheckedIn(false)
      setHasWarmUp(false)
      setTodayProgress(0)
      setHasAssignedSchedule(false)
      setNextShiftInfo(null)
    }
  }, [])

  // Fetch dashboard data and initialize warm-up time
  useEffect(() => {
    if (!user) return

    const displayName = first_name || full_name || user?.email?.split('@')[0] || 'User'
    setUserName(displayName)
    loadDashboardData()
    setNextWarmUpTime(calculateNextWarmUpTime())
  }, [user, first_name, full_name, loadDashboardData])

  // Update next warm-up time when warm-up is completed
  useEffect(() => {
    setNextWarmUpTime(calculateNextWarmUpTime())
  }, [hasWarmUp])

  const handleStartWarmUp = () => {
    // Navigate to recovery plan page
    navigate('/dashboard/worker/recovery-plan')
  }

  const handleCompleteCheckIn = () => {
    // Prevent navigation if already checked in
    if (hasCheckedIn) {
      return
    }
    // Check-in page has been removed
    // TODO: Implement check-in functionality directly on dashboard if needed
    console.log('Check-in functionality needs to be implemented')
  }

  const handleReportIncident = () => {
    navigate('/dashboard/worker/report-incident')
  }

  return (
    <DashboardLayout>
      <div className="worker-dashboard">
        {/* Header */}
        <header className="worker-header">
        <div className="worker-header-left">
          <h1 className="worker-welcome">Welcome back, {userName}</h1>
          <p className="worker-subtitle">
            {business_name ? `${business_name} • ${teamSite || 'No team assigned'}` : (teamSite || 'No team assigned')}
          </p>
        </div>
        <div className="worker-header-right">
          <div className="worker-streak-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L8 8l6 2-6 2 4 6 4-6-6-2 6-2-4-6z"/>
            </svg>
            <span>{streakDays} day streak</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="worker-main">
        <div className="worker-container">
          {/* Today's Progress Card */}
            <div className="worker-card worker-progress-card">
            <h2 className="worker-card-title">Today's Progress</h2>
            <p className="worker-card-subtitle">
              {todayProgress === 100 
                ? "🎉 Excellent! You've completed everything today!" 
                : todayProgress === 50
                ? "Keep up the great work! One more task to complete."
                : "Keep up the great work!"}
            </p>
            <div className="worker-progress-wrapper">
              <div className="worker-progress-bar">
                <div 
                  className="worker-progress-fill" 
                  style={{ width: `${todayProgress}%` }}
                ></div>
              </div>
              <span className="worker-progress-text">{todayProgress}% Complete</span>
            </div>
            <div style={{ 
              marginTop: '16px', 
              display: 'flex', 
              gap: '16px', 
              fontSize: '13px',
              color: '#6b7280'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                color: hasCheckedIn ? '#10b981' : '#9ca3af'
              }}>
                {hasCheckedIn ? '✓' : '○'}
                <span>Check-In</span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                color: hasWarmUp ? '#10b981' : '#9ca3af'
              }}>
                {hasWarmUp ? '✓' : '○'}
                <span>Warm-Up</span>
              </div>
            </div>
          </div>

          {/* Daily Tasks Grid */}
          <div className="worker-tasks-grid">
            {/* Daily Warm-Up Card */}
            <div className="worker-card worker-task-card">
              <div className="worker-task-header">
                <div className="worker-task-icon worker-icon-play">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="8 5 19 12 8 19 8 5"/>
                  </svg>
                </div>
                <div className="worker-task-info">
                  <h3 className="worker-task-title">Daily Warm-Up</h3>
                  <p className="worker-task-desc">Spine & Hips Primer • 6 minutes</p>
                  {nextWarmUpTime && (
                    <p style={{ 
                      fontSize: '12px', 
                      color: hasWarmUp ? '#10b981' : '#6b7280',
                      marginTop: '4px',
                      fontWeight: 500
                    }}>
                      {hasWarmUp ? (
                        <>
                          <span style={{ marginRight: '4px' }}>✓</span>
                          Next warm-up: {formatNextWarmUpTime(nextWarmUpTime)} ({timeUntilNext || getTimeUntilNextWarmUp(nextWarmUpTime)})
                        </>
                      ) : (
                        <>
                          Next warm-up: {formatNextWarmUpTime(nextWarmUpTime)} ({timeUntilNext || getTimeUntilNextWarmUp(nextWarmUpTime)})
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={handleStartWarmUp}
                className="worker-btn worker-btn-primary worker-btn-large"
                disabled={hasWarmUp}
                style={hasWarmUp ? {
                  opacity: 0.6,
                  cursor: 'not-allowed',
                  backgroundColor: '#e5e7eb',
                  color: '#6b7280'
                } : {}}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="8 5 19 12 8 19 8 5"/>
                </svg>
                {hasWarmUp ? 'Already Completed' : 'Start Warm-Up'}
              </button>
            </div>

            {/* Daily Check-In Card */}
            <div className="worker-card worker-task-card">
              <div className="worker-task-header">
                <div className="worker-task-icon worker-icon-checkin">
                  {hasActiveException ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                    </svg>
                  ) : hasCheckedIn ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="9 12 11 14 15 10"></polyline>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </div>
                <div className="worker-task-info">
                  <h3 className="worker-task-title">Daily Check-In</h3>
                  {hasActiveException && exceptionInfo ? (
                    <p className="worker-task-desc" style={{ color: '#f59e0b' }}>
                      ⚠️ Exception Active • {exceptionInfo.exception_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Exception'}
                      {exceptionInfo.case_status && (
                        <span style={{ 
                          fontSize: '0.85em', 
                          display: 'block', 
                          marginTop: '4px',
                          fontWeight: 600,
                          color: getCaseStatusColor(exceptionInfo.case_status)
                        }}>
                          Case Status: {getCaseStatusLabel(exceptionInfo.case_status)}
                        </span>
                      )}
                      {exceptionInfo.reason && (
                        <span style={{ fontSize: '0.85em', display: 'block', marginTop: '4px' }}>
                          {exceptionInfo.reason}
                        </span>
                      )}
                    </p>
                  ) : hasCheckedIn && checkInStatus?.checkIn ? (
                    <p className="worker-task-desc" style={{ color: '#10b981' }}>
                      ✓ Already checked in today • {checkInStatus.checkIn.predicted_readiness || 'Completed'}
                      {checkInStatus.checkIn.check_in_time && (
                        <span style={{ fontSize: '0.85em', marginLeft: '8px' }}>
                          at {checkInStatus.checkIn.check_in_time}
                        </span>
                      )}
                    </p>
                  ) : !hasAssignedSchedule ? (
                    <p className="worker-task-desc" style={{ color: '#ef4444' }}>
                      {nextShiftInfo?.hasShift && nextShiftInfo.date ? (
                        <>
                          📅 Next Check-In: {nextShiftInfo.formattedDate || (nextShiftInfo.dayName ? `${nextShiftInfo.dayName}, ` : '') + new Date(nextShiftInfo.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {nextShiftInfo.shiftStart && nextShiftInfo.shiftEnd && (
                            <span style={{ fontSize: '0.85em', display: 'block', marginTop: '4px', color: '#525252' }}>
                              {formatTime(nextShiftInfo.shiftStart)} - {formatTime(nextShiftInfo.shiftEnd)}
                              {nextShiftInfo.checkInWindow?.windowStart && nextShiftInfo.checkInWindow?.windowEnd && (
                                <span style={{ marginLeft: '8px' }}>
                                  (Check-in: {formatTime(nextShiftInfo.checkInWindow.windowStart)} - {formatTime(nextShiftInfo.checkInWindow.windowEnd)})
                                </span>
                              )}
                            </span>
                          )}
                        </>
                      ) : (
                        '⚠️ No schedule assigned • Contact Team Leader'
                      )}
                    </p>
                  ) : (
                    <p className="worker-task-desc">How are you feeling? • 15 seconds</p>
                  )}
                </div>
              </div>
              {hasActiveException ? (
                <button 
                  disabled
                  className="worker-btn worker-btn-secondary worker-btn-large"
                  style={{ 
                    opacity: 0.6, 
                    cursor: 'not-allowed',
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    borderColor: '#f59e0b'
                  }}
                  title={`Exception active: ${exceptionInfo?.exception_type || 'Unknown'}. Check-in not required.`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  Exception Active
                </button>
              ) : !hasAssignedSchedule ? (
                <button 
                  disabled
                  className="worker-btn worker-btn-secondary worker-btn-large"
                  style={{ 
                    opacity: 0.6, 
                    cursor: 'not-allowed',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    borderColor: '#ef4444'
                  }}
                  title="No assigned schedule. Please contact your Team Leader to assign you a schedule."
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  No Schedule Assigned
                </button>
              ) : hasCheckedIn ? (
                <button 
                  disabled
                  className="worker-btn worker-btn-secondary worker-btn-large"
                  style={{ 
                    opacity: 0.6, 
                    cursor: 'not-allowed',
                    backgroundColor: '#e5e7eb',
                    color: '#6b7280'
                  }}
                  title="Already checked in today. Check-in again tomorrow."
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                  </svg>
                  Already Checked In
                </button>
              ) : (
                <button 
                  onClick={handleCompleteCheckIn}
                  className="worker-btn worker-btn-secondary worker-btn-large"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  Complete Check-In
                </button>
              )}
            </div>
          </div>

          {/* Report Incident Card */}
          <div 
            className="worker-card worker-incident-card"
            onClick={handleReportIncident}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleReportIncident()
              }
            }}
            aria-label="Report Incident or Near-Miss"
          >
            <div className="worker-incident-header">
              <div className="worker-incident-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
                  <path d="M12 8v4m0 4h.01" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="worker-incident-info">
                <h3 className="worker-incident-title">Report Incident or Near-Miss</h3>
                <p className="worker-incident-desc">Quick 60-second report with photo</p>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation()
                handleReportIncident()
              }}
              className="worker-btn worker-btn-danger worker-btn-large"
            >
              Report Now
            </button>
          </div>

          {/* Achievements Section */}
          <div className="worker-card worker-achievements-card">
            <h2 className="worker-card-title">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
              </svg>
              Your Achievements
            </h2>
            <div className="worker-achievements-grid">
              <div className="worker-achievement-item">
                <div className="worker-achievement-icon worker-achievement-fire">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L8 8l6 2-6 2 4 6 4-6-6-2 6-2-4-6z"/>
                  </svg>
                </div>
                <p className="worker-achievement-label">{streakDays} Day Streak</p>
              </div>
              <div className="worker-achievement-item">
                <div className="worker-achievement-icon worker-achievement-check">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <p className="worker-achievement-label">100% This Week</p>
              </div>
              <div className="worker-achievement-item">
                <div className="worker-achievement-icon worker-achievement-trophy">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                </div>
                <p className="worker-achievement-label">Team Leader</p>
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </DashboardLayout>
  )
}


