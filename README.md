# Workreadines

Full-stack application with authentication system using TypeScript, Vite (React), Hono, and Supabase.

## Project Structure

```
WORKREADINES/
├── frontend/     # React + TypeScript + Vite
└── backend/      # Node.js + Hono + TypeScript
```

## Features

- ✅ User Registration & Login
- ✅ Secure Authentication with Supabase
- ✅ Password Hashing with bcrypt
- ✅ Role-based Access Control (user, manager, admin)
- ✅ Protected Routes
- ✅ Modern UI/UX Design
- ✅ Authentication Middleware
- ✅ Secure Backend API

## Setup Instructions

### Prerequisites

- Node.js (v20+)
- npm or yarn
- Supabase account

### 1. Supabase Setup

1. Create a new project on [Supabase](https://supabase.com)
2. Go to SQL Editor and run this to create the users table:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'manager', 'admin')),
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust as needed)
CREATE POLICY "Users can view their own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Service role can do everything"
  ON users FOR ALL
  USING (auth.role() = 'service_role');
```

3. Get your Supabase credentials:
   - Project URL
   - Anon Key (for frontend)
   - Service Role Key (for backend)

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` file:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Run development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

### 3. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3000
```

Run development server:
```bash
npm run dev
```

Backend will run on `http://localhost:3000`

## Security Features

- **Password Hashing**: Passwords are hashed using bcrypt with 10 salt rounds
- **Authentication Middleware**: Protects routes requiring authentication
- **Role-based Authorization**: Different access levels for users, managers, and admins
- **Token Verification**: JWT tokens verified on every protected request
- **CORS Configuration**: Properly configured for secure cross-origin requests

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)
- `PATCH /api/auth/users/:id/role` - Update user role (admin only)

### Health Check

- `GET /health` - Server health check

## User Roles

- **user**: Basic access
- **manager**: Team and project management access
- **admin**: Full system access

## Development

### Frontend
```bash
cd frontend
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
```

### Backend
```bash
cd backend
npm run dev      # Development server with hot reload
npm run build    # Build TypeScript
npm start        # Run production build
```

## Notes

- Make sure both frontend and backend are running for full functionality
- The authentication uses Supabase Auth, but also includes bcrypt for additional security
- Role management can be done through the admin panel or directly in the database

