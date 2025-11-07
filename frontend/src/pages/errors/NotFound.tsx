import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getDashboardRoute, PUBLIC_ROUTES } from '../../config/routes'
import './ErrorPages.css'

export function NotFound() {
  const navigate = useNavigate()
  const { user, role } = useAuth()

  const handleGoBack = () => {
    if (user && role) {
      navigate(getDashboardRoute(role as any))
    } else {
      navigate(PUBLIC_ROUTES.LOGIN)
    }
  }

  return (
    <div className="error-page">
      <div className="error-container">
        <div className="error-code">404</div>
        <h1 className="error-title">Page Not Found</h1>
        <p className="error-message">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="error-actions">
          <button onClick={handleGoBack} className="btn-primary">
            {user ? 'Go to Dashboard' : 'Go to Login'}
          </button>
          <button onClick={() => navigate(-1)} className="btn-secondary">
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

