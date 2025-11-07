# System Workflow: Worker → Team Leader → Site Supervisor

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Hierarchical Structure](#hierarchical-structure)
3. [Database Relationships](#database-relationships)
4. [Core Workflows](#core-workflows)
5. [Role-Based Permissions](#role-based-permissions)
6. [Data Flow Logic](#data-flow-logic)
7. [API Endpoints](#api-endpoints)

---

## 🎯 System Overview

Ang system na ito ay nagpapamahala sa work readiness at safety monitoring ng mga workers sa ilalim ng hierarchical structure:
- **Workers** → nagpo-provide ng daily health/readiness data
- **Team Leaders** → nagmo-monitor at nagma-manage ng kanilang team members
- **Site Supervisors** → nagmo-monitor ng multiple teams at nagpo-provide ng oversight

---

## 🏗️ Hierarchical Structure

```
Site Supervisor (supervisor_id)
    ↓ oversees
Multiple Teams
    ↓ each team has
Team Leader (team_leader_id)
    ↓ manages
Multiple Workers (team_members)
```

### Key Relationships:
- **1 Supervisor** → **Many Teams** (via `teams.supervisor_id`)
- **1 Team Leader** → **1 Team** (via `teams.team_leader_id`)
- **1 Team** → **Many Workers** (via `team_members.team_id`)

---

## 🗄️ Database Relationships

### Main Tables:

#### 1. **users** table
- Stores all user accounts (workers, team leaders, supervisors)
- `role` field: `'worker' | 'team_leader' | 'supervisor' | 'whs_control_center' | 'executive' | 'clinician'`

#### 2. **teams** table
```sql
teams {
  id: UUID
  name: TEXT
  site_location: TEXT
  team_leader_id: UUID → users.id (ONE team per team leader)
  supervisor_id: UUID → users.id (ONE supervisor per team)
}
```

#### 3. **team_members** table
```sql
team_members {
  id: UUID
  team_id: UUID → teams.id
  user_id: UUID → users.id (workers only)
  compliance_percentage: INTEGER (0-100)
  phone: TEXT
}
```

#### 4. **daily_checkins** table
- Stores worker daily check-in data
- `user_id` → links to worker
- Contains: pain_level, fatigue_level, stress_level, sleep_quality, predicted_readiness

#### 5. **warm_ups** table
- Tracks warm-up completion per worker per day
- `user_id`, `warm_up_date`, `completed`

#### 6. **worker_exceptions** table
- Tracks incidents, transfers, medical leaves, etc.
- Can be created by Team Leader or Supervisor
- Can be assigned to WHS (Workplace Health & Safety)

---

## 🔄 Core Workflows

### 1. **Daily Check-In Workflow**

#### Worker Level:
```
Worker logs in
  ↓
Views Worker Dashboard
  ↓
1. Completes Warm-Up Exercise (optional)
   → POST /api/checkins/warm-up
   → Records in warm_ups table
  ↓
2. Submits Daily Check-In
   → POST /api/checkins
   → Provides: pain_level, fatigue_level, stress_level, sleep_quality
   → System calculates: predicted_readiness (Green/Yellow/Red)
   → Records in daily_checkins table
```

**Check-in Data:**
- Pain Level (0-10)
- Fatigue Level (0-10)
- Stress Level (0-10)
- Sleep Quality (0-12)
- Predicted Readiness: `Green | Yellow | Red`
- Additional Notes (optional)

#### Team Leader Level:
```
Team Leader logs in
  ↓
Views Team Dashboard
  ↓
GET /api/teams/check-ins?date=YYYY-MM-DD
  ↓
Sees all team members' check-in status:
  - ✅ Checked In / ❌ Pending
  - ✅ Warm-Up Complete / ❌ Not Done
  - Status: Green / Amber (Yellow) / Red / Pending
  - Workers with active exceptions
```

**Team Leader can:**
- View check-ins for a specific date or date range
- Filter by status (Green/Amber/Red/Pending)
- See statistics: completion rate, status distribution
- View worker details (pain, fatigue, stress levels)

#### Supervisor Level:
```
Supervisor logs in
  ↓
Views Supervisor Dashboard
  ↓
GET /api/supervisor/dashboard
  ↓
Aggregated view of ALL teams:
  - Total workers across all assigned teams
  - Overall completion rates
  - Status summary (Green/Amber/Pending)
  - Incidents today
  - Near misses this week
  - Workers requiring attention
```

**Supervisor can:**
- See metrics for all teams under their supervision
- Identify teams/workers needing attention
- View team leader performance metrics

---

### 2. **Team Management Workflow**

#### Supervisor Creates Team Leader:
```
Supervisor
  ↓
POST /api/supervisor/team-leaders
  ↓
Creates:
  1. New user with role='team_leader'
  2. New team with:
     - team_leader_id = new user
     - supervisor_id = supervisor
     - name, site_location
```

#### Team Leader Manages Workers:
```
Team Leader
  ↓
POST /api/teams/members
  ↓
Adds worker to team:
  1. Checks if user exists (by email)
  2. If exists → adds to team_members
  3. If not → creates new user + adds to team_members
```

**Team Leader can:**
- Add workers to their team
- Remove workers from team
- Update worker info (compliance_percentage, phone, etc.)
- View team statistics

---

### 3. **Exception/Incident Management Workflow**

#### Team Leader Creates Exception:
```
Team Leader
  ↓
POST /api/teams/members/:memberId/exception
  ↓
Creates exception (worker_exceptions):
  - exception_type: 'transfer' | 'accident' | 'injury' | 'medical_leave' | 'other'
  - start_date, end_date
  - reason
  ↓
If type='transfer':
  - Moves worker to new team (updates team_members.team_id)
```

**Exception Effects:**
- Workers with active exceptions are **excluded** from:
  - Check-in completion calculations
  - Analytics and statistics
  - Status tracking
- Exception status overrides normal check-in status

#### Supervisor Reports Incident:
```
Supervisor
  ↓
POST /api/supervisor/incidents
  ↓
Creates exception for worker:
  - Verifies worker belongs to supervisor's team
  - Creates exception (same as team leader)
  ↓
Can assign to WHS:
  PATCH /api/supervisor/incidents/:id/assign-to-whs
  ↓
  Sets assigned_to_whs = true
  (Exception locked - cannot be modified until WHS closes it)
```

---

### 4. **Analytics & Performance Tracking**

#### Team Leader Analytics:
```
GET /api/teams/check-ins/analytics
Query params: startDate, endDate, workerIds (optional)
  ↓
Returns:
  - Summary statistics (completion rate, readiness distribution)
  - Daily trends (check-ins over time)
  - Worker-level statistics
  - Weekly patterns (day of week analysis)
  - Health metrics averages
  - Trends (comparison with previous period)
```

**Key Logic:**
- Excludes workers with active exceptions from calculations
- Filters check-ins by date range
- Groups by worker, day, week

#### Supervisor - Team Leader Performance:
```
GET /api/supervisor/team-leaders/performance
Query params: startDate, endDate
  ↓
Returns:
  - For each Team Leader:
    - Team info
    - Worker count
    - Check-in completion rate (based on scheduled days)
    - Last check-in date
    - Schedule adherence
```

**Calculation Logic:**
1. Get all teams assigned to supervisor
2. Get all team leaders
3. Get all workers under each team leader
4. Get check-ins for workers in date range
5. Count check-ins per team leader (aggregate of their workers)
6. Calculate completion rate based on:
   - Scheduled working days (from work_schedules)
   - Number of workers per team leader
   - Expected check-ins = scheduled_days × worker_count

---

## 🔐 Role-Based Permissions

### Worker (`role='worker'`)
**Can:**
- ✅ View own dashboard
- ✅ Submit daily check-in
- ✅ Mark warm-up as complete
- ✅ View own check-in history
- ✅ View own team info

**Cannot:**
- ❌ View other workers' check-ins
- ❌ Manage team members
- ❌ Create exceptions (except for viewing own)

### Team Leader (`role='team_leader'`)
**Can:**
- ✅ View/manage own team
- ✅ View all team members' check-ins
- ✅ View team analytics
- ✅ Add/remove team members
- ✅ Create/update exceptions for team members
- ✅ View team members' login logs
- ✅ Transfer workers to other teams

**Cannot:**
- ❌ View other teams' check-ins (unless transferred)
- ❌ Create team leaders
- ❌ Access supervisor endpoints

### Supervisor (`role='supervisor'`)
**Can:**
- ✅ View all assigned teams
- ✅ View all workers across all teams
- ✅ View team leader performance
- ✅ Create team leaders
- ✅ Report incidents/exceptions for any worker
- ✅ Assign incidents to WHS
- ✅ View supervisor dashboard with aggregated metrics
- ✅ View all team analytics

**Cannot:**
- ❌ Directly manage team members (must go through team leader)
- ❌ Create workers (team leader does this)

---

## 📊 Data Flow Logic

### Check-In Status Determination:

```
Worker submits check-in
  ↓
System calculates predicted_readiness:
  - Based on pain_level, fatigue_level, stress_level, sleep_quality
  - Returns: 'Green' | 'Yellow' | 'Red'
  ↓
Status shown in dashboards:
  - Green → Ready to work
  - Yellow/Amber → Caution needed
  - Red → Not ready / Requires attention
  - Pending → No check-in submitted
  - Exception → Has active exception (overrides everything)
```

### Exception Priority:
```
IF worker has active exception:
  Status = 'exception'
  ↓
  Excluded from:
    - Completion rate calculations
    - Analytics
    - Normal status tracking
ELSE:
  Status = based on check-in (Green/Yellow/Red/Pending)
```

### Completion Rate Calculation:

**Team Leader View:**
```
Completion Rate = (Workers who checked in / Active workers) × 100

Active workers = Total workers - Workers with active exceptions
```

**Supervisor View:**
```
Completion Rate = (All check-ins from all teams / Expected check-ins) × 100

Expected check-ins = Sum of:
  - For each team: active_workers × scheduled_days
```

---

## 🔌 API Endpoints

### Worker Endpoints
```
GET  /api/checkins/today          - Get today's check-in status
POST /api/checkins                - Submit daily check-in
POST /api/checkins/warm-up        - Mark warm-up as complete
GET  /api/checkins/history        - View check-in history
GET  /api/teams/my-team           - View own team info
```

### Team Leader Endpoints
```
GET  /api/teams                   - Get own team and members
POST /api/teams/members           - Add worker to team
PATCH /api/teams/members/:id      - Update team member
DELETE /api/teams/members/:id     - Remove team member
GET  /api/teams/check-ins         - View team check-ins
GET  /api/teams/check-ins/analytics - Team analytics
POST /api/teams/members/:id/exception - Create exception
GET  /api/teams/logs              - View team login logs
```

### Supervisor Endpoints
```
GET  /api/supervisor/dashboard    - Supervisor dashboard
GET  /api/supervisor/teams        - Get all assigned teams
GET  /api/supervisor/workers      - Get all workers
GET  /api/supervisor/team-leaders/performance - Team leader metrics
POST /api/supervisor/team-leaders - Create team leader
POST /api/supervisor/incidents    - Report incident
PATCH /api/supervisor/incidents/:id/assign-to-whs - Assign to WHS
GET  /api/supervisor/incidents    - View all incidents
```

---

## 🔍 Key Business Logic

### 1. **Check-In Window**
- Workers have scheduled shifts with check-in windows
- Check-in window is determined by `shift_start_time` from schedules
- System validates if check-in is within recommended window
- Late check-ins are allowed but tracked

### 2. **Exception Handling**
- Only **ONE active exception** per worker at a time
- Exceptions can be created by Team Leader OR Supervisor
- If exception is `assigned_to_whs = true`:
  - Locked from modification
  - Must be closed by WHS first
- When exception ends or is deactivated:
  - Worker returns to normal tracking
  - Previous check-ins remain in history

### 3. **Data Aggregation**
- **Team Leader** sees data for their team only
- **Supervisor** sees aggregated data from all assigned teams
- All queries filter by:
  - `team_id` (for team leader)
  - `supervisor_id` (for supervisor)
  - Active exceptions (excluded from counts)

### 4. **Performance Metrics**
- **Team Leader Performance** = Aggregation of their workers' check-ins
- Considers:
  - Scheduled working days (not all calendar days)
  - Active workers (excluding exceptions)
  - Completion rates
  - On-time check-ins

---

## 📝 Example Scenarios

### Scenario 1: Daily Check-In Flow
```
1. Worker logs in at 6:00 AM
2. Completes warm-up exercise → marked in system
3. Fills out check-in form:
   - Pain: 2/10
   - Fatigue: 3/10
   - Stress: 4/10
   - Sleep: 8/12
4. System calculates: Green status
5. Team Leader sees worker as "Green" on dashboard
6. Supervisor sees aggregated metrics updated
```

### Scenario 2: Worker Transfer
```
1. Team Leader needs to transfer Worker A to Team B
2. Team Leader creates exception:
   POST /api/teams/members/:id/exception
   {
     exception_type: 'transfer',
     transfer_to_team_id: 'team-b-uuid'
   }
3. System:
   - Deactivates old team_members record
   - Creates new team_members record with new team_id
   - Creates exception record
4. Worker A now belongs to Team B
   - Team Leader A no longer sees Worker A
   - Team Leader B now sees Worker A
```

### Scenario 3: Supervisor Monitoring
```
1. Supervisor logs in
2. Views dashboard:
   - 3 teams assigned
   - 45 total workers
   - 42 checked in today (93% completion)
   - 2 workers with exceptions
   - 1 incident today
3. Sees "Attention Required":
   - Worker with Amber status
   - High pain level (7/10)
4. Supervisor can:
   - View details
   - Report incident
   - Assign to WHS if needed
```

---

## 🎓 Learning Points

### Key Concepts:
1. **Hierarchical Access**: Each role sees data based on their position in the hierarchy
2. **Data Filtering**: All queries filter by team_id or supervisor_id for security
3. **Exception Handling**: Active exceptions override normal status tracking
4. **Aggregation**: Supervisors see aggregated data, Team Leaders see team-specific data
5. **Real-time Updates**: Dashboards use cache-control headers to ensure fresh data

### Database Queries Pattern:
1. Get teams assigned to user (based on role)
2. Get team members from those teams
3. Get check-ins/warm-ups for those team members
4. Filter by exceptions
5. Aggregate and calculate metrics

### Security Considerations:
- Row Level Security (RLS) policies in database
- Role-based middleware checks (`requireRole`)
- Service role client for backend operations (bypasses RLS)
- Input validation on all endpoints

---

## 📚 Related Files

- `backend/src/routes/supervisor.ts` - Supervisor endpoints
- `backend/src/routes/teams.ts` - Team Leader endpoints
- `backend/src/routes/checkins.ts` - Worker check-in endpoints
- `backend/database/teams_schema.sql` - Database schema
- `backend/src/middleware/auth.ts` - Authentication & authorization

---

**Last Updated**: System Workflow Documentation
**Purpose**: Reference guide for understanding the Worker → Team Leader → Site Supervisor workflow and logic

