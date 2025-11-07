import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getDashboardRoute, PUBLIC_ROUTES } from '../../config/routes'
import './ErrorPages.css'

export function Unauthorized() {
  const navigate = useNavigate()
  const { user, role, signOut } = useAuth()

  const handleGoToDashboard = () => {
    if (user && role) {
      navigate(getDashboardRoute(role as any))
    } else {
      navigate(PUBLIC_ROUTES.LOGIN)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-code">403</div>
        <h1 className="error-title">Access Denied</h1>
        <p className="error-message">
          You don't have permission to access this page.
          {role && ` Your current role is: ${role}`}
        </p>
        <div className="error-actions">
          <button onClick={handleGoToDashboard} className="btn-primary">
            {user ? 'Go to Your Dashboard' : 'Go to Login'}
          </button>
          {user && (
            <button onClick={handleSignOut} className="btn-secondary">
              Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

