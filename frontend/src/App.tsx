import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { DashboardRedirect } from './components/DashboardRedirect'
import { Loading } from './components/Loading'
import { Login } from './pages/auth/login/Login'
import { Register } from './pages/auth/register/Register'
import { WorkerDashboard } from './pages/dashboard/worker/WorkerDashboard'
import { WorkerCalendar } from './pages/dashboard/worker/WorkerCalendar'
import { WorkerAppointments } from './pages/dashboard/worker/WorkerAppointments'
import { CheckInRecords } from './pages/dashboard/worker/CheckInRecords'
import { RecoveryPlan } from './pages/dashboard/worker/RecoveryPlan'
import { ReportIncident } from './pages/dashboard/worker/ReportIncident'
import { SupervisorDashboard } from './pages/dashboard/supervisor/SupervisorDashboard'
import { SupervisorTeams } from './pages/dashboard/supervisor/SupervisorTeams'
import { SupervisorAnalytics } from './pages/dashboard/supervisor/SupervisorAnalytics'
import { IncidentManagement } from './pages/dashboard/supervisor/IncidentManagement'
import { MyIncidents } from './pages/dashboard/supervisor/MyIncidents'
import { TeamLeadersPerformance } from './pages/dashboard/supervisor/TeamLeadersPerformance'
import { WhsControlCenterDashboard } from './pages/dashboard/whs-control-center/WhsControlCenterDashboard'
import { RecordCases } from './pages/dashboard/whs-control-center/RecordCases'
import { WhsAnalytics } from './pages/dashboard/whs-control-center/WhsAnalytics'
import { Notifications } from './pages/dashboard/notifications/Notifications'
import { ExecutiveDashboard } from './pages/dashboard/executive/ExecutiveDashboard'
import { ClinicianDashboard } from './pages/dashboard/clinician/ClinicianDashboard'
import { MyTasks } from './pages/dashboard/clinician/MyTasks'
import { AppointmentManagement } from './pages/dashboard/clinician/AppointmentManagement'
import { ClinicianAnalytics } from './pages/dashboard/clinician/ClinicianAnalytics'
import { TeamLeaderDashboard } from './pages/dashboard/team-leader/TeamLeaderDashboard'
import { TeamMembers } from './pages/dashboard/team-leader/TeamMembers'
import { TeamLeaderCalendar } from './pages/dashboard/team-leader/TeamLeaderCalendar'
import { WorkerReadiness } from './pages/dashboard/team-leader/WorkerReadiness'
import { CheckInAnalytics } from './pages/dashboard/team-leader/CheckInAnalytics'
import { TeamLeaderLogs } from './pages/dashboard/team-leader/TeamLeaderLogs'
import { WorkerSchedules } from './pages/dashboard/team-leader/WorkerSchedules'
import { Profile } from './pages/dashboard/profile/Profile'
import { NotFound } from './pages/errors/NotFound'
import { Unauthorized } from './pages/errors/Unauthorized'
import { ROLES } from './types/roles'
import { PUBLIC_ROUTES, PROTECTED_ROUTES } from './config/routes'
import './App.css'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <Loading 
        fullScreen 
        message="Loading application..." 
        size="large"
      />
    )
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path={PUBLIC_ROUTES.LOGIN}
        element={user ? <DashboardRedirect /> : <Login />} 
      />
      <Route 
        path={PUBLIC_ROUTES.REGISTER}
        element={user ? <DashboardRedirect /> : <Register />} 
      />
      
      {/* Worker Routes */}
      <Route
        path={PROTECTED_ROUTES.WORKER.DASHBOARD}
        element={
          <ProtectedRoute requiredRole={ROLES.WORKER}>
            <WorkerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.WORKER.CALENDAR}
        element={
          <ProtectedRoute requiredRole={ROLES.WORKER}>
            <WorkerCalendar />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.WORKER.APPOINTMENTS}
        element={
          <ProtectedRoute requiredRole={ROLES.WORKER}>
            <WorkerAppointments />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.WORKER.CHECK_IN_RECORDS}
        element={
          <ProtectedRoute requiredRole={ROLES.WORKER}>
            <CheckInRecords />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.WORKER.RECOVERY_PLAN}
        element={
          <ProtectedRoute requiredRole={ROLES.WORKER}>
            <RecoveryPlan />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.WORKER.REPORT_INCIDENT}
        element={
          <ProtectedRoute requiredRole={ROLES.WORKER}>
            <ReportIncident />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.WORKER.NOTIFICATIONS}
        element={
          <ProtectedRoute requiredRole={ROLES.WORKER}>
            <Notifications />
          </ProtectedRoute>
        }
      />
      
      {/* Supervisor Routes */}
      <Route
        path={PROTECTED_ROUTES.SUPERVISOR.DASHBOARD}
        element={
          <ProtectedRoute requiredRole={ROLES.SUPERVISOR}>
            <SupervisorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.SUPERVISOR.TEAMS}
        element={
          <ProtectedRoute requiredRole={ROLES.SUPERVISOR}>
            <SupervisorTeams />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.SUPERVISOR.ANALYTICS}
        element={
          <ProtectedRoute requiredRole={ROLES.SUPERVISOR}>
            <SupervisorAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.SUPERVISOR.INCIDENTS}
        element={
          <ProtectedRoute requiredRole={ROLES.SUPERVISOR}>
            <IncidentManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.SUPERVISOR.MY_INCIDENTS}
        element={
          <ProtectedRoute requiredRole={ROLES.SUPERVISOR}>
            <MyIncidents />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.SUPERVISOR.TEAM_LEADERS_PERFORMANCE}
        element={
          <ProtectedRoute requiredRole={ROLES.SUPERVISOR}>
            <TeamLeadersPerformance />
          </ProtectedRoute>
        }
      />
      
      {/* Team Leader Routes */}
      <Route
        path={PROTECTED_ROUTES.TEAM_LEADER.DASHBOARD}
        element={
          <ProtectedRoute requiredRole={ROLES.TEAM_LEADER}>
            <TeamLeaderDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.TEAM_LEADER.TEAM_MEMBERS}
        element={
          <ProtectedRoute requiredRole={ROLES.TEAM_LEADER}>
            <TeamMembers />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.TEAM_LEADER.CALENDAR}
        element={
          <ProtectedRoute requiredRole={ROLES.TEAM_LEADER}>
            <TeamLeaderCalendar />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.TEAM_LEADER.READINESS}
        element={
          <ProtectedRoute requiredRole={ROLES.TEAM_LEADER}>
            <WorkerReadiness />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.TEAM_LEADER.ANALYTICS}
        element={
          <ProtectedRoute requiredRole={ROLES.TEAM_LEADER}>
            <CheckInAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.TEAM_LEADER.LOGS}
        element={
          <ProtectedRoute requiredRole={ROLES.TEAM_LEADER}>
            <TeamLeaderLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.TEAM_LEADER.WORKER_SCHEDULES}
        element={
          <ProtectedRoute requiredRole={ROLES.TEAM_LEADER}>
            <WorkerSchedules />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.TEAM_LEADER.NOTIFICATIONS}
        element={
          <ProtectedRoute requiredRole={ROLES.TEAM_LEADER}>
            <Notifications />
          </ProtectedRoute>
        }
      />
      
      {/* WHS Control Center Routes */}
      <Route
        path={PROTECTED_ROUTES.WHS_CONTROL_CENTER.DASHBOARD}
        element={
          <ProtectedRoute requiredRole={ROLES.WHS_CONTROL_CENTER}>
            <WhsControlCenterDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.WHS_CONTROL_CENTER.RECORD_CASES}
        element={
          <ProtectedRoute requiredRole={ROLES.WHS_CONTROL_CENTER}>
            <RecordCases />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.WHS_CONTROL_CENTER.ANALYTICS}
        element={
          <ProtectedRoute requiredRole={ROLES.WHS_CONTROL_CENTER}>
            <WhsAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.WHS_CONTROL_CENTER.NOTIFICATIONS}
        element={
          <ProtectedRoute requiredRole={ROLES.WHS_CONTROL_CENTER}>
            <Notifications />
          </ProtectedRoute>
        }
      />
      
      {/* Executive Routes */}
      <Route
        path={PROTECTED_ROUTES.EXECUTIVE.DASHBOARD}
        element={
          <ProtectedRoute requiredRole={ROLES.EXECUTIVE}>
            <ExecutiveDashboard />
          </ProtectedRoute>
        }
      />
      
      {/* Clinician Routes */}
      <Route
        path={PROTECTED_ROUTES.CLINICIAN.DASHBOARD}
        element={
          <ProtectedRoute requiredRole={ROLES.CLINICIAN}>
            <ClinicianDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.CLINICIAN.MY_TASKS}
        element={
          <ProtectedRoute requiredRole={ROLES.CLINICIAN}>
            <MyTasks />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.CLINICIAN.APPOINTMENTS}
        element={
          <ProtectedRoute requiredRole={ROLES.CLINICIAN}>
            <AppointmentManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.CLINICIAN.ANALYTICS}
        element={
          <ProtectedRoute requiredRole={ROLES.CLINICIAN}>
            <ClinicianAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path={PROTECTED_ROUTES.CLINICIAN.NOTIFICATIONS}
        element={
          <ProtectedRoute requiredRole={ROLES.CLINICIAN}>
            <Notifications />
          </ProtectedRoute>
        }
      />
      
      {/* Profile route - accessible to all authenticated users */}
      <Route
        path={PROTECTED_ROUTES.PROFILE}
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      
      {/* Generic dashboard route - redirects based on role */}
      <Route
        path={PROTECTED_ROUTES.DASHBOARD}
        element={
          <ProtectedRoute>
            <DashboardRedirect />
          </ProtectedRoute>
        }
      />
      
      {/* Error Routes */}
      <Route path="/unauthorized" element={<Unauthorized />} />
      
      {/* Home and Catch-All Routes */}
      <Route 
        path={PUBLIC_ROUTES.HOME}
        element={user ? <DashboardRedirect /> : <Navigate to={PUBLIC_ROUTES.LOGIN} replace />} 
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
