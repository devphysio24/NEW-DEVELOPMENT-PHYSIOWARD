import { useState, useEffect, useCallback, useMemo } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import * as XLSX from 'xlsx'
import './RecordCases.css'

interface Case {
  id: string
  caseNumber: string
  workerId: string
  workerName: string
  workerEmail: string
  workerInitials?: string
  teamId: string
  teamName: string
  siteLocation: string
  supervisorId: string | null
  supervisorName: string
  teamLeaderId: string | null
  teamLeaderName: string
  clinicianId: string | null
  clinicianName: string | null
  type: string
  reason: string
  startDate: string
  endDate: string | null
  status: 'NEW CASE' | 'IN PROGRESS' | 'CLOSED' | 'IN REHAB' | 'RETURN TO WORK' | 'TRIAGED' | 'ASSESSED'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const TYPE_LABELS: Record<string, string> = {
  accident: 'Accident',
  injury: 'Injury',
  medical_leave: 'Medical Leave',
  other: 'Other',
}

export function RecordCases() {
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const itemsPerPage = 200 // Show 200 records per page like in the image
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  // Debounce search query to reduce API calls
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch all cases
  useEffect(() => {
    let isMounted = true

    const fetchCases = async () => {
      try {
        setLoading(true)
        setError('')

        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString(),
          status: statusFilter,
          type: typeFilter,
          search: debouncedSearchQuery,
        })

        const response = await fetch(`${API_BASE_URL}/api/whs/cases?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch cases')
        }

        const data = await response.json()
        
        if (isMounted) {
          setCases(data.cases || [])
          setTotalRecords(data.pagination?.total || data.cases?.length || 0)
        }
      } catch (err: any) {
        console.error('Error fetching cases:', err)
        if (isMounted) {
          setError(err.message || 'Failed to load cases')
          setCases([])
          setTotalRecords(0)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchCases()

    return () => {
      isMounted = false
    }
  }, [currentPage, statusFilter, typeFilter, debouncedSearchQuery, refreshKey])

  // Use cases directly from API (backend handles sorting for better performance)
  // No client-side sorting needed - reduces memory usage and improves performance
  const displayedCases = useMemo(() => {
    return cases
  }, [cases])

  const handleRefresh = () => {
    setCurrentPage(1)
    setRefreshKey(prev => prev + 1)
  }

  const getStatusStyle = useCallback((status: string) => {
    switch (status) {
      case 'NEW CASE':
        return { bg: '#DBEAFE', color: '#3B82F6' }
      case 'TRIAGED':
        return { bg: '#E9D5FF', color: '#8B5CF6' }
      case 'ASSESSED':
        return { bg: '#FEF3C7', color: '#F59E0B' }
      case 'IN PROGRESS':
        return { bg: '#FEF2F2', color: '#EF4444' }
      case 'IN REHAB':
        return { bg: '#D1FAE5', color: '#10B981' }
      case 'RETURN TO WORK':
        return { bg: '#CFFAFE', color: '#06B6D4' }
      case 'CLOSED':
        return { bg: '#F3F4F6', color: '#6B7280' }
      default:
        return { bg: '#F3F4F6', color: '#6B7280' }
    }
  }, [])

  const getAvatarColor = useCallback((name: string) => {
    const colors = [
      '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
      '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }, [])

  const getInitials = useCallback((name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }, [])

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }, [])

  const handleDownloadExcel = useCallback(async () => {
    // Prevent multiple simultaneous exports
    if (exporting) return

    const abortController = new AbortController()
    
    try {
      setExporting(true)
      setError('')

      // Calculate max limit (backend allows up to 1000 per request)
      const maxLimit = Math.min(totalRecords || 1000, 1000)
      
      // Fetch all cases for export (respecting current filters)
      // Use maximum limit to get all records in one request if possible
      const params = new URLSearchParams({
        page: '1',
        limit: maxLimit.toString(),
        status: statusFilter,
        type: typeFilter,
        search: debouncedSearchQuery,
      })

      const response = await fetch(`${API_BASE_URL}/api/whs/cases?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch cases for export')
      }

      const data = await response.json()
      const allCases = data.cases || []

      if (!allCases || allCases.length === 0) {
        setError('No cases to export')
        setExporting(false)
        return
      }

      // Optimize: Prepare data for Excel export (memoized transformation)
      // Use pre-allocated array for better performance
      const excelData = new Array(allCases.length)
      const typeLabelsCache = TYPE_LABELS
      
      for (let i = 0; i < allCases.length; i++) {
        const caseItem = allCases[i]
        excelData[i] = {
          'Worker Name': caseItem.workerName || '',
          'Case ID': caseItem.caseNumber || '',
          'Email Address': caseItem.workerEmail || '',
          'Incident Type': typeLabelsCache[caseItem.type] || caseItem.type || '',
          'Team': caseItem.teamName || '',
          'Status': caseItem.status || '',
          'Actions': 'View Details'
        }
      }

      // Create workbook and worksheet efficiently
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Cases')

      // Set optimized column widths
      worksheet['!cols'] = [
        { wch: 25 }, // Worker Name
        { wch: 15 }, // Case ID
        { wch: 30 }, // Email Address
        { wch: 18 }, // Incident Type
        { wch: 20 }, // Team
        { wch: 15 }, // Status
        { wch: 15 }  // Actions
      ]

      // Generate filename with timestamp for uniqueness
      const date = new Date()
      const dateStr = date.toISOString().split('T')[0]
      const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-')
      const filename = `cases_export_${dateStr}_${timeStr}.xlsx`

      // Write file and trigger download (non-blocking)
      XLSX.writeFile(workbook, filename)
      
    } catch (error: any) {
      // Don't show error if user cancelled
      if (error.name === 'AbortError') {
        return
      }
      console.error('Error exporting to Excel:', error)
      setError(error.message || 'Failed to export Excel file. Please try again.')
    } finally {
      setExporting(false)
    }
  }, [totalRecords, statusFilter, typeFilter, debouncedSearchQuery, exporting])

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
      <div className="record-cases">
        {/* Header */}
        <div className="record-cases-header">
          <div>
            <h1 className="record-cases-title">Record Cases</h1>
            <p className="record-cases-subtitle">View and manage all case records</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="record-cases-toolbar">
          <div className="record-cases-toolbar-left">
            <button className="record-cases-add-btn" title="Add New Record">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <div className="record-cases-search">
              <svg className="record-cases-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                className="record-cases-search-input"
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="record-cases-filter-btn" title="Filter">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
            </button>
            <button className="record-cases-refresh-btn" title="Refresh" onClick={handleRefresh}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
            <button 
              className="record-cases-download-btn" 
              title={exporting ? 'Exporting...' : 'Download Excel'} 
              onClick={handleDownloadExcel}
              disabled={displayedCases.length === 0 || loading || exporting}
            >
              {exporting ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                  <path d="M12 2 A10 10 0 0 1 22 12" strokeLinecap="round"></path>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              )}
            </button>
          </div>
          <div className="record-cases-toolbar-right">
            <span className="record-cases-pagination-info">
              {totalRecords > 0 ? `${startRecord}-${endRecord} of ${totalRecords}` : '0 records'}
            </span>
            <button 
              className="record-cases-pagination-btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <span className="record-cases-page-number">{currentPage}</span>
            <button 
              className="record-cases-pagination-btn"
              disabled={currentPage >= totalPages || totalPages === 0}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <button className="record-cases-view-btn" title="View Options">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="record-cases-filters">
          <select
            className="record-cases-filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="all">All Status</option>
            <option value="new">New Cases</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          <select
            className="record-cases-filter-select"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setCurrentPage(1)
            }}
          >
            <option value="all">All Types</option>
            <option value="accident">Accident</option>
            <option value="injury">Injury</option>
            <option value="medical_leave">Medical Leave</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Table */}
        <div className="record-cases-table-container">
          {loading ? (
            <Loading message="Loading case records..." size="medium" />
          ) : error ? (
            <div className="record-cases-error">
              <p>{error}</p>
            </div>
          ) : displayedCases.length === 0 ? (
            <div className="record-cases-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 16px', color: '#94A3B8' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <p style={{ fontWeight: 500, color: '#0F172A', marginBottom: '4px' }}>No cases found</p>
              <p style={{ fontSize: '13px', color: '#64748B' }}>
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Cases will appear here when they are reported'}
              </p>
            </div>
          ) : (
            <table className="record-cases-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" />
                  </th>
                  <th>Worker Name</th>
                  <th>Case ID</th>
                  <th>Email Address</th>
                  <th>Incident Type</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedCases.map((caseItem) => {
                  const statusStyleObj = getStatusStyle(caseItem.status)
                  const statusStyle = { backgroundColor: statusStyleObj.bg, color: statusStyleObj.color }
                  const avatarColor = getAvatarColor(caseItem.workerName)
                  const initials = getInitials(caseItem.workerName)
                  
                  return (
                    <tr key={caseItem.id}>
                      <td>
                        <input type="checkbox" />
                      </td>
                      <td>
                        <div className="record-cases-worker-info">
                          <div 
                            className="record-cases-avatar"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initials}
                          </div>
                          <span className="record-cases-worker-name">{caseItem.workerName}</span>
                        </div>
                      </td>
                      <td className="record-cases-case-id">{caseItem.caseNumber}</td>
                      <td className="record-cases-email">{caseItem.workerEmail}</td>
                      <td className="record-cases-type">{TYPE_LABELS[caseItem.type] || caseItem.type}</td>
                      <td className="record-cases-team">{caseItem.teamName}</td>
                      <td>
                        <span className="record-cases-status-badge" style={statusStyle}>
                          {caseItem.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="record-cases-view-details"
                          onClick={() => {
                            setSelectedCase(caseItem)
                            setShowViewModal(true)
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* View Case Details Modal */}
        {showViewModal && selectedCase && (
          <div className="record-cases-modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="record-cases-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="record-cases-modal-header">
                <div>
                  <h2 className="record-cases-modal-title">Case Details</h2>
                  <p className="record-cases-modal-subtitle">{selectedCase.caseNumber}</p>
                </div>
                <button 
                  className="record-cases-modal-close"
                  onClick={() => setShowViewModal(false)}
                  aria-label="Close modal"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div className="record-cases-modal-body">
                <div className="record-cases-details-grid">
                  <div className="record-cases-detail-section">
                    <h3 className="record-cases-detail-section-title">Case Information</h3>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Case Number:</span>
                      <span className="record-cases-detail-value">{selectedCase.caseNumber}</span>
                    </div>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Status:</span>
                      <span className="record-cases-status-badge" style={getStatusStyle(selectedCase.status)}>
                        {selectedCase.status}
                      </span>
                    </div>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Severity:</span>
                      <span className="record-cases-detail-value">{selectedCase.severity}</span>
                    </div>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Incident Type:</span>
                      <span className="record-cases-detail-value">{TYPE_LABELS[selectedCase.type] || selectedCase.type}</span>
                    </div>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Created:</span>
                      <span className="record-cases-detail-value">{formatDate(selectedCase.createdAt)}</span>
                    </div>
                  </div>

                  <div className="record-cases-detail-section">
                    <h3 className="record-cases-detail-section-title">Worker Information</h3>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Name:</span>
                      <span className="record-cases-detail-value">{selectedCase.workerName}</span>
                    </div>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Email:</span>
                      <span className="record-cases-detail-value">{selectedCase.workerEmail}</span>
                    </div>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Team:</span>
                      <span className="record-cases-detail-value">{selectedCase.teamName}</span>
                    </div>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Site Location:</span>
                      <span className="record-cases-detail-value">{selectedCase.siteLocation || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="record-cases-detail-section">
                    <h3 className="record-cases-detail-section-title">Incident Details</h3>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Start Date:</span>
                      <span className="record-cases-detail-value">{formatDate(selectedCase.startDate)}</span>
                    </div>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">End Date:</span>
                      <span className="record-cases-detail-value">{selectedCase.endDate ? formatDate(selectedCase.endDate) : 'Ongoing'}</span>
                    </div>
                    <div className="record-cases-detail-item">
                      <span className="record-cases-detail-label">Reason:</span>
                      <span className="record-cases-detail-value">{selectedCase.reason || 'No reason provided'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="record-cases-modal-footer">
                <button 
                  className="record-cases-modal-close-btn"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

