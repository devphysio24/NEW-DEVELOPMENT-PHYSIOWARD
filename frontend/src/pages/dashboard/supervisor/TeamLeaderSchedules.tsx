import { useState, useEffect } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './TeamLeaderSchedules.css'

interface WorkSchedule {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  effective_date?: string
  expiry_date?: string
  notes?: string
}

interface TeamLeader {
  id: string
  team_id: string
  team_name: string
  email: string
  name: string
  schedules: WorkSchedule[]
}

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]

export function TeamLeaderSchedules() {
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeamLeader, setSelectedTeamLeader] = useState<TeamLeader | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null)
  const [useRange, setUseRange] = useState(false) // Toggle between single day and range
  const [formData, setFormData] = useState({
    day_of_week: 1,
    start_day_of_week: 1, // Monday
    end_day_of_week: 5,   // Friday
    start_time: '08:00',
    end_time: '17:00',
    is_active: true,
    effective_date: '',
    expiry_date: '',
    notes: '',
  })

  useEffect(() => {
    loadTeamLeaders()
  }, [])

  const loadTeamLeaders = async () => {
    try {
      setLoading(true)
      // NOTE: Team Leader schedules feature is disabled - team leaders now manage individual worker schedules
      // This endpoint no longer exists in the backend
      // Show appropriate message to user
      setTeamLeaders([])
    } catch (error) {
      console.error('Error loading team leaders:', error)
      setTeamLeaders([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddSchedule = () => {
    if (!selectedTeamLeader) {
      alert('Please select a team leader first')
      return
    }
    setEditingSchedule(null)
    setUseRange(true) // Default to range mode for new schedules
    setFormData({
      day_of_week: 1,
      start_day_of_week: 1, // Monday
      end_day_of_week: 5,   // Friday
      start_time: '08:00',
      end_time: '17:00',
      is_active: true,
      effective_date: '',
      expiry_date: '',
      notes: '',
    })
    setShowModal(true)
  }

  const handleEditSchedule = (schedule: WorkSchedule) => {
    if (!selectedTeamLeader) return
    setEditingSchedule(schedule)
    setUseRange(false) // Editing single schedule, so use single day mode
    setFormData({
      day_of_week: schedule.day_of_week,
      start_day_of_week: schedule.day_of_week,
      end_day_of_week: schedule.day_of_week,
      start_time: schedule.start_time.substring(0, 5),
      end_time: schedule.end_time.substring(0, 5),
      is_active: schedule.is_active,
      effective_date: schedule.effective_date || '',
      expiry_date: schedule.expiry_date || '',
      notes: schedule.notes || '',
    })
    setShowModal(true)
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedules/${scheduleId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to delete schedule')
      
      // Reload team leaders and update selected one
      const refreshResponse = await fetch(`${API_BASE_URL}/api/schedules/team-leaders`, {
        credentials: 'include',
      })
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        const updatedLeaders = refreshData.teamLeaders || []
        setTeamLeaders(updatedLeaders)
        if (selectedTeamLeader) {
          const updated = updatedLeaders.find((tl: TeamLeader) => tl.id === selectedTeamLeader.id)
          if (updated) setSelectedTeamLeader(updated)
        }
      }
    } catch (error) {
      console.error('Error deleting schedule:', error)
      alert('Failed to delete schedule')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTeamLeader) return

    try {
      const url = editingSchedule
        ? `${API_BASE_URL}/api/schedules/${editingSchedule.id}`
        : `${API_BASE_URL}/api/schedules`
      
      const method = editingSchedule ? 'PUT' : 'POST'
      
      let payload: any
      
      if (editingSchedule) {
        // Editing single schedule
        payload = {
          day_of_week: formData.day_of_week,
          start_time: formData.start_time,
          end_time: formData.end_time,
          is_active: formData.is_active,
          effective_date: formData.effective_date || null,
          expiry_date: formData.expiry_date || null,
          notes: formData.notes || null,
        }
      } else {
        // Creating new schedule(s)
        if (useRange) {
          // Day range mode
          payload = {
            team_leader_id: selectedTeamLeader.id,
            start_day_of_week: formData.start_day_of_week,
            end_day_of_week: formData.end_day_of_week,
            start_time: formData.start_time,
            end_time: formData.end_time,
            is_active: formData.is_active,
            effective_date: formData.effective_date || null,
            expiry_date: formData.expiry_date || null,
            notes: formData.notes || null,
          }
        } else {
          // Single day mode
          payload = {
            team_leader_id: selectedTeamLeader.id,
            day_of_week: formData.day_of_week,
            start_time: formData.start_time,
            end_time: formData.end_time,
            is_active: formData.is_active,
            effective_date: formData.effective_date || null,
            expiry_date: formData.expiry_date || null,
            notes: formData.notes || null,
          }
        }
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const responseData = await response.json()
      
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save schedule')
      }

      if (responseData.message) {
        // Show success message for bulk creation
        alert(responseData.message)
      }
      
      // Reload team leaders and update selected one
      const refreshResponse = await fetch(`${API_BASE_URL}/api/schedules/team-leaders`, {
        credentials: 'include',
      })
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        const updatedLeaders = refreshData.teamLeaders || []
        setTeamLeaders(updatedLeaders)
        const updated = updatedLeaders.find((tl: TeamLeader) => tl.id === selectedTeamLeader.id)
        if (updated) setSelectedTeamLeader(updated)
      }
      
      setShowModal(false)
      setEditingSchedule(null)
    } catch (error: any) {
      console.error('Error saving schedule:', error)
      alert(error.message || 'Failed to save schedule')
    }
  }

  const getSchedulesByDay = (day: number) => {
    if (!selectedTeamLeader) return []
    return selectedTeamLeader.schedules.filter(s => s.day_of_week === day)
  }

  // Helper function to detect if schedules are identical (for visual grouping)
  const areSchedulesIdentical = (schedule1: WorkSchedule, schedule2: WorkSchedule) => {
    return (
      schedule1.start_time === schedule2.start_time &&
      schedule1.end_time === schedule2.end_time &&
      schedule1.is_active === schedule2.is_active &&
      schedule1.effective_date === schedule2.effective_date &&
      schedule1.expiry_date === schedule2.expiry_date &&
      schedule1.notes === schedule2.notes
    )
  }

  // Get grouped schedules for visual display
  const getGroupedSchedules = () => {
    if (!selectedTeamLeader) return []
    
    const groups: Array<{
      days: number[]
      schedule: WorkSchedule
      scheduleIds: string[]
    }> = []

    // Group consecutive days with identical schedules
    const processed: Set<string> = new Set()
    
    selectedTeamLeader.schedules.forEach(schedule => {
      if (processed.has(schedule.id)) return
      
      const group: number[] = [schedule.day_of_week]
      const scheduleIds: string[] = [schedule.id]
      
      // Find other schedules with same pattern
      selectedTeamLeader.schedules.forEach(otherSchedule => {
        if (
          otherSchedule.id !== schedule.id &&
          !processed.has(otherSchedule.id) &&
          areSchedulesIdentical(schedule, otherSchedule)
        ) {
          group.push(otherSchedule.day_of_week)
          scheduleIds.push(otherSchedule.id)
          processed.add(otherSchedule.id)
        }
      })
      
      group.sort((a, b) => a - b)
      
      // Only group if 2 or more consecutive days
      if (group.length >= 2 && isConsecutive(group)) {
        groups.push({
          days: group,
          schedule,
          scheduleIds,
        })
        group.forEach(day => {
          const sched = selectedTeamLeader!.schedules.find(s => 
            s.day_of_week === day && areSchedulesIdentical(s, schedule)
          )
          if (sched) processed.add(sched.id)
        })
      }
    })
    
    return groups
  }

  // Check if days are consecutive
  const isConsecutive = (days: number[]): boolean => {
    if (days.length < 2) return false
    const sorted = [...days].sort((a, b) => a - b)
    
    // Check if all days are consecutive
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        // Check if wraps around (Friday to Monday: 5 to 1)
        if (!(sorted[i] === 0 && sorted[i - 1] === 6)) {
          return false
        }
      }
    }
    return true
  }

  // Format day range string
  const formatDayRange = (days: number[]): string => {
    if (days.length === 0) return ''
    if (days.length === 1) return DAYS_OF_WEEK[days[0]]
    
    const sorted = [...days].sort((a, b) => a - b)
    const start = sorted[0]
    const end = sorted[sorted.length - 1]
    
    // Handle wrap-around (e.g., Friday to Monday)
    if (end < start) {
      return `${DAYS_OF_WEEK[start]}-${DAYS_OF_WEEK[6]}, ${DAYS_OF_WEEK[0]}-${DAYS_OF_WEEK[end]}`
    }
    
    return `${DAYS_OF_WEEK[start]}-${DAYS_OF_WEEK[end]}`
  }

  // Bulk delete similar schedules
  const handleBulkDelete = async (scheduleIds: string[]) => {
    if (!confirm(`Are you sure you want to delete ${scheduleIds.length} schedule(s)?`)) return
    
    try {
      // Delete all schedules in parallel
      await Promise.all(
        scheduleIds.map(id => 
          fetch(`${API_BASE_URL}/api/schedules/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          })
        )
      )
      
      // Reload team leaders
      const refreshResponse = await fetch(`${API_BASE_URL}/api/schedules/team-leaders`, {
        credentials: 'include',
      })
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        const updatedLeaders = refreshData.teamLeaders || []
        setTeamLeaders(updatedLeaders)
        if (selectedTeamLeader) {
          const updated = updatedLeaders.find((tl: TeamLeader) => tl.id === selectedTeamLeader.id)
          if (updated) setSelectedTeamLeader(updated)
        }
      }
    } catch (error) {
      console.error('Error deleting schedules:', error)
      alert('Failed to delete schedules')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Loading message="Loading team leaders..." size="medium" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="schedule-container">
        <div className="schedule-header">
          <h1>Team Leader Work Schedules</h1>
          <p className="schedule-subtitle">Manage work schedules for your team leaders</p>
        </div>

        {teamLeaders.length === 0 ? (
          <div className="schedule-empty">
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <h3 style={{ color: '#666', marginBottom: '1rem' }}>Team Leader Schedules Feature Disabled</h3>
              <p style={{ color: '#888', marginBottom: '1rem' }}>
                Team Leader work schedules management has been disabled. Team Leaders now manage individual worker schedules instead.
              </p>
              <p style={{ color: '#888' }}>
                To manage worker schedules, please use the Worker Schedules page in the Team Leader dashboard.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Team Leader Selection */}
            <div className="team-leader-selector">
              <label>Select Team Leader:</label>
              <select
                value={selectedTeamLeader?.id || ''}
                onChange={(e) => {
                  const tl = teamLeaders.find(t => t.id === e.target.value)
                  setSelectedTeamLeader(tl || null)
                }}
                className="team-leader-dropdown"
              >
                <option value="">-- Select Team Leader --</option>
                {teamLeaders.map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {tl.name} ({tl.team_name})
                  </option>
                ))}
              </select>
            </div>

            {selectedTeamLeader && (
              <>
                <div className="team-leader-info">
                  <h2>{selectedTeamLeader.name}</h2>
                  <p>Team: {selectedTeamLeader.team_name}</p>
                  <p>Email: {selectedTeamLeader.email}</p>
                </div>

                <div className="schedule-actions">
                  <button onClick={handleAddSchedule} className="btn-primary">
                    + Add Schedule
                  </button>
                </div>

                {/* Grouped Schedules Summary */}
                {(() => {
                  const groupedSchedules = getGroupedSchedules()
                  if (groupedSchedules.length > 0) {
                    return (
                      <div className="grouped-schedules-section">
                        <h3>Grouped Schedules</h3>
                        <div className="grouped-schedules-list">
                          {groupedSchedules.map((group, idx) => (
                            <div key={idx} className="grouped-schedule-item">
                              <div className="grouped-schedule-info">
                                <div className="grouped-schedule-days">
                                  <strong>{formatDayRange(group.days)}</strong>
                                </div>
                                <div className="grouped-schedule-time">
                                  {group.schedule.start_time.substring(0, 5)} - {group.schedule.end_time.substring(0, 5)}
                                </div>
                                {(group.schedule.effective_date || group.schedule.expiry_date) && (
                                  <div className="grouped-schedule-dates">
                                    {group.schedule.effective_date && (
                                      <small>From: {new Date(group.schedule.effective_date).toLocaleDateString()}</small>
                                    )}
                                    {group.schedule.expiry_date && (
                                      <small>Until: {new Date(group.schedule.expiry_date).toLocaleDateString()}</small>
                                    )}
                                  </div>
                                )}
                                {group.schedule.notes && (
                                  <div className="grouped-schedule-notes">{group.schedule.notes}</div>
                                )}
                              </div>
                              <div className="grouped-schedule-actions">
                                <button 
                                  onClick={() => handleBulkDelete(group.scheduleIds)}
                                  className="btn-delete btn-sm"
                                  title={`Delete all ${group.days.length} schedules`}
                                >
                                  Delete All ({group.days.length})
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                {/* Weekly Schedule Grid */}
                <div className="schedule-grid">
                  {DAYS_OF_WEEK.map((day, index) => {
                    const daySchedules = getSchedulesByDay(index)
                    return (
                      <div key={index} className="schedule-day-card">
                        <h3>{day}</h3>
                        {daySchedules.length === 0 ? (
                          <p className="no-schedule">No schedule</p>
                        ) : (
                          <div className="schedule-list">
                            {daySchedules.map((schedule) => (
                              <div key={schedule.id} className={`schedule-item ${!schedule.is_active ? 'inactive' : ''}`}>
                                <div className="schedule-time">
                                  {schedule.start_time.substring(0, 5)} - {schedule.end_time.substring(0, 5)}
                                </div>
                                {!schedule.is_active && (
                                  <span className="schedule-badge inactive-badge">Inactive</span>
                                )}
                                {schedule.notes && (
                                  <div className="schedule-notes">{schedule.notes}</div>
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
                                <div className="schedule-actions">
                                  <button onClick={() => handleEditSchedule(schedule)} className="btn-edit">
                                    Edit
                                  </button>
                                  <button onClick={() => handleDeleteSchedule(schedule.id)} className="btn-delete">
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* Modal for Add/Edit Schedule */}
        {showModal && selectedTeamLeader && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>{editingSchedule ? 'Edit' : 'Add'} Schedule for {selectedTeamLeader.name}</h2>
              <form onSubmit={handleSubmit}>
                {!editingSchedule && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={useRange}
                        onChange={(e) => setUseRange(e.target.checked)}
                      />
                      Use Day Range (e.g., Monday - Friday)
                    </label>
                  </div>
                )}

                {editingSchedule ? (
                  // Edit mode: single day only
                  <div className="form-group">
                    <label>Day of Week *</label>
                    <select
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                      required
                    >
                      {DAYS_OF_WEEK.map((day, index) => (
                        <option key={index} value={index}>{day}</option>
                      ))}
                    </select>
                  </div>
                ) : useRange ? (
                  // Range mode: start and end day
                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Day *</label>
                      <select
                        value={formData.start_day_of_week}
                        onChange={(e) => setFormData({ ...formData, start_day_of_week: parseInt(e.target.value) })}
                        required
                      >
                        {DAYS_OF_WEEK.map((day, index) => (
                          <option key={index} value={index}>{day}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>End Day *</label>
                      <select
                        value={formData.end_day_of_week}
                        onChange={(e) => setFormData({ ...formData, end_day_of_week: parseInt(e.target.value) })}
                        required
                      >
                        {DAYS_OF_WEEK.map((day, index) => (
                          <option key={index} value={index}>{day}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  // Single day mode
                  <div className="form-group">
                    <label>Day of Week *</label>
                    <select
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                      required
                    >
                      {DAYS_OF_WEEK.map((day, index) => (
                        <option key={index} value={index}>{day}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>End Time *</label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    Active Schedule
                  </label>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Effective Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.effective_date}
                      onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Expiry Date (Optional)</label>
                    <input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Notes (Optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    placeholder="Add any additional notes about this schedule..."
                  />
                </div>

                <div className="form-actions">
                  <button type="button" onClick={() => {
                    setShowModal(false)
                    setEditingSchedule(null)
                  }} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingSchedule ? 'Update Schedule' : useRange ? `Create Schedule (${DAYS_OF_WEEK[formData.start_day_of_week]} - ${DAYS_OF_WEEK[formData.end_day_of_week]})` : 'Create Schedule'}
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

