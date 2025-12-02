/**
 * User Role Constants
 * 
 * Centralized role definitions to ensure consistency across backend and frontend.
 * These values must match frontend/src/types/roles.ts
 * 
 * SECURITY: Always validate roles on the backend. Frontend validation is for UX only.
 */

export const ROLES = {
  WORKER: 'worker',
  SUPERVISOR: 'supervisor',
  WHS_CONTROL_CENTER: 'whs_control_center',
  EXECUTIVE: 'executive',
  CLINICIAN: 'clinician',
  TEAM_LEADER: 'team_leader',
  ADMIN: 'admin',
} as const

export type UserRole = typeof ROLES[keyof typeof ROLES]

/**
 * All valid roles array - use this for validation
 */
export const VALID_ROLES: UserRole[] = [
  ROLES.WORKER,
  ROLES.SUPERVISOR,
  ROLES.WHS_CONTROL_CENTER,
  ROLES.EXECUTIVE,
  ROLES.CLINICIAN,
  ROLES.TEAM_LEADER,
  ROLES.ADMIN,
]

/**
 * Roles that executives can create/manage
 */
export const EXECUTIVE_MANAGED_ROLES: UserRole[] = [
  ROLES.SUPERVISOR,
  ROLES.CLINICIAN,
  ROLES.WHS_CONTROL_CENTER,
]

/**
 * Roles that executives can assign (includes team_leader and worker for hierarchy)
 */
export const EXECUTIVE_ASSIGNABLE_ROLES: UserRole[] = [
  ...EXECUTIVE_MANAGED_ROLES,
  ROLES.TEAM_LEADER,
  ROLES.WORKER,
]

/**
 * Roles that can be created via public registration
 */
export const PUBLIC_REGISTRATION_ROLES: UserRole[] = [
  ROLES.WORKER,
]

/**
 * Validate if a role is valid
 */
export function isValidRole(role: string): role is UserRole {
  return VALID_ROLES.includes(role as UserRole)
}

/**
 * Validate if a role can be assigned by an executive
 */
export function isExecutiveAssignableRole(role: string): boolean {
  return EXECUTIVE_ASSIGNABLE_ROLES.includes(role as UserRole)
}

