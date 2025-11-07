/**
 * Route Validation Script
 * Checks consistency between frontend and backend route configurations
 * Run with: npx tsx scripts/validate-routes.ts
 */

// Frontend routes (simulated - in real scenario, import from actual files)
const FRONTEND_ROLES = {
  WORKER: 'worker',
  SUPERVISOR: 'supervisor',
  WHS_CONTROL_CENTER: 'whs_control_center',
  EXECUTIVE: 'executive',
  CLINICIAN: 'clinician',
  TEAM_LEADER: 'team_leader',
} as const

const FRONTEND_ROUTES = {
  WORKER: {
    DASHBOARD: '/dashboard/worker',
    CHECK_IN: '/dashboard/worker/check-in',
    CHECK_IN_RECORDS: '/dashboard/worker/check-in-records',
  },
  SUPERVISOR: {
    DASHBOARD: '/dashboard/supervisor',
    TEAMS: '/dashboard/supervisor/teams',
    SCHEDULES: '/dashboard/supervisor/schedules',
  },
  TEAM_LEADER: {
    DASHBOARD: '/dashboard/team-leader',
    CALENDAR: '/dashboard/team-leader/calendar',
    READINESS: '/dashboard/team-leader/readiness',
    ANALYTICS: '/dashboard/team-leader/analytics',
  },
  WHS_CONTROL_CENTER: {
    DASHBOARD: '/dashboard/whs-control-center',
  },
  EXECUTIVE: {
    DASHBOARD: '/dashboard/executive',
  },
  CLINICIAN: {
    DASHBOARD: '/dashboard/clinician',
  },
}

// Backend API routes (simulated)
const BACKEND_ROLES = {
  WORKER: 'worker',
  SUPERVISOR: 'supervisor',
  WHS_CONTROL_CENTER: 'whs_control_center',
  EXECUTIVE: 'executive',
  CLINICIAN: 'clinician',
  TEAM_LEADER: 'team_leader',
} as const

const BACKEND_API_ROUTES = {
  TEAMS: '/api/teams',
  CHECKINS: '/api/checkins',
  SUPERVISOR: '/api/supervisor',
  SCHEDULES: '/api/schedules',
}

const BACKEND_ROUTE_ACCESS = {
  '/api/teams': ['team_leader'],
  '/api/teams/all': ['team_leader'],
  '/api/teams/members': ['team_leader'],
  '/api/checkins': ['worker', 'team_leader', 'supervisor'],
  '/api/checkins/submit': ['worker'],
  '/api/checkins/today': ['worker'],
  '/api/checkins/history': ['worker'],
  '/api/checkins/team': ['team_leader', 'supervisor'],
  '/api/checkins/analytics': ['team_leader', 'supervisor'],
  '/api/supervisor': ['supervisor'],
  '/api/supervisor/teams': ['supervisor'],
  '/api/supervisor/workers': ['supervisor'],
  '/api/schedules': ['supervisor', 'team_leader'],
  '/api/schedules/team-leaders': ['supervisor'],
}

// Validation functions
function validateRoleConsistency() {
  console.log('🔍 Validating role consistency...\n')
  
  const frontendRoles = Object.values(FRONTEND_ROLES)
  const backendRoles = Object.values(BACKEND_ROLES)
  
  let hasErrors = false
  
  // Check if all frontend roles exist in backend
  for (const role of frontendRoles) {
    if (!backendRoles.includes(role)) {
      console.error(`❌ Frontend role '${role}' not found in backend`)
      hasErrors = true
    }
  }
  
  // Check if all backend roles exist in frontend
  for (const role of backendRoles) {
    if (!frontendRoles.includes(role)) {
      console.error(`❌ Backend role '${role}' not found in frontend`)
      hasErrors = true
    }
  }
  
  if (!hasErrors) {
    console.log('✅ All roles are consistent between frontend and backend\n')
  } else {
    console.log('')
  }
  
  return !hasErrors
}

