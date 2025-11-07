import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../../../components/DashboardLayout'
import { Loading } from '../../../components/Loading'
import { useAuth } from '../../../contexts/AuthContext'
import { API_BASE_URL } from '../../../config/api'
import { PROTECTED_ROUTES } from '../../../config/routes'
import './Profile.css'

export function Profile() {
  const { user, first_name, last_name, business_name, business_registration_number, role, refreshAuth } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '', // Password required for saving profile changes
    business_name: '',
    business_registration_number: '',
  })

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })

  const [showPasswords, setShowPasswords] = useState({
    password: false, // For profile edit form
    old_password: false,
    new_password: false,
    confirm_password: false,
  })

  useEffect(() => {
    // Load current user data
    if (user) {
      setFormData({
        first_name: first_name || '',
        last_name: last_name || '',
        email: user.email || '',
        password: '', // Password field starts empty
        business_name: business_name || '',
        business_registration_number: business_registration_number || '', // Load from AuthContext
      })
      setLoading(false)
    }
  }, [user, first_name, last_name, business_name, business_registration_number])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
    // Clear errors when user starts typing
    if (error) setError(null)
    if (success) setSuccess(null)
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setPasswordData(prev => ({
      ...prev,
      [name]: value,
    }))
    // Clear errors when user starts typing
    if (passwordError) setPasswordError(null)
    if (passwordSuccess) setPasswordSuccess(null)
  }

  const togglePasswordVisibility = (field: 'password' | 'old_password' | 'new_password' | 'confirm_password') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    // Validation
    if (!formData.first_name?.trim()) {
      setError('First name is required')
      setSaving(false)
      return
    }

    if (!formData.last_name?.trim()) {
      setError('Last name is required')
      setSaving(false)
      return
    }

    // Supervisor-specific validation: business_name and business_registration_number are required
    if (role === 'supervisor') {
      if (!formData.business_name?.trim()) {
        setError('Business Name is required for supervisors')
        setSaving(false)
        return
      }

      if (!formData.business_registration_number?.trim()) {
        setError('Business Registration Number is required for supervisors')
        setSaving(false)
        return
      }
    }

    if (!formData.email?.trim()) {
      setError('Email is required')
      setSaving(false)
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email.trim())) {
      setError('Please enter a valid email address')
      setSaving(false)
      return
    }

    // Password validation - required for saving profile changes
    if (!formData.password?.trim()) {
      setError('Password is required to save changes')
      setSaving(false)
      return
    }

    try {
      // Optimize: Create abort controller for request timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PATCH',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password, // Send password for verification
          business_name: role === 'worker' ? undefined : (formData.business_name.trim() || null), // Don't send if worker
          business_registration_number: formData.business_registration_number.trim() || null,
        }),
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to update profile' }))
        throw new Error(data.error || 'Failed to update profile')
      }

      await response.json().catch(() => ({}))
      setSuccess('Profile updated successfully!')
      
      // Clear password field after successful save
      setFormData(prev => ({
        ...prev,
        password: '',
      }))
      
      // Refresh auth context to get updated user data
      await refreshAuth()
      
      // If supervisor just completed business info, redirect to dashboard
      if (role === 'supervisor' && formData.business_name.trim() && formData.business_registration_number.trim()) {
        setTimeout(() => {
          navigate(PROTECTED_ROUTES.SUPERVISOR.DASHBOARD)
        }, 1000)
      }
    } catch (err: any) {
      // Handle different error types
      if (err.name === 'AbortError') {
        setError('Request timed out. Please try again.')
      } else if (err.message) {
        setError(err.message)
      } else {
        setError('Failed to update profile. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)
    setChangingPassword(true)

    // Validation
    if (!passwordData.old_password) {
      setPasswordError('Current password is required')
      setChangingPassword(false)
      return
    }

    if (!passwordData.new_password) {
      setPasswordError('New password is required')
      setChangingPassword(false)
      return
    }

    if (passwordData.new_password.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      setChangingPassword(false)
      return
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError('New passwords do not match')
      setChangingPassword(false)
      return
    }

    if (passwordData.old_password === passwordData.new_password) {
      setPasswordError('New password must be different from current password')
      setChangingPassword(false)
      return
    }

    try {
      // Optimize: Create abort controller for request timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      const response = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: 'PATCH',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          old_password: passwordData.old_password,
          new_password: passwordData.new_password,
        }),
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to change password' }))
        throw new Error(data.error || 'Failed to change password')
      }

      await response.json().catch(() => ({}))
      setPasswordSuccess('Password changed successfully!')
      
      // Clear password fields after successful change
      setPasswordData({
        old_password: '',
        new_password: '',
        confirm_password: '',
      })
    } catch (err: any) {
      // Handle different error types
      if (err.name === 'AbortError') {
        setPasswordError('Request timed out. Please try again.')
      } else if (err.message) {
        setPasswordError(err.message)
      } else {
        setPasswordError('Failed to change password. Please try again.')
      }
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <Loading message="Loading profile..." size="medium" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="profile-container">
        <div className="profile-header">
          <h1>Profile Settings</h1>
          <p className="profile-subtitle">Manage your personal information</p>
        </div>

        <div className="profile-content">
          <form onSubmit={handleSubmit} className="profile-form">
            {error && (
              <div className="profile-error">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="profile-success">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>{success}</span>
              </div>
            )}

            <div className="profile-form-section">
              <label htmlFor="first_name" className="profile-label">
                First Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="profile-input"
                placeholder="Enter your first name"
                required
                disabled={saving}
              />
            </div>

            <div className="profile-form-section">
              <label htmlFor="last_name" className="profile-label">
                Last Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="profile-input"
                placeholder="Enter your last name"
                required
                disabled={saving}
              />
            </div>

            <div className="profile-form-section">
              <label htmlFor="email" className="profile-label">
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="profile-input"
                placeholder="Enter your email address"
                required
                disabled={saving}
              />
            </div>

            <div className="profile-form-section">
              <label htmlFor="business_name" className="profile-label">
                Business Name
                {role === 'supervisor' && <span className="required">*</span>}
                {role === 'worker' && <span className="profile-readonly-badge">(Inherited from Team Leader)</span>}
              </label>
              <input
                type="text"
                id="business_name"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                className="profile-input"
                placeholder="Enter your business name (optional)"
                disabled={saving || role === 'worker'}
                readOnly={role === 'worker'}
                required={role === 'supervisor'}
              />
              <p className="profile-input-hint">
                {role === 'worker' 
                  ? 'Business name is inherited from your Team Leader and cannot be edited.'
                  : role === 'supervisor'
                  ? 'Required: Enter your business name'
                  : 'Optional: Enter your business name if you have business registration'}
              </p>
            </div>

            <div className="profile-form-section">
              <label htmlFor="business_registration_number" className="profile-label">
                Business Registration Number
                {role === 'supervisor' && <span className="required">*</span>}
              </label>
              <input
                type="text"
                id="business_registration_number"
                name="business_registration_number"
                value={formData.business_registration_number}
                onChange={handleChange}
                className="profile-input"
                placeholder="Enter your business registration number (optional)"
                disabled={saving}
                required={role === 'supervisor'}
              />
              <p className="profile-input-hint">
                {role === 'supervisor' 
                  ? 'Required: Enter your business registration number'
                  : 'Optional: Enter your business registration number'}
              </p>
            </div>

            <div className="profile-form-section">
              <label htmlFor="password" className="profile-label">
                Current Password <span className="required">*</span>
              </label>
              <div className="profile-input-wrapper">
                <input
                  type={showPasswords.password ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="profile-input"
                  placeholder="Enter your password to save changes"
                  required
                  disabled={saving}
                />
                <button
                  type="button"
                  className="profile-password-toggle"
                  onClick={() => togglePasswordVisibility('password')}
                  disabled={saving}
                >
                  {showPasswords.password ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="profile-input-hint">Required to confirm changes</p>
            </div>

            <div className="profile-form-actions">
              <button
                type="submit"
                className="profile-save-btn"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="30"></circle>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Password Change Section */}
          <div className="profile-password-section">
            <div className="profile-password-header">
              <h2>Change Password</h2>
              <p className="profile-password-subtitle">Update your password for better security</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="profile-password-form">
              {passwordError && (
                <div className="profile-error">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="profile-success">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="profile-form-section">
                <label htmlFor="old_password" className="profile-label">
                  Current Password <span className="required">*</span>
                </label>
                <div className="profile-input-wrapper">
                  <input
                    type={showPasswords.old_password ? 'text' : 'password'}
                    id="old_password"
                    name="old_password"
                    value={passwordData.old_password}
                    onChange={handlePasswordChange}
                    className="profile-input"
                    placeholder="Enter your current password"
                    required
                    disabled={changingPassword}
                  />
                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => togglePasswordVisibility('old_password')}
                    disabled={changingPassword}
                  >
                    {showPasswords.old_password ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="profile-form-section">
                <label htmlFor="new_password" className="profile-label">
                  New Password <span className="required">*</span>
                </label>
                <div className="profile-input-wrapper">
                  <input
                    type={showPasswords.new_password ? 'text' : 'password'}
                    id="new_password"
                    name="new_password"
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    className="profile-input"
                    placeholder="Enter your new password"
                    required
                    disabled={changingPassword}
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => togglePasswordVisibility('new_password')}
                    disabled={changingPassword}
                  >
                    {showPasswords.new_password ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="profile-input-hint">Must be at least 6 characters</p>
              </div>

              <div className="profile-form-section">
                <label htmlFor="confirm_password" className="profile-label">
                  Confirm New Password <span className="required">*</span>
                </label>
                <div className="profile-input-wrapper">
                  <input
                    type={showPasswords.confirm_password ? 'text' : 'password'}
                    id="confirm_password"
                    name="confirm_password"
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    className="profile-input"
                    placeholder="Confirm your new password"
                    required
                    disabled={changingPassword}
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="profile-password-toggle"
                    onClick={() => togglePasswordVisibility('confirm_password')}
                    disabled={changingPassword}
                  >
                    {showPasswords.confirm_password ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="profile-form-actions">
                <button
                  type="submit"
                  className="profile-save-btn"
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <>
                      <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="30"></circle>
                      </svg>
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

