import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './TeamLeaderDashboard.css'

interface TeamMember {
  id: string
  user_id: string
  compliance_percentage: number
  phone?: string
  users?: {
    id: string
    email: string
    first_name?: string
    last_name?: string
    full_name?: string
    role: string
    phone?: string
  }
}

interface Team {
  id: string
  name: string
  site_location?: string
  team_leader_id: string
}

interface Supervisor {
  id: string
  email: string
  first_name?: string
  last_name?: string
  full_name?: string
}

interface TeamData {
  team: Team
  supervisor?: Supervisor | null
  members: TeamMember[]
  statistics: {
    totalMembers: number
    activeWorkers: number
    totalExemptions: number
    totalCases: number
  }
}

export function TeamLeaderDashboard() {
  const { user, business_name } = useAuth()
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTeamSetupModal, setShowTeamSetupModal] = useState(false)
  const [showExceptionModal, setShowExceptionModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [error, setError] = useState('')
  const [exceptions, setExceptions] = useState<Record<string, any>>({})
  const [workersWithSchedules, setWorkersWithSchedules] = useState<Set<string>>(new Set())

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: 'worker',
  })
  
  const [teamSetupData, setTeamSetupData] = useState({
    name: '',
    site_location: '',
  })
  
  const [exceptionForm, setExceptionForm] = useState({
    exception_type: 'transfer',
    reason: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    transfer_to_team_id: '',
  })
  const [currentException, setCurrentException] = useState<any>(null)
  const [availableTeams, setAvailableTeams] = useState<Array<{ id: string; name: string; site_location?: string; display_name: string; team_leader?: { name: string } }>>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    
    const loadTeamData = async () => {
      try {
        // Add cache-busting timestamp to ensure fresh data
        const response = await fetch(`${API_BASE_URL}/api/teams`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!isMounted) return

        if (!response.ok) {
          throw new Error('Failed to fetch team data')
        }

        const data = await response.json()
        
        // Debug logging (only in development)
        if (import.meta.env.DEV) {
        if (data.members && data.members.length > 0) {
            console.log('[TeamLeaderDashboard] Loaded', data.members.length, 'team members')
          }
        }
        
        if (isMounted) {
          // Check if response has an error
          if (data.error) {
            console.error('[TeamLeaderDashboard] Backend returned error:', data.error)
            setError(data.error)
            setTeamData(null)
            setShowTeamSetupModal(false) // Don't show modal if there's an error
            return
          }
          
          // If no team exists, show create team modal
          if (!data.team || data.team === null || data.team === undefined) {
            if (import.meta.env.DEV) {
              console.log('[TeamLeaderDashboard] No team found - showing create team modal')
            }
            setTeamData(null)
            setShowTeamSetupModal(true)
            setError('')
          } else {
            if (import.meta.env.DEV) {
              console.log('[TeamLeaderDashboard] Team found:', data.team.name, '- members:', data.members?.length || 0)
            }
            setTeamData(data)
            setShowTeamSetupModal(false) // Explicitly close modal when team exists
            setError('')
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('[TeamLeaderDashboard] ❌ Error loading team data:', err)
          console.error('[TeamLeaderDashboard] Error details:', {
            message: err.message,
            stack: err.stack,
            response: err.response,
          })
          setError(err.message || 'Failed to load team data')
          setTeamData(null)
          setShowTeamSetupModal(false) // Don't show modal on error
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // Only load team data if user is authenticated
    if (user) {
      loadTeamData()
    } else {
      setLoading(false)
    }

    return () => {
      isMounted = false
    }
  }, [user]) // Re-fetch when user changes (e.g., after login)

  // Load exceptions and worker schedules when team data is loaded
  useEffect(() => {
    const loadExceptionsAndSchedules = async () => {
      if (!teamData || !teamData.members) return

      try {
        // Load exceptions
        const exceptionsResponse = await fetch(`${API_BASE_URL}/api/teams/exceptions`, {
          credentials: 'include',
        })

        if (exceptionsResponse.ok) {
          const exceptionsData = await exceptionsResponse.json()
          const exceptionsMap: Record<string, any> = {}
          exceptionsData.exceptions?.forEach((ex: any) => {
            exceptionsMap[ex.user_id] = ex
          })
          setExceptions(exceptionsMap)
        }

        // Load worker schedules to check who has ANY active schedules assigned
        // A worker is "Active" if they have at least one active schedule assigned (any date, any time)
        const workerIds = teamData.members.map(m => m.user_id).filter(Boolean)
        if (workerIds.length === 0) return

        // Fetch ALL active schedules for workers (no date filter = gets all schedules)
        // This accurately shows which workers have been assigned schedules by the team leader
        const schedulesResponse = await fetch(
          `${API_BASE_URL}/api/schedules/workers`,
          {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
          }
        )

        if (schedulesResponse.ok) {
          const schedulesData = await schedulesResponse.json()
          // Get unique worker IDs who have ANY active schedules assigned
          const workersWithAnySchedule = new Set<string>()
          if (schedulesData.schedules && Array.isArray(schedulesData.schedules)) {
            schedulesData.schedules.forEach((schedule: any) => {
              // Worker is active if they have at least one active schedule (regardless of date)
              if (schedule.worker_id && schedule.is_active !== false) {
                workersWithAnySchedule.add(schedule.worker_id)
              }
            })
          }
          setWorkersWithSchedules(workersWithAnySchedule)
        }
      } catch (error) {
        console.error('Error loading exceptions or schedules:', error)
      }
    }

    loadExceptionsAndSchedules()
  }, [teamData])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.team-leader-actions-dropdown')) {
        setOpenDropdownId(null)
      }
    }

    if (openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdownId])

  const fetchTeamData = async () => {
    try {
      setError('')
      const response = await fetch(`${API_BASE_URL}/api/teams`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch team data')
      }

      const data = await response.json()
      
      // If no team exists, show create team modal
      if (!data.team || data.team === null) {
        console.log('[TeamLeaderDashboard] fetchTeamData: No team found - showing create team modal')
        setTeamData(null)
        setShowTeamSetupModal(true)
      } else {
        console.log('[TeamLeaderDashboard] fetchTeamData: Team found:', data.team.name, '- hiding create team modal')
        setTeamData(data)
        setShowTeamSetupModal(false) // Explicitly close modal when team exists
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team data')
    }
  }

  const handleTeamSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!teamSetupData.name || teamSetupData.name.trim() === '') {
      setError('Team name is required')
      return
    }

    try {
      // Check if team exists to decide between POST (create) or PATCH (update)
      const checkResponse = await fetch(`${API_BASE_URL}/api/teams`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const checkData = await checkResponse.json()
      const method = (!checkData.team || checkData.team === null) ? 'POST' : 'PATCH'

      const response = await fetch(`${API_BASE_URL}/api/teams`, {
        method: method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teamSetupData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${method === 'POST' ? 'create' : 'update'} team`)
      }

      setShowTeamSetupModal(false)
      setTeamSetupData({ name: '', site_location: '' })
      await fetchTeamData()
    } catch (err: any) {
      setError(err.message || 'Failed to setup team')
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/members`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add team member')
      }

      // Reset form and close modal
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        phone: '',
        role: 'worker',
      })
      setShowAddModal(false)
      await fetchTeamData()
    } catch (err: any) {
      setError(err.message || 'Failed to add team member')
    }
  }

  const handleEditMember = useCallback((member: TeamMember) => {
    setSelectedMember(member)
    
    // If full_name exists but first_name/last_name are missing, try to split full_name
    let firstName = member.users?.first_name || ''
    let lastName = member.users?.last_name || ''
    
    if ((!firstName || !lastName) && member.users?.full_name) {
      const fullNameParts = member.users.full_name.trim().split(' ')
      if (fullNameParts.length > 0) {
        firstName = firstName || fullNameParts[0] || ''
        lastName = lastName || fullNameParts.slice(1).join(' ') || ''
      }
    }
    
    setFormData({
      email: member.users?.email || '',
      password: '',
      first_name: firstName,
      last_name: lastName,
      phone: member.phone || '',
      role: member.users?.role || 'worker', // For display only, not editable
    })
    setShowEditModal(true)
  }, [])

  const handleUpdateMember = useCallback(async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    if (!selectedMember) return

    // Validate inputs
    const trimmedFirstName = formData.first_name.trim()
    const trimmedLastName = formData.last_name.trim()
    const trimmedPhone = formData.phone.trim()

    if (!trimmedFirstName || !trimmedLastName) {
      setError('First name and last name are required')
      return
    }

    // Validate name length (security: prevent extremely long strings)
    if (trimmedFirstName.length > 100 || trimmedLastName.length > 100) {
      setError('Name fields must be less than 100 characters')
      return
    }

    // Validate phone format (optional but if provided, should be reasonable)
    if (trimmedPhone && trimmedPhone.length > 20) {
      setError('Phone number is too long')
      return
    }

    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/members/${selectedMember.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          phone: trimmedPhone || null,
          // Role is NOT sent - backend will not update it (security)
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update team member')
      }

      setShowEditModal(false)
      setSelectedMember(null)
      // Refresh team data directly
      const refreshResponse = await fetch(`${API_BASE_URL}/api/teams`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json()
        if (refreshData.team) {
          setTeamData(refreshData)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update team member')
    }
  }, [selectedMember, formData])

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove team member')
      }

      await fetchTeamData()
    } catch (err: any) {
      setError(err.message || 'Failed to remove team member')
    }
  }

  const handleManageException = async (member: TeamMember) => {
    setSelectedMember(member)
    setError('')
    setLoadingTeams(true)

    // Load available teams for transfer
    try {
      const teamsResponse = await fetch(`${API_BASE_URL}/api/teams/all`, {
        credentials: 'include',
      })
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json()
        // Filter out current team
        const filteredTeams = (teamsData.teams || []).filter((t: any) => t.id !== teamData?.team?.id)
        setAvailableTeams(filteredTeams)
      }
    } catch (error) {
      console.error('Error loading teams:', error)
    } finally {
      setLoadingTeams(false)
    }

    // Check if worker has existing exception
    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/members/${member.id}/exception`, {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        if (data.exception) {
          setCurrentException(data.exception)
          setExceptionForm({
            exception_type: data.exception.exception_type,
            reason: data.exception.reason || '',
            start_date: data.exception.start_date,
            end_date: data.exception.end_date || '',
            transfer_to_team_id: '',
          })
        } else {
          setCurrentException(null)
          setExceptionForm({
            exception_type: 'transfer',
            reason: '',
            start_date: new Date().toISOString().split('T')[0],
            end_date: '',
            transfer_to_team_id: '',
          })
        }
      }
    } catch (error) {
      console.error('Error loading exception:', error)
      setCurrentException(null)
      setExceptionForm({
        exception_type: 'transfer',
        reason: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        transfer_to_team_id: '',
      })
    }

    setShowExceptionModal(true)
  }

  const handleSaveException = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    if (!selectedMember) return

    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/members/${selectedMember.id}/exception`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exception_type: exceptionForm.exception_type,
          reason: exceptionForm.reason || null,
          start_date: exceptionForm.start_date,
          end_date: exceptionForm.end_date || null,
          transfer_to_team_id: exceptionForm.exception_type === 'transfer' ? exceptionForm.transfer_to_team_id : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save exception')
      }

      setShowExceptionModal(false)
      setSelectedMember(null)
      
      // If transferred, show success message
      if (data.transferred) {
        alert('Worker has been transferred to the new team successfully!')
      }
      
      // Reload team data to reflect changes (worker moved to new team if transfer)
      await fetchTeamData()
      
      // Reload exceptions
      const exResponse = await fetch(`${API_BASE_URL}/api/teams/exceptions`, {
        credentials: 'include',
      })
      if (exResponse.ok) {
        const exData = await exResponse.json()
        const exceptionsMap: Record<string, any> = {}
        exData.exceptions?.forEach((ex: any) => {
          exceptionsMap[ex.user_id] = ex
        })
        setExceptions(exceptionsMap)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save exception')
    }
  }

  const handleRemoveException = async () => {
    if (!currentException || !selectedMember) return
    if (!confirm('Are you sure to remove exception? All the worker schedules will be activated again.')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/teams/exceptions/${currentException.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove exception')
      }

      const data = await response.json()
      
      // Show success message with schedule reactivation info
      if (data.reactivatedSchedules > 0) {
        alert(`Exception removed successfully. ${data.reactivatedSchedules} schedule(s) were automatically reactivated for this worker.`)
      } else {
        alert('Exception removed successfully.')
      }

      setShowExceptionModal(false)
      setSelectedMember(null)
      await fetchTeamData()
      
      // Reload exceptions
      const exResponse = await fetch(`${API_BASE_URL}/api/teams/exceptions`, {
        credentials: 'include',
      })
      if (exResponse.ok) {
        const exData = await exResponse.json()
        const exceptionsMap: Record<string, any> = {}
        exData.exceptions?.forEach((ex: any) => {
          exceptionsMap[ex.user_id] = ex
        })
        setExceptions(exceptionsMap)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove exception')
    }
  }

  const getInitials = (firstName?: string, lastName?: string, fullName?: string, email?: string) => {
    // Try to use first_name and last_name first
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
    }
    // Fallback to full_name if available
    const name = fullName || (firstName && lastName ? `${firstName} ${lastName}` : '') || ''
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return '??'
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }


  // Optimized filter with memoization
  const filteredMembers = useMemo(() => {
    if (!teamData?.members) return []
    
    const query = searchQuery.toLowerCase().trim()
    if (!query) return teamData.members
    
    return teamData.members.filter((member) => {
      // Early return if no user data (security: prevent null access)
      if (!member.users) return false
      
      const name = (member.users.first_name && member.users.last_name 
      ? `${member.users.first_name} ${member.users.last_name}` 
        : member.users.full_name) || member.users.email || ''
      const email = member.users.email || ''
      
      // Case-insensitive search
    return name.toLowerCase().includes(query) || email.toLowerCase().includes(query)
  })
  }, [teamData?.members, searchQuery])

  if (loading) {
    return (
      <DashboardLayout>
        <div className="team-leader-dashboard-simple">
        <Loading message="Loading team data..." size="medium" />
        </div>
      </DashboardLayout>
    )
  }

  // If no team exists, show create team modal
  if (!teamData && !loading) {
    if (error) {
      return (
        <DashboardLayout>
          <div className="team-leader-dashboard-simple">
            <div className="team-leader-error">
              <p>{error || 'Failed to load team data. Please try refreshing the page.'}</p>
          </div>
        </div>
        </DashboardLayout>
      )
    }
    // Show modal for creating team (no dashboard content until team is created)
    return (
      <DashboardLayout>
        <div className="team-leader-dashboard-simple">
          {/* Create Team Modal - mandatory when no team exists */}
          {showTeamSetupModal && (
            <div className="modal-overlay" onClick={() => {}}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>Create Your Team</h3>
                </div>
                {error && (
                  <div className="error-message" style={{ margin: '0 24px 16px 24px' }}>
                    {error}
                  </div>
                )}
                <form onSubmit={handleTeamSetup} className="member-form">
                  <div className="form-group">
                    <label>Team Name *</label>
                    <input
                      type="text"
                      required
                      value={teamSetupData.name}
                      onChange={(e) => setTeamSetupData({ ...teamSetupData, name: e.target.value })}
                      placeholder="Enter your team name (e.g., Team Delta)"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Site Location (Optional)</label>
                    <input
                      type="text"
                      value={teamSetupData.site_location}
                      onChange={(e) => setTeamSetupData({ ...teamSetupData, site_location: e.target.value })}
                      placeholder="e.g., Pilbara Site A"
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="submit-btn">
                      Create Team
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

  // Type guard: teamData must exist at this point
  if (!teamData) {
    return null
  }

  return (
    <DashboardLayout>
      <div className="team-leader-dashboard-simple">
      {/* Header */}
        <div className="team-leader-header">
          <div>
            <h1 className="team-leader-title">Team Members</h1>
            <p className="team-leader-subtitle">
              {business_name ? `${business_name} • Manage your team roster and assignments.` : 'Manage your team roster and assignments.'}
            </p>
          </div>
          <button className="team-leader-add-btn" onClick={() => setShowAddModal(true)}>
            + Add Team Member
          </button>
        </div>

      {/* Statistics Cards */}
        <div className="team-leader-stats">
          <div className="team-leader-stat-card">
            <div className="team-leader-stat-value">{teamData.statistics.totalMembers}</div>
            <div className="team-leader-stat-label">Total Members</div>
        </div>
          <div className="team-leader-stat-card">
            <div className="team-leader-stat-value team-leader-stat-green">{teamData.statistics.activeWorkers}</div>
            <div className="team-leader-stat-label">Active Workers</div>
        </div>
          <div className="team-leader-stat-card">
            <div className="team-leader-stat-value">{teamData.statistics.totalCases}</div>
            <div className="team-leader-stat-label">Total Cases</div>
        </div>
          <div className="team-leader-stat-card">
            <div className="team-leader-stat-value">{teamData.statistics.totalExemptions}</div>
            <div className="team-leader-stat-label">Total Exemptions</div>
      </div>
          </div>

          {/* Search Bar */}
        <div className="team-leader-search">
          <svg className="team-leader-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
            <input
              type="text"
            placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            className="team-leader-search-input"
            />
          </div>

          {/* Error Message */}
          {error && (
          <div className="team-leader-error">
            <p>{error}</p>
            <button onClick={() => setError('')} className="team-leader-error-close">×</button>
            </div>
          )}

          {/* Team Members List */}
        <div className="team-leader-members-list">
            {(teamData.members || []).length === 0 ? (
            <div className="team-leader-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 16px', color: '#94A3B8' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <p style={{ fontWeight: 500, color: '#0F172A', marginBottom: '4px' }}>No team members found</p>
              <p style={{ fontSize: '13px', color: '#64748B' }}>
                Click &quot;+ Add Team Member&quot; to add your first worker.
              </p>
              </div>
          ) : filteredMembers.length === 0 ? (
            <div className="team-leader-empty">
              <p style={{ fontWeight: 500, color: '#0F172A', marginBottom: '4px' }}>No members match your search</p>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Try adjusting your search query</p>
                  </div>
          ) : (
            <div className="team-leader-members-table-container">
              {filteredMembers.map((member) => {
                const memberName = (() => {
                        if (member.users?.first_name && member.users?.last_name) {
                          return `${member.users.first_name} ${member.users.last_name}`
                        }
                        if (member.users?.full_name) {
                          return member.users.full_name
                        }
                        if (member.users?.email) {
                          return member.users.email
                        }
                        return 'Unknown'
                })()
                const initials = getInitials(member.users?.first_name, member.users?.last_name, member.users?.full_name, member.users?.email)
                const avatarColor = getAvatarColor(memberName)
                
                return (
                  <div key={member.id} className="team-leader-member-card">
                    <div className="team-leader-member-avatar" style={{ backgroundColor: avatarColor }}>
                      {initials}
                    </div>
                    <div className="team-leader-member-info">
                      <div className="team-leader-member-name">{memberName}</div>
                      <div className="team-leader-member-role">
                        <span className={`team-leader-role-badge ${member.users?.role === 'supervisor' ? 'role-supervisor' : 'role-worker'}`}>
                        {member.users?.role === 'supervisor' ? 'Supervisor' : 'Worker'}
                      </span>
                      {member.users?.role === 'worker' && (
                          <span className={workersWithSchedules.has(member.user_id) ? 'team-leader-active-badge' : 'team-leader-inactive-badge'}>
                            {workersWithSchedules.has(member.user_id) ? 'Active' : 'Inactive'}
                      </span>
                      )}
                      {exceptions[member.user_id] && (
                          <span className="team-leader-exception-badge">
                            ⚠️ Exception
                        </span>
                      )}
                    </div>
                      <div className="team-leader-member-contact">
                        {member.users?.email || 'N/A'}
                        {member.phone && ` • ${member.phone}`}
                    </div>
                  </div>
                    <div className="team-leader-member-actions">
                      <div className="team-leader-actions-dropdown">
                        <div className="team-leader-actions-header">
                          <span className="team-leader-actions-label">Actions</span>
                    <button
                            className="team-leader-actions-trigger"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenDropdownId(openDropdownId === member.id ? null : member.id)
                            }}
                            title="Actions"
                    >
                            <span className="team-leader-actions-dots">⋮</span>
                    </button>
                        </div>
                        {openDropdownId === member.id && (
                          <div className="team-leader-actions-menu">
                    <button
                              className="team-leader-action-item"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditMember(member)
                                setOpenDropdownId(null)
                              }}
                            >
                              <span className="team-leader-action-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                              </span>
                              <span className="team-leader-action-text">Edit</span>
                    </button>
                    <button
                              className={`team-leader-action-item ${exceptions[member.user_id] ? 'has-exception' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleManageException(member)
                                setOpenDropdownId(null)
                              }}
                            >
                              <span className="team-leader-action-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                  <line x1="12" y1="9" x2="12" y2="13"></line>
                                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                              </span>
                              <span className="team-leader-action-text">Exception</span>
                            </button>
                            <button
                              className="team-leader-action-item remove-action"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveMember(member.id)
                                setOpenDropdownId(null)
                              }}
                            >
                              <span className="team-leader-action-icon">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </span>
                              <span className="team-leader-action-text">Remove</span>
                    </button>
                          </div>
                        )}
                      </div>
                  </div>
                </div>
                )
              })}
            </div>
            )}
          </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Team Member</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddMember} className="member-form">
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="worker">Worker</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowAddModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Sidebar */}
      {showEditModal && selectedMember && (
        <>
          <div className="sidebar-overlay" onClick={() => setShowEditModal(false)}></div>
          <div className="sidebar-panel">
            <div className="sidebar-header">
              <h3>Edit Team Member</h3>
              <button className="sidebar-close" onClick={() => setShowEditModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="sidebar-body">
              <form className="member-form">
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={formData.email} disabled />
              </div>
              <div className="form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <input
                  type="text"
                  value={formData.role?.toUpperCase() || 'N/A'}
                  disabled
                  style={{ background: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }}
                />
                <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0 0' }}>
                  Role cannot be changed
                </p>
              </div>
              </form>
            </div>
            <div className="sidebar-footer">
                <button type="button" onClick={() => setShowEditModal(false)} className="cancel-btn">
                  Cancel
                </button>
              <button type="button" onClick={handleUpdateMember} className="submit-btn">
                  Update Member
                </button>
              </div>
          </div>
        </>
      )}

      {/* Create Team Modal - for first time login */}
      {showTeamSetupModal && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Your Team</h3>
            </div>
            {error && (
              <div className="error-message" style={{ margin: '0 24px 16px 24px' }}>
                {error}
              </div>
            )}
            <form onSubmit={handleTeamSetup} className="member-form">
              <div className="form-group">
                <label>Team Name *</label>
                <input
                  type="text"
                  required
                  value={teamSetupData.name}
                  onChange={(e) => setTeamSetupData({ ...teamSetupData, name: e.target.value })}
                  placeholder="Enter your team name (e.g., Team Delta)"
                />
              </div>
              <div className="form-group">
                <label>Site Location (Optional)</label>
                <input
                  type="text"
                  value={teamSetupData.site_location}
                  onChange={(e) => setTeamSetupData({ ...teamSetupData, site_location: e.target.value })}
                  placeholder="e.g., Pilbara Site A"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exception Sidebar */}
      {showExceptionModal && selectedMember && (
        <>
          <div className="sidebar-overlay" onClick={() => setShowExceptionModal(false)}></div>
          <div className="sidebar-panel">
            <div className="sidebar-header">
              <h3>Manage Exception - {(() => {
                if (selectedMember.users?.first_name && selectedMember.users?.last_name) {
                  return `${selectedMember.users.first_name} ${selectedMember.users.last_name}`
                }
                if (selectedMember.users?.full_name) {
                  return selectedMember.users.full_name
                }
                return selectedMember.users?.email || 'Worker'
              })()}</h3>
              <button className="sidebar-close" onClick={() => setShowExceptionModal(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="sidebar-body">
            {error && (
                <div className="error-message" style={{ margin: '0 0 16px 0' }}>
                {error}
              </div>
            )}
            {currentException && (
              <>
                {/* Warning if assigned to WHS */}
                {currentException.assigned_to_whs && (
                  <div style={{
                      margin: '0 0 16px 0',
                    padding: '12px',
                    backgroundColor: '#FEE2E2',
                    borderRadius: '6px',
                    borderLeft: '4px solid #EF4444',
                  }}>
                    <p style={{ margin: 0, fontWeight: '600', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      Exception Assigned to WHS
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.875em', color: '#7F1D1D' }}>
                      This exception has been assigned to WHS Case Manager. You cannot modify or remove it until WHS closes the case.
                    </p>
                  </div>
                )}
                {/* Regular active exception info */}
              <div style={{
                    margin: '0 0 16px 0',
                padding: '12px',
                backgroundColor: '#fef3c7',
                borderRadius: '6px',
                borderLeft: '4px solid #f59e0b',
              }}>
                <p style={{ margin: 0, fontWeight: '600', color: '#92400e' }}>
                  Current Exception Active
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.9em', color: '#78350f' }}>
                  Type: {currentException.exception_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown'}
                  {currentException.reason && ` • ${currentException.reason}`}
                </p>
              </div>
              </>
            )}
              <form className="member-form">
              <div className="form-group">
                <label>Exception Type *</label>
                <select
                  value={exceptionForm.exception_type}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, exception_type: e.target.value, transfer_to_team_id: '' })}
                  required
                  disabled={currentException?.assigned_to_whs}
                >
                  <option value="transfer">Transfer</option>
                  <option value="accident">Accident</option>
                  <option value="injury">Injury</option>
                  <option value="medical_leave">Medical Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>
              {exceptionForm.exception_type === 'transfer' && (
                <div className="form-group">
                  <label>Transfer To Team *</label>
                  {loadingTeams ? (
                    <p>Loading teams...</p>
                  ) : availableTeams.length === 0 ? (
                    <p style={{ color: '#ef4444', fontSize: '0.9em' }}>No other teams available for transfer</p>
                  ) : (
                    <select
                      value={exceptionForm.transfer_to_team_id}
                      onChange={(e) => setExceptionForm({ ...exceptionForm, transfer_to_team_id: e.target.value })}
                      required
                      disabled={currentException?.assigned_to_whs}
                    >
                      <option value="">-- Select Team --</option>
                      {availableTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.display_name} {team.team_leader && `(Leader: ${team.team_leader.name})`}
                        </option>
                      ))}
                    </select>
                  )}
                  <small style={{ color: '#6b7280', marginTop: '4px', display: 'block' }}>
                    Select the team where this worker will be transferred to.
                  </small>
                </div>
              )}
              <div className="form-group">
                <label>Reason (Optional)</label>
                <textarea
                  value={exceptionForm.reason}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, reason: e.target.value })}
                  placeholder="Enter reason for exception..."
                  rows={3}
                  disabled={currentException?.assigned_to_whs}
                />
              </div>
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  value={exceptionForm.start_date}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, start_date: e.target.value })}
                  required
                  disabled={currentException?.assigned_to_whs}
                />
              </div>
              <div className="form-group">
                <label>End Date (Optional - leave empty for indefinite)</label>
                <input
                  type="date"
                  value={exceptionForm.end_date}
                  onChange={(e) => setExceptionForm({ ...exceptionForm, end_date: e.target.value })}
                  min={exceptionForm.start_date}
                  disabled={currentException?.assigned_to_whs}
                />
                <small style={{ color: '#6b7280', marginTop: '4px', display: 'block' }}>
                  If no end date is set, the exception will remain active until manually removed.
                </small>
              </div>
              </form>
            </div>
            <div className="sidebar-footer">
                {currentException && (
                  <button
                    type="button"
                    onClick={handleRemoveException}
                    className="cancel-btn"
                    style={{ 
                      backgroundColor: currentException?.assigned_to_whs ? '#9CA3AF' : '#ef4444', 
                      color: 'white', 
                      marginRight: 'auto',
                      cursor: currentException?.assigned_to_whs ? 'not-allowed' : 'pointer',
                      opacity: currentException?.assigned_to_whs ? 0.6 : 1
                    }}
                    disabled={currentException?.assigned_to_whs}
                    title={currentException?.assigned_to_whs ? 'Cannot remove: Exception assigned to WHS' : 'Remove exception'}
                  >
                    Remove Exception
                  </button>
                )}
                <button type="button" onClick={() => setShowExceptionModal(false)} className="cancel-btn">
                  Cancel
                </button>
                <button 
                type="button" 
                onClick={handleSaveException}
                  className="submit-btn"
                  disabled={currentException?.assigned_to_whs}
                  style={{
                    opacity: currentException?.assigned_to_whs ? 0.6 : 1,
                    cursor: currentException?.assigned_to_whs ? 'not-allowed' : 'pointer'
                  }}
                  title={currentException?.assigned_to_whs ? 'Cannot update: Exception assigned to WHS' : ''}
                >
                  {currentException ? 'Update Exception' : 'Create Exception'}
                </button>
              </div>
          </div>
        </>
      )}
      </div>
    </DashboardLayout>
  )
}
