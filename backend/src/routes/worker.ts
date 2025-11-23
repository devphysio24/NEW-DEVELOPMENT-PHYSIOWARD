import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../middleware/auth.js'
import { getCaseStatusFromNotes } from '../utils/caseStatus.js'
import { getAdminClient } from '../utils/adminClient.js'
import { analyzeIncident } from '../utils/openai.js'
import { getTodayDateString } from '../utils/dateUtils.js'
import { formatDateString } from '../utils/dateTime.js'
import { getExceptionDatesForScheduledDates } from '../utils/exceptionUtils.js'
import { 
  getScheduledDatesInRange, 
  findNextScheduledDate, 
  formatDateForDisplay 
} from '../utils/scheduleUtils.js'
import { calculateAge } from '../utils/ageUtils.js'

const worker = new Hono()

// Check if worker can submit incident report (check for active exceptions)
worker.get('/can-report-incident', authMiddleware, requireRole(['worker']), async (c) => {
  try {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const adminClient = getAdminClient()

    // Check if worker has active exception (excluding closed cases)
    const { data: existingException, error: existingError } = await adminClient
      .from('worker_exceptions')
      .select('id, exception_type, reason, start_date, end_date, notes, deactivated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (existingException) {
      // Check if case is closed by checking case_status in notes or deactivated_at timestamp
      let isClosed = false
      
      // Check deactivated_at timestamp first (if case was closed by supervisor)
      if (existingException.deactivated_at) {
        isClosed = true
      } else if (existingException.notes) {
        // OPTIMIZATION: Use centralized case status helper
        const caseStatus = getCaseStatusFromNotes(existingException.notes)
        isClosed = caseStatus === 'closed' || caseStatus === 'return_to_work'
      }

      if (!isClosed) {
        return c.json({
          canReport: false,
          reason: 'You already have an active incident/exception. Please wait until your current case is closed before submitting a new report.',
          hasActiveCase: true,
          exceptionType: existingException.exception_type,
          startDate: existingException.start_date,
        })
      }
    }

    return c.json({
      canReport: true,
      reason: null,
      hasActiveCase: false,
    })

  } catch (error: any) {
    console.error('[GET /worker/can-report-incident] Error:', error)
    return c.json({ 
      error: 'Failed to check report status', 
      details: error.message 
    }, 500)
  }
})

// AI Analyze Incident Report (analyze before submitting)
worker.post('/analyze-incident', authMiddleware, requireRole(['worker']), async (c) => {
  try {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const body = await c.req.json()
    const { type, description, location, severity, date } = body

    // Validation
    if (!type || !description || !location || !severity || !date) {
      return c.json({ error: 'Missing required fields for analysis' }, 400)
    }

    const validTypes = ['incident', 'near_miss']
    if (!validTypes.includes(type)) {
      return c.json({ error: 'Invalid report type' }, 400)
    }

    const validSeverities = ['low', 'medium', 'high', 'critical']
    if (!validSeverities.includes(severity)) {
      return c.json({ error: 'Invalid severity' }, 400)
    }

    // Perform AI analysis
    const analysis = await analyzeIncident({
      type,
      description,
      location,
      severity,
      date,
    })

    return c.json({
      success: true,
      analysis,
    })

  } catch (error: any) {
    console.error('[POST /worker/analyze-incident] Error:', error)
    return c.json({ 
      error: 'Failed to analyze incident report', 
      details: error.message 
    }, 500)
  }
})

