import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../../../config/api'
import { ROLE_OPTIONS, type UserRole } from '../../../types/roles'
import { getDashboardRoute } from '../../../config/routes'
import { useAuth } from '../../../contexts/AuthContext'
import { handleApiResponse, isValidEmail, isValidBusinessRegNumber } from '../../../utils/apiHelpers'
import './Register.css'

export function Register() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>('worker')
  const [businessName, setBusinessName] = useState('')
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()
  const { setRole: setAuthRole, refreshAuth } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedBusinessName = role === 'supervisor' ? businessName.trim() : ''
    const trimmedRegNumber = role === 'supervisor' ? businessRegistrationNumber.trim() : ''

    // Validation
    if (!trimmedFirstName || !trimmedLastName) {
      setError('First Name and Last Name are required')
      setLoading(false)
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setError('Please enter a valid email address')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    // Supervisor-specific validation
    if (role === 'supervisor') {
      if (!trimmedBusinessName || trimmedBusinessName.length < 2) {
        setError('Business Name is required (minimum 2 characters)')
        setLoading(false)
        return
      }

      if (!trimmedRegNumber || !isValidBusinessRegNumber(trimmedRegNumber)) {
        setError('Valid Business Registration Number is required')
        setLoading(false)
        return
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          first_name: trimmedFirstName,
          last_name: trimmedLastName,
          email: trimmedEmail,
          password,
          role,
          business_name: role === 'supervisor' ? trimmedBusinessName : undefined,
          business_registration_number: role === 'supervisor' ? trimmedRegNumber : undefined,
        }),
      })

      const result = await handleApiResponse<{ user: { role: string } }>(response)

      if (!result.success) {
        if (result.error?.includes('already exists') || result.error?.includes('already registered')) {
          setError('Email already registered. Please sign in instead.')
        } else if (result.error?.includes('Invalid email')) {
          setError('Please enter a valid email address')
        } else {
          setError(result.error || 'Failed to sign up. Please try again.')
        }
        setLoading(false)
        return
      }

      const userRole = result.data?.user?.role || role
      if (userRole) {
        setAuthRole(userRole)
      }
      
      await refreshAuth()
      await new Promise(resolve => setTimeout(resolve, 100))

      setSuccess('Account successfully created! Redirecting to dashboard...')
      setTimeout(() => {
        navigate(getDashboardRoute(userRole as any), { replace: true })
      }, 1000)
    } catch (err: any) {
      console.error('Registration error:', err)
      if (err.message?.includes('already registered') || err.message?.includes('already exists')) {
        setError('Email already registered. Please sign in instead.')
      } else {
        setError('Failed to sign up. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 10C25 10 30 12 30 15V25C30 28 25 30 20 30C15 30 10 28 10 25V15C10 12 15 10 20 10Z"
              fill="#FF6B6B"
            />
            <path
              d="M15 20C15 22.5 17.5 25 20 25C22.5 25 25 22.5 25 20V15C25 12.5 22.5 10 20 10C17.5 10 15 12.5 15 15V20Z"
              fill="#4ECDC4"
            />
            <path
              d="M25 20C25 17.5 22.5 15 20 15C17.5 15 15 17.5 15 20V25C15 27.5 17.5 30 20 30C22.5 30 25 27.5 25 25V20Z"
              fill="#FFE66D"
            />
          </svg>
        </div>

        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Sign in
          </Link>
        </p>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-input-group">
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="auth-input"
              required
            />
          </div>

          <div className="auth-input-group">
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="auth-input"
              required
            />
          </div>

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

          <div className="auth-input-group">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="auth-input"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                {showConfirmPassword ? (
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

          <div className="auth-input-group">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="auth-input"
              required
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Business Information Fields - Required for Supervisors */}
          {role === 'supervisor' && (
            <>
              <div className="auth-input-group">
                <input
                  type="text"
                  placeholder="Business Name *"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="auth-input"
                  required
                />
              </div>

              <div className="auth-input-group">
                <input
                  type="text"
                  placeholder="Business Registration Number *"
                  value={businessRegistrationNumber}
                  onChange={(e) => setBusinessRegistrationNumber(e.target.value)}
                  className="auth-input"
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-button"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  )
}

