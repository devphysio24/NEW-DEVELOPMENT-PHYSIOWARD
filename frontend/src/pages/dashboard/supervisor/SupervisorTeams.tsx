import { useState, useEffect } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './SupervisorTeams.css'

interface TeamLeader {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  initials: string
}

interface Team {
  id: string
  name: string
  siteLocation: string | null
  teamLeader: TeamLeader | null
  memberCount: number
  activeMemberCount?: number
  exceptionCount?: number
  checkInStats: {
    green: number
    amber: number
    pending: number
  }
  createdAt: string
}

export function SupervisorTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [showTeamDetailsModal, setShowTeamDetailsModal] = useState(false)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [teamLeaderForm, setTeamLeaderForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    team_name: '',
    site_location: '',
  })

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE_URL}/api/supervisor/teams`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch teams')
      }

      const data = await response.json()
      setTeams(data.teams || [])
    } catch (err: any) {
      console.error('Error fetching teams:', err)
      setError(err.message || 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeamLeader = async () => {
    try {
      setCreateLoading(true)
      setCreateError(null)

      const response = await fetch(`${API_BASE_URL}/api/supervisor/team-leaders`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(teamLeaderForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create team leader')
      }

      // Reset form and close modal
      setTeamLeaderForm({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        team_name: '',
        site_location: '',
      })
      setShowCreateModal(false)
      
      // Refresh teams list
      fetchTeams()
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create team leader')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleViewTeam = async (team: Team) => {
    setSelectedTeam(team)
    setShowTeamDetailsModal(true)
    setLoadingMembers(true)
    
    try {
      // Fetch team members from the supervisor's team endpoint
      const response = await fetch(`${API_BASE_URL}/api/supervisor/teams/${team.id}/members`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTeamMembers(data.members || [])
      } else {
        setTeamMembers([])
      }
    } catch (err) {
      console.error('Error fetching team members:', err)
      setTeamMembers([])
    } finally {
      setLoadingMembers(false)
    }
  }

  const closeTeamDetailsModal = () => {
    setShowTeamDetailsModal(false)
    setSelectedTeam(null)
    setTeamMembers([])
  }

  const handleDeleteClick = (e: React.MouseEvent, team: Team) => {
    e.stopPropagation() // Prevent opening team details modal
    setTeamToDelete(team)
    setShowDeleteModal(true)
    setDeletePassword('')
    setDeleteError(null)
  }

  const handleDeleteTeam = async () => {
    if (!teamToDelete) return

    if (!deletePassword.trim()) {
      setDeleteError('Password is required to delete team')
      return
    }

    try {
      setDeleteLoading(true)
      setDeleteError(null)

      const response = await fetch(`${API_BASE_URL}/api/supervisor/teams/${teamToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: deletePassword }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete team')
      }

      // Close modal and refresh teams list
      setShowDeleteModal(false)
      setTeamToDelete(null)
      setDeletePassword('')
      fetchTeams()
    } catch (err: any) {
      console.error('Error deleting team:', err)
      setDeleteError(err.message || 'Failed to delete team')
    } finally {
      setDeleteLoading(false)
    }
  }

  const closeDeleteModal = () => {
    if (deleteLoading) return // Prevent closing while deleting
    setShowDeleteModal(false)
    setTeamToDelete(null)
    setDeletePassword('')
    setDeleteError(null)
  }

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.siteLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.teamLeader?.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Generate avatar colors based on team name
  const getAvatarColor = (name: string) => {
    const colors = [
      '#9b8b7e', // brown
      '#5b4fc7', // purple
      '#10b981', // green
      '#f59e0b', // amber
      '#3b82f6', // blue
      '#ec4899', // pink
      '#8b5cf6', // violet
      '#14b8a6', // teal
    ]
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    return colors[index]
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="supervisor-teams">
          <Loading message="Loading teams..." size="medium" />
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="supervisor-teams">
          <div className="teams-error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2>Error Loading Teams</h2>
            <p>{error}</p>
            <button onClick={fetchTeams} className="retry-btn">Try Again</button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="supervisor-teams">
        {/* Header */}
        <div className="teams-header">
          <div className="teams-header-left">
            <h1 className="teams-title">All Teams</h1>
            <p className="teams-count">{teams.length} {teams.length === 1 ? 'team' : 'teams'}</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="create-team-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Create Team Leader
          </button>
        </div>

        {/* Search Bar */}
        <div className="teams-search-bar">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            placeholder="Search teams, locations, or team leaders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Teams Grid */}
        {filteredTeams.length === 0 ? (
          <div className="teams-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <h2>No teams found</h2>
            <p>
              {searchQuery 
                ? 'Try adjusting your search query' 
                : 'Create your first team leader to get started'}
            </p>
            {!searchQuery && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="create-team-btn-secondary"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Team Leader
              </button>
            )}
          </div>
        ) : (
          <div className="teams-grid">
            {filteredTeams.map((team) => (
              <div 
                key={team.id} 
                className="team-card"
                onClick={() => handleViewTeam(team)}
              >
                {/* Team Leader Avatar */}
                <div className="team-card-header">
                  <div 
                    className="team-leader-avatar"
                    style={{ backgroundColor: getAvatarColor(team.teamLeader?.fullName || team.name) }}
                  >
                    {team.teamLeader?.initials || 'TL'}
                  </div>
                  <div className="team-card-title-section" style={{ flex: 1 }}>
                    <h3 className="team-card-name">{team.teamLeader?.fullName || 'No Team Leader'}</h3>
                    {team.teamLeader?.email && (
                      <p className="team-leader-email">{team.teamLeader.email}</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDeleteClick(e, team)}
                    className="team-delete-btn"
                    title="Delete Team"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>

                {/* Team Info */}
                <div className="team-card-body">
                  <div className="team-info-row">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span className="team-name-label">{team.name}</span>
                  </div>
                  
                  {team.siteLocation && (
                    <div className="team-info-row">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      <span className="team-location">{team.siteLocation}</span>
                    </div>
                  )}

                  <div className="team-info-row">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span className="team-members-count">
                      {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </div>

                {/* Status Summary */}
                <div className="team-card-footer">
                  <div className="status-dots">
                    {team.checkInStats.green > 0 && (
                      <div className="status-dot-group">
                        <div className="status-dot status-green"></div>
                        <span className="status-count">{team.checkInStats.green}</span>
                      </div>
                    )}
                    {team.checkInStats.amber > 0 && (
                      <div className="status-dot-group">
                        <div className="status-dot status-amber"></div>
                        <span className="status-count">{team.checkInStats.amber}</span>
                      </div>
                    )}
                    {team.checkInStats.pending > 0 && (
                      <div className="status-dot-group">
                        <div className="status-dot status-pending"></div>
                        <span className="status-count">{team.checkInStats.pending}</span>
                      </div>
                    )}
                    {team.memberCount === 0 && (
                      <span className="no-members-text">No members yet</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Team Leader Modal */}
      {showCreateModal && (
        <div 
          className="modal-overlay"
          onClick={() => !createLoading && setShowCreateModal(false)}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Create Team Leader</h2>
              <button 
                className="modal-close-btn"
                onClick={() => setShowCreateModal(false)}
                disabled={createLoading}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {createError && (
              <div className="modal-error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {createError}
              </div>
            )}

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={teamLeaderForm.first_name}
                    onChange={(e) => setTeamLeaderForm({ ...teamLeaderForm, first_name: e.target.value })}
                    disabled={createLoading}
                    placeholder="John"
                  />
                </div>

                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={teamLeaderForm.last_name}
                    onChange={(e) => setTeamLeaderForm({ ...teamLeaderForm, last_name: e.target.value })}
                    disabled={createLoading}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={teamLeaderForm.email}
                  onChange={(e) => setTeamLeaderForm({ ...teamLeaderForm, email: e.target.value })}
                  disabled={createLoading}
                  placeholder="john.doe@example.com"
                />
              </div>

              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={teamLeaderForm.password}
                  onChange={(e) => setTeamLeaderForm({ ...teamLeaderForm, password: e.target.value })}
                  disabled={createLoading}
                  placeholder="••••••••"
                />
              </div>

              <div className="form-group">
                <label>Team Name *</label>
                <input
                  type="text"
                  value={teamLeaderForm.team_name}
                  onChange={(e) => setTeamLeaderForm({ ...teamLeaderForm, team_name: e.target.value })}
                  disabled={createLoading}
                  placeholder="e.g., Team Alpha"
                />
              </div>

              <div className="form-group">
                <label>Site Location (Optional)</label>
                <input
                  type="text"
                  value={teamLeaderForm.site_location}
                  onChange={(e) => setTeamLeaderForm({ ...teamLeaderForm, site_location: e.target.value })}
                  disabled={createLoading}
                  placeholder="e.g., Pilbara Site A"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={createLoading}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeamLeader}
                disabled={
                  createLoading || 
                  !teamLeaderForm.email || 
                  !teamLeaderForm.password || 
                  !teamLeaderForm.first_name || 
                  !teamLeaderForm.last_name || 
                  !teamLeaderForm.team_name
                }
                className="btn-primary"
              >
                {createLoading ? 'Creating...' : 'Create Team Leader'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Details Modal */}
      {showTeamDetailsModal && selectedTeam && (
        <div 
          className="modal-overlay"
          onClick={closeTeamDetailsModal}
        >
          <div 
            className="modal-content modal-large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-header-content">
                <div 
                  className="team-leader-avatar-large"
                  style={{ backgroundColor: getAvatarColor(selectedTeam.teamLeader?.fullName || selectedTeam.name) }}
                >
                  {selectedTeam.teamLeader?.initials || 'TL'}
                </div>
                <div>
                  <h2>{selectedTeam.name}</h2>
                  <p className="modal-subtitle">
                    {selectedTeam.siteLocation && `${selectedTeam.siteLocation} • `}
                    Led by {selectedTeam.teamLeader?.fullName || 'No Team Leader'}
                  </p>
                </div>
              </div>
              <button 
                className="modal-close-btn"
                onClick={closeTeamDetailsModal}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {/* Team Stats */}
              <div className="team-stats-grid">
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{selectedTeam.memberCount}</div>
                    <div className="stat-label">Total Members</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#d1fae5', color: '#059669' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{selectedTeam.checkInStats.green}</div>
                    <div className="stat-label">Green Status</div>
                  </div>
                </div>

                {(selectedTeam.exceptionCount || 0) > 0 && (
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                      </svg>
                    </div>
                    <div className="stat-content">
                      <div className="stat-value">{selectedTeam.exceptionCount || 0}</div>
                      <div className="stat-label">Exceptions</div>
                    </div>
                  </div>
                )}

                {selectedTeam.checkInStats.amber > 0 && (
                  <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                    </div>
                    <div className="stat-content">
                      <div className="stat-value">{selectedTeam.checkInStats.amber}</div>
                      <div className="stat-label">Amber Status</div>
                    </div>
                  </div>
                )}

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{selectedTeam.checkInStats.pending}</div>
                    <div className="stat-label">Pending</div>
                  </div>
                </div>
              </div>

              {/* Team Members List */}
              <div className="team-members-section">
                <h3 className="section-title">Team Members</h3>
                
                {loadingMembers ? (
                  <Loading message="Loading members..." size="small" />
                ) : teamMembers.length === 0 ? (
                  <div className="members-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <p>No members in this team yet</p>
                  </div>
                ) : (
                  <div className="members-list">
                    {teamMembers.map((member: any) => {
                      const memberName = member.users?.full_name || 
                                        (member.users?.first_name && member.users?.last_name 
                                          ? `${member.users.first_name} ${member.users.last_name}`
                                          : member.users?.email?.split('@')[0] || 'Unknown')
                      const initials = memberName
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                      
                      return (
                        <div key={member.id} className="member-item">
                          <div 
                            className="member-avatar"
                            style={{ backgroundColor: getAvatarColor(memberName) }}
                          >
                            {initials}
                          </div>
                          <div className="member-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div className="member-name">{memberName}</div>
                              {member.hasActiveException && member.exception && (
                                <span 
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    backgroundColor: '#fef3c7',
                                    color: '#92400e',
                                    border: '1px solid #f59e0b',
                                  }}
                                  title={`Exception: ${member.exception.exception_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Exception'}${member.exception.reason ? ` - ${member.exception.reason}` : ''}`}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                    <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                                  </svg>
                                  {member.exception.exception_type?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Exception'}
                                </span>
                              )}
                            </div>
                            <div className="member-email">{member.users?.email || 'No email'}</div>
                            {member.phone && (
                              <div className="member-phone">{member.phone}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <div className="member-role-badge">
                              {member.users?.role || 'worker'}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Team Leader Contact */}
              {selectedTeam.teamLeader && (
                <div className="team-leader-contact">
                  <h3 className="section-title">Team Leader Contact</h3>
                  <div className="contact-card">
                    <div 
                      className="contact-avatar"
                      style={{ backgroundColor: getAvatarColor(selectedTeam.teamLeader.fullName) }}
                    >
                      {selectedTeam.teamLeader.initials}
                    </div>
                    <div className="contact-info">
                      <div className="contact-name">{selectedTeam.teamLeader.fullName}</div>
                      <div className="contact-email">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                          <polyline points="22,6 12,13 2,6"></polyline>
                        </svg>
                        {selectedTeam.teamLeader.email}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Team Confirmation Modal */}
      {showDeleteModal && teamToDelete && (
        <div 
          className="modal-overlay"
          onClick={closeDeleteModal}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 style={{ color: '#dc2626' }}>Delete Team</h2>
              <button 
                className="modal-close-btn"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div style={{ 
                padding: '16px', 
                backgroundColor: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: '8px', 
                marginBottom: '20px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#dc2626', marginTop: '2px', flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <div>
                    <p style={{ margin: 0, fontWeight: '600', color: '#991b1b', marginBottom: '8px' }}>
                      Warning: This action cannot be undone
                    </p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#7f1d1d' }}>
                      You are about to delete <strong>{teamToDelete.name}</strong> and all associated data including team members, exceptions, and schedules.
                    </p>
                  </div>
                </div>
              </div>

              {deleteError && (
                <div className="modal-error">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {deleteError}
                </div>
              )}

              <div className="form-group">
                <label>
                  Enter your password to confirm deletion
                  <span style={{ color: '#dc2626' }}> *</span>
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value)
                    setDeleteError(null)
                  }}
                  disabled={deleteLoading}
                  placeholder="Your supervisor password"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && deletePassword.trim() && !deleteLoading) {
                      handleDeleteTeam()
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                  }}
                />
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#6b7280' }}>
                  This ensures that only you can delete teams
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeam}
                disabled={deleteLoading || !deletePassword.trim()}
                style={{
                  backgroundColor: deleteLoading || !deletePassword.trim() ? '#fca5a5' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: deleteLoading || !deletePassword.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s',
                }}
              >
                {deleteLoading ? (
                  <>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }}></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Delete Team
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

