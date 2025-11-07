import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { API_BASE_URL } from '../../../config/api'
import { useAuth } from '../../../contexts/AuthContext'
import { getStatusLabel, getStatusPriority, getStatusInlineStyle } from '../../../utils/caseStatus'
import './ClinicianDashboard.css'

interface Case {
  id: string
  caseNumber: string
  workerId: string
  workerName: string
  workerEmail: string
  workerInitials: string
  teamId: string
  teamName: string
  siteLocation: string
  supervisorId: string | null
  supervisorName: string
  teamLeaderId: string | null
  teamLeaderName: string
  type: string
  reason: string
  startDate: string
  endDate: string | null
  status: 'NEW CASE' | 'ACTIVE' | 'TRIAGED' | 'ASSESSED' | 'IN REHAB' | 'RETURN TO WORK' | 'CLOSED'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  isActive: boolean
  isInRehab: boolean
  createdAt: string
  updatedAt: string
  approvedBy?: string | null
  approvedAt?: string | null
}

interface RehabilitationPlan {
  id: string
  exceptionId: string
  caseNumber: string
  workerId: string
  workerName: string
  workerEmail: string
  teamName: string
  siteLocation: string
  duration: number
  startDate: string
  endDate: string
  progress: number
  currentDay: number
  daysCompleted: number
  status: 'active' | 'completed' | 'cancelled'
  notes: string
  createdAt: string
  updatedAt: string
}

interface Summary {
  total: number
  active: number
  completed: number
  inRehab: number
  pendingConfirmation: number
}

const TYPE_LABELS: Record<string, string> = {
  injury: 'Injury',
  accident: 'Accident',
  medical_leave: 'Medical Leave',
  other: 'Other',
}

// Status labels are now imported from utils/caseStatus

