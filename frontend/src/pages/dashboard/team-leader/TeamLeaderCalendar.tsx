import { useState, useEffect, useMemo, useCallback } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './TeamLeaderCalendar.css'

interface Worker {
  id: string
  email: string
  first_name?: string
  last_name?: string
  full_name?: string
}

interface WorkerSchedule {
  id: string
  worker_id: string
  scheduled_date?: string | null // NULL for recurring schedules
  day_of_week?: number | null // 0-6 for recurring schedules, NULL for single-date
  effective_date?: string | null // Start date for recurring schedules
  expiry_date?: string | null // End date for recurring schedules
  start_time: string
  end_time: string
  notes?: string
  is_active: boolean
  users?: Worker
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MAX_SCHEDULES_TO_SHOW_IN_CELL = 2 // Show only 2 schedules in calendar cell, rest as count
const DETAIL_PAGE_SIZE = 50 // Pagination size for detail panel

export function TeamLeaderCalendar() {
  const [schedules, setSchedules] = useState<WorkerSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [timeFilter, setTimeFilter] = useState<string>('all') // 'all', 'morning', 'afternoon', 'night'
  const [detailPage, setDetailPage] = useState(1)

  // Calculate date range for current month (with buffer for recurring schedules)
  const monthRange = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    // Add 2 weeks buffer before and after for recurring schedules
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - 14)
    const endDate = new Date(lastDay)
    endDate.setDate(endDate.getDate() + 14)
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }
  }, [currentDate])

  useEffect(() => {
    loadSchedules()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthRange.startDate, monthRange.endDate])

  // Reset filters when date changes
  useEffect(() => {
    setSearchQuery('')
    setTimeFilter('all')
    setDetailPage(1)
  }, [selectedDate])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      // Fetch worker schedules with date range filter for better performance
      const response = await fetch(
        `${API_BASE_URL}/api/schedules/workers?startDate=${monthRange.startDate}&endDate=${monthRange.endDate}&_t=${Date.now()}`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        }
      )
      if (!response.ok) throw new Error('Failed to fetch worker schedules')
      const data = await response.json()
      if (import.meta.env.DEV) {
        console.log('[TeamLeaderCalendar] Loaded', data.schedules?.length || 0, 'worker schedules')
      }
      setSchedules(data.schedules || [])
    } catch (error) {
      console.error('[TeamLeaderCalendar] Error loading worker schedules:', error)
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }

  // Get the first day of the month and number of days
  const getMonthData = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { year, month, daysInMonth, startingDayOfWeek }
  }

  // Get worker name helper
  const getWorkerName = (schedule: WorkerSchedule): string => {
    const user = schedule.users
    if (user?.full_name) return user.full_name
    if (user?.first_name && user?.last_name) return `${user.first_name} ${user.last_name}`
    if (user?.first_name) return user.first_name
    return user?.email?.split('@')[0] || 'Unknown Worker'
  }

  // Memoized: Get schedules for a specific date (optimized for performance)
  const getSchedulesForDate = useCallback((date: Date): WorkerSchedule[] => {
    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split('T')[0]
    const dateObj = new Date(dateStr)
    dateObj.setHours(0, 0, 0, 0)

    return schedules.filter(schedule => {
      if (!schedule.is_active) return false

      // Single-date schedule: check if scheduled_date matches
      if (schedule.scheduled_date && (schedule.day_of_week === null || schedule.day_of_week === undefined)) {
        return schedule.scheduled_date === dateStr
      }

      // Recurring schedule: check day_of_week and effective/expiry dates
      if (schedule.day_of_week !== null && schedule.day_of_week !== undefined) {
        if (schedule.day_of_week !== dayOfWeek) return false

        // Check effective_date
        if (schedule.effective_date) {
          const effectiveDate = new Date(schedule.effective_date)
          effectiveDate.setHours(0, 0, 0, 0)
          if (dateObj < effectiveDate) return false
        }

        // Check expiry_date
        if (schedule.expiry_date) {
          const expiryDate = new Date(schedule.expiry_date)
          expiryDate.setHours(23, 59, 59, 999)
          if (dateObj > expiryDate) return false
        }

        return true
      }

      return false
    })
  }, [schedules])

  // Memoized: Get shift type from time
  const getShiftType = useCallback((startTime: string): 'morning' | 'afternoon' | 'night' | 'other' => {
    const hour = parseInt(startTime.split(':')[0])
    if (hour >= 5 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 17) return 'afternoon'
    if (hour >= 17 || hour < 5) return 'night'
    return 'other'
  }, [])

  // Memoized: Filter and sort schedules for selected date
  const filteredSelectedDateSchedules = useMemo(() => {
    if (!selectedDate) return []
    
    let filtered = getSchedulesForDate(selectedDate)
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(schedule => {
        const workerName = getWorkerName(schedule).toLowerCase()
        return workerName.includes(query)
      })
    }
    
    // Apply time filter
    if (timeFilter !== 'all') {
      filtered = filtered.filter(schedule => {
        const shiftType = getShiftType(schedule.start_time)
        return shiftType === timeFilter
      })
    }
    
    // Sort by worker name, then by time
    return filtered.sort((a, b) => {
      const nameA = getWorkerName(a).toLowerCase()
      const nameB = getWorkerName(b).toLowerCase()
      if (nameA !== nameB) return nameA.localeCompare(nameB)
      return a.start_time.localeCompare(b.start_time)
    })
  }, [selectedDate, getSchedulesForDate, searchQuery, timeFilter, getShiftType])

  // Paginated schedules for detail panel
  const paginatedSchedules = useMemo(() => {
    const start = (detailPage - 1) * DETAIL_PAGE_SIZE
    const end = start + DETAIL_PAGE_SIZE
    return filteredSelectedDateSchedules.slice(start, end)
  }, [filteredSelectedDateSchedules, detailPage])

  const totalPages = Math.ceil(filteredSelectedDateSchedules.length / DETAIL_PAGE_SIZE)

  // Helper: Get today's date (normalized to midnight)
  const getToday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  }

  // Check if date is in the past
  const isPastDate = (date: Date): boolean => {
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate < getToday()
  }

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = getToday()
    const checkDate = new Date(date)
    checkDate.setHours(0, 0, 0, 0)
    return checkDate.getTime() === today.getTime()
  }

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDate(null)
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDate(null)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
    setSelectedDate(new Date())
  }

  const { year, month, daysInMonth, startingDayOfWeek } = getMonthData()

  const renderCalendarDays = () => {
    const days: React.ReactElement[] = []

    // Empty cells before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>)
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const daySchedules = getSchedulesForDate(date)
      const hasSchedule = daySchedules.length > 0
      const isPast = isPastDate(date)
      const isTodayDate = isToday(date)
      const isSelected = selectedDate?.getTime() === date.getTime()

      days.push(
        <div
          key={day}
          className={`calendar-day ${hasSchedule ? 'has-schedule' : ''} ${isPast ? 'past-date' : ''} ${isTodayDate ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => setSelectedDate(date)}
        >
          <div className="day-number">{day}</div>
          {hasSchedule && (
            <div className="schedule-details-in-calendar">
              {daySchedules.slice(0, MAX_SCHEDULES_TO_SHOW_IN_CELL).map((schedule) => {
                const workerName = getWorkerName(schedule)
                const shortName = workerName.length > 6 ? workerName.substring(0, 6) + '..' : workerName
                return (
                  <div key={schedule.id} className={`schedule-time-badge ${isPast ? 'past' : ''}`} title={`${workerName}: ${schedule.start_time.substring(0, 5)} - ${schedule.end_time.substring(0, 5)}`}>
                    <span className="worker-name-short">{shortName}</span>
                    <span className="schedule-time">{schedule.start_time.substring(0, 5)}</span>
                  </div>
                )
              })}
              {daySchedules.length > MAX_SCHEDULES_TO_SHOW_IN_CELL && (
                <div className="schedule-count-badge" title={`${daySchedules.length} workers scheduled`}>
                  +{daySchedules.length - MAX_SCHEDULES_TO_SHOW_IN_CELL}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    return days
  }

  return (
    <DashboardLayout>
      <div className="calendar-container">
        <div className="calendar-header">
          <h1>Worker Schedules Calendar</h1>
          <p className="calendar-subtitle">View all worker schedules assigned by you</p>
        </div>

        {loading ? (
          <Loading message="Loading calendar..." size="medium" />
        ) : (
          <>
            <div className="calendar-controls">
              <button onClick={goToPreviousMonth} className="nav-button">
                ← Previous
              </button>
              <div className="month-year">
                <h2>{MONTHS[month]} {year}</h2>
              </div>
              <button onClick={goToNextMonth} className="nav-button">
                Next →
              </button>
              <button onClick={goToToday} className="today-button">
                Today
              </button>
            </div>

            <div className="calendar-wrapper">
              <div className="calendar-grid">
                {/* Day headers */}
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="calendar-day-header">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {renderCalendarDays()}
              </div>

              {/* Selected date details */}
              {selectedDate && (
                <div className="calendar-details">
                  <div className="details-header">
                    <h3>
                      {selectedDate.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </h3>
                    <div className="header-badges">
                      {isPastDate(selectedDate) && (
                        <span className="past-badge">Past</span>
                      )}
                      {isToday(selectedDate) && (
                        <span className="today-badge">Today</span>
                      )}
                      {filteredSelectedDateSchedules.length > 0 && (
                        <span className="count-badge">{filteredSelectedDateSchedules.length} workers</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Filters */}
                  {getSchedulesForDate(selectedDate).length > 0 && (
                    <div className="details-filters">
                      <input
                        type="text"
                        placeholder="Search workers..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setDetailPage(1) // Reset to first page on search
                        }}
                        className="search-input"
                      />
                      <select
                        value={timeFilter}
                        onChange={(e) => {
                          setTimeFilter(e.target.value)
                          setDetailPage(1) // Reset to first page on filter
                        }}
                        className="time-filter-select"
                      >
                        <option value="all">All Shifts</option>
                        <option value="morning">Morning (5AM-12PM)</option>
                        <option value="afternoon">Afternoon (12PM-5PM)</option>
                        <option value="night">Night (5PM-5AM)</option>
                      </select>
                    </div>
                  )}

                  <div className="details-content">
                    {filteredSelectedDateSchedules.length === 0 ? (
                      <p className="no-schedule-text">
                        {getSchedulesForDate(selectedDate).length === 0
                          ? 'No worker schedules assigned for this date'
                          : 'No workers match your search/filter'}
                      </p>
                    ) : (
                      <>
                        <div className="schedule-list">
                          {paginatedSchedules.map((schedule) => {
                            const workerName = getWorkerName(schedule)
                            const isRecurring = schedule.day_of_week !== null && schedule.day_of_week !== undefined
                            const shiftType = getShiftType(schedule.start_time)
                            return (
                              <div key={schedule.id} className="schedule-detail-card">
                                <div className="schedule-worker-name">
                                  <strong>{workerName}</strong>
                                  <span className={`shift-type-badge ${shiftType}`}>
                                    {shiftType === 'morning' ? '🌅' : shiftType === 'afternoon' ? '☀️' : '🌙'}
                                  </span>
                                </div>
                                <div className="schedule-time">
                                  {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)}
                                </div>
                                {isRecurring && (
                                  <div className="schedule-type">
                                    <small>Recurring: {DAYS_OF_WEEK[schedule.day_of_week!]}</small>
                                  </div>
                                )}
                                {schedule.notes && (
                                  <div className="schedule-note">
                                    <strong>Notes:</strong> {schedule.notes}
                                  </div>
                                )}
                                {(schedule.effective_date || schedule.expiry_date) && (
                                  <div className="schedule-dates">
                                    {schedule.effective_date && (
                                      <small>From: {new Date(schedule.effective_date).toLocaleDateString()}</small>
                                    )}
                                    {schedule.expiry_date && (
                                      <small>Until: {new Date(schedule.expiry_date).toLocaleDateString()}</small>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                        
                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div className="pagination-controls">
                            <button
                              onClick={() => setDetailPage(p => Math.max(1, p - 1))}
                              disabled={detailPage === 1}
                              className="pagination-btn"
                            >
                              ← Previous
                            </button>
                            <span className="pagination-info">
                              Page {detailPage} of {totalPages} ({filteredSelectedDateSchedules.length} total)
                            </span>
                            <button
                              onClick={() => setDetailPage(p => Math.min(totalPages, p + 1))}
                              disabled={detailPage === totalPages}
                              className="pagination-btn"
                            >
                              Next →
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="calendar-legend">
              <div className="legend-item">
                <div className="schedule-time-badge">
                  <span className="worker-name-short">Worker</span>
                  <span className="schedule-time">08:00</span>
                </div>
                <span>Upcoming Schedule</span>
              </div>
              <div className="legend-item">
                <div className="schedule-time-badge past-schedule">
                  <span className="worker-name-short">Worker</span>
                  <span className="schedule-time">08:00</span>
                </div>
                <span>Past Schedule</span>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