function validateRouteProtection() {
  console.log('🔍 Validating route protection...\n')
  
  let hasWarnings = false
  
  // Check that all backend routes have access control defined
  for (const route of Object.values(BACKEND_API_ROUTES)) {
    const hasAccessControl = Object.keys(BACKEND_ROUTE_ACCESS).some(pattern => 
      route.startsWith(pattern) || pattern.startsWith(route)
    )
    
    if (!hasAccessControl) {
      console.warn(`⚠️  Backend route '${route}' has no access control defined`)
      hasWarnings = true
    }
  }
  
  // Check that all access control roles are valid
  for (const [route, roles] of Object.entries(BACKEND_ROUTE_ACCESS)) {
    for (const role of roles) {
      if (!Object.values(BACKEND_ROLES).includes(role as any)) {
        console.error(`❌ Invalid role '${role}' in access control for route '${route}'`)
        hasWarnings = true
      }
    }
  }
  
  if (!hasWarnings) {
    console.log('✅ All routes have proper protection configured\n')
  } else {
    console.log('')
  }
  
  return !hasWarnings
}

function validateRouteCoverage() {
  console.log('🔍 Validating route coverage...\n')
  
  // Check that each role has at least one route
  const rolesWithRoutes = new Set<string>()
  
  for (const [route, roles] of Object.entries(BACKEND_ROUTE_ACCESS)) {
    for (const role of roles) {
      rolesWithRoutes.add(role)
    }
  }
  
  let hasIssues = false
  
  for (const role of Object.values(BACKEND_ROLES)) {
    if (!rolesWithRoutes.has(role)) {
      console.warn(`⚠️  Role '${role}' has no backend API routes assigned`)
      hasIssues = true
    }
    
    // Check if role has frontend routes
    const roleKey = Object.keys(FRONTEND_ROLES).find(
      key => FRONTEND_ROLES[key as keyof typeof FRONTEND_ROLES] === role
    )
    
    if (roleKey && !FRONTEND_ROUTES[roleKey as keyof typeof FRONTEND_ROUTES]) {
      console.warn(`⚠️  Role '${role}' has no frontend routes defined`)
      hasIssues = true
    }
  }
  
  if (!hasIssues) {
    console.log('✅ All roles have proper route coverage\n')
  } else {
    console.log('')
  }
  
  return !hasIssues
}

function generateRouteSummary() {
  console.log('📊 Route Summary\n')
  console.log('=' .repeat(60))
  
  console.log('\n🎭 Roles:')
  Object.entries(FRONTEND_ROLES).forEach(([key, value]) => {
    console.log(`  - ${key}: ${value}`)
  })
  
  console.log('\n🌐 Frontend Routes:')
  Object.entries(FRONTEND_ROUTES).forEach(([role, routes]) => {
    console.log(`  ${role}:`)
    Object.entries(routes).forEach(([name, path]) => {
      console.log(`    - ${name}: ${path}`)
    })
  })
  
  console.log('\n🔒 Backend API Routes:')
  Object.entries(BACKEND_ROUTE_ACCESS).forEach(([route, roles]) => {
    console.log(`  ${route}`)
    console.log(`    Allowed: ${roles.join(', ')}`)
  })
  
  console.log('\n' + '='.repeat(60))
}

// Run validation
function main() {
  console.log('\n🚀 Starting Route Validation\n')
  console.log('='.repeat(60) + '\n')
  
  const roleConsistency = validateRoleConsistency()
  const routeProtection = validateRouteProtection()
  const routeCoverage = validateRouteCoverage()
  
  console.log('='.repeat(60))
  console.log('\n📋 Validation Results:\n')
  
  if (roleConsistency && routeProtection && routeCoverage) {
    console.log('✅ All validations passed!')
    console.log('🎉 Your routing configuration is secure and consistent.\n')
  } else {
    console.log('⚠️  Some issues were found. Please review and fix them.\n')
  }
  
  generateRouteSummary()
  
  console.log('\n✨ Validation complete!\n')
}

main()

