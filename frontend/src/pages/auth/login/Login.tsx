import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getDashboardRoute } from '../../../config/routes'
import { API_BASE_URL } from '../../../config/api'
import { useAuth } from '../../../contexts/AuthContext'
import { handleApiResponse, isValidEmail } from '../../../utils/apiHelpers'
import './Login.css'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { setRole, refreshAuth } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    
    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: trimmedEmail, password }),
      })

      const result = await handleApiResponse<{ user: { role: string } }>(response)

      if (!result.success) {
        setError(result.error || 'Failed to sign in. Please try again.')
        setLoading(false)
        return
      }

      if (!result.data?.user?.role) {
        setError('User role not found. Please contact administrator.')
        setLoading(false)
        return
      }

      setRole(result.data.user.role)
      await refreshAuth()
      await new Promise(resolve => setTimeout(resolve, 200))
      
      navigate(getDashboardRoute(result.data.user.role as any), { replace: true })
    } catch (err: any) {
      console.error('Login error:', err)
      setError('Failed to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-slogan">
          Ensuring Safe and Ready Workplaces, Every Day.
        </div>
        
        <div className="auth-logo">
          <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 10C25 10 30 12 30 15V25C30 28 25 30 20 30C15 30 10 28 10 25V15C10 12 15 10 20 10Z"
              fill="#0d0d0d"
            />
            <path
              d="M15 20C15 22.5 17.5 25 20 25C22.5 25 25 22.5 25 20V15C25 12.5 22.5 10 20 10C17.5 10 15 12.5 15 15V20Z"
              fill="#6e7681"
            />
            <path
              d="M25 20C25 17.5 22.5 15 20 15C17.5 15 15 17.5 15 20V25C15 27.5 17.5 30 20 30C22.5 30 25 27.5 25 25V20Z"
              fill="#dfe1e6"
            />
          </svg>
        </div>

        <h1 className="auth-title">Welcome back!</h1>
        <p className="auth-subtitle">
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">
            Sign up
          </Link>
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-input-group">
              <input
                type="email"
                placeholder="Work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                required
              />
            </div>

            <div className="auth-input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-password-toggle"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {showPassword ? (
                    <>
                      <path d="M2 2L18 18M11.5 11.5C11.2239 11.7761 10.7761 11.7761 10.5 11.5M8.5 8.5C8.77614 8.22386 9.22386 8.22386 9.5 8.5M3 10C3 10 5 5 10 5C12.5 5 14.5 7 15.5 9M17 10C17 10 15 15 10 15C7.5 15 5.5 13 4.5 11" />
                      <circle cx="10" cy="10" r="3" />
                    </>
                  ) : (
                    <>
                      <path d="M2 10C2 10 4 5 9 5C14 5 17 10 17 10M17 10C17 10 15 15 10 15C5 15 2 10 2 10" />
                      <circle cx="10" cy="10" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="auth-button"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

      </div>
    </div>
  )
}