// Report Incident or Near-Miss
worker.post('/report-incident', authMiddleware, requireRole(['worker']), async (c) => {
  try {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const formData = await c.req.formData()
    const type = formData.get('type') as string
    const description = formData.get('description') as string
    const incidentDate = formData.get('incident_date') as string
    const location = formData.get('location') as string
    const severity = formData.get('severity') as string || 'medium'
    const photo = formData.get('photo') as File | null

    // Validation
    if (!type || !description || !incidentDate || !location) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const validTypes = ['incident', 'near_miss']
    if (!validTypes.includes(type)) {
      return c.json({ error: 'Invalid report type. Must be "incident" or "near_miss"' }, 400)
    }

    const validSeverities = ['low', 'medium', 'high', 'critical']
    if (!validSeverities.includes(severity)) {
      return c.json({ error: 'Invalid severity. Must be "low", "medium", "high", or "critical"' }, 400)
    }

    const adminClient = getAdminClient()

    // Get worker's team (required - worker must be in a team)
    let teamId: string | null = null
    let team: any = null
    
    // Optimized: Get team member and team info in one query
    const { data: teamMember, error: teamError } = await adminClient
      .from('team_members')
      .select('team_id, teams(id, name, supervisor_id, team_leader_id)')
      .eq('user_id', user.id)
      .maybeSingle() // Use maybeSingle to handle no result gracefully

    if (teamError) {
      console.error(`[POST /worker/report-incident] Error fetching team_members for user ${user.id} (${user.email}):`, teamError)
      return c.json({ error: 'Failed to fetch team information. Please try again.' }, 500)
    }

    if (!teamMember || !teamMember.team_id) {
      console.error(`[POST /worker/report-incident] Worker ${user.id} (${user.email}) is not assigned to any team`)
      return c.json({ error: 'Worker not found in any team. Please contact your supervisor to be assigned to a team.' }, 404)
    }

    teamId = teamMember.team_id
    team = Array.isArray(teamMember.teams) ? teamMember.teams[0] : teamMember.teams

    // If team relationship didn't load, fetch team directly
    if (!team && teamId) {
      const { data: teamData, error: teamFetchError } = await adminClient
        .from('teams')
        .select('id, name, supervisor_id, team_leader_id')
        .eq('id', teamId)
        .single()
      
      if (teamFetchError || !teamData) {
        console.error(`[POST /worker/report-incident] Error fetching team ${teamId}:`, teamFetchError)
        return c.json({ error: 'Team not found. Please contact your supervisor.' }, 404)
      }
      
      team = teamData
    }

    if (!team) {
      console.error(`[POST /worker/report-incident] Team data not available for team_id: ${teamId}`)
      return c.json({ error: 'Team information not available. Please contact your supervisor.' }, 500)
    }

    // Check if worker already has active exception or incident report (excluding closed cases)
    const { data: existingException, error: existingError } = await adminClient
      .from('worker_exceptions')
      .select('id, exception_type, reason, start_date, end_date, notes, deactivated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (existingException) {
      // Check if case is closed by checking case_status in notes or deactivated_at timestamp
      let isClosed = false
      
      // Check deactivated_at timestamp first (if case was closed by supervisor)
      if (existingException.deactivated_at) {
        isClosed = true
      } else if (existingException.notes) {
        // OPTIMIZATION: Use centralized case status helper
        const caseStatus = getCaseStatusFromNotes(existingException.notes)
        isClosed = caseStatus === 'closed' || caseStatus === 'return_to_work'
      }
      
      if (!isClosed) {
        return c.json({ 
          error: 'You already have an active incident/exception. Please wait until your current case is closed before submitting a new report.',
          details: 'You must wait for your current case to be closed by your supervisor or clinician before reporting a new incident.'
        }, 400)
      }
    }

    // Also check for active incidents (in case it's not synced with exceptions)
    const today = new Date().toISOString().split('T')[0]
    const { data: activeIncident, error: incidentError } = await adminClient
      .from('incidents')
      .select('id, incident_type, incident_date, severity')
      .eq('user_id', user.id)
      .gte('incident_date', today)
      .order('incident_date', { ascending: false })
      .limit(1)

    if (activeIncident && activeIncident.length > 0) {
      // Check if there's a corresponding active exception
      const { data: incidentException } = await adminClient
        .from('worker_exceptions')
        .select('id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (incidentException) {
        return c.json({ 
          error: 'You already have an active incident report. Please wait until your current case is closed before submitting a new report.',
          details: 'You must wait for your current case to be closed by your supervisor or clinician before reporting a new incident.'
        }, 400)
      }
    }

    // Handle photo upload if provided
    let photoUrl: string | null = null
    if (photo && photo.size > 0) {
      try {
        // Convert file to base64 for storage
        const arrayBuffer = await photo.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString('base64')
        const dataUrl = `data:${photo.type};base64,${base64}`

        // Store in Supabase Storage (if configured) or store as base64 in notes
        // For now, we'll store it in the notes field as a reference
        // In production, you'd want to upload to Supabase Storage
        photoUrl = dataUrl // Store reference - in production, upload to storage and get URL
      } catch (photoError: any) {
        console.error('[POST /worker/report-incident] Error processing photo:', photoError)
        // Don't fail the incident creation if photo processing fails
      }
    }

    // Determine exception type based on report type
    // For incident/near_miss reports, we'll use 'accident' or 'other' as exception type
    const exceptionType = type === 'incident' ? 'accident' : 'other'

    // Create incident record in incidents table
    const incidentData: any = {
      user_id: user.id,
      team_id: teamId,
      incident_type: type,
      incident_date: incidentDate,
      description: `${description}${location ? `\n\nLocation: ${location}` : ''}${photoUrl ? '\n\n[Photo attached]' : ''}`,
      severity: severity,
    }

    // Insert into incidents table
    let incidentId: string | null = null
    try {
      const { data: incident, error: incidentError } = await adminClient
        .from('incidents')
        .insert([incidentData])
        .select('id')
        .single()

      if (!incidentError && incident) {
        incidentId = incident.id
      } else if (incidentError) {
        console.error('[POST /worker/report-incident] Error creating incident:', incidentError)
        // Continue with exception creation even if incident creation fails
      }
    } catch (err: any) {
      console.error('[POST /worker/report-incident] Error inserting into incidents table:', err)
      // Continue with exception creation
    }

    // Also create exception record
    const exceptionData = {
      user_id: user.id,
      team_id: teamId,
      exception_type: exceptionType,
      reason: `${type === 'incident' ? 'Incident' : 'Near-Miss'} reported: ${description}. Location: ${location}. Severity: ${severity}`,
      start_date: incidentDate,
      end_date: null,
      is_active: true,
      created_by: user.id,
      notes: photoUrl ? `Photo attached: ${photoUrl.substring(0, 100)}...` : null,
    }

    const { data: newException, error: createError } = await adminClient
      .from('worker_exceptions')
      .insert([exceptionData])
      .select()
      .single()

    if (createError) {
      console.error('[POST /worker/report-incident] Error creating exception:', createError)
      return c.json({ error: 'Failed to create incident report', details: createError.message }, 500)
    }

    // OPTIMIZATION: Automatically deactivate all active schedules when incident is reported
    let deactivatedScheduleCount = 0
    try {
      const { count: scheduleCount, error: countError } = await adminClient
        .from('worker_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', user.id)
        .eq('is_active', true)
      
      if (!countError && scheduleCount && scheduleCount > 0) {
        const { error: deactivateError } = await adminClient
          .from('worker_schedules')
          .update({ is_active: false })
          .eq('worker_id', user.id)
          .eq('is_active', true)

        if (!deactivateError) {
          deactivatedScheduleCount = scheduleCount
        }
      }
    } catch (deactivateScheduleError: any) {
      console.error('[POST /worker/report-incident] Error deactivating schedules:', deactivateScheduleError)
    }

    // Create notifications (team is required, so notifications will always be sent)
    try {
      const workerName = (user as any).full_name || 
                        ((user as any).first_name && (user as any).last_name 
                          ? `${(user as any).first_name} ${(user as any).last_name}`
                          : user.email || 'Unknown Worker')

      const notifications: any[] = []

      // Notification for supervisor (team is required)
      if (team.supervisor_id) {
        notifications.push({
          user_id: team.supervisor_id,
          type: 'system',
          title: `⚠️ ${type === 'incident' ? 'Incident' : 'Near-Miss'} Report`,
          message: `${workerName} has reported a ${type === 'incident' ? 'workplace incident' : 'near-miss'} (Severity: ${severity.toUpperCase()}).`,
          data: {
            incident_id: incidentId || newException.id,
            exception_id: newException.id,
            worker_id: user.id,
            worker_name: workerName,
            worker_email: user.email || '',
            incident_type: type,
            severity: severity,
            location: location,
            incident_date: incidentDate,
            description: description,
            schedules_deactivated: deactivatedScheduleCount,
          },
          is_read: false,
        })
      }

      // Notification for team leader (team is required)
      if (team.team_leader_id) {
        notifications.push({
          user_id: team.team_leader_id,
          type: 'system',
          title: `⚠️ ${type === 'incident' ? 'Incident' : 'Near-Miss'} Report`,
          message: `${workerName} has reported a ${type === 'incident' ? 'workplace incident' : 'near-miss'} (Severity: ${severity.toUpperCase()}).`,
          data: {
            incident_id: incidentId || newException.id,
            exception_id: newException.id,
            worker_id: user.id,
            worker_name: workerName,
            worker_email: user.email || '',
            incident_type: type,
            severity: severity,
            location: location,
            incident_date: incidentDate,
            description: description,
            schedules_deactivated: deactivatedScheduleCount,
          },
          is_read: false,
        })
      }

      // Notification for worker (confirmation)
      notifications.push({
        user_id: user.id,
        type: 'system',
        title: '✅ Report Submitted',
        message: `Your ${type === 'incident' ? 'incident' : 'near-miss'} report has been submitted successfully. Your supervisor has been notified.`,
        data: {
          incident_id: incidentId || newException.id,
          exception_id: newException.id,
          incident_type: type,
        },
        is_read: false,
      })

      if (notifications.length > 0) {
        await adminClient
          .from('notifications')
          .insert(notifications)
      }
    } catch (notifError: any) {
      console.error('[POST /worker/report-incident] Error creating notifications:', notifError)
      // Don't fail the incident creation if notifications fail
    }

    return c.json({
      success: true,
      message: 'Incident report submitted successfully',
      incident: {
        id: incidentId || newException.id,
        type: type,
        date: incidentDate,
        location: location,
      },
    }, 201)

  } catch (error: any) {
    console.error('[POST /worker/report-incident] Error:', error)
    return c.json({ error: 'Failed to submit incident report', details: error.message }, 500)
  }
})

