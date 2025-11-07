-- Migration: Add rehabilitation_plans table for clinician management
-- This allows clinicians to create and manage rehabilitation plans for workers

CREATE TABLE IF NOT EXISTS rehabilitation_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_id UUID NOT NULL REFERENCES worker_exceptions(id) ON DELETE CASCADE,
  clinician_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT end_date_after_start_date CHECK (end_date >= start_date)
);

COMMENT ON TABLE rehabilitation_plans IS 'Stores rehabilitation plans created by clinicians for worker exceptions';
COMMENT ON COLUMN rehabilitation_plans.exception_id IS 'Reference to the worker_exception that this plan is for';
COMMENT ON COLUMN rehabilitation_plans.clinician_id IS 'Clinician who created this plan';
COMMENT ON COLUMN rehabilitation_plans.status IS 'Status: active, completed, or cancelled';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rehabilitation_plans_exception_id ON rehabilitation_plans(exception_id);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_plans_clinician_id ON rehabilitation_plans(clinician_id);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_plans_status ON rehabilitation_plans(status);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_plans_dates ON rehabilitation_plans(start_date, end_date);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_rehabilitation_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rehabilitation_plans_updated_at
  BEFORE UPDATE ON rehabilitation_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_rehabilitation_plans_updated_at();

