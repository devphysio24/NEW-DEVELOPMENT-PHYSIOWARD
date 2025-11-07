import { useAuth } from '../../../contexts/AuthContext'
import './ExecutiveDashboard.css'

export function ExecutiveDashboard() {
  const { user, business_name, signOut } = useAuth()

  return (
    <div className="role-dashboard">
      <div className="role-dashboard-header">
        <div>
          <h1>Executive Dashboard</h1>
          <p className="role-subtitle">
            Welcome back, {user?.email}
            {business_name && <span> • {business_name}</span>}
          </p>
        </div>
        <button onClick={signOut} className="role-logout-btn">
          Logout
        </button>
      </div>

      <div className="role-dashboard-content">
        <div className="role-dashboard-card">
          <h2>Executive Overview</h2>
          <p>High-level insights, strategic metrics, and organizational performance.</p>
        </div>

        <div className="role-dashboard-grid">
          <div className="role-dashboard-card">
            <h3>Strategic Metrics</h3>
            <p>View key performance indicators</p>
          </div>

          <div className="role-dashboard-card">
            <h3>Organizational Reports</h3>
            <p>Access comprehensive reports</p>
          </div>

          <div className="role-dashboard-card">
            <h3>Decision Support</h3>
            <p>Analytics and insights for decision making</p>
          </div>

          <div className="role-dashboard-card">
            <h3>Leadership Tools</h3>
            <p>Tools for executive leadership</p>
          </div>
        </div>
      </div>
    </div>
  )
}