// Get worker's cases (accidents/incidents) - VIEW ONLY
worker.get('/cases', authMiddleware, requireRole(['worker']), async (c) => {
  try {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const page = c.req.query('page') ? parseInt(c.req.query('page')!) : 1
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
    const status = c.req.query('status') || 'all'
    const search = c.req.query('search') || ''

    const adminClient = getAdminClient()
    const offset = (page - 1) * limit

    // Get cases for this worker only
    let query = adminClient
      .from('worker_exceptions')
      .select(`
        *,
        teams!worker_exceptions_team_id_fkey(
          id,
          name,
          site_location,
          supervisor_id,
          team_leader_id
        )
      `)
      .eq('user_id', user.id) // SECURITY: Only this worker's cases
      .in('exception_type', ['injury', 'medical_leave', 'accident', 'other'])

    // Filter by status
    const todayStr = getTodayDateString()
    if (status === 'active') {
      query = query.eq('is_active', true).gte('start_date', todayStr).or(`end_date.is.null,end_date.gte.${todayStr}`)
    } else if (status === 'closed') {
      query = query.or(`end_date.lt.${todayStr},is_active.eq.false`)
    }

    // Count query with same filters
    const countQuery = adminClient
      .from('worker_exceptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('exception_type', ['injury', 'medical_leave', 'accident', 'other'])
    
    if (status === 'active') {
      countQuery.eq('is_active', true).gte('start_date', todayStr).or(`end_date.is.null,end_date.gte.${todayStr}`)
    } else if (status === 'closed') {
      countQuery.or(`end_date.lt.${todayStr},is_active.eq.false`)
    }

    const [countResult, casesResult] = await Promise.all([
      countQuery,
      query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
    ])

    const { count } = countResult
    const { data: cases, error: casesError } = casesResult

    if (casesError) {
      console.error('[GET /worker/cases] Database Error:', casesError)
      return c.json({ error: 'Failed to fetch cases', details: casesError.message }, 500)
    }

    // Get rehabilitation plans for cases
    const caseIds = (cases || []).map((c: any) => c.id)
    let rehabPlans: any[] = []
    if (caseIds.length > 0) {
      const { data: rehabPlansData } = await adminClient
        .from('rehabilitation_plans')
        .select('exception_id, status')
        .in('exception_id', caseIds)
        .eq('status', 'active')
      
      rehabPlans = rehabPlansData || []
    }

    const rehabMap = new Map()
    rehabPlans.forEach((plan: any) => {
      rehabMap.set(plan.exception_id, true)
    })

    // Get supervisor and team leader info
    const supervisorIds = Array.from(new Set(
      (cases || [])
        .map((incident: any) => {
          const team = Array.isArray(incident.teams) ? incident.teams[0] : incident.teams
          return team?.supervisor_id
        })
        .filter(Boolean)
    ))

    const teamLeaderIds = Array.from(new Set(
      (cases || [])
        .map((incident: any) => {
          const team = Array.isArray(incident.teams) ? incident.teams[0] : incident.teams
          return team?.team_leader_id
        })
        .filter(Boolean)
    ))

    const allUserIds = Array.from(new Set([...supervisorIds, ...teamLeaderIds]))
    let userMap = new Map()
    if (allUserIds.length > 0) {
      const { data: users } = await adminClient
        .from('users')
        .select('id, email, first_name, last_name, full_name')
        .in('id', allUserIds)

      if (users) {
        users.forEach((userData: any) => {
          userMap.set(userData.id, userData)
        })
      }
    }

    // Format cases
    const { getCaseStatusFromNotes, mapCaseStatusToDisplay } = await import('../utils/caseStatus.js')
    
    // Generate case number from exception
    const generateCaseNumber = (exceptionId: string, createdAt: string): string => {
      const date = new Date(createdAt)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      const uuidPrefix = exceptionId?.substring(0, 4)?.toUpperCase() || 'CASE'
      return `CASE-${year}${month}${day}-${hours}${minutes}${seconds}-${uuidPrefix}`
    }
    
    const formatUserName = (user: any): string => {
      if (!user) return 'Unknown'
      if (user.full_name) return user.full_name
      if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`
      return user.email || 'Unknown'
    }

    // Get worker's user data from database
    const { data: workerUser } = await adminClient
      .from('users')
      .select('id, email, first_name, last_name, full_name')
      .eq('id', user.id)
      .single()

    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const casesArray = Array.isArray(cases) ? cases : []
    let formattedCases = casesArray.map((incident: any) => {
      const team = incident.teams?.[0] || incident.teams
      const supervisor = team?.supervisor_id ? userMap.get(team.supervisor_id) : null
      const teamLeader = team?.team_leader_id ? userMap.get(team.team_leader_id) : null
      
      const startDate = new Date(incident.start_date)
      startDate.setHours(0, 0, 0, 0)
      const endDate = incident.end_date ? new Date(incident.end_date) : null
      if (endDate) endDate.setHours(0, 0, 0, 0)
      
      const isCurrentlyActive = todayDate >= startDate && (!endDate || todayDate <= endDate) && incident.is_active
      const isInRehab = rehabMap.has(incident.id)

      const caseNumber = generateCaseNumber(incident.id, incident.created_at)
      const caseStatusFromNotes = getCaseStatusFromNotes(incident.notes)
      const caseStatus = mapCaseStatusToDisplay(caseStatusFromNotes, isInRehab, isCurrentlyActive)

      let priority = 'MEDIUM'
      if (incident.exception_type === 'injury' || incident.exception_type === 'accident') {
        priority = 'HIGH'
      } else if (incident.exception_type === 'medical_leave') {
        priority = 'MEDIUM'
      } else {
        priority = 'LOW'
      }

      return {
        id: incident.id,
        caseNumber,
        workerId: incident.user_id,
        workerName: formatUserName(workerUser),
        workerEmail: workerUser?.email || user.email || '',
        workerInitials: (workerUser?.first_name?.[0]?.toUpperCase() || '') + (workerUser?.last_name?.[0]?.toUpperCase() || '') || 'U',
        teamId: incident.team_id,
        teamName: team?.name || '',
        siteLocation: team?.site_location || '',
        supervisorName: formatUserName(supervisor),
        teamLeaderName: formatUserName(teamLeader),
        type: incident.exception_type,
        reason: incident.reason || '',
        startDate: incident.start_date,
        endDate: incident.end_date,
        status: caseStatus,
        priority,
        isActive: isCurrentlyActive,
        isInRehab,
        caseStatus: caseStatusFromNotes || null,
        notes: incident.notes || null,
        createdAt: incident.created_at,
        updatedAt: incident.updated_at,
        return_to_work_duty_type: incident.return_to_work_duty_type || null,
        return_to_work_date: incident.return_to_work_date || null,
      }
    })

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      formattedCases = formattedCases.filter(caseItem => 
        caseItem.caseNumber.toLowerCase().includes(searchLower) ||
        caseItem.type.toLowerCase().includes(searchLower) ||
        caseItem.teamName.toLowerCase().includes(searchLower)
      )
    }

    return c.json({
      cases: formattedCases,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: page < Math.ceil((count || 0) / limit),
        hasPrev: page > 1,
      },
    }, 200)
  } catch (error: any) {
    console.error('[GET /worker/cases] Error:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

// Get single case detail for worker - VIEW ONLY
worker.get('/cases/:id', authMiddleware, requireRole(['worker']), async (c) => {
  try {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const caseId = c.req.param('id')
    if (!caseId) {
      return c.json({ error: 'Case ID is required' }, 400)
    }

    const adminClient = getAdminClient()

    // Get single case - SECURITY: Only this worker's cases
    const { data: caseData, error: caseError } = await adminClient
      .from('worker_exceptions')
      .select(`
        *,
        teams!worker_exceptions_team_id_fkey(
          id,
          name,
          site_location,
          supervisor_id,
          team_leader_id
        )
      `)
      .eq('id', caseId)
      .eq('user_id', user.id) // SECURITY: Only their own cases
      .in('exception_type', ['injury', 'medical_leave', 'accident', 'other'])
      .single()

    if (caseError || !caseData) {
      return c.json({ error: 'Case not found or not authorized' }, 404)
    }

    // Get supervisor and team leader info
    const team = Array.isArray(caseData.teams) ? caseData.teams[0] : caseData.teams
    const userIds = [team?.supervisor_id, team?.team_leader_id].filter(Boolean)
    
    let userMap = new Map()
    if (userIds.length > 0) {
      const { data: users } = await adminClient
        .from('users')
        .select('id, email, first_name, last_name, full_name, gender, date_of_birth')
        .in('id', userIds)
      
      users?.forEach((u: any) => userMap.set(u.id, u))
    }

    // Check rehab status
    const { data: rehabPlan } = await adminClient
      .from('rehabilitation_plans')
      .select('id, status')
      .eq('exception_id', caseId)
      .eq('status', 'active')
      .maybeSingle()

    const supervisor = userMap.get(team?.supervisor_id)
    const teamLeader = userMap.get(team?.team_leader_id)
    
    const { getCaseStatusFromNotes, mapCaseStatusToDisplay } = await import('../utils/caseStatus.js')
    
    // Generate case number from exception
    const generateCaseNumber = (exceptionId: string, createdAt: string): string => {
      const date = new Date(createdAt)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      const uuidPrefix = exceptionId?.substring(0, 4)?.toUpperCase() || 'CASE'
      return `CASE-${year}${month}${day}-${hours}${minutes}${seconds}-${uuidPrefix}`
    }
    
    const formatUserName = (user: any): string => {
      if (!user) return 'Unknown'
      if (user.full_name) return user.full_name
      if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`
      return user.email || 'Unknown'
    }

    const caseStatusFromNotes = getCaseStatusFromNotes(caseData.notes)
    const isInRehab = !!rehabPlan
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    const startDate = new Date(caseData.start_date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = caseData.end_date ? new Date(caseData.end_date) : null
    if (endDate) endDate.setHours(0, 0, 0, 0)
    const isCurrentlyActive = todayDate >= startDate && (!endDate || todayDate <= endDate) && caseData.is_active

    let priority = 'MEDIUM'
    if (caseData.exception_type === 'injury' || caseData.exception_type === 'accident') {
      priority = 'HIGH'
    } else if (caseData.exception_type === 'medical_leave') {
      priority = 'MEDIUM'
    } else {
      priority = 'LOW'
    }

    // Get worker's user data from database
    const { data: workerUser } = await adminClient
      .from('users')
      .select('id, email, first_name, last_name, full_name, gender, date_of_birth')
      .eq('id', user.id)
      .single()

    const formattedCase = {
      id: caseData.id,
      caseNumber: generateCaseNumber(caseData.id, caseData.created_at),
      workerId: caseData.user_id,
      workerName: formatUserName(workerUser),
      workerEmail: workerUser?.email || user.email || '',
      workerInitials: (workerUser?.first_name?.[0]?.toUpperCase() || '') + (workerUser?.last_name?.[0]?.toUpperCase() || '') || 'U',
      workerGender: (workerUser as any)?.gender || null,
      workerDateOfBirth: (workerUser as any)?.date_of_birth || null,
      teamId: caseData.team_id,
      teamName: team?.name || '',
      siteLocation: team?.site_location || '',
      supervisorName: formatUserName(supervisor),
      teamLeaderName: formatUserName(teamLeader),
      type: caseData.exception_type,
      reason: caseData.reason || '',
      startDate: caseData.start_date,
      endDate: caseData.end_date,
      status: mapCaseStatusToDisplay(caseStatusFromNotes, isInRehab, isCurrentlyActive),
      priority,
      isActive: isCurrentlyActive,
      isInRehab,
      caseStatus: caseStatusFromNotes || null,
      notes: caseData.notes || null,
      createdAt: caseData.created_at,
      updatedAt: caseData.updated_at,
      return_to_work_duty_type: caseData.return_to_work_duty_type || null,
      return_to_work_date: caseData.return_to_work_date || null,
    }

    return c.json({ case: formattedCase }, 200)
  } catch (error: any) {
    console.error('[GET /worker/cases/:id] Error:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

// Get worker's check-in streak
worker.get('/streak', authMiddleware, requireRole(['worker']), async (c) => {
  try {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const adminClient = getAdminClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = getTodayDateString()

    // Get all active schedules for this worker
    const { data: schedules, error: scheduleError } = await adminClient
      .from('worker_schedules')
      .select('*')
      .eq('worker_id', user.id)
      .eq('is_active', true)
      .order('scheduled_date', { ascending: false })
      .order('day_of_week', { ascending: true })

    if (scheduleError) {
      console.error('[GET /worker/streak] Error fetching schedules:', scheduleError)
      return c.json({ error: 'Failed to fetch schedules', details: scheduleError.message }, 500)
    }

    // Get all check-ins for this worker (last 30 days for performance)
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = formatDateString(thirtyDaysAgo)

    const { data: checkIns, error: checkInError } = await adminClient
      .from('daily_checkins')
      .select('check_in_date')
      .eq('user_id', user.id)
      .gte('check_in_date', thirtyDaysAgoStr)
      .order('check_in_date', { ascending: false })

    // Get all exceptions for this worker (to check if scheduled dates have exceptions)
    const { data: exceptions, error: exceptionError } = await adminClient
      .from('worker_exceptions')
      .select('exception_type, start_date, end_date, is_active, deactivated_at, reason')
      .eq('user_id', user.id)

    if (exceptionError) {
      console.error('[GET /worker/streak] Error fetching exceptions:', exceptionError)
      // Continue without exceptions - not critical
    }

    if (checkInError) {
      console.error('[GET /worker/streak] Error fetching check-ins:', checkInError)
      return c.json({ error: 'Failed to fetch check-ins', details: checkInError.message }, 500)
    }

    // Create a set of dates with check-ins (normalize to YYYY-MM-DD format)
    const checkInDates = new Set<string>()
    if (checkIns) {
      checkIns.forEach((checkIn: any) => {
        const dateStr = typeof checkIn.check_in_date === 'string' 
          ? checkIn.check_in_date.split('T')[0]
          : formatDateString(new Date(checkIn.check_in_date))
        checkInDates.add(dateStr)
      })
    }

    // Get scheduled dates for past 30 days (for streak calculation)
    const pastScheduledDates = getScheduledDatesInRange(schedules || [], thirtyDaysAgo, today)
    
    // Check which scheduled dates have exceptions (using centralized function)
    const { exceptionDates, scheduledDatesWithExceptions } = getExceptionDatesForScheduledDates(
      pastScheduledDates,
      exceptions || []
    )

    // Calculate streak: count consecutive days (going backwards from today)
    // where worker had a schedule AND completed check-in
    // Rules:
    // - Days with schedule AND check-in: count towards streak
    // - Days with schedule but NO check-in: break streak
    // - Days with NO schedule: skip (don't break streak, don't count)
    // Current streak is the most recent consecutive days with schedule + check-in
    
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    let foundFirstScheduledDay = false
    let foundMostRecentCheckIn = false // Track if we've found the most recent check-in

    // Go backwards from today to find consecutive days with schedule + check-in
    for (let dayOffset = 0; dayOffset <= 30; dayOffset++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - dayOffset)
      const checkDateStr = formatDateString(checkDate)

      const hadSchedule = pastScheduledDates.has(checkDateStr)
      const hadCheckIn = checkInDates.has(checkDateStr)
      const hadException = scheduledDatesWithExceptions.has(checkDateStr)

      if (hadSchedule) {
        // Worker had a schedule on this day
        foundFirstScheduledDay = true
        
        // If there's an exception on this scheduled date, don't count it (don't break streak, don't count)
        if (hadException) {
          // Exception dates don't break streak - continue
          continue
        }
        
        if (hadCheckIn) {
          // Had schedule AND check-in - count towards streak
          if (!foundMostRecentCheckIn) {
            // This is the most recent check-in, start building current streak from here
            foundMostRecentCheckIn = true
            tempStreak = 1
            currentStreak = 1
          } else {
            // Continue building the current streak
            tempStreak++
            currentStreak = tempStreak
          }
          
          // Always update longest streak
          longestStreak = Math.max(longestStreak, tempStreak)
        } else {
          // Had schedule but NO check-in - break streak
          if (foundMostRecentCheckIn) {
            // We've already found the most recent check-in, so this breaks the current streak
            // Don't update currentStreak anymore
            tempStreak = 0
          } else {
            // Haven't found most recent check-in yet, continue searching
            tempStreak = 0
          }
        }
      } else {
        // No schedule - skip this day (doesn't break streak, doesn't count)
        // Only reset if we haven't found any scheduled days yet
        if (!foundFirstScheduledDay && dayOffset === 0) {
          // Today with no schedule - no streak
          currentStreak = 0
        }
        // For previous days without schedule, just continue (don't break streak, don't count)
        // If we're building a streak, continue building it
        if (foundMostRecentCheckIn && tempStreak > 0) {
          // We're in a streak, skipping non-scheduled days doesn't break it
          // But we don't increment the streak either
        }
      }
    }

    // Check if today's check-in is completed
    const todayCheckInCompleted = checkInDates.has(todayStr) && pastScheduledDates.has(todayStr)

    // Count completed days (past days with schedule AND check-in, excluding exception dates)
    const completedDays = Array.from(pastScheduledDates).filter(date => 
      checkInDates.has(date) && !scheduledDatesWithExceptions.has(date)
    ).length
    
    // Find missed schedule dates (past scheduled dates without check-in AND without exception)
    // Exception dates should NOT be counted as missed schedules
    const missedScheduleDates = Array.from(pastScheduledDates)
      .filter(date => !checkInDates.has(date) && !scheduledDatesWithExceptions.has(date))
      .sort()
      .reverse() // Most recent first
    
    // Debug logging for streak calculation
    console.log(`[GET /worker/streak] Current streak: ${currentStreak}, Completed days: ${completedDays}, Past scheduled days: ${pastScheduledDates.size}`)

    // Get future scheduled dates (next 90 days)
    const futureEndDate = new Date(today)
    futureEndDate.setDate(futureEndDate.getDate() + 90)
    const futureScheduledDates = getScheduledDatesInRange(schedules || [], today, futureEndDate)
    
    // Calculate total scheduled days (past + future)
    const totalScheduledDaysIncludingFuture = pastScheduledDates.size + futureScheduledDates.size
    const pastScheduledDays = pastScheduledDates.size

    // Find next scheduled check-in date
    let nextCheckInDate: string | null = null
    let nextCheckInDateFormatted: string | null = null
    
    // First check if today has a schedule but no check-in yet
    if (pastScheduledDates.has(todayStr) && !checkInDates.has(todayStr)) {
      nextCheckInDate = todayStr
      nextCheckInDateFormatted = 'Today'
    } else {
      // Find next future scheduled date
      nextCheckInDate = findNextScheduledDate(schedules || [], today, 90)
      if (nextCheckInDate) {
        nextCheckInDateFormatted = formatDateForDisplay(nextCheckInDate)
      }
    }

    // Calculate next milestone (7 days, 14 days, 30 days, etc.)
    const milestones = [7, 14, 30, 60, 90]
    const nextMilestone = milestones.find(m => m > currentStreak) || null
    const daysUntilNextMilestone = nextMilestone ? nextMilestone - currentStreak : null

    // Check if worker has achieved 7-day badge
    const hasSevenDayBadge = currentStreak >= 7

    return c.json({
      currentStreak,
      longestStreak,
      todayCheckInCompleted,
      nextMilestone,
      daysUntilNextMilestone,
      hasSevenDayBadge,
      totalScheduledDays: totalScheduledDaysIncludingFuture,
      pastScheduledDays,
      completedDays,
      missedScheduleDates,
      missedScheduleCount: missedScheduleDates.length,
      exceptionDates,
      nextCheckInDate,
      nextCheckInDateFormatted,
      badge: hasSevenDayBadge ? {
        name: '7-Day Streak',
        description: 'Completed 7 consecutive days of check-ins',
        icon: '🔥',
        achieved: true,
        achievedDate: todayStr, // Approximate - could track actual achievement date
      } : null,
    }, 200)

  } catch (error: any) {
    console.error('[GET /worker/streak] Error:', error)
    return c.json({ error: 'Internal server error', details: error.message }, 500)
  }
})

export default worker

