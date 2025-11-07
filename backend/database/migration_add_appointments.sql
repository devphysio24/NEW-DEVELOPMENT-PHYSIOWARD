-- Migration: Add appointments table for clinician appointment management
-- Clinicians can create appointments for workers assigned to them

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES worker_exceptions(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'declined')),
  appointment_type VARCHAR(50) DEFAULT 'consultation' CHECK (appointment_type IN ('consultation', 'follow_up', 'assessment', 'review', 'other')),
  location TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT appointment_date_not_past CHECK (appointment_date >= CURRENT_DATE::date)
);

COMMENT ON TABLE appointments IS 'Stores appointments created by clinicians for workers with assigned cases';
COMMENT ON COLUMN appointments.case_id IS 'Reference to the worker_exception (case) this appointment is for';
COMMENT ON COLUMN appointments.clinician_id IS 'Clinician who created this appointment';
COMMENT ON COLUMN appointments.worker_id IS 'Worker who the appointment is with';
COMMENT ON COLUMN appointments.status IS 'Status: pending, confirmed, completed, cancelled, or declined';
COMMENT ON COLUMN appointments.appointment_type IS 'Type of appointment: consultation, follow_up, assessment, review, or other';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_case_id ON appointments(case_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinician_id ON appointments(clinician_id);
CREATE INDEX IF NOT EXISTS idx_appointments_worker_id ON appointments(worker_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date_time ON appointments(appointment_date, appointment_time);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointments_updated_at();

-- Enable Row Level Security
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Clinicians can view their own appointments" ON appointments;
DROP POLICY IF EXISTS "Workers can view their own appointments" ON appointments;
DROP POLICY IF EXISTS "Clinicians can manage their own appointments" ON appointments;
DROP POLICY IF EXISTS "Service role can do everything on appointments" ON appointments;

-- Policies
-- Clinicians can view appointments they created
CREATE POLICY "Clinicians can view their own appointments"
  ON appointments FOR SELECT
  USING (auth.uid() = clinician_id OR auth.role() = 'service_role');

-- Workers can view their own appointments
CREATE POLICY "Workers can view their own appointments"
  ON appointments FOR SELECT
  USING (auth.uid() = worker_id OR auth.role() = 'service_role');

-- Clinicians can manage (INSERT/UPDATE/DELETE) appointments they created
CREATE POLICY "Clinicians can manage their own appointments"
  ON appointments FOR ALL
  USING (auth.uid() = clinician_id OR auth.role() = 'service_role')
  WITH CHECK (auth.uid() = clinician_id OR auth.role() = 'service_role');

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role can do everything on appointments"
  ON appointments FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

