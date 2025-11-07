/**
 * Centralized Route Configuration
 * This file contains all route definitions and their access control rules
 */

import { ROLES, type UserRole } from '../types/roles'

// Public routes (no authentication required)
export const PUBLIC_ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  HOME: '/',
} as const

// Protected routes by role
export const PROTECTED_ROUTES = {
  // Worker routes
  WORKER: {
    DASHBOARD: '/dashboard/worker',
    CALENDAR: '/dashboard/worker/calendar',
    APPOINTMENTS: '/dashboard/worker/appointments',
    CHECK_IN_RECORDS: '/dashboard/worker/check-in-records',
    RECOVERY_PLAN: '/dashboard/worker/recovery-plan',
    REPORT_INCIDENT: '/dashboard/worker/report-incident',
    NOTIFICATIONS: '/dashboard/notifications',
  },
  
  // Supervisor routes
  SUPERVISOR: {
    DASHBOARD: '/dashboard/supervisor',
    TEAMS: '/dashboard/supervisor/teams',
    // SCHEDULES: '/dashboard/supervisor/schedules', // DISABLED: Team Leaders now assign individual schedules to workers
    ANALYTICS: '/dashboard/supervisor/analytics',
    INCIDENTS: '/dashboard/supervisor/incidents',
    MY_INCIDENTS: '/dashboard/supervisor/my-incidents',
    TEAM_LEADERS_PERFORMANCE: '/dashboard/supervisor/team-leaders-performance',
    NOTIFICATIONS: '/dashboard/notifications',
  },
  
  // Team Leader routes
  TEAM_LEADER: {
    DASHBOARD: '/dashboard/team-leader',
    TEAM_MEMBERS: '/dashboard/team-leader/team-members',
    CALENDAR: '/dashboard/team-leader/calendar',
    READINESS: '/dashboard/team-leader/readiness',
    ANALYTICS: '/dashboard/team-leader/analytics',
    LOGS: '/dashboard/team-leader/logs',
    WORKER_SCHEDULES: '/dashboard/team-leader/worker-schedules',
    NOTIFICATIONS: '/dashboard/notifications',
  },
  
  // WHS Control Center routes
  WHS_CONTROL_CENTER: {
    DASHBOARD: '/dashboard/whs-control-center',
    RECORD_CASES: '/dashboard/whs-control-center/record-cases',
    ANALYTICS: '/dashboard/whs-control-center/analytics',
    NOTIFICATIONS: '/dashboard/notifications',
  },
  
  // Executive routes
  EXECUTIVE: {
    DASHBOARD: '/dashboard/executive',
  },
  
  // Clinician routes
  CLINICIAN: {
    DASHBOARD: '/dashboard/clinician',
    MY_TASKS: '/dashboard/clinician/tasks',
    APPOINTMENTS: '/dashboard/clinician/appointments',
    ANALYTICS: '/dashboard/clinician/analytics',
    NOTIFICATIONS: '/dashboard/notifications',
  },
  
  // Generic dashboard (redirects based on role)
  DASHBOARD: '/dashboard',
  
  // Profile route (accessible to all roles)
  PROFILE: '/dashboard/profile',
} as const

