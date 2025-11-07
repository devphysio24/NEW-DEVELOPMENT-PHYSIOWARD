import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './AppointmentManagement.css'

interface Appointment {
  id: string
  caseId: string
  caseNumber: string
  workerId: string
  workerName: string
  workerEmail: string
  teamName: string
  siteLocation: string
  appointmentDate: string
  appointmentTime: string
  durationMinutes: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'declined'
  appointmentType: 'consultation' | 'follow_up' | 'assessment' | 'review' | 'other'
  location: string
  notes: string
  cancellationReason: string
  createdAt: string
  updatedAt: string
}

interface Case {
  id: string
  caseNumber: string
  workerId: string
  workerName: string
  workerEmail: string
  teamName: string
  siteLocation: string
  type: string
  reason: string
  status: string
}

interface Summary {
  today: number
  thisWeek: number
  completedThisMonth: number
  cancelledThisMonth: number
  confirmed: number
  pending: number
  declined: number
}

const TYPE_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  follow_up: 'Follow-up',
  assessment: 'Assessment',
  review: 'Review',
  other: 'Other',
}

export function AppointmentManagement() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [summary, setSummary] = useState<Summary>({
    today: 0,
    thisWeek: 0,
    completedThisMonth: 0,
    cancelledThisMonth: 0,
    confirmed: 0,
    pending: 0,
    declined: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [activeTab, setActiveTab] = useState<'today' | 'all' | 'week' | 'upcoming'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'declined'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    case_id: '',
    appointment_date: '',
    appointment_time: '',
    duration_minutes: 30,
    appointment_type: 'consultation',
    location: '',
    notes: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // Fetch appointments
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const dateFilter = activeTab === 'today' ? 'today' : activeTab === 'week' ? 'week' : activeTab === 'upcoming' ? 'upcoming' : 'all'
      const status = statusFilter === 'all' ? 'all' : statusFilter

      const response = await fetch(
        `${API_BASE_URL}/api/clinician/appointments?page=${currentPage}&limit=${itemsPerPage}&date=${dateFilter}&status=${status}&_t=${Date.now()}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch appointments' }))
        throw new Error(errorData.error || 'Failed to fetch appointments')
      }

      const data = await response.json()
      setAppointments(data.appointments || [])
      setSummary(data.summary || {
        today: 0,
        thisWeek: 0,
        completedThisMonth: 0,
        cancelledThisMonth: 0,
        confirmed: 0,
        pending: 0,
        declined: 0,
      })
      setTotalPages(data.pagination?.totalPages || 1)
      setTotalItems(data.pagination?.total || 0)
    } catch (err: any) {
      console.error('Error fetching appointments:', err)
      setError(err.message || 'Failed to fetch appointments')
    } finally {
      setLoading(false)
    }
  }, [currentPage, itemsPerPage, activeTab, statusFilter])

  // Fetch cases only once on mount (memoized)
  useEffect(() => {
    fetchAppointments()
    
    let mounted = true
    fetch(`${API_BASE_URL}/api/clinician/cases?status=all&limit=100`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (mounted && data) {
          setCases(data.cases || [])
        }
      })
      .catch(() => {
        // Silently handle errors - cases are optional for appointment creation
      })

    return () => {
      mounted = false
    }
  }, [fetchAppointments])

  // Reset status filter when switching tabs (except when staying on 'today')
  useEffect(() => {
    if (activeTab !== 'today') {
      setStatusFilter('all')
    }
  }, [activeTab])

  const handleCreateAppointment = async () => {
    if (!formData.case_id || !formData.appointment_date || !formData.appointment_time) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      const response = await fetch(`${API_BASE_URL}/api/clinician/appointments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.error || responseData.details || 'Failed to create appointment')
      }

      setShowCreateModal(false)
      setFormData({
        case_id: '',
        appointment_date: '',
        appointment_time: '',
        duration_minutes: 30,
        appointment_type: 'consultation',
        location: '',
        notes: '',
      })
      // Switch to 'all' tab to see the new appointment and refresh
      setActiveTab('all')
      setCurrentPage(1)
      // Wait a bit then refresh to ensure data is saved
      setTimeout(() => {
        fetchAppointments()
      }, 500)
    } catch (err: any) {
      setError(err.message || 'Failed to create appointment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateStatus = async (appointmentId: string, status: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/clinician/appointments/${appointmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update appointment' }))
        throw new Error(errorData.error || 'Failed to update appointment')
      }

      fetchAppointments()
    } catch (err: any) {
      setError(err.message || 'Failed to update appointment')
    }
  }

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/clinician/appointments/${appointmentId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete appointment' }))
        throw new Error(errorData.error || 'Failed to delete appointment')
      }

      fetchAppointments()
    } catch (err: any) {
      setError(err.message || 'Failed to delete appointment')
    }
  }

  // Helper functions
  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`
  }

  // Backend already filters, so we just use appointments directly
  const today = new Date().toISOString().split('T')[0]
  const todayAppointments = appointments.filter((apt) => apt.appointmentDate === today && apt.status === 'confirmed')
  const pendingAppointments = appointments.filter((apt) => apt.appointmentDate === today && apt.status === 'pending')
  const declinedAppointments = appointments.filter((apt) => apt.appointmentDate === today && apt.status === 'declined')

  return (
    <DashboardLayout>
      <div className="appointment-management">
        {/* Header */}
        <div className="appointment-header">
          <div className="header-left">
            <h1>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Appointment Management
            </h1>
          </div>
          <div className="header-right">
            <button className="btn-export">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export
            </button>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Appointment
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="card-content">
              <div className="card-label">Today's</div>
              <div className="card-value">{summary.today} appointments</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="card-content">
              <div className="card-label">Upcoming</div>
              <div className="card-value">{summary.thisWeek} this week</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="card-content">
              <div className="card-label">Completed</div>
              <div className="card-value">{summary.completedThisMonth} this month</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="card-content">
              <div className="card-label">Cancelled</div>
              <div className="card-value">{summary.cancelledThisMonth} this month</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="appointment-filters">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${activeTab === 'today' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('today')
                setCurrentPage(1)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Today's Scheduled ({todayAppointments.length})
            </button>
            <button
              className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('all')
                setCurrentPage(1)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              All Confirmed ({summary.confirmed})
            </button>
            <button
              className={`filter-tab ${activeTab === 'week' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('week')
                setCurrentPage(1)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              This Week ({summary.thisWeek})
            </button>
            <button
              className={`filter-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('upcoming')
                setCurrentPage(1)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
              Upcoming ({summary.thisWeek})
            </button>
          </div>

          {activeTab === 'today' && (
            <div className="status-filters">
              <button
                className={`status-filter-btn ${statusFilter === 'confirmed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('confirmed')}
              >
                Confirmed: {todayAppointments.length}
              </button>
              <button
                className={`status-filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setStatusFilter('pending')}
              >
                Pending: {pendingAppointments.length}
              </button>
              <button
                className={`status-filter-btn ${statusFilter === 'declined' ? 'active' : ''}`}
                onClick={() => setStatusFilter('declined')}
              >
                Declined: {declinedAppointments.length}
              </button>
            </div>
          )}
        </div>

        {/* Appointments List */}
        {loading ? (
          <Loading message="Loading appointments..." />
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <h3>No appointments found</h3>
            <p>Create your first appointment to get started</p>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Appointment
            </button>
          </div>
        ) : (
          <div className="appointments-list">
            {appointments.map((appointment) => (
              <div key={appointment.id} className="appointment-card">
                <div className="appointment-header-card">
                  <div className="appointment-info">
                    <div className="worker-info">
                      <div className="worker-avatar">
                        {appointment.workerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="worker-name">{appointment.workerName}</div>
                        <div className="case-number">{appointment.caseNumber}</div>
                      </div>
                    </div>
                    <div className="appointment-time">
                      <div className="time-primary">{formatTime(appointment.appointmentTime)}</div>
                      <div className="time-secondary">{formatDate(appointment.appointmentDate)}</div>
                    </div>
                  </div>
                  <div className="appointment-actions">
                    <span className={`status-badge status-${appointment.status}`}>
                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                    </span>
                    {appointment.status === 'pending' && (
                      <button
                        className="btn-sm btn-success"
                        onClick={() => handleUpdateStatus(appointment.id, 'confirmed')}
                      >
                        Confirm
                      </button>
                    )}
                    {appointment.status === 'confirmed' && (
                      <button
                        className="btn-sm btn-primary"
                        onClick={() => handleUpdateStatus(appointment.id, 'completed')}
                      >
                        Complete
                      </button>
                    )}
                    <button
                      className="btn-sm btn-danger"
                      onClick={() => handleDeleteAppointment(appointment.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="appointment-details">
                  <div className="detail-item">
                    <span className="detail-label">Type:</span>
                    <span>{TYPE_LABELS[appointment.appointmentType] || appointment.appointmentType}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Duration:</span>
                    <span>{appointment.durationMinutes} minutes</span>
                  </div>
                  {appointment.location && (
                    <div className="detail-item">
                      <span className="detail-label">Location:</span>
                      <span>{appointment.location}</span>
                    </div>
                  )}
                  {appointment.notes && (
                    <div className="detail-item">
                      <span className="detail-label">Notes:</span>
                      <span>{appointment.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && appointments.length > 0 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of{' '}
              {totalItems} appointments
            </div>
            <div className="pagination-controls">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={15}>15 per page</option>
                <option value={30}>30 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <div className="pagination-buttons">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  ««
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  ‹
                </button>
                <span className="pagination-page">{currentPage}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  »»
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Appointment Modal */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Create New Appointment</h2>
                <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Case *</label>
                  <select
                    value={formData.case_id}
                    onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}
                    required
                  >
                    <option value="">Select a case</option>
                    {cases.map((caseItem) => (
                      <option key={caseItem.id} value={caseItem.id}>
                        {caseItem.caseNumber} - {caseItem.workerName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      value={formData.appointment_date}
                      onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Time *</label>
                    <input
                      type="time"
                      value={formData.appointment_time}
                      onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Duration (minutes) *</label>
                    <input
                      type="number"
                      value={formData.duration_minutes}
                      onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                      min={15}
                      max={480}
                      step={15}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Type *</label>
                    <select
                      value={formData.appointment_type}
                      onChange={(e) => setFormData({ ...formData, appointment_type: e.target.value })}
                      required
                    >
                      <option value="consultation">Consultation</option>
                      <option value="follow_up">Follow-up</option>
                      <option value="assessment">Assessment</option>
                      <option value="review">Review</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Appointment location"
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={4}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleCreateAppointment} disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Appointment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

