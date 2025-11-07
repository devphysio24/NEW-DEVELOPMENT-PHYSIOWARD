import { useState, useEffect, useCallback, useMemo } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import './TeamMembers.css'

interface TeamMember {
  id: string
  user_id: string
  team_id: string
  phone: string | null
  compliance_percentage: number
  created_at: string
  updated_at: string
  users: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    full_name: string | null
    role: string
  } | null
}

interface TeamData {
  id: string
  name: string
  site_location: string | null
  team_leader_id: string
  supervisor_id: string | null
}

export function TeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [team, setTeam] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const itemsPerPage = 200
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
  })

  // Debounce search query
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch team members
  useEffect(() => {
    let isMounted = true

    const fetchTeamMembers = async () => {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(`${API_BASE_URL}/api/teams`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch team members')
        }

        const data = await response.json()
        
        if (isMounted) {
          setTeam(data.team || null)
          const allMembers = data.members || []
          
          // Apply filters
          let filtered = allMembers
          
          // Filter by role
          if (roleFilter !== 'all') {
            filtered = filtered.filter((m: TeamMember) => m.users?.role === roleFilter)
          }
          
          // Filter by search query (optimized with early return)
          if (debouncedSearchQuery.trim()) {
            const searchLower = debouncedSearchQuery.toLowerCase().trim()
            filtered = filtered.filter((m: TeamMember) => {
              // Early return if no user data (security: prevent null access)
              if (!m.users) return false
              
              const name = m.users.full_name || 
                          (m.users.first_name && m.users.last_name 
                            ? `${m.users.first_name} ${m.users.last_name}` 
                            : m.users.email || '')
              const email = m.users.email || ''
              
              // Case-insensitive search
              return name.toLowerCase().includes(searchLower) || 
                     email.toLowerCase().includes(searchLower)
            })
          }
          
          setTotalRecords(filtered.length)
          
          // Apply pagination
          const startIndex = (currentPage - 1) * itemsPerPage
          const endIndex = startIndex + itemsPerPage
          const paginated = filtered.slice(startIndex, endIndex)
          
          setMembers(paginated)
        }
      } catch (err: any) {
        console.error('Error fetching team members:', err)
        if (isMounted) {
          setError(err.message || 'Failed to load team members')
          setMembers([])
          setTotalRecords(0)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchTeamMembers()

    return () => {
      isMounted = false
    }
  }, [currentPage, roleFilter, debouncedSearchQuery, refreshKey])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.team-members-actions-dropdown')) {
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

  const handleRefresh = useCallback(() => {
    setCurrentPage(1)
    setRefreshKey(prev => prev + 1)
  }, [])

  const handleEdit = useCallback(() => {
    if (!selectedMember) return
    
    setEditForm({
      first_name: selectedMember.users?.first_name || '',
      last_name: selectedMember.users?.last_name || '',
      phone: selectedMember.phone || '',
    })
    setShowEditModal(true)
  }, [selectedMember])

  const handleUpdate = useCallback(async () => {
    if (!selectedMember) return

    // Validate inputs
    const trimmedFirstName = editForm.first_name.trim()
    const trimmedLastName = editForm.last_name.trim()
    const trimmedPhone = editForm.phone.trim()

    if (!trimmedFirstName || !trimmedLastName) {
      alert('First name and last name are required')
      return
    }

    // Validate name length (security: prevent extremely long strings)
    if (trimmedFirstName.length > 100 || trimmedLastName.length > 100) {
      alert('Name fields must be less than 100 characters')
      return
    }

    // Validate phone format (optional but if provided, should be reasonable)
    if (trimmedPhone && trimmedPhone.length > 20) {
      alert('Phone number is too long')
      return
    }

    try {
      setUpdating(true)
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
          // Role is NOT sent - backend will not update it
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update team member')
      }

      setShowEditModal(false)
      setSelectedMember(null)
      handleRefresh()
    } catch (err: any) {
      console.error('Error updating team member:', err)
      alert(err.message || 'Failed to update team member')
    } finally {
      setUpdating(false)
    }
  }, [selectedMember, editForm, handleRefresh])

  const handleDelete = async () => {
    if (!selectedMember) return

    try {
      setDeleting(true)
      const response = await fetch(`${API_BASE_URL}/api/teams/members/${selectedMember.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete team member')
      }

      setShowDeleteModal(false)
      setSelectedMember(null)
      handleRefresh()
    } catch (err: any) {
      console.error('Error deleting team member:', err)
      alert(err.message || 'Failed to delete team member')
    } finally {
      setDeleting(false)
    }
  }

  const getAvatarColor = useCallback((name: string) => {
    const colors = [
      '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }, [])

  const getInitials = useCallback((member: TeamMember) => {
    if (member.users?.first_name && member.users?.last_name) {
      return `${member.users.first_name[0]}${member.users.last_name[0]}`.toUpperCase()
    }
    if (member.users?.full_name) {
      const parts = member.users.full_name.trim().split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      }
      return member.users.full_name.substring(0, 2).toUpperCase()
    }
    if (member.users?.email) {
      return member.users.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }, [])

  const getMemberName = useCallback((member: TeamMember) => {
    if (member.users?.full_name) return member.users.full_name
    if (member.users?.first_name && member.users?.last_name) {
      return `${member.users.first_name} ${member.users.last_name}`
    }
    return member.users?.email || 'Unknown'
  }, [])

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [])

  // Calculate pagination info
  const totalPages = useMemo(() => {
    return Math.ceil(totalRecords / itemsPerPage) || 1
  }, [totalRecords, itemsPerPage])
  
  const startRecord = useMemo(() => {
    return totalRecords > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0
  }, [currentPage, itemsPerPage, totalRecords])
  
  const endRecord = useMemo(() => {
    return Math.min(currentPage * itemsPerPage, totalRecords)
  }, [currentPage, itemsPerPage, totalRecords])

  return (
    <DashboardLayout>
      <div className="team-members">
        {/* Header */}
        <div className="team-members-header">
          <div>
            <h1 className="team-members-title">Team Members</h1>
            <p className="team-members-subtitle">
              {team ? `Manage members of ${team.name}` : 'View and manage your team members'}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="team-members-toolbar">
          <div className="team-members-toolbar-left">
            <div className="team-members-search">
              <svg className="team-members-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                className="team-members-search-input"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="team-members-refresh-btn" title="Refresh" onClick={handleRefresh}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </div>
          <div className="team-members-toolbar-right">
            <span className="team-members-pagination-info">
              {totalRecords > 0 ? `${startRecord}-${endRecord} of ${totalRecords}` : '0 members'}
            </span>
            <button 
              className="team-members-pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <span className="team-members-page-number">{currentPage}</span>
            <button 
              className="team-members-pagination-btn"
              disabled={currentPage >= totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="team-members-filters">
          <select
            className="team-members-filter-select"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="all">All Roles</option>
            <option value="worker">Workers</option>
            <option value="supervisor">Supervisors</option>
            <option value="team_leader">Team Leaders</option>
          </select>
        </div>

        {/* Table */}
        <div className="team-members-table-container">
          {loading ? (
            <Loading message="Loading team members..." size="medium" />
          ) : error ? (
            <div className="team-members-error">
              <p>{error}</p>
            </div>
          ) : members.length === 0 ? (
            <div className="team-members-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 16px', color: '#94A3B8' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <p style={{ fontWeight: 500, color: '#0F172A', marginBottom: '4px' }}>No team members found</p>
              <p style={{ fontSize: '13px', color: '#64748B' }}>
                {searchQuery || roleFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Team members will appear here once they are added to your team'}
              </p>
            </div>
          ) : (
            <table className="team-members-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" />
                  </th>
                  <th>Member Name</th>
                  <th>Member ID</th>
                  <th>Email Address</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const memberName = getMemberName(member)
                  const avatarColor = getAvatarColor(memberName)
                  const initials = getInitials(member)
                  
                  return (
                    <tr key={member.id} className="team-members-table-row">
                      <td>
                        <input type="checkbox" />
                      </td>
                      <td>
                        <div className="team-members-member-info">
                          <div 
                            className="team-members-avatar"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initials}
                          </div>
                          <span className="team-members-member-name">{memberName}</span>
                        </div>
                      </td>
                      <td className="team-members-member-id">{member.user_id.substring(0, 8).toUpperCase()}</td>
                      <td className="team-members-email">{member.users?.email || 'N/A'}</td>
                      <td className="team-members-phone">{member.phone || 'N/A'}</td>
                      <td>
                        <span className="team-members-role-badge">
                          {member.users?.role?.toUpperCase() || 'N/A'}
                        </span>
                      </td>
                      <td>
                        <div className="team-members-actions">
                          <div className="team-members-actions-dropdown">
                            <div className="team-members-actions-header">
                              <span className="team-members-actions-label">Actions</span>
                              <button
                                className="team-members-actions-trigger"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenDropdownId(openDropdownId === member.id ? null : member.id)
                                }}
                                title="Actions"
                              >
                                <span className="team-members-actions-dots">⋮</span>
                              </button>
                            </div>
                            {openDropdownId === member.id && (
                              <div className="team-members-actions-menu">
                                <button
                                  className="team-members-action-item"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedMember(member)
                                    handleEdit()
                                    setOpenDropdownId(null)
                                  }}
                                >
                                  <span className="team-members-action-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                  </span>
                                  <span className="team-members-action-text">Edit</span>
                                </button>
                                <button
                                  className="team-members-action-item"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedMember(member)
                                    setShowViewModal(true)
                                    setOpenDropdownId(null)
                                  }}
                                >
                                  <span className="team-members-action-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                      <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                  </span>
                                  <span className="team-members-action-text">View Details</span>
                                </button>
                                <button
                                  className="team-members-action-item remove-action"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedMember(member)
                                    setShowDeleteModal(true)
                                    setOpenDropdownId(null)
                                  }}
                                >
                                  <span className="team-members-action-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6"></polyline>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                  </span>
                                  <span className="team-members-action-text">Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* View Member Details Modal */}
        {showViewModal && selectedMember && (
          <div className="team-members-modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="team-members-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="team-members-modal-header">
                <div>
                  <h2 className="team-members-modal-title">Member Details</h2>
                  <p className="team-members-modal-subtitle">{getMemberName(selectedMember)}</p>
                </div>
                <button 
                  className="team-members-modal-close"
                  onClick={() => setShowViewModal(false)}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div className="team-members-modal-body">
                <div className="team-members-details-grid">
                  <div className="team-members-detail-section">
                    <h3 className="team-members-detail-section-title">Personal Information</h3>
                    <div className="team-members-detail-item">
                      <span className="team-members-detail-label">Name:</span>
                      <span className="team-members-detail-value">{getMemberName(selectedMember)}</span>
                    </div>
                    <div className="team-members-detail-item">
                      <span className="team-members-detail-label">Email:</span>
                      <span className="team-members-detail-value">{selectedMember.users?.email || 'N/A'}</span>
                    </div>
                    <div className="team-members-detail-item">
                      <span className="team-members-detail-label">Phone:</span>
                      <span className="team-members-detail-value">{selectedMember.phone || 'N/A'}</span>
                    </div>
                    <div className="team-members-detail-item">
                      <span className="team-members-detail-label">Role:</span>
                      <span className="team-members-detail-value">{selectedMember.users?.role?.toUpperCase() || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="team-members-detail-section">
                    <h3 className="team-members-detail-section-title">Team Information</h3>
                    <div className="team-members-detail-item">
                      <span className="team-members-detail-label">Team:</span>
                      <span className="team-members-detail-value">{team?.name || 'N/A'}</span>
                    </div>
                    <div className="team-members-detail-item">
                      <span className="team-members-detail-label">Site Location:</span>
                      <span className="team-members-detail-value">{team?.site_location || 'N/A'}</span>
                    </div>
                    <div className="team-members-detail-item">
                      <span className="team-members-detail-label">Member ID:</span>
                      <span className="team-members-detail-value">{selectedMember.user_id}</span>
                    </div>
                  </div>

                  <div className="team-members-detail-section">
                    <h3 className="team-members-detail-section-title">Timeline</h3>
                    <div className="team-members-detail-item">
                      <span className="team-members-detail-label">Added:</span>
                      <span className="team-members-detail-value">{formatDate(selectedMember.created_at)}</span>
                    </div>
                    <div className="team-members-detail-item">
                      <span className="team-members-detail-label">Last Updated:</span>
                      <span className="team-members-detail-value">{formatDate(selectedMember.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="team-members-modal-footer">
                <button 
                  className="team-members-modal-close-btn"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Member Modal */}
        {showEditModal && selectedMember && (
          <>
            <div className="sidebar-overlay" onClick={() => setShowEditModal(false)}></div>
            <div className="sidebar-panel">
              <div className="sidebar-header">
                <div>
                  <h3>Edit Team Member</h3>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>{getMemberName(selectedMember)}</p>
                </div>
                <button 
                  className="sidebar-close"
                  onClick={() => setShowEditModal(false)}
                  aria-label="Close sidebar"
                  disabled={updating}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div className="sidebar-body">
                <div className="team-members-edit-form">
                  <div className="team-members-form-group">
                    <label className="team-members-form-label">First Name *</label>
                    <input
                      type="text"
                      className="team-members-form-input"
                      value={editForm.first_name}
                      onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                      placeholder="Enter first name"
                      disabled={updating}
                      maxLength={100}
                      required
                    />
                  </div>

                  <div className="team-members-form-group">
                    <label className="team-members-form-label">Last Name *</label>
                    <input
                      type="text"
                      className="team-members-form-input"
                      value={editForm.last_name}
                      onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                      placeholder="Enter last name"
                      disabled={updating}
                      maxLength={100}
                      required
                    />
                  </div>

                  <div className="team-members-form-group">
                    <label className="team-members-form-label">Phone</label>
                    <input
                      type="text"
                      className="team-members-form-input"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="Enter phone number"
                      disabled={updating}
                      maxLength={20}
                    />
                  </div>

                  <div className="team-members-form-group">
                    <label className="team-members-form-label">Role</label>
                    <input
                      type="text"
                      className="team-members-form-input"
                      value={selectedMember.users?.role?.toUpperCase() || 'N/A'}
                      disabled
                      style={{ background: '#F8FAFC', color: '#64748B', cursor: 'not-allowed' }}
                    />
                    <p style={{ fontSize: '11px', color: '#94A3B8', margin: '4px 0 0 0' }}>
                      Role cannot be changed
                    </p>
                  </div>

                  <div className="team-members-form-note">
                    <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                      Email: {selectedMember.users?.email || 'N/A'} (cannot be changed)
                    </p>
                  </div>
                </div>
              </div>

              <div className="sidebar-footer">
                <button 
                  className="team-members-modal-close-btn"
                  onClick={() => setShowEditModal(false)}
                  disabled={updating}
                >
                  Cancel
                </button>
                <button 
                  className="team-members-modal-save-btn"
                  onClick={handleUpdate}
                  disabled={updating || !editForm.first_name.trim() || !editForm.last_name.trim()}
                >
                  {updating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedMember && (
          <div className="team-members-modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="team-members-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="team-members-modal-header">
                <div>
                  <h2 className="team-members-modal-title">Delete Team Member</h2>
                  <p className="team-members-modal-subtitle">This action cannot be undone</p>
                </div>
                <button 
                  className="team-members-modal-close"
                  onClick={() => setShowDeleteModal(false)}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div className="team-members-modal-body">
                <p style={{ color: '#64748B', marginBottom: '16px' }}>
                  Are you sure you want to remove <strong>{getMemberName(selectedMember)}</strong> from your team?
                </p>
                <p style={{ color: '#94A3B8', fontSize: '13px' }}>
                  This will remove them from the team but will not delete their user account.
                </p>
              </div>

              <div className="team-members-modal-footer">
                <button 
                  className="team-members-modal-close-btn"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button 
                  className="team-members-modal-delete-btn"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete Member'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

