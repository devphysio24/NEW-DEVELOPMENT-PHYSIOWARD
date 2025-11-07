import { useState, useEffect, Fragment } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './WorkerSchedules.css'

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
  check_in_window_start?: string
  check_in_window_end?: string
  requires_daily_checkin?: boolean
  daily_checkin_start_time?: string
  daily_checkin_end_time?: string
  project_id?: string
  notes?: string
  is_active: boolean
  created_at: string
  users?: Worker
}

interface WorkerException {
  id: string
  user_id: string
  exception_type: string
  start_date: string
  end_date?: string | null
  reason?: string
  is_active: boolean
}

export function WorkerSchedules() {
  const [schedules, setSchedules] = useState<WorkerSchedule[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [exceptions, setExceptions] = useState<WorkerException[]>([]) // Track active exceptions
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<WorkerSchedule | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<'workers' | 'schedules'>('workers')
  const today = new Date().toISOString().split('T')[0]
  
  const [useRange, setUseRange] = useState(false) // Toggle between single date and date range
  const [selectedDays, setSelectedDays] = useState<number[]>([]) // Selected days of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set()) // Track which workers are expanded
  
  const [formData, setFormData] = useState({
    worker_ids: [] as string[],
    scheduled_date: today,
    start_date: today,
    end_date: '',
    days_of_week: [] as number[],
    start_time: '08:00',
    end_time: '17:00',
    check_in_window_start: '',
    check_in_window_end: '',
    requires_daily_checkin: false,
    daily_checkin_start_time: '',
    daily_checkin_end_time: '',
    project_id: '',
    notes: '',
    is_active: true,
  })

  const DAYS_OF_WEEK = [
    { value: 0, label: 'Sunday', short: 'Sun' },
    { value: 1, label: 'Monday', short: 'Mon' },
    { value: 2, label: 'Tuesday', short: 'Tue' },
    { value: 3, label: 'Wednesday', short: 'Wed' },
    { value: 4, label: 'Thursday', short: 'Thu' },
    { value: 5, label: 'Friday', short: 'Fri' },
    { value: 6, label: 'Saturday', short: 'Sat' },
  ]
  
  const [selectedWorkersForBulk, setSelectedWorkersForBulk] = useState<Set<string>>(new Set())
  
  // Search and pagination for workers
  const [workerSearchQuery, setWorkerSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(workerSearchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [workerSearchQuery])

  useEffect(() => {
    loadWorkers()
    loadSchedules()
    loadExceptions()
  }, [])

  const loadExceptions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/exceptions`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch exceptions')
      const data = await response.json()
      // Only store active exceptions
      setExceptions((data.exceptions || []).filter((exc: WorkerException) => exc.is_active))
    } catch (error) {
      console.error('Error loading exceptions:', error)
      // Don't fail if exceptions fail to load
    }
  }

  // Helper function to check if worker has active exception
  const hasActiveException = (workerId: string, scheduleDate?: string | null): boolean => {
    const activeException = exceptions.find(exc => exc.user_id === workerId && exc.is_active)
    if (!activeException) return false

    // Check if exception date range overlaps with schedule date or today
    const checkDate = scheduleDate ? new Date(scheduleDate) : new Date()
    checkDate.setHours(0, 0, 0, 0)
    
    const exceptionStart = new Date(activeException.start_date)
    exceptionStart.setHours(0, 0, 0, 0)
    const exceptionEnd = activeException.end_date ? new Date(activeException.end_date) : null
    if (exceptionEnd) {
      exceptionEnd.setHours(23, 59, 59, 999)
    }

    return checkDate >= exceptionStart && (!exceptionEnd || checkDate <= exceptionEnd)
  }

  // Helper function to get exception type label
  const getExceptionTypeLabel = (exceptionType: string): string => {
    const labels: Record<string, string> = {
      transfer: 'Transfer',
      accident: 'Accident',
      injury: 'Injury',
      medical_leave: 'Medical Leave',
      other: 'Other',
    }
    return labels[exceptionType] || exceptionType
  }

  // Helper function to get active exception for worker
  const getActiveException = (workerId: string): WorkerException | undefined => {
    return exceptions.find(exc => exc.user_id === workerId && exc.is_active)
  }

  const loadWorkers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch team')
      const data = await response.json()
      
      // Get workers from team members
      const workersList = (data.members || [])
        .filter((member: any) => member.users?.role === 'worker')
        .map((member: any) => ({
          id: member.users.id,
          email: member.users.email,
          first_name: member.users.first_name,
          last_name: member.users.last_name,
          full_name: member.users.full_name || 
                    (member.users.first_name && member.users.last_name 
                      ? `${member.users.first_name} ${member.users.last_name}`
                      : member.users.email),
        }))
      
      setWorkers(workersList)
    } catch (error) {
      console.error('Error loading workers:', error)
      setError('Failed to load workers')
    }
  }

  const loadSchedules = async () => {
    try {
      setLoading(true)
      const url = `${API_BASE_URL}/api/schedules/workers`
      
      const response = await fetch(url, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to fetch schedules')
      const data = await response.json()
      setSchedules(data.schedules || [])
      setError('')
    } catch (error) {
      console.error('Error loading schedules:', error)
      setError('Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSchedule = () => {
    setEditingSchedule(null)
    setUseRange(false) // Default to single date mode
    setSelectedDays([])
    
    // Calculate end_date as 30 days from today by default
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 30)
    
    // If workers are already selected, use them; otherwise open modal with no selection
    setFormData({
      worker_ids: selectedWorkersForBulk.size > 0 ? Array.from(selectedWorkersForBulk) : [],
      scheduled_date: today,
      start_date: today,
      end_date: endDate.toISOString().split('T')[0],
      days_of_week: [],
      start_time: '08:00',
      end_time: '17:00',
      check_in_window_start: '',
      check_in_window_end: '',
      requires_daily_checkin: false,
      daily_checkin_start_time: '',
      daily_checkin_end_time: '',
      project_id: '',
      notes: '',
      is_active: true,
    })
    setShowModal(true)
  }
  
  // Filter workers based on search
  const filteredWorkers = workers.filter(worker => {
    if (!debouncedSearchQuery) return true
    const query = debouncedSearchQuery.toLowerCase()
    return (
      worker.full_name?.toLowerCase().includes(query) ||
      worker.email.toLowerCase().includes(query) ||
      worker.first_name?.toLowerCase().includes(query) ||
      worker.last_name?.toLowerCase().includes(query)
    )
  })

  const handleEditSchedule = (schedule: WorkerSchedule) => {
    // Prevent editing if worker has active exception
    if (hasActiveException(schedule.worker_id, schedule.scheduled_date)) {
      const activeException = getActiveException(schedule.worker_id)
      const exceptionTypeLabel = activeException ? getExceptionTypeLabel(activeException.exception_type) : 'exemption'
      alert(`Cannot edit schedule: Worker has an active ${exceptionTypeLabel} exemption. Please remove or close the exemption first.`)
      return
    }

    setEditingSchedule(schedule)
    
    // Check if this is a recurring schedule (has day_of_week) or single-date schedule
    const isRecurring = schedule.day_of_week !== null && schedule.day_of_week !== undefined
    
    setUseRange(isRecurring) // Set to true if recurring, false if single-date
    setSelectedDays(isRecurring ? [schedule.day_of_week!] : [])
    
    setFormData({
      worker_ids: [schedule.worker_id], // Single worker for editing
      scheduled_date: schedule.scheduled_date || today,
      start_date: schedule.effective_date || schedule.scheduled_date || today,
      end_date: schedule.expiry_date || '',
      days_of_week: isRecurring ? [schedule.day_of_week!] : [],
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      check_in_window_start: schedule.check_in_window_start || '',
      check_in_window_end: schedule.check_in_window_end || '',
      requires_daily_checkin: schedule.requires_daily_checkin || false,
      daily_checkin_start_time: schedule.daily_checkin_start_time || '',
      daily_checkin_end_time: schedule.daily_checkin_end_time || '',
      project_id: schedule.project_id || '',
      notes: schedule.notes || '',
      is_active: schedule.is_active,
    })
    setShowModal(true)
  }

  const handleToggleScheduleStatus = async (schedule: WorkerSchedule) => {
    const newStatus = !schedule.is_active
    const action = newStatus ? 'activate' : 'deactivate'
    
    // Check if worker has active exception when trying to activate
    if (newStatus && hasActiveException(schedule.worker_id, schedule.scheduled_date)) {
      const activeException = getActiveException(schedule.worker_id)
      const exceptionTypeLabel = activeException ? getExceptionTypeLabel(activeException.exception_type) : 'exemption'
      alert(`Cannot activate schedule: Worker has an active ${exceptionTypeLabel} exemption. Please remove or close the exemption first before activating schedules.`)
      return
    }
    
    if (!confirm(`Are you sure you want to ${action} this schedule?`)) return

    try {
      const response = await fetch(`${API_BASE_URL}/api/schedules/workers/${schedule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_active: newStatus,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${action} schedule`)
      }

      alert(`Schedule ${action}d successfully`)
      loadSchedules()
      loadExceptions() // Reload exceptions after schedule change
    } catch (error: any) {
      console.error(`Error ${action}ing schedule:`, error)
      alert(error.message || `Failed to ${action} schedule`)
    }
  }

  const toggleDaySelection = (dayValue: number) => {
    setSelectedDays(prev => {
      if (prev.includes(dayValue)) {
        return prev.filter(d => d !== dayValue)
      } else {
        return [...prev, dayValue].sort()
      }
    })
  }

  // Helper function to normalize time format (HH:MM or HH:MM:SS -> HH:MM)
  const normalizeTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return ''
    // Remove seconds if present (HH:MM:SS -> HH:MM)
    return timeStr.split(':').slice(0, 2).join(':')
    }

  // Helper function to add one hour to a time string (HH:MM format)
  const addOneHour = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    const newHours = (hours + 1) % 24
    return `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (editingSchedule) {
      // Single worker edit - ALL schedules can be edited individually (even bulk-created)
      if (!formData.start_time || !formData.end_time) {
        setError('Please fill in all required fields')
        return
      }

      // Validate schedule type
      const isRecurringSchedule = editingSchedule?.day_of_week !== null && editingSchedule?.day_of_week !== undefined
      const isRecurringMode = useRange && selectedDays.length > 0
      
      if (isRecurringSchedule || isRecurringMode) {
        // Recurring schedule: need start_date and at least one day selected
        if (!formData.start_date) {
          setError('Start date is required for recurring schedules')
          return
        }
        if (selectedDays.length === 0 && !isRecurringSchedule) {
          // Allow empty if keeping existing recurring schedule day
          setError('Please select at least one day of the week for recurring schedule')
          return
        }
      } else {
        // Single-date schedule: need scheduled_date
        if (!formData.scheduled_date) {
          setError('Scheduled date is required')
          return
        }
      }

      if (formData.requires_daily_checkin && (!formData.daily_checkin_start_time || !formData.daily_checkin_end_time)) {
        setError('Daily check-in start and end times are required when daily check-in is enabled')
        return
      }
      
      // Validate that daily check-in end time is after start time
      if (formData.requires_daily_checkin && formData.daily_checkin_start_time && formData.daily_checkin_end_time) {
        const [startH, startM] = formData.daily_checkin_start_time.split(':').map(Number)
        const [endH, endM] = formData.daily_checkin_end_time.split(':').map(Number)
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM
        
        if (endMinutes <= startMinutes) {
          setError('Daily check-in end time must be after start time. Please use 24-hour format (e.g., 08:00, 09:00, not 08:00 am)')
          return
        }
      }

      try {
        const url = `${API_BASE_URL}/api/schedules/workers/${editingSchedule.id}`
        
        const updateData: any = {
          start_time: normalizeTime(formData.start_time),
          end_time: normalizeTime(formData.end_time),
          check_in_window_start: normalizeTime(formData.check_in_window_start) || null,
          check_in_window_end: normalizeTime(formData.check_in_window_end) || null,
          requires_daily_checkin: formData.requires_daily_checkin,
          daily_checkin_start_time: normalizeTime(formData.daily_checkin_start_time) || null,
          daily_checkin_end_time: normalizeTime(formData.daily_checkin_end_time) || null,
          project_id: formData.project_id || null,
          notes: formData.notes || null,
          is_active: formData.is_active,
        }
        
        // Handle schedule type: single-date vs recurring
        // Check if editing a recurring schedule (has day_of_week) OR user selected recurring mode
        const isRecurringEdit = editingSchedule?.day_of_week !== null && editingSchedule?.day_of_week !== undefined
        const isRecurringMode = useRange && selectedDays.length > 0
        
        // Always ensure day_of_week is sent when editing recurring schedule
        if (isRecurringEdit || isRecurringMode) {
          // Editing as recurring schedule - allow changing day_of_week
          // If user selected new days, use those; otherwise keep existing
          const newDayOfWeek = selectedDays.length > 0 ? selectedDays[0] : editingSchedule?.day_of_week
          
          if (newDayOfWeek !== null && newDayOfWeek !== undefined) {
            updateData.day_of_week = newDayOfWeek
          }
          updateData.scheduled_date = null
          updateData.effective_date = formData.start_date || null
          updateData.expiry_date = formData.end_date || null
        } else if (editingSchedule && editingSchedule.scheduled_date) {
          // Editing as single-date schedule
          updateData.scheduled_date = formData.scheduled_date
          updateData.day_of_week = null
          updateData.effective_date = null
          updateData.expiry_date = null
        }

        console.log('Updating schedule with:', updateData)
        console.log('Selected days:', selectedDays)
        console.log('Is recurring edit:', isRecurringEdit, 'Is recurring mode:', isRecurringMode)

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(updateData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update schedule')
        }

        const result = await response.json()
        console.log('Update response:', result)

        alert('Schedule updated successfully')
        setShowModal(false)
        // Force reload to get updated data
        setSchedules([])
        loadSchedules()
        loadExceptions() // Reload exceptions after schedule update
      } catch (error: any) {
        console.error('Error updating schedule:', error)
        setError(error.message || 'Failed to update schedule')
      }
    } else {
      // Bulk create for multiple workers
      if (!formData.worker_ids.length || !formData.start_time || !formData.end_time) {
        setError('Please select at least one worker and fill in all required fields')
        return
      }

      // Validate date selection
      if (!useRange && !formData.scheduled_date) {
        setError('Please select a date')
        return
      }

      if (useRange && (!formData.start_date || !formData.end_date || selectedDays.length === 0)) {
        setError('Please select start date, end date, and at least one day of the week')
        return
      }

      if (formData.requires_daily_checkin && (!formData.daily_checkin_start_time || !formData.daily_checkin_end_time)) {
        setError('Daily check-in start and end times are required when daily check-in is enabled')
        return
      }

      // Validate that daily check-in end time is after start time
      if (formData.requires_daily_checkin && formData.daily_checkin_start_time && formData.daily_checkin_end_time) {
        if (formData.daily_checkin_end_time <= formData.daily_checkin_start_time) {
          setError('Daily check-in end time must be after start time. Please use 24-hour format (e.g., 08:00, 09:00, not 08:00 am)')
          return
        }
      }

      setCreating(true)
      setError('')

      try {
        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        // Create schedule for each selected worker
        for (const workerId of formData.worker_ids) {
          try {
            const scheduleData: any = {
              worker_id: workerId,
              start_time: normalizeTime(formData.start_time),
              end_time: normalizeTime(formData.end_time),
              check_in_window_start: normalizeTime(formData.check_in_window_start) || null,
              check_in_window_end: normalizeTime(formData.check_in_window_end) || null,
              requires_daily_checkin: formData.requires_daily_checkin,
              daily_checkin_start_time: normalizeTime(formData.daily_checkin_start_time) || null,
              daily_checkin_end_time: normalizeTime(formData.daily_checkin_end_time) || null,
              project_id: formData.project_id || null,
              notes: formData.notes || null,
              is_active: formData.is_active,
            }

            // Add date selection based on mode
            if (useRange) {
              scheduleData.start_date = formData.start_date
              scheduleData.end_date = formData.end_date
              scheduleData.days_of_week = selectedDays
            } else {
              scheduleData.scheduled_date = formData.scheduled_date
            }

            const response = await fetch(`${API_BASE_URL}/api/schedules/workers`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify(scheduleData),
            })

            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || 'Failed to create schedule')
            }

            const result = await response.json()
            // If bulk creation, count the number of schedules created
            const createdCount = result.count || 1
            successCount += createdCount
          } catch (error: any) {
            errorCount++
            const workerName = workers.find(w => w.id === workerId)?.full_name || workerId
            errors.push(`${workerName}: ${error.message}`)
            console.error(`Error creating schedule for worker ${workerId}:`, error)
          }
        }

        if (errorCount === 0) {
          alert(`Successfully created ${successCount} schedule(s)`)
        } else if (successCount > 0) {
          alert(`Created ${successCount} schedule(s), but ${errorCount} worker(s) failed:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? '\n...' : ''}`)
        } else {
          throw new Error(`Failed to create schedules:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`)
        }

        setShowModal(false)
        setSelectedWorkersForBulk(new Set()) // Clear selection after creation
        setActiveTab('schedules') // Switch to schedules tab to show newly created schedules
        loadSchedules()
        loadExceptions() // Reload exceptions after schedule creation
      } catch (error: any) {
        console.error('Error creating schedules:', error)
        setError(error.message || 'Failed to create schedules')
      } finally {
        setCreating(false)
      }
    }
  }

  const getWorkerName = (schedule: WorkerSchedule) => {
    if (schedule.users) {
      return schedule.users.full_name || 
             (schedule.users.first_name && schedule.users.last_name 
               ? `${schedule.users.first_name} ${schedule.users.last_name}`
               : schedule.users.email)
    }
    return 'Unknown Worker'
  }

  return (
    <DashboardLayout>
      <div className="worker-schedules-container">
        <div className="worker-schedules-header">
          <div className="header-content">
            <div>
              <h1>Worker Schedules</h1>
              <p className="subtitle">Manage individual schedules for workers in your team</p>
            </div>
          </div>
        </div>

        {error && !showModal && <div className="error-message">{error}</div>}

        {/* Tabs Navigation */}
        <div className="tabs-container">
          <div className="tabs-header">
            <button
              className={`tab-button ${activeTab === 'workers' ? 'active' : ''}`}
              onClick={() => setActiveTab('workers')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Select Workers
              {selectedWorkersForBulk.size > 0 && (
                <span className="tab-badge">{selectedWorkersForBulk.size}</span>
              )}
            </button>
            <button
              className={`tab-button ${activeTab === 'schedules' ? 'active' : ''}`}
              onClick={() => setActiveTab('schedules')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Worker Schedules
              {schedules.length > 0 && (
                <span className="tab-badge">{schedules.length}</span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="tabs-content">
            {activeTab === 'workers' && (
              <div className="tab-panel">
                {/* Worker Selection Table */}
                <div className="worker-selection-section">
                  <div className="section-header">
                    <h2>Select Workers</h2>
                    <div className="header-actions">
                      <input
                        type="text"
                        placeholder="Enter Employee Name"
                        value={workerSearchQuery}
                        onChange={(e) => setWorkerSearchQuery(e.target.value)}
                        className="worker-search-input-table"
                      />
                      {selectedWorkersForBulk.size > 0 && (
                        <>
                          <button
                            onClick={() => setSelectedWorkersForBulk(new Set())}
                            className="btn-text-small"
                          >
                            Clear Selection ({selectedWorkersForBulk.size})
                          </button>
                          <button
                            onClick={handleAddSchedule}
                            className="btn-primary"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19"></line>
                              <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            Create Schedule ({selectedWorkersForBulk.size})
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Workers Table */}
                  <div className="workers-table-container">
                    <table className="workers-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>
                            <input
                              type="checkbox"
                              checked={filteredWorkers.length > 0 && filteredWorkers.every(w => selectedWorkersForBulk.has(w.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const newSelection = new Set(selectedWorkersForBulk)
                                  filteredWorkers.forEach(w => newSelection.add(w.id))
                                  setSelectedWorkersForBulk(newSelection)
                                } else {
                                  const newSelection = new Set(selectedWorkersForBulk)
                                  filteredWorkers.forEach(w => newSelection.delete(w.id))
                                  setSelectedWorkersForBulk(newSelection)
                                }
                              }}
                            />
                          </th>
                          <th>Name</th>
                          <th>Email address</th>
                          <th>Phone Number</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWorkers.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="no-data">
                              {workerSearchQuery ? `No workers found matching "${debouncedSearchQuery}"` : 'No workers available'}
                            </td>
                          </tr>
                        ) : (
                          filteredWorkers.map((worker) => (
                            <tr 
                              key={worker.id} 
                              className={selectedWorkersForBulk.has(worker.id) ? 'selected' : ''}
                            >
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedWorkersForBulk.has(worker.id)}
                                  onChange={() => {
                                    const newSelection = new Set(selectedWorkersForBulk)
                                    if (selectedWorkersForBulk.has(worker.id)) {
                                      newSelection.delete(worker.id)
                                    } else {
                                      newSelection.add(worker.id)
                                    }
                                    setSelectedWorkersForBulk(newSelection)
                                  }}
                                />
                              </td>
                              <td className="worker-name-cell">
                                <div className="worker-info-cell">
                                  <div className="worker-avatar-small">
                                    {(worker.full_name || worker.email).charAt(0).toUpperCase()}
                                  </div>
                                  <span>{worker.full_name || worker.email}</span>
                                </div>
                              </td>
                              <td>{worker.email}</td>
                              <td>-</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schedules' && (
              <div className="tab-panel">
                {loading ? (
                  <Loading message="Loading schedules..." size="medium" />
                ) : schedules.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                    </div>
                    <p>No schedules found.</p>
                    <button onClick={() => setActiveTab('workers')} className="btn-primary">
                      Go to Select Workers
                    </button>
                  </div>
                ) : (
                  <div className="schedules-table-container">
                    <div className="schedules-header">
                      <h2>Worker Schedules</h2>
                      <button onClick={handleAddSchedule} className="btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Create Schedule
                      </button>
                    </div>
                    <table className="schedules-table">
                      <thead>
                        <tr>
                          <th>Worker</th>
                          <th>Schedule</th>
                          <th>Time</th>
                          <th>Check-In Window</th>
                          <th>Daily Check-In</th>
                          <th>Status</th>
                          <th>Notes</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Group schedules by worker */}
                        {(() => {
                          // Group schedules by worker_id
                          const schedulesByWorker = new Map<string, WorkerSchedule[]>()
                          schedules.forEach((schedule) => {
                            const workerId = schedule.worker_id
                            if (!schedulesByWorker.has(workerId)) {
                              schedulesByWorker.set(workerId, [])
                            }
                            schedulesByWorker.get(workerId)!.push(schedule)
                          })

                          const toggleWorker = (workerId: string) => {
                            setExpandedWorkers(prev => {
                              const newSet = new Set(prev)
                              if (newSet.has(workerId)) {
                                newSet.delete(workerId)
                              } else {
                                newSet.add(workerId)
                              }
                              return newSet
                            })
                          }

                          return Array.from(schedulesByWorker.entries()).map(([workerId, workerSchedules]) => {
                            const workerName = getWorkerName(workerSchedules[0])
                            const isExpanded = expandedWorkers.has(workerId)
                            const scheduleCount = workerSchedules.length

                            return (
                              <Fragment key={workerId}>
                                {/* Worker header row */}
                                <tr 
                                  className="worker-group-row"
                                  onClick={() => toggleWorker(workerId)}
                                  style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#f9fafb' : 'white' }}
                                >
                                  <td colSpan={7} style={{ padding: '1rem 1.25rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                      <button 
                                        className="expand-toggle"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          toggleWorker(workerId)
                                        }}
                                        style={{ 
                                          background: 'none', 
                                          border: 'none', 
                                          cursor: 'pointer',
                                          padding: '0.25rem',
                                          display: 'flex',
                                          alignItems: 'center'
                                        }}
                                      >
                                        <svg 
                                          width="16" 
                                          height="16" 
                                          viewBox="0 0 24 24" 
                                          fill="none" 
                                          stroke="currentColor" 
                                          strokeWidth="2"
                                          style={{ 
                                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', 
                                            transition: 'transform 0.2s',
                                            color: '#6b7280'
                                          }}
                                        >
                                          <polyline points="9 18 15 12 9 6"></polyline>
                                        </svg>
                                      </button>
                                      <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827' }}>
                                        {workerName}
                                      </span>
                                      <span style={{
                                        padding: '0.25rem 0.75rem',
                                        backgroundColor: '#eff6ff',
                                        color: '#1e40af',
                                        borderRadius: '9999px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600
                                      }}>
                                        {scheduleCount} schedule{scheduleCount !== 1 ? 's' : ''}
                                      </span>
                              </div>
                            </td>
                                </tr>
                                
                                {/* Expanded schedules rows */}
                                {isExpanded && workerSchedules.map((schedule) => (
                                  <tr key={schedule.id} style={{ backgroundColor: '#fafafa' }}>
                                    <td style={{ paddingLeft: '3rem', verticalAlign: 'middle' }}>
                                      {schedule.scheduled_date ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <span style={{ fontWeight: 600, color: '#111827' }}>
                                            {new Date(schedule.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </span>
                                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Single date</span>
                                        </div>
                                      ) : schedule.day_of_week !== null && schedule.day_of_week !== undefined ? (
                                        <div className="recurring-schedule-info">
                                          <div className="recurring-day">{DAYS_OF_WEEK.find(d => d.value === schedule.day_of_week)?.label || `Day ${schedule.day_of_week}`}</div>
                                          {schedule.effective_date && schedule.expiry_date && (
                                            <div className="recurring-dates">
                                              <small>
                                                {new Date(schedule.effective_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(schedule.expiry_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                              </small>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="auto-text">—</span>
                                      )}
                                    </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div className="time-range">
                                <span className="time-start">{schedule.start_time}</span>
                                <span className="time-separator">→</span>
                                <span className="time-end">{schedule.end_time}</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Shift hours</div>
                            </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {schedule.check_in_window_start && schedule.check_in_window_end ? (
                                  <>
                                    <span style={{ fontWeight: 500, color: '#111827' }}>
                                      {schedule.check_in_window_start} - {schedule.check_in_window_end}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Custom window</span>
                                  </>
                                ) : (
                                  <span className="auto-text">Auto-calculated</span>
                                )}
                              </div>
                            </td>
                                    <td style={{ verticalAlign: 'middle' }}>
                                      {schedule.requires_daily_checkin ? (
                                        <div className="daily-checkin-info">
                                          <span className="checkin-badge required">Required</span>
                                          {schedule.daily_checkin_start_time && schedule.daily_checkin_end_time && (
                                            <div className="checkin-time">
                                              {schedule.daily_checkin_start_time} - {schedule.daily_checkin_end_time}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <span className="auto-text">Not required</span>
                                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>—</span>
                                        </div>
                                      )}
                                    </td>
                            <td style={{ verticalAlign: 'middle' }}>
                              {(() => {
                                const hasException = hasActiveException(schedule.worker_id, schedule.scheduled_date)
                                const activeException = hasException ? getActiveException(schedule.worker_id) : null
                                
                                if (hasException && activeException) {
                                  const exceptionTypeLabel = getExceptionTypeLabel(activeException.exception_type)
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', alignItems: 'flex-start' }}>
                                      <span className={`status-badge ${schedule.is_active ? 'active' : 'inactive'}`}>
                                        {schedule.is_active ? 'ACTIVE' : 'INACTIVE'}
                                      </span>
                                      <span className="exemption-badge" title={`Worker has active ${exceptionTypeLabel} exemption`}>
                                        ⚠️ {exceptionTypeLabel.toUpperCase()}
                                      </span>
                                    </div>
                                  )
                                }
                                
                                return (
                                  <span className={`status-badge ${schedule.is_active ? 'active' : 'inactive'}`}>
                                    {schedule.is_active ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                )
                              })()}
                            </td>
                            <td className="notes-cell" style={{ verticalAlign: 'middle' }}>{schedule.notes || <span className="no-notes">—</span>}</td>
                            <td style={{ verticalAlign: 'middle' }}>
                              <div className="action-buttons">
                                {(() => {
                                  const hasException = hasActiveException(schedule.worker_id, schedule.scheduled_date)
                                  const activeException = hasException ? getActiveException(schedule.worker_id) : null
                                  const exceptionTypeLabel = activeException ? getExceptionTypeLabel(activeException.exception_type) : ''
                                  
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (!hasException) {
                                          handleEditSchedule(schedule)
                                        }
                                      }}
                                      className={`btn-action btn-edit ${hasException ? 'btn-disabled' : ''}`}
                                      title={hasException 
                                        ? `Cannot edit: Worker has an active ${exceptionTypeLabel} exemption` 
                                        : 'Edit Schedule'}
                                      disabled={hasException}
                                      style={hasException ? { 
                                        opacity: 0.5, 
                                        cursor: 'not-allowed',
                                        backgroundColor: '#f3f4f6',
                                        borderColor: '#d1d5db'
                                      } : {}}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                      </svg>
                                    </button>
                                  )
                                })()}
                                {(() => {
                                  const hasException = !schedule.is_active && hasActiveException(schedule.worker_id, schedule.scheduled_date)
                                  const activeException = hasException ? getActiveException(schedule.worker_id) : null
                                  const exceptionTypeLabel = activeException ? getExceptionTypeLabel(activeException.exception_type) : ''
                                  
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        if (!hasException) {
                                          handleToggleScheduleStatus(schedule)
                                        }
                                      }}
                                      className={`btn-action ${schedule.is_active ? 'btn-deactivate' : 'btn-activate'} ${hasException ? 'btn-disabled' : ''}`}
                                      title={hasException 
                                        ? `Cannot activate: Worker has an active ${exceptionTypeLabel} exemption` 
                                        : schedule.is_active 
                                          ? 'Deactivate Schedule' 
                                          : 'Activate Schedule'}
                                      disabled={hasException}
                                      style={hasException ? { 
                                        opacity: 0.5, 
                                        cursor: 'not-allowed',
                                        backgroundColor: '#f3f4f6',
                                        borderColor: '#d1d5db'
                                      } : {}}
                                    >
                                      {schedule.is_active ? (
                                        // Deactivate icon (eye with slash)
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                          <line x1="1" y1="1" x2="23" y2="23"></line>
                                        </svg>
                                      ) : (
                                        // Activate icon (eye)
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                          <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                      )}
                                    </button>
                                  )
                                })()}
                              </div>
                            </td>
                          </tr>
                        ))}
                              </Fragment>
                            )
                          })
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal - Cleaner Design */}
        {showModal && (
          <div className="modal-overlay" onClick={() => {
            if (!creating) {
              setShowModal(false)
              if (!editingSchedule) {
                setSelectedWorkersForBulk(new Set())
              }
            }
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <h2>{editingSchedule ? 'Edit Schedule' : 'Create Schedule'}</h2>
                  {!editingSchedule && formData.worker_ids.length > 1 && (
                    <p className="modal-subtitle">Creating schedule for {formData.worker_ids.length} workers</p>
                  )}
                </div>
                <button 
                  className="modal-close" 
                  onClick={() => {
                    if (!creating) {
                      setShowModal(false)
                      if (!editingSchedule) {
                        setSelectedWorkersForBulk(new Set())
                      }
                    }
                  }}
                  disabled={creating}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="schedule-form">
                {editingSchedule ? (
                  // Single worker for editing
                  <div className="form-group">
                    <label>Worker</label>
                    <input
                      type="text"
                      value={getWorkerName({ users: workers.find(w => w.id === editingSchedule.worker_id) } as any)}
                      disabled
                      className="form-input disabled"
                    />
                  </div>
                ) : (
                  // Multiple workers for bulk create
                  <div className="form-group">
                    <label>Selected Workers ({formData.worker_ids.length})</label>
                    <div className="selected-workers-list">
                      {formData.worker_ids.length === 0 ? (
                        <p className="no-selection">No workers selected</p>
                      ) : (
                        <div className="selected-workers-tags">
                          {formData.worker_ids.map((workerId) => {
                            const worker = workers.find(w => w.id === workerId)
                            return (
                              <span key={workerId} className="worker-tag">
                                {worker?.full_name || worker?.email || workerId}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Date Selection Mode Toggle (only for new schedules) */}
                {!editingSchedule && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={useRange}
                        onChange={(e) => {
                          setUseRange(e.target.checked)
                          if (e.target.checked) {
                            setSelectedDays([1, 2, 3, 4, 5]) // Default to Mon-Fri
                          } else {
                            setSelectedDays([])
                          }
                        }}
                      />
                      <span>Create recurring schedule (select days of week)</span>
                    </label>
                  </div>
                )}

                {/* Show schedule type indicator when editing */}
                {editingSchedule && (
                  <div className="form-group">
                    <div className="schedule-type-indicator">
                      {editingSchedule.day_of_week !== null && editingSchedule.day_of_week !== undefined ? (
                        <span className="schedule-badge recurring">
                          📅 Recurring: {DAYS_OF_WEEK.find(d => d.value === editingSchedule.day_of_week)?.label} 
                          {editingSchedule.effective_date && editingSchedule.expiry_date && (
                            <span> ({new Date(editingSchedule.effective_date).toLocaleDateString()} - {new Date(editingSchedule.expiry_date).toLocaleDateString()})</span>
                          )}
                        </span>
                      ) : (
                        <span className="schedule-badge single">📆 Single Date: {editingSchedule.scheduled_date && new Date(editingSchedule.scheduled_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                )}

                {(!editingSchedule && !useRange) || (editingSchedule && !useRange) ? (
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>
                ) : (useRange || (editingSchedule && editingSchedule.day_of_week !== null && editingSchedule.day_of_week !== undefined)) ? (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Start Date *</label>
                        <input
                          type="date"
                          value={formData.start_date}
                          onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                          required
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>End Date {editingSchedule ? '' : '*'}</label>
                        <input
                          type="date"
                          value={formData.end_date}
                          onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                          required={!editingSchedule}
                          className="form-input"
                        />
                        {editingSchedule && (
                          <small className="field-help">Leave empty for ongoing schedule</small>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Days of Week *</label>
                      <div className="days-selector">
                        {DAYS_OF_WEEK.map((day) => {
                          const isSelected = selectedDays.includes(day.value)
                          return (
                            <button
                              key={day.value}
                              type="button"
                              className={`day-button ${isSelected ? 'selected' : ''}`}
                              onClick={() => toggleDaySelection(day.value)}
                            >
                              {day.short}
                            </button>
                          )
                        })}
                      </div>
                      <small className="field-help">
                        {selectedDays.length === 0 
                          ? 'Select at least one day' 
                          : `Selected: ${selectedDays.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(', ')}`}
                      </small>
                    </div>
                  </>
                ) : null}

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>End Time *</label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Daily Check-In Requirement Section */}
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.requires_daily_checkin}
                      onChange={(e) => {
                        const isEnabled = e.target.checked
                        setFormData({ 
                          ...formData, 
                          requires_daily_checkin: isEnabled,
                          daily_checkin_start_time: isEnabled ? (formData.daily_checkin_start_time || '08:00') : '',
                          daily_checkin_end_time: isEnabled ? (formData.daily_checkin_end_time || '09:00') : '',
                          // Clear check-in window when daily check-in is enabled (to avoid confusion)
                          check_in_window_start: isEnabled ? '' : formData.check_in_window_start,
                          check_in_window_end: isEnabled ? '' : formData.check_in_window_end,
                        })
                      }}
                    />
                    <span>Require Daily Check-In</span>
                  </label>
                  <small className="field-help">
                    If enabled, workers must complete daily check-in within the specified time range
                  </small>
                </div>

                {formData.requires_daily_checkin ? (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Daily Check-In Start Time *</label>
                      <input
                        type="time"
                        value={formData.daily_checkin_start_time}
                        onChange={(e) => {
                          const newStart = e.target.value
                          setFormData({ 
                            ...formData, 
                            daily_checkin_start_time: newStart,
                            // Auto-adjust end time if it's before or equal to start time
                            daily_checkin_end_time: formData.daily_checkin_end_time && formData.daily_checkin_end_time <= newStart
                              ? addOneHour(newStart)
                              : formData.daily_checkin_end_time
                          })
                        }}
                        required={formData.requires_daily_checkin}
                        className="form-input"
                      />
                      <small className="field-help">When daily check-in window opens (24-hour format, e.g., 08:00)</small>
                    </div>

                    <div className="form-group">
                      <label>Daily Check-In End Time *</label>
                      <input
                        type="time"
                        value={formData.daily_checkin_end_time}
                        onChange={(e) => {
                          const newEnd = e.target.value
                          setFormData({ 
                            ...formData, 
                            daily_checkin_end_time: newEnd
                          })
                        }}
                        required={formData.requires_daily_checkin}
                        className="form-input"
                      />
                      <small className="field-help">When daily check-in window closes (must be after start time)</small>
                    </div>
                  </div>
                ) : (
                <div className="form-row">
                  <div className="form-group">
                    <label>Check-In Window Start <span className="optional">(Optional)</span></label>
                    <input
                      type="time"
                      value={formData.check_in_window_start}
                      onChange={(e) => setFormData({ ...formData, check_in_window_start: e.target.value })}
                      className="form-input"
                    />
                      <small className="field-help">Custom check-in window start (leave empty to auto-calculate based on shift)</small>
                  </div>

                  <div className="form-group">
                    <label>Check-In Window End <span className="optional">(Optional)</span></label>
                    <input
                      type="time"
                      value={formData.check_in_window_end}
                      onChange={(e) => setFormData({ ...formData, check_in_window_end: e.target.value })}
                      className="form-input"
                    />
                      <small className="field-help">Custom check-in window end (leave empty to auto-calculate based on shift)</small>
                  </div>
                </div>
                )}

                <div className="form-group">
                  <label>Notes <span className="optional">(Optional)</span></label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="form-input"
                    rows={3}
                    placeholder="Add notes about this schedule..."
                  />
                </div>

                {editingSchedule && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                      <span>Active Schedule</span>
                    </label>
                  </div>
                )}

                {error && <div className="form-error">{error}</div>}

                <div className="form-actions">
                  <button 
                    type="button" 
                    onClick={() => {
                      if (!creating) {
                        setShowModal(false)
                        if (!editingSchedule) {
                          setSelectedWorkersForBulk(new Set())
                        }
                      }
                    }} 
                    className="btn-secondary"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={creating || (!editingSchedule && formData.worker_ids.length === 0)}
                  >
                    {creating ? (
                      <>
                        <span className="spinner"></span>
                        Creating...
                      </>
                    ) : editingSchedule ? (
                      'Update Schedule'
                    ) : (
                      `Create ${formData.worker_ids.length} Schedule${formData.worker_ids.length !== 1 ? 's' : ''}`
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
