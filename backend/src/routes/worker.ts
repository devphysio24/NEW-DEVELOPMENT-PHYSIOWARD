import { Hono } from 'hono'
import { authMiddleware, requireRole } from '../middleware/auth'
import { getAdminClient } from '../utils/adminClient'
import { analyzeIncident } from '../utils/openai'

const worker = new Hono()

// Check if worker can submit incident report (check for active exceptions)
worker.get('/can-report-incident', authMiddleware, requireRole(['worker']), async (c) => {
  try {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const adminClient = getAdminClient()

    // Check if worker has active exception
    const { data: existingException, error: existingError } = await adminClient
      .from('worker_exceptions')
      .select('id, exception_type, reason, start_date, end_date, notes')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (existingException) {
      // Extract case status from notes if available
      const caseStatus = existingException.notes?.includes('case_status') 
        ? existingException.notes.match(/case_status["\s]*[:=]["\s]*([^,}\s"]+)/i)?.[1]?.toLowerCase()
        : null
      
      const isClosed = caseStatus === 'closed'

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

    // Check if worker already has active exception or incident report
    const { data: existingException, error: existingError } = await adminClient
      .from('worker_exceptions')
      .select('id, exception_type, reason, start_date, end_date, notes')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (existingException) {
      // Extract case status from notes if available
      const caseStatus = existingException.notes?.includes('case_status') 
        ? existingException.notes.match(/case_status["\s]*[:=]["\s]*([^,}\s"]+)/i)?.[1]?.toLowerCase()
        : null
      
      const isClosed = caseStatus === 'closed'
      
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

export default worker