export function ClinicianDashboard() {
  const { user, first_name, full_name, business_name } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [rehabilitationPlans, setRehabilitationPlans] = useState<RehabilitationPlan[]>([])
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    active: 0,
    completed: 0,
    inRehab: 0,
    pendingConfirmation: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [successMessage, setSuccessMessage] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false)
  const [selectedCaseForPlan, setSelectedCaseForPlan] = useState<Case | null>(null)
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [createPlanForm, setCreatePlanForm] = useState({
    plan_name: 'Recovery Plan',
    plan_description: 'Daily recovery exercises and activities',
    duration_days: 7,
    start_date: new Date().toISOString().split('T')[0], // Default to today (YYYY-MM-DD)
  })
  const [exercises, setExercises] = useState<Array<{
    exercise_name: string
    repetitions: string
    instructions: string
    video_url: string
  }>>([
    {
      exercise_name: '',
      repetitions: '',
      instructions: '',
      video_url: '',
    }
  ])
  const [creatingPlan, setCreatingPlan] = useState(false)
  const [showCaseSelection, setShowCaseSelection] = useState(true)
  const [selectedPlanForProgress, setSelectedPlanForProgress] = useState<RehabilitationPlan | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressData, setProgressData] = useState<any>(null)
  const [loadingProgress, setLoadingProgress] = useState(false)
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<RehabilitationPlan | null>(null)
  const [showEditPlanModal, setShowEditPlanModal] = useState(false)
  const [editPlanForm, setEditPlanForm] = useState({
    duration_days: 7,
    start_date: '',
    notes: '',
  })
  const [updatingPlan, setUpdatingPlan] = useState(false)
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open')

  const userName = first_name || full_name || user?.email?.split('@')[0] || 'Dr. Clinician'

  // Fetch data
  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')

        const [casesRes, plansRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/clinician/cases?status=all&limit=100`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            signal: abortController.signal,
          }),
          fetch(`${API_BASE_URL}/api/clinician/rehabilitation-plans?status=active`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            signal: abortController.signal,
          }),
        ])

        if (!isMounted) return

        if (!casesRes.ok || !plansRes.ok) {
          const errorText = casesRes.ok 
            ? await plansRes.json().catch(() => ({ error: 'Failed to fetch rehabilitation plans' }))
            : await casesRes.json().catch(() => ({ error: 'Failed to fetch cases' }))
          throw new Error(errorText.error || 'Failed to fetch data')
        }

        const casesData = await casesRes.json()
        const plansData = await plansRes.json()

        if (isMounted) {
          // Extract approval information from notes for each case
          const casesWithApproval = (casesData.cases || []).map((caseItem: any) => {
            let approvedBy: string | null = null
            let approvedAt: string | null = null
            
            if (caseItem.notes) {
              try {
                const notesData = JSON.parse(caseItem.notes)
                if (notesData.approved_by) {
                  approvedBy = notesData.approved_by
                }
                if (notesData.approved_at) {
                  approvedAt = notesData.approved_at
                }
              } catch {
                // Notes is not JSON, ignore
              }
            }
            
            return {
              ...caseItem,
              approvedBy,
              approvedAt,
            }
          })
          
          setCases(casesWithApproval)
          setRehabilitationPlans(plansData.plans || [])
          setSummary(casesData.summary || {
            total: 0,
            active: 0,
            completed: 0,
            inRehab: 0,
            pendingConfirmation: 0,
          })
        }
      } catch (err: any) {
        // Don't set error if request was aborted
        if (err.name === 'AbortError') {
          return
        }
        console.error('Error fetching data:', err)
        if (isMounted) {
          const errorMessage = err.message || 'Failed to load data'
          setError(errorMessage)
          // Clear error after 5 seconds
          setTimeout(() => {
            if (isMounted) setError('')
          }, 5000)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleCreatePlan = (caseItem?: Case) => {
    if (caseItem) {
      setSelectedCaseForPlan(caseItem)
      setShowCaseSelection(false)
      // Initialize form with today's date as default start_date
      setCreatePlanForm({
        plan_name: 'Recovery Plan',
        plan_description: 'Daily recovery exercises and activities',
        duration_days: 7,
        start_date: new Date().toISOString().split('T')[0],
      })
    } else {
      setShowCaseSelection(true)
      setSelectedCaseForPlan(null)
    }
    setShowCreatePlanModal(true)
  }

  const handleCaseSelect = (caseItem: Case) => {
    setSelectedCaseForPlan(caseItem)
    setShowCaseSelection(false)
    setCreatePlanForm({
      plan_name: 'Recovery Plan',
      plan_description: 'Daily recovery exercises and activities',
      duration_days: 7,
      start_date: new Date().toISOString().split('T')[0],
    })
    setExercises([
      {
        exercise_name: '',
        repetitions: '',
        instructions: '',
        video_url: '',
      }
    ])
  }

  const handleBackToSelection = () => {
    setShowCaseSelection(true)
    setSelectedCaseForPlan(null)
    setCreatePlanForm({
      plan_name: 'Recovery Plan',
      plan_description: 'Daily recovery exercises and activities',
      duration_days: 7,
      start_date: new Date().toISOString().split('T')[0],
    })
    setExercises([
      {
        exercise_name: '',
        repetitions: '',
        instructions: '',
        video_url: '',
      }
    ])
  }

  const handleCloseCreatePlanModal = () => {
    setShowCreatePlanModal(false)
    setShowCaseSelection(true)
    setSelectedCaseForPlan(null)
    setCreatePlanForm({
      plan_name: 'Recovery Plan',
      plan_description: 'Daily recovery exercises and activities',
      duration_days: 7,
      start_date: new Date().toISOString().split('T')[0],
    })
    setExercises([
      {
        exercise_name: '',
        repetitions: '',
        instructions: '',
        video_url: '',
      }
    ])
  }

  const handleAddExercise = () => {
    setExercises([...exercises, {
      exercise_name: '',
      repetitions: '',
      instructions: '',
      video_url: '',
    }])
  }

  const handleRemoveExercise = (index: number) => {
    if (exercises.length > 1) {
      setExercises(exercises.filter((_, i) => i !== index))
    }
  }

  const handleExerciseChange = (index: number, field: string, value: string) => {
    const updatedExercises = [...exercises]
    updatedExercises[index] = { ...updatedExercises[index], [field]: value }
    setExercises(updatedExercises)
  }

  const handleSubmitPlan = async () => {
    // Clear previous errors
    setError('')
    
    // Frontend validation
    if (!selectedCaseForPlan) {
      setError('Please select a case for the rehabilitation plan')
      return
    }
    
    if (!createPlanForm.plan_name?.trim()) {
      setError('Plan name is required')
      return
    }
    
    if (!createPlanForm.duration_days || createPlanForm.duration_days < 1) {
      setError('Duration must be at least 1 day')
      return
    }
    
    if (createPlanForm.duration_days > 365) {
      setError('Duration cannot exceed 365 days')
      return
    }
    
    if (!createPlanForm.start_date) {
      setError('Start date is required')
      return
    }
    
    // Validate start_date is not in the past
    const selectedDate = new Date(createPlanForm.start_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDate.setHours(0, 0, 0, 0)
    
    if (selectedDate < today) {
      setError('Start date cannot be in the past')
      return
    }

    // Validate exercises
    const validExercises = exercises.filter(ex => ex.exercise_name?.trim())
    if (validExercises.length === 0) {
      setError('Please add at least one exercise')
      return
    }

    // Validate all exercises have names
    for (let i = 0; i < exercises.length; i++) {
      if (exercises[i].exercise_name?.trim() && !exercises[i].exercise_name.trim()) {
        setError(`Exercise ${i + 1} must have a name`)
        return
      }
    }

    // Validate exercise names length
    for (let i = 0; i < validExercises.length; i++) {
      if (validExercises[i].exercise_name.trim().length > 255) {
        setError(`Exercise ${i + 1} name is too long (max 255 characters)`)
        return
      }
    }

    try {
      setCreatingPlan(true)
      setError('')

      // Ensure start_date is in YYYY-MM-DD format
      const startDateFormatted = createPlanForm.start_date.split('T')[0]
      
      console.log('[DEBUG] Submitting plan with:', {
        exception_id: selectedCaseForPlan.id,
        plan_name: createPlanForm.plan_name,
        duration_days: createPlanForm.duration_days,
        start_date: startDateFormatted,
        exercises_count: validExercises.length
      })

      const response = await fetch(`${API_BASE_URL}/api/clinician/rehabilitation-plans`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exception_id: selectedCaseForPlan.id,
          plan_name: createPlanForm.plan_name.trim(),
          plan_description: createPlanForm.plan_description?.trim() || '',
          duration_days: createPlanForm.duration_days,
          start_date: startDateFormatted, // Send in YYYY-MM-DD format
          exercises: validExercises.map(ex => ({
            exercise_name: ex.exercise_name.trim(),
            repetitions: ex.repetitions?.trim() || '',
            instructions: ex.instructions?.trim() || '',
            video_url: ex.video_url?.trim() || '',
          })),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create plan')
      }

      setSuccessMessage('Rehabilitation plan created successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      handleCloseCreatePlanModal()
      handleRefresh()
    } catch (err: any) {
      console.error('Error creating plan:', err)
      setError(err.message || 'Failed to create rehabilitation plan')
      // Clear error after 5 seconds
      setTimeout(() => setError(''), 5000)
    } finally {
      setCreatingPlan(false)
    }
  }

  const handleUpdatePlanStatus = async (planId: string, status: 'completed' | 'cancelled') => {
    if (!confirm(`Are you sure you want to ${status === 'completed' ? 'complete' : 'cancel'} this rehabilitation plan?`)) {
      return
    }

    setError('')
    try {
      // Validate planId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(planId)) {
        throw new Error('Invalid plan ID')
      }

      const response = await fetch(`${API_BASE_URL}/api/clinician/rehabilitation-plans/${planId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update plan')
      }

      setSuccessMessage(`Rehabilitation plan ${status === 'completed' ? 'completed' : 'cancelled'} successfully`)
      setTimeout(() => setSuccessMessage(''), 3000)
      handleRefresh()
    } catch (err: any) {
      console.error('Error updating plan:', err)
      setError(err.message || 'Failed to update rehabilitation plan')
      setTimeout(() => setError(''), 5000)
    }
  }

  const handleEditPlan = (plan: RehabilitationPlan) => {
    setSelectedPlanForEdit(plan)
    // Calculate duration from start_date and end_date if available, otherwise use plan.duration
    const startDate = new Date(plan.startDate)
    const endDate = plan.endDate ? new Date(plan.endDate) : null
    const calculatedDuration = endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 : plan.duration
    
    setEditPlanForm({
      duration_days: calculatedDuration,
      start_date: plan.startDate.split('T')[0], // Format to YYYY-MM-DD
      notes: plan.notes || '',
    })
    setShowEditPlanModal(true)
  }

  const handleCloseEditPlanModal = () => {
    setShowEditPlanModal(false)
    setSelectedPlanForEdit(null)
    setEditPlanForm({
      duration_days: 7,
      start_date: '',
      notes: '',
    })
  }

  const handleUpdatePlan = async () => {
    if (!selectedPlanForEdit) return

    setError('')

    // Validate form
    if (!editPlanForm.start_date) {
      setError('Start date is required')
      return
    }
    
    if (!editPlanForm.duration_days || editPlanForm.duration_days < 1) {
      setError('Duration must be at least 1 day')
      return
    }
    
    if (editPlanForm.duration_days > 365) {
      setError('Duration cannot exceed 365 days')
      return
    }

    // Validate start_date is not in the past
    const selectedDate = new Date(editPlanForm.start_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    selectedDate.setHours(0, 0, 0, 0)
    
    if (selectedDate < today) {
      setError('Start date cannot be in the past')
      return
    }

    try {
      setUpdatingPlan(true)

      // Calculate end_date based on start_date and duration
      const startDate = new Date(editPlanForm.start_date)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + editPlanForm.duration_days - 1)

      const updatePayload: any = {
        start_date: editPlanForm.start_date.split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        notes: editPlanForm.notes || null,
      }

      // Validate planId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(selectedPlanForEdit.id)) {
        throw new Error('Invalid plan ID')
      }

      const response = await fetch(`${API_BASE_URL}/api/clinician/rehabilitation-plans/${selectedPlanForEdit.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update plan')
      }

      setSuccessMessage('Rehabilitation plan updated successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      handleCloseEditPlanModal()
      handleRefresh()
    } catch (err: any) {
      console.error('Error updating plan:', err)
      setError(err.message || 'Failed to update rehabilitation plan')
      setTimeout(() => setError(''), 5000)
    } finally {
      setUpdatingPlan(false)
    }
  }

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
  }, [])

  const formatDateLong = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }, [])

  const handleViewProgress = async (plan: RehabilitationPlan) => {
    setSelectedPlanForProgress(plan)
    setShowProgressModal(true)
    setLoadingProgress(true)
    setError('')
    
    try {
      // Validate planId is a valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(plan.id)) {
        throw new Error('Invalid plan ID')
      }

      const response = await fetch(`${API_BASE_URL}/api/clinician/rehabilitation-plans/${plan.id}/progress`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch progress data')
      }
      
      const data = await response.json()
      setProgressData(data)
    } catch (err: any) {
      console.error('Error fetching progress:', err)
      setError(err.message || 'Failed to load progress data')
      setTimeout(() => setError(''), 5000)
    } finally {
      setLoadingProgress(false)
    }
  }

  // Status style is now imported from utils/caseStatus
  // Using getStatusStyle from utils for consistency

  const getPriorityStyle = useCallback((priority: string) => {
    switch (priority) {
      case 'HIGH':
        return { bg: '#FEE2E2', color: '#EF4444' }
      case 'MEDIUM':
        return { bg: '#FEF3C7', color: '#F59E0B' }
      case 'LOW':
        return { bg: '#E0E7FF', color: '#6366F1' }
      default:
        return { bg: '#F3F4F6', color: '#6B7280' }
    }
  }, [])

  const getAvatarColor = useCallback((name: string) => {
    const colors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6']
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }, [])

  const activePlans = useMemo(() => rehabilitationPlans.filter(p => p.status === 'active'), [rehabilitationPlans])
  const sortedCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      // Sort by status priority using centralized utility
      const aOrder = getStatusPriority(a.status)
      const bOrder = getStatusPriority(b.status)
      if (aOrder !== bOrder) return aOrder - bOrder
      // Then by created date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [cases])

  // Filter cases based on active tab
  const filteredCases = useMemo(() => {
    if (activeTab === 'closed') {
      return sortedCases.filter(c => c.status === 'CLOSED')
    } else {
      return sortedCases.filter(c => c.status !== 'CLOSED')
    }
  }, [sortedCases, activeTab])

  // Available cases for creating rehabilitation plans (ACTIVE or IN REHAB status, but without an active plan)
  // OPTIMIZATION: Uses useMemo to prevent unnecessary recalculations, only re-runs when sortedCases changes
  // SECURITY: Backend validates clinician_id and prevents duplicate plans - this filter is for UI convenience only
  const availableCasesForPlan = useMemo(() => {
    return sortedCases.filter(c => 
      (c.status === 'ACTIVE' || c.status === 'IN REHAB') && !c.isInRehab
    )
  }, [sortedCases])

  return (
    <DashboardLayout>
      <div className="clinician-dashboard">
        {/* Header */}
        <div className="clinician-header">
          <div>
            <h1 className="clinician-title">Clinician Dashboard</h1>
            <p className="clinician-subtitle">
              Welcome back, {userName}
              {business_name && <span> • {business_name}</span>}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="clinician-error-banner" style={{
            padding: '12px 16px',
            margin: '16px 0',
            backgroundColor: '#FEE2E2',
            border: '1px solid #FCA5A5',
            borderRadius: '8px',
            color: '#DC2626',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="clinician-success-banner" style={{
            padding: '12px 16px',
            margin: '16px 0',
            backgroundColor: '#D1FAE5',
            border: '1px solid #6EE7B7',
            borderRadius: '8px',
            color: '#065F46',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="clinician-summary-grid">
          <div className="clinician-summary-card">
            <div className="clinician-summary-icon" style={{ backgroundColor: '#F3F4F6' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div className="clinician-summary-content">
              <p className="clinician-summary-label">Total Cases</p>
              <p className="clinician-summary-value">{summary.total}</p>
            </div>
          </div>

          <div className="clinician-summary-card">
            <div className="clinician-summary-icon" style={{ backgroundColor: '#FEF3C7' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div className="clinician-summary-content">
              <p className="clinician-summary-label">Active Cases</p>
              <p className="clinician-summary-value">{summary.active}</p>
            </div>
          </div>

          <div className="clinician-summary-card">
            <div className="clinician-summary-icon" style={{ backgroundColor: '#F3F4F6' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <div className="clinician-summary-content">
              <p className="clinician-summary-label">Completed Cases</p>
              <p className="clinician-summary-value">{summary.completed}</p>
            </div>
          </div>

          <div className="clinician-summary-card">
            <div className="clinician-summary-icon" style={{ backgroundColor: '#ECFDF5' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div className="clinician-summary-content">
              <p className="clinician-summary-label">Pending Confirmation</p>
              <p className="clinician-summary-value">{summary.pendingConfirmation}</p>
            </div>
          </div>
        </div>

        {/* View Tasks Button */}
        <div className="clinician-actions">
          <button className="clinician-view-tasks-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            View Tasks
          </button>
        </div>

        {/* Active Rehabilitation Plans Section */}
        <div className="clinician-section">
          <div className="clinician-section-header">
            <div>
              <h2 className="clinician-section-title">Active Rehabilitation Plans</h2>
              <p className="clinician-section-subtitle">
                Showing {activePlans.length > 0 ? `1-${activePlans.length}` : '0'} of {activePlans.length} plans
              </p>
            </div>
            <div className="clinician-section-actions">
              <button 
                className="clinician-create-plan-btn"
                onClick={() => handleCreatePlan()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Plan
              </button>
              <button className="clinician-refresh-btn" onClick={handleRefresh} title="Refresh">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <Loading message="Loading rehabilitation plans..." size="medium" />
          ) : activePlans.length === 0 ? (
            <div className="clinician-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 16px', color: '#94A3B8' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <p style={{ fontWeight: 500, color: '#0F172A', marginBottom: '4px' }}>No active rehabilitation plans</p>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Create a rehabilitation plan for a case to get started</p>
            </div>
          ) : (
            <div className="clinician-plans-grid">
              {activePlans.map((plan) => (
                <div key={plan.id} className="clinician-plan-card">
                  <div className="clinician-plan-header">
                    <span className="clinician-plan-status-badge active">Active</span>
                  </div>
                  <div className="clinician-plan-body">
                    <div className="clinician-plan-info">
                      <div className="clinician-plan-info-item">
                        <span className="clinician-plan-label">Case:</span>
                        <span className="clinician-plan-value">{plan.caseNumber}</span>
                      </div>
                      <div className="clinician-plan-info-item">
                        <span className="clinician-plan-label">Worker:</span>
                        <span className="clinician-plan-value">{plan.workerName}</span>
                      </div>
                      <div className="clinician-plan-info-item">
                        <span className="clinician-plan-label">Duration:</span>
                        <span className="clinician-plan-value">{plan.duration} days</span>
                      </div>
                      <div className="clinician-plan-info-item">
                        <span className="clinician-plan-label">Progress:</span>
                        <span className="clinician-plan-value">
                          Day {plan.currentDay} of {plan.duration} ({plan.progress}%)
                        </span>
                      </div>
                    </div>
                    <div className="clinician-plan-progress-section">
                      <div className="clinician-plan-progress-label">
                        Current Day: Day {plan.currentDay} ({plan.daysCompleted} days completed)
                      </div>
                      <div className="clinician-plan-progress-bar">
                        <div 
                          className="clinician-plan-progress-fill"
                          style={{ width: `${plan.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="clinician-plan-actions">
                    <button 
                      className="clinician-plan-action-btn"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleViewProgress(plan)
                      }}
                      type="button"
                      style={{ position: 'relative', zIndex: 1 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                      </svg>
                      View Progress
                    </button>
                    <button 
                      className="clinician-plan-action-btn"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                      Edit
                    </button>
                    <button 
                      className="clinician-plan-action-btn complete"
                      onClick={() => handleUpdatePlanStatus(plan.id, 'completed')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Complete
                    </button>
                    <button 
                      className="clinician-plan-action-btn cancel"
                      onClick={() => handleUpdatePlanStatus(plan.id, 'cancelled')}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Cases Section */}
        <div className="clinician-section">
          <div className="clinician-section-header">
            <div>
              <h2 className="clinician-section-title">My Cases</h2>
            </div>
            <button className="clinician-refresh-btn" onClick={handleRefresh} title="Refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="clinician-tabs">
            <button
              className={`clinician-tab ${activeTab === 'open' ? 'active' : ''}`}
              onClick={() => setActiveTab('open')}
            >
              Open
              <span className="clinician-tab-count">
                {sortedCases.filter(c => c.status !== 'CLOSED').length}
              </span>
            </button>
            <button
              className={`clinician-tab ${activeTab === 'closed' ? 'active' : ''}`}
              onClick={() => setActiveTab('closed')}
            >
              Closed
              <span className="clinician-tab-count">
                {sortedCases.filter(c => c.status === 'CLOSED').length}
              </span>
            </button>
          </div>

          {loading ? (
            <Loading message="Loading cases..." size="medium" />
          ) : error ? (
            <div className="clinician-error">
              <p>{error}</p>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="clinician-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 16px', color: '#94A3B8' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              <p style={{ fontWeight: 500, color: '#0F172A', marginBottom: '4px' }}>
                No {activeTab === 'closed' ? 'closed' : 'open'} cases found
              </p>
              <p style={{ fontSize: '13px', color: '#64748B' }}>
                {activeTab === 'closed' 
                  ? 'No closed cases at this time' 
                  : 'Cases will appear here when workers need medical attention'}
              </p>
            </div>
          ) : (
            <div className="clinician-table-card">
              <div className="clinician-table-container">
                <table className="clinician-table">
                  <thead>
                    <tr>
                      <th>CASE #</th>
                      <th>WORKER</th>
                      <th>INCIDENT</th>
                      <th>STATUS</th>
                      <th>PRIORITY</th>
                      <th>CREATED</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.map((caseItem) => {
                      // Optimized: Use centralized utilities for status styling
                      const statusStyle = getStatusInlineStyle(caseItem.status)
                      const priorityStyleObj = getPriorityStyle(caseItem.priority)
                      const priorityStyle = { backgroundColor: priorityStyleObj.bg, color: priorityStyleObj.color }
                      const avatarColor = getAvatarColor(caseItem.workerName)
                      
                      return (
                        <tr key={caseItem.id}>
                          <td className="clinician-case-number">{caseItem.caseNumber}</td>
                          <td>
                            <div className="clinician-worker-info">
                              <div 
                                className="clinician-worker-avatar"
                                style={{ backgroundColor: avatarColor }}
                              >
                                {caseItem.workerInitials}
                              </div>
                              <div>
                                <div className="clinician-worker-name">{caseItem.workerName}</div>
                                <div className="clinician-worker-email">{caseItem.workerEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="clinician-incident-info">
                              <div className="clinician-incident-type">
                                {TYPE_LABELS[caseItem.type] || caseItem.type}
                              </div>
                              <div className="clinician-incident-detail">
                                {caseItem.reason || 'Medical Treatment'}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="clinician-status-badge" style={statusStyle}>
                              {getStatusLabel(caseItem.status)}
                            </span>
                          </td>
                          <td>
                            <span className="clinician-priority-badge" style={priorityStyle}>
                              {caseItem.priority}
                            </span>
                          </td>
                          <td className="clinician-date">{formatDate(caseItem.createdAt)}</td>
                          <td>
                            <button 
                              className="clinician-action-btn"
                              onClick={() => {
                                setSelectedCase(caseItem)
                                setShowViewModal(true)
                              }}
                              title="View case details"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Plan Modal */}
      {showCreatePlanModal && (
        <div className="clinician-modal-overlay" onClick={handleCloseCreatePlanModal}>
          <div className="clinician-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="clinician-modal-header">
              <h2 className="clinician-modal-title">
                {showCaseSelection ? 'Select Worker for Rehabilitation Plan' : 'Create Rehabilitation Plan'}
              </h2>
              <button 
                className="clinician-modal-close"
                onClick={handleCloseCreatePlanModal}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="clinician-modal-body">
              {showCaseSelection ? (
                <>
                  {availableCasesForPlan.length === 0 ? (
                    <div className="clinician-empty" style={{ padding: '40px 20px' }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: '0 auto 16px', color: '#94A3B8' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                      </svg>
                      <p style={{ fontWeight: 500, color: '#0F172A', marginBottom: '4px' }}>No available cases</p>
                      <p style={{ fontSize: '13px', color: '#64748B' }}>All active cases already have rehabilitation plans</p>
                    </div>
                  ) : (
                    <div className="clinician-case-selection-list">
                      {availableCasesForPlan.map((caseItem) => {
                        const avatarColor = getAvatarColor(caseItem.workerName)
                        const statusStyle = getStatusInlineStyle(caseItem.status)
                        const priorityStyleObj = getPriorityStyle(caseItem.priority)
                        const priorityStyle = { backgroundColor: priorityStyleObj.bg, color: priorityStyleObj.color }
                        
                        return (
                          <div 
                            key={caseItem.id}
                            className="clinician-case-selection-item"
                            onClick={() => handleCaseSelect(caseItem)}
                          >
                            <div className="clinician-case-selection-content">
                              <div 
                                className="clinician-worker-avatar"
                                style={{ backgroundColor: avatarColor }}
                              >
                                {caseItem.workerInitials}
                              </div>
                              <div className="clinician-case-selection-info">
                                <div className="clinician-case-selection-header">
                                  <span className="clinician-case-selection-name">{caseItem.workerName}</span>
                                  <span className="clinician-case-number">{caseItem.caseNumber}</span>
                                </div>
                                <div className="clinician-case-selection-details">
                                  <span className="clinician-status-badge" style={statusStyle}>
                                    {getStatusLabel(caseItem.status)}
                                  </span>
                                  <span className="clinician-priority-badge" style={priorityStyle}>
                                    {caseItem.priority}
                                  </span>
                                  <span className="clinician-case-selection-type">
                                    {TYPE_LABELS[caseItem.type] || caseItem.type}
                                  </span>
                                </div>
                                <div className="clinician-case-selection-meta">
                                  <span>{caseItem.teamName}</span>
                                  <span>•</span>
                                  <span>{formatDate(caseItem.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#94A3B8', flexShrink: 0 }}>
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : selectedCaseForPlan ? (
                <>
                  {/* Info Alert */}
                  <div className="clinician-alert-info">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>Create a customized rehabilitation plan with exercises for your patient</span>
                  </div>

                  {/* Plan Details Section */}
                  <div className="clinician-form-section">
                    <h3 className="clinician-form-section-title">Plan Details</h3>
                    <div className="clinician-form-group">
                      <label>Plan Name *</label>
                      <input 
                        type="text" 
                        value={createPlanForm.plan_name}
                        onChange={(e) => setCreatePlanForm({ ...createPlanForm, plan_name: e.target.value })}
                        placeholder="Recovery Plan"
                        required
                      />
                    </div>
                    <div className="clinician-form-group">
                      <label>Plan Description</label>
                      <textarea 
                        value={createPlanForm.plan_description}
                        onChange={(e) => setCreatePlanForm({ ...createPlanForm, plan_description: e.target.value })}
                        rows={3}
                        placeholder="Daily recovery exercises and activities"
                      />
                    </div>
                    <div className="clinician-form-group">
                      <label>Start Date *</label>
                      <input 
                        type="date" 
                        value={createPlanForm.start_date}
                        onChange={(e) => setCreatePlanForm({ ...createPlanForm, start_date: e.target.value })}
                        min={new Date().toISOString().split('T')[0]} // Can't select past dates
                        required
                      />
                      <small className="clinician-form-helper">When should this rehabilitation plan start? (Day 1 will begin on this date)</small>
                    </div>
                    <div className="clinician-form-group">
                      <label>Duration (Days) *</label>
                      <input 
                        type="number" 
                        min="1"
                        value={createPlanForm.duration_days}
                        onChange={(e) => setCreatePlanForm({ ...createPlanForm, duration_days: parseInt(e.target.value) || 7 })}
                        required
                      />
                      <small className="clinician-form-helper">
                        How many days should this plan last? 
                        {createPlanForm.start_date && createPlanForm.duration_days && (
                          <span style={{ display: 'block', marginTop: '4px', fontWeight: '500', color: '#3b82f6' }}>
                            Plan will run from {new Date(createPlanForm.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} 
                            to {new Date(new Date(createPlanForm.start_date).getTime() + (createPlanForm.duration_days - 1) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </small>
                    </div>
                  </div>

                  {/* Exercises Section */}
                  <div className="clinician-form-section">
                    <h3 className="clinician-form-section-title">Exercises</h3>
                    {exercises.map((exercise, index) => (
                      <div key={index} className="clinician-exercise-card">
                        <div className="clinician-exercise-header">
                          <span className="clinician-exercise-number">Exercise {index + 1}</span>
                          {exercises.length > 1 && (
                            <button
                              type="button"
                              className="clinician-exercise-remove"
                              onClick={() => handleRemoveExercise(index)}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="clinician-form-group">
                          <label>Exercise Name *</label>
                          <input 
                            type="text" 
                            value={exercise.exercise_name}
                            onChange={(e) => handleExerciseChange(index, 'exercise_name', e.target.value)}
                            placeholder="Exercise Name (e.g., Cat-Cow)"
                            required
                          />
                        </div>
                        <div className="clinician-form-group">
                          <label>Repetitions</label>
                          <input 
                            type="text" 
                            value={exercise.repetitions}
                            onChange={(e) => handleExerciseChange(index, 'repetitions', e.target.value)}
                            placeholder="Repetitions (e.g., 10 reps)"
                          />
                        </div>
                        <div className="clinician-form-group">
                          <label>Instructions</label>
                          <textarea 
                            value={exercise.instructions}
                            onChange={(e) => handleExerciseChange(index, 'instructions', e.target.value)}
                            rows={3}
                            placeholder="Instructions"
                          />
                        </div>
                        <div className="clinician-form-group">
                          <label>Video URL (optional)</label>
                          <input 
                            type="url" 
                            value={exercise.video_url}
                            onChange={(e) => handleExerciseChange(index, 'video_url', e.target.value)}
                            placeholder="Video URL (optional)"
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="clinician-add-exercise-btn"
                      onClick={handleAddExercise}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Add Another Exercise
                    </button>
                  </div>
                </>
              ) : null}
            </div>
            <div className="clinician-modal-footer">
              {showCaseSelection ? (
                <button 
                  className="clinician-modal-cancel-btn"
                  onClick={handleCloseCreatePlanModal}
                  style={{ marginLeft: 'auto' }}
                >
                  Cancel
                </button>
              ) : (
                <>
                  <button 
                    className="clinician-modal-cancel-btn"
                    onClick={handleBackToSelection}
                  >
                    Back
                  </button>
                  <button 
                    className="clinician-modal-submit-btn"
                    onClick={handleSubmitPlan}
                    disabled={creatingPlan || !createPlanForm.plan_name || !createPlanForm.duration_days || exercises.filter(ex => ex.exercise_name.trim()).length === 0}
                  >
                    {creatingPlan ? 'Creating...' : 'Create Plan'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View Case Modal */}
      {showViewModal && selectedCase && (
        <div className="clinician-modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="clinician-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="clinician-modal-header">
              <div>
                <h2 className="clinician-modal-title">Case Details</h2>
                <p className="clinician-modal-subtitle">{selectedCase.caseNumber}</p>
              </div>
              <button 
                className="clinician-modal-close"
                onClick={() => setShowViewModal(false)}
                aria-label="Close modal"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="clinician-modal-body">
              <div className="clinician-details-grid">
                <div className="clinician-detail-section">
                  <h3 className="clinician-detail-section-title">Case Information</h3>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Case Number:</span>
                    <span className="clinician-detail-value">{selectedCase.caseNumber}</span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Status:</span>
                    <span className="clinician-status-badge" style={getStatusInlineStyle(selectedCase.status)}>
                      {getStatusLabel(selectedCase.status)}
                    </span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Severity:</span>
                    {(() => {
                      const priorityStyleObj = getPriorityStyle(selectedCase.priority)
                      const priorityStyle = { backgroundColor: priorityStyleObj.bg, color: priorityStyleObj.color }
                      return (
                        <span className="clinician-priority-badge" style={priorityStyle}>
                          {selectedCase.priority}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Incident Type:</span>
                    <span className="clinician-detail-value">{TYPE_LABELS[selectedCase.type] || selectedCase.type}</span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Created:</span>
                    <span className="clinician-detail-value">{formatDate(selectedCase.createdAt)}</span>
                  </div>
                </div>
                <div className="clinician-detail-section">
                  <h3 className="clinician-detail-section-title">Worker Information</h3>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Name:</span>
                    <span className="clinician-detail-value">{selectedCase.workerName}</span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Email:</span>
                    <span className="clinician-detail-value">{selectedCase.workerEmail}</span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Team:</span>
                    <span className="clinician-detail-value">{selectedCase.teamName}</span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Team Leader:</span>
                    <span className="clinician-detail-value">{selectedCase.teamLeaderName || 'N/A'}</span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Site Location:</span>
                    <span className="clinician-detail-value">{selectedCase.siteLocation || 'N/A'}</span>
                  </div>
                </div>
                <div className="clinician-detail-section">
                  <h3 className="clinician-detail-section-title">Incident Details</h3>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Start Date:</span>
                    <span className="clinician-detail-value">{formatDate(selectedCase.startDate)}</span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">End Date:</span>
                    <span className="clinician-detail-value">{selectedCase.endDate ? formatDate(selectedCase.endDate) : 'Ongoing'}</span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Reason:</span>
                    <span className="clinician-detail-value">{selectedCase.reason || 'No reason provided'}</span>
                  </div>
                </div>
                <div className="clinician-detail-section">
                  <h3 className="clinician-detail-section-title">Supervisor Information</h3>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Supervisor:</span>
                    <span className="clinician-detail-value">{selectedCase.supervisorName || 'N/A'}</span>
                  </div>
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Last Updated:</span>
                    <span className="clinician-detail-value">{formatDate(selectedCase.updatedAt)}</span>
                  </div>
                  {(selectedCase.status === 'CLOSED' || selectedCase.status === 'RETURN TO WORK') && selectedCase.approvedBy && (
                    <div className="clinician-detail-item">
                      <span className="clinician-detail-label">Approved by:</span>
                      <span className="clinician-detail-value" style={{ color: '#10B981', fontWeight: 600 }}>
                        {selectedCase.approvedBy}
                      </span>
                    </div>
                  )}
                  {(selectedCase.status === 'CLOSED' || selectedCase.status === 'RETURN TO WORK') && selectedCase.approvedAt && (
                    <div className="clinician-detail-item">
                      <span className="clinician-detail-label">Approved at:</span>
                      <span className="clinician-detail-value">{formatDate(selectedCase.approvedAt)}</span>
                    </div>
                  )}
                  <div className="clinician-detail-item">
                    <span className="clinician-detail-label">Assignment Status:</span>
                    <span className="clinician-detail-value">
                      <span 
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          background: '#ECFDF5',
                          color: '#10B981',
                        }}
                      >
                        ✓ Approved by WHS Review
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="clinician-modal-footer">
              {!selectedCase.isInRehab && (selectedCase.status === 'ACTIVE' || selectedCase.status === 'IN REHAB') && (
                <button 
                  className="clinician-modal-submit-btn"
                  onClick={() => {
                    setShowViewModal(false)
                    handleCreatePlan(selectedCase)
                  }}
                >
                  Create Rehabilitation Plan
                </button>
              )}
              <button 
                className="clinician-modal-cancel-btn"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      {showProgressModal && selectedPlanForProgress && (
        <div className="clinician-modal-overlay" onClick={() => setShowProgressModal(false)}>
          <div className="clinician-modal-content" style={{ maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="clinician-modal-header">
              <div>
                <h2 className="clinician-modal-title">Rehabilitation Plan Progress</h2>
                <p className="clinician-modal-subtitle">{selectedPlanForProgress.caseNumber}</p>
              </div>
              <button 
                className="clinician-modal-close"
                onClick={() => setShowProgressModal(false)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="clinician-modal-body">
              {loadingProgress ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p>Loading progress...</p>
                </div>
              ) : progressData ? (
                <>
                  {/* Plan Details */}
                  <div style={{ marginBottom: '24px', padding: '16px', background: '#F8FAFC', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600', color: '#0F172A' }}>
                          {progressData.plan.plan_name}
                        </h3>
                        <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748B' }}>
                          {progressData.plan.workerName} • {progressData.plan.caseNumber}
                        </p>
                      </div>
                      <span className="clinician-plan-status-badge active">Active</span>
                    </div>
                    <div style={{ display: 'flex', gap: '24px', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>Overall Progress</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progressData.plan.progress}%`, background: '#8B5CF6', borderRadius: '4px' }}></div>
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A', minWidth: '45px' }}>
                            {progressData.plan.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748B' }}>
                      Day {progressData.plan.currentDay} of {progressData.plan.duration} ({progressData.plan.daysCompleted} completed) • 
                      <span style={{ marginLeft: '4px', fontWeight: '500', color: '#8B5CF6' }}>Current: Day {progressData.plan.currentDay}</span>
                    </div>
                  </div>

                  {/* Daily Progress Timeline */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0F172A' }}>Daily Progress Timeline</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {progressData.dailyProgress.map((day: any) => {
                        const isCompleted = day.status === 'completed'
                        const isCurrent = day.status === 'current'
                        
                        return (
                          <div
                            key={day.dayNumber}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 16px',
                              borderRadius: '8px',
                              background: isCompleted ? '#ECFDF5' : isCurrent ? '#FEF3C7' : '#F8FAFC',
                              border: isCurrent ? '1px solid #FCD34D' : '1px solid transparent',
                            }}
                          >
                            <div style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              marginRight: '12px',
                              background: isCompleted ? '#10B981' : isCurrent ? '#F59E0B' : '#E2E8F0',
                              color: isCompleted || isCurrent ? '#FFFFFF' : '#64748B',
                              fontWeight: '600',
                              fontSize: '14px',
                              flexShrink: 0
                            }}>
                              {isCompleted ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              ) : (
                                day.dayNumber
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#0F172A' }}>
                                  {formatDateLong(day.date)}
                                </span>
                                <span style={{ 
                                  fontSize: '12px', 
                                  fontWeight: '500',
                                  color: isCompleted ? '#10B981' : isCurrent ? '#F59E0B' : '#64748B'
                                }}>
                                  {isCompleted ? 'Completed' : isCurrent ? 'Current' : 'Pending'}
                                </span>
                              </div>
                              {isCompleted && (
                                <div style={{ fontSize: '13px', color: '#64748B' }}>
                                  {day.exercisesCompleted} of {day.totalExercises} exercise{day.totalExercises !== 1 ? 's' : ''} completed
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: '#64748B' }}>No progress data available</p>
                </div>
              )}
            </div>
            <div className="clinician-modal-footer">
              <button 
                className="clinician-modal-cancel-btn"
                onClick={() => setShowProgressModal(false)}
                style={{ marginLeft: 'auto' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {showEditPlanModal && selectedPlanForEdit && (
        <div className="clinician-modal-overlay" onClick={handleCloseEditPlanModal}>
          <div className="clinician-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="clinician-modal-header">
              <div>
                <h2 className="clinician-modal-title">Edit Rehabilitation Plan</h2>
                <p className="clinician-modal-subtitle">{selectedPlanForEdit.caseNumber} • {selectedPlanForEdit.workerName}</p>
              </div>
              <button 
                className="clinician-modal-close"
                onClick={handleCloseEditPlanModal}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="clinician-modal-body">
              {/* Info Alert */}
              <div className="clinician-alert-info">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Edit the rehabilitation plan details. Changes will update the plan schedule.</span>
              </div>

              {/* Plan Details Section */}
              <div className="clinician-form-section">
                <h3 className="clinician-form-section-title">Plan Details</h3>
                <div className="clinician-form-group">
                  <label>Start Date *</label>
                  <input 
                    type="date" 
                    value={editPlanForm.start_date}
                    onChange={(e) => setEditPlanForm({ ...editPlanForm, start_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                  <small className="clinician-form-helper">When should this rehabilitation plan start? (Day 1 will begin on this date)</small>
                </div>
                <div className="clinician-form-group">
                  <label>Duration (Days) *</label>
                  <input 
                    type="number" 
                    min="1"
                    value={editPlanForm.duration_days}
                    onChange={(e) => setEditPlanForm({ ...editPlanForm, duration_days: parseInt(e.target.value) || 1 })}
                    required
                  />
                  <small className="clinician-form-helper">
                    How many days should this plan last? 
                    {editPlanForm.start_date && editPlanForm.duration_days && (
                      <span style={{ display: 'block', marginTop: '4px', fontWeight: '500', color: '#3b82f6' }}>
                        Plan will run from {new Date(editPlanForm.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} 
                        to {new Date(new Date(editPlanForm.start_date).getTime() + (editPlanForm.duration_days - 1) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </small>
                </div>
                <div className="clinician-form-group">
                  <label>Notes</label>
                  <textarea 
                    value={editPlanForm.notes}
                    onChange={(e) => setEditPlanForm({ ...editPlanForm, notes: e.target.value })}
                    rows={4}
                    placeholder="Additional notes about this rehabilitation plan (optional)"
                  />
                  <small className="clinician-form-helper">Add any additional notes or instructions for this plan</small>
                </div>
              </div>
            </div>
            <div className="clinician-modal-footer">
              <button 
                className="clinician-modal-cancel-btn"
                onClick={handleCloseEditPlanModal}
              >
                Cancel
              </button>
              <button 
                className="clinician-modal-submit-btn"
                onClick={handleUpdatePlan}
                disabled={updatingPlan || !editPlanForm.start_date || !editPlanForm.duration_days || editPlanForm.duration_days < 1}
              >
                {updatingPlan ? 'Updating...' : 'Update Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