// Route access control mapping
export const ROUTE_ACCESS_CONTROL: Record<string, UserRole[]> = {
  // Worker routes
  [PROTECTED_ROUTES.WORKER.DASHBOARD]: [ROLES.WORKER],
  [PROTECTED_ROUTES.WORKER.CALENDAR]: [ROLES.WORKER],
  [PROTECTED_ROUTES.WORKER.APPOINTMENTS]: [ROLES.WORKER],
  [PROTECTED_ROUTES.WORKER.CHECK_IN_RECORDS]: [ROLES.WORKER],
  [PROTECTED_ROUTES.WORKER.RECOVERY_PLAN]: [ROLES.WORKER],
  [PROTECTED_ROUTES.WORKER.REPORT_INCIDENT]: [ROLES.WORKER],
  // Notifications route is shared - defined below for TEAM_LEADER.NOTIFICATIONS
  
  // Supervisor routes
  [PROTECTED_ROUTES.SUPERVISOR.DASHBOARD]: [ROLES.SUPERVISOR],
  [PROTECTED_ROUTES.SUPERVISOR.TEAMS]: [ROLES.SUPERVISOR],
  // [PROTECTED_ROUTES.SUPERVISOR.SCHEDULES]: [ROLES.SUPERVISOR], // DISABLED: Team Leaders now assign individual schedules to workers
  [PROTECTED_ROUTES.SUPERVISOR.ANALYTICS]: [ROLES.SUPERVISOR],
  [PROTECTED_ROUTES.SUPERVISOR.INCIDENTS]: [ROLES.SUPERVISOR],
  [PROTECTED_ROUTES.SUPERVISOR.MY_INCIDENTS]: [ROLES.SUPERVISOR],
  [PROTECTED_ROUTES.SUPERVISOR.TEAM_LEADERS_PERFORMANCE]: [ROLES.SUPERVISOR],
  
  // Team Leader routes
  [PROTECTED_ROUTES.TEAM_LEADER.DASHBOARD]: [ROLES.TEAM_LEADER],
  [PROTECTED_ROUTES.TEAM_LEADER.TEAM_MEMBERS]: [ROLES.TEAM_LEADER],
  [PROTECTED_ROUTES.TEAM_LEADER.CALENDAR]: [ROLES.TEAM_LEADER],
  [PROTECTED_ROUTES.TEAM_LEADER.READINESS]: [ROLES.TEAM_LEADER],
  [PROTECTED_ROUTES.TEAM_LEADER.ANALYTICS]: [ROLES.TEAM_LEADER],
  [PROTECTED_ROUTES.TEAM_LEADER.LOGS]: [ROLES.TEAM_LEADER],
  [PROTECTED_ROUTES.TEAM_LEADER.WORKER_SCHEDULES]: [ROLES.TEAM_LEADER],
  // Notifications route - shared by multiple roles (Team Leader, WHS, Clinician, Worker, Supervisor)
  [PROTECTED_ROUTES.TEAM_LEADER.NOTIFICATIONS]: [ROLES.TEAM_LEADER, ROLES.WHS_CONTROL_CENTER, ROLES.CLINICIAN, ROLES.WORKER, ROLES.SUPERVISOR],
  
  // Profile route - accessible to all authenticated users
  [PROTECTED_ROUTES.PROFILE]: [ROLES.WORKER, ROLES.SUPERVISOR, ROLES.TEAM_LEADER, ROLES.WHS_CONTROL_CENTER, ROLES.EXECUTIVE, ROLES.CLINICIAN],
  
  // WHS Control Center routes
  [PROTECTED_ROUTES.WHS_CONTROL_CENTER.DASHBOARD]: [ROLES.WHS_CONTROL_CENTER],
  [PROTECTED_ROUTES.WHS_CONTROL_CENTER.RECORD_CASES]: [ROLES.WHS_CONTROL_CENTER],
  [PROTECTED_ROUTES.WHS_CONTROL_CENTER.ANALYTICS]: [ROLES.WHS_CONTROL_CENTER],
  // Notifications route is shared - already defined above for TEAM_LEADER.NOTIFICATIONS
  
  // Executive routes
  [PROTECTED_ROUTES.EXECUTIVE.DASHBOARD]: [ROLES.EXECUTIVE],
  
  // Clinician routes
  [PROTECTED_ROUTES.CLINICIAN.DASHBOARD]: [ROLES.CLINICIAN],
  [PROTECTED_ROUTES.CLINICIAN.MY_TASKS]: [ROLES.CLINICIAN],
  [PROTECTED_ROUTES.CLINICIAN.APPOINTMENTS]: [ROLES.CLINICIAN],
  [PROTECTED_ROUTES.CLINICIAN.ANALYTICS]: [ROLES.CLINICIAN],
  // Notifications route is shared - already defined above for WHS_CONTROL_CENTER.NOTIFICATIONS
}

// Helper function to check if a route requires authentication
export function isProtectedRoute(path: string): boolean {
  return path.startsWith('/dashboard')
}

// Helper function to check if user has access to a route
export function hasRouteAccess(path: string, userRole: UserRole | null): boolean {
  if (!userRole) return false
  
  const allowedRoles = ROUTE_ACCESS_CONTROL[path]
  if (!allowedRoles) {
    // If route not in access control, check if it's a generic dashboard route
    if (path === PROTECTED_ROUTES.DASHBOARD) {
      return true // Generic dashboard is accessible to all authenticated users
    }
    return false
  }
  
  return allowedRoles.includes(userRole)
}

// Helper function to get the correct dashboard route for a role
export function getDashboardRoute(role: UserRole): string {
  switch (role) {
    case ROLES.WORKER:
      return PROTECTED_ROUTES.WORKER.DASHBOARD
    case ROLES.SUPERVISOR:
      return PROTECTED_ROUTES.SUPERVISOR.DASHBOARD
    case ROLES.TEAM_LEADER:
      return PROTECTED_ROUTES.TEAM_LEADER.DASHBOARD
    case ROLES.WHS_CONTROL_CENTER:
      return PROTECTED_ROUTES.WHS_CONTROL_CENTER.DASHBOARD
    case ROLES.EXECUTIVE:
      return PROTECTED_ROUTES.EXECUTIVE.DASHBOARD
    case ROLES.CLINICIAN:
      return PROTECTED_ROUTES.CLINICIAN.DASHBOARD
    default:
      return PUBLIC_ROUTES.LOGIN
  }
}

// Helper function to check if a path is a public route
export function isPublicRoute(path: string): boolean {
  return Object.values(PUBLIC_ROUTES).includes(path as any)
}

