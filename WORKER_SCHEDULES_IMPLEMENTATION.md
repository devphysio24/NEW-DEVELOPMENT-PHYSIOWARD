# Worker Schedules Implementation

## Summary
Added individual worker scheduling functionality where **Team Leaders** can create and manage schedules for workers in their team. Workers now have their own schedules instead of just following the team leader's schedule.

## Changes Made

### 1. Database Changes
- **File**: `backend/database/migration_add_worker_schedules.sql`
- **New Table**: `worker_schedules`
  - Stores individual worker schedules with specific dates (not just day of week)
  - Supports custom check-in windows per schedule
  - Links to workers, teams, and tracks who created the schedule

**Key Fields:**
- `worker_id` - The worker this schedule is for
- `scheduled_date` - Specific date (YYYY-MM-DD), not just day of week
- `start_time`, `end_time` - Shift times
- `check_in_window_start`, `check_in_window_end` - Optional custom check-in window
- `created_by` - Team leader who created it
- `team_id` - Team this schedule belongs to

### 2. API Endpoints Added

#### Team Leader Endpoints (for managing worker schedules):
- `GET /api/schedules/workers` - View all worker schedules in team (with filters)
- `POST /api/schedules/workers` - Create schedule for a worker
- `PUT /api/schedules/workers/:id` - Update worker schedule
- `DELETE /api/schedules/workers/:id` - Delete worker schedule

#### Worker Endpoints (for viewing own schedule):
- `GET /api/schedules/my-schedule` - View own schedule (next 7 days by default)

### 3. Check-In Logic Updated
- **File**: `backend/src/routes/checkins.ts`
- **Function**: `getWorkerShiftInfo()`
- **Priority Logic**:
  1. **First**: Check `worker_schedules` table for individual worker schedule
  2. **Fallback**: Use team leader's schedule (backward compatibility)

This ensures:
- Workers with individual schedules use their own schedule
- Workers without individual schedules still work (use team leader schedule)
- Smooth migration - no breaking changes

### 4. Route Access Control Updated
- **File**: `backend/src/config/routes.ts`
- Added route permissions for new worker schedule endpoints

## Migration Steps

### Step 1: Run Database Migration
1. Go to Supabase Dashboard → SQL Editor
2. Run: `backend/database/migration_add_worker_schedules.sql`
   - Creates `worker_schedules` table
   - Sets up Row Level Security (RLS) policies
   - Creates indexes for performance

### Step 2: Restart Backend
```bash
cd backend
npm run build
npm start
```

## How It Works

### Workflow

```
Team Leader
  ↓
Creates schedule for Worker
  ↓
POST /api/schedules/workers
{
  worker_id: "uuid",
  scheduled_date: "2024-01-15", // Specific date
  start_time: "08:00",
  end_time: "17:00",
  check_in_window_start: "06:00", // Optional
  check_in_window_end: "08:00",   // Optional
  notes: "Project A - Site X"
}
  ↓
Worker checks in
  ↓
System checks worker_schedules first
  ↓
Uses individual schedule if found
  ↓
Falls back to team leader schedule if not found
```

### Example: Creating Worker Schedule

```bash
# Team Leader creates schedule for worker
POST /api/schedules/workers
Headers: { Authorization: "Bearer <team_leader_token>" }
Body: {
  "worker_id": "worker-uuid-here",
  "scheduled_date": "2024-01-15",
  "start_time": "08:00",
  "end_time": "17:00",
  "notes": "Regular shift"
}
```

### Example: Worker Views Schedule

```bash
# Worker views their schedule
GET /api/schedules/my-schedule?startDate=2024-01-15&endDate=2024-01-22
Headers: { Authorization: "Bearer <worker_token>" }
```

### Example: Team Leader Views All Worker Schedules

```bash
# Team Leader views schedules for all workers in team
GET /api/schedules/workers?startDate=2024-01-15&endDate=2024-01-22
Headers: { Authorization: "Bearer <team_leader_token>" }

# Filter by specific worker
GET /api/schedules/workers?workerId=worker-uuid&startDate=2024-01-15
```

## Benefits

1. **Individual Schedules**: Each worker can have their own schedule
2. **Date-Specific**: Schedules are for specific dates, not just day of week
3. **Flexible**: Can handle different shifts for different workers
4. **Custom Check-In Windows**: Can set custom check-in windows per schedule
5. **Backward Compatible**: Still works with team leader schedules as fallback
6. **Project Support**: Can link schedules to projects (project_id field)

## Backward Compatibility

The system is **fully backward compatible**:
- Workers without individual schedules still work
- Falls back to team leader schedule automatically
- Existing team leader schedules continue to work
- No breaking changes to existing functionality

## Security

- **RLS Policies**: 
  - Workers can only view their own schedules
  - Team leaders can manage schedules for workers in their team only
  - Supervisors can view all schedules in their teams
- **Validation**: 
  - Team leader can only create schedules for workers in their team
  - Worker must exist and have role='worker'
  - Date and time format validation

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Team leader can create worker schedule
- [ ] Team leader can view worker schedules
- [ ] Team leader can update worker schedule
- [ ] Team leader can delete worker schedule
- [ ] Worker can view their own schedule
- [ ] Check-in uses worker schedule when available
- [ ] Check-in falls back to team leader schedule when worker schedule not available
- [ ] Custom check-in windows work
- [ ] Date filtering works correctly
- [ ] RLS policies prevent unauthorized access

## Future Enhancements

1. **Bulk Schedule Creation**: Create schedules for multiple workers at once
2. **Recurring Schedules**: Create weekly/monthly recurring schedules
3. **Schedule Templates**: Save common schedule patterns
4. **Approval Workflow**: Supervisor approval for schedule changes
5. **Schedule Conflicts**: Detect and warn about overlapping schedules
6. **Calendar View**: Visual calendar interface for managing schedules

## API Reference

### POST /api/schedules/workers
Create a worker schedule (Team Leader only)

**Request Body:**
```json
{
  "worker_id": "uuid",
  "scheduled_date": "2024-01-15",
  "start_time": "08:00",
  "end_time": "17:00",
  "check_in_window_start": "06:00",  // Optional
  "check_in_window_end": "08:00",    // Optional
  "project_id": "uuid",               // Optional
  "notes": "string"                   // Optional
}
```

**Response:**
```json
{
  "message": "Worker schedule created successfully",
  "schedule": { ... }
}
```

### GET /api/schedules/workers
Get worker schedules in team (Team Leader only)

**Query Params:**
- `startDate` (optional) - Filter start date (YYYY-MM-DD)
- `endDate` (optional) - Filter end date (YYYY-MM-DD)
- `workerId` (optional) - Filter by specific worker

**Response:**
```json
{
  "schedules": [
    {
      "id": "uuid",
      "worker_id": "uuid",
      "scheduled_date": "2024-01-15",
      "start_time": "08:00",
      "end_time": "17:00",
      "users": { ... }  // Worker details
    }
  ]
}
```

### GET /api/schedules/my-schedule
Get own schedule (Worker only)

**Query Params:**
- `startDate` (optional, default: today) - Start date
- `endDate` (optional, default: +7 days) - End date

**Response:**
```json
{
  "schedules": [ ... ]
}
```

### PUT /api/schedules/workers/:id
Update worker schedule (Team Leader only)

### DELETE /api/schedules/workers/:id
Delete worker schedule (Team Leader only)

