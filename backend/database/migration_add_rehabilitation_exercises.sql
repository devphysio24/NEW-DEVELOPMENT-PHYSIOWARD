-- Migration: Add plan details and exercises to rehabilitation plans
-- This adds plan_name, plan_description to rehabilitation_plans and creates rehabilitation_exercises table

-- Add plan_name and plan_description columns to rehabilitation_plans
ALTER TABLE rehabilitation_plans
ADD COLUMN IF NOT EXISTS plan_name VARCHAR(255) NOT NULL DEFAULT 'Recovery Plan',
ADD COLUMN IF NOT EXISTS plan_description TEXT DEFAULT 'Daily recovery exercises and activities';

-- Create rehabilitation_exercises table
CREATE TABLE IF NOT EXISTS rehabilitation_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES rehabilitation_plans(id) ON DELETE CASCADE,
  exercise_name VARCHAR(255) NOT NULL,
  repetitions VARCHAR(100),
  instructions TEXT,
  video_url TEXT,
  exercise_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT exercise_name_not_empty CHECK (length(trim(exercise_name)) > 0)
);

COMMENT ON TABLE rehabilitation_exercises IS 'Stores individual exercises for rehabilitation plans';
COMMENT ON COLUMN rehabilitation_exercises.plan_id IS 'Reference to the rehabilitation_plan this exercise belongs to';
COMMENT ON COLUMN rehabilitation_exercises.exercise_order IS 'Order of exercise within the plan';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rehabilitation_exercises_plan_id ON rehabilitation_exercises(plan_id);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_exercises_order ON rehabilitation_exercises(plan_id, exercise_order);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_rehabilitation_exercises_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rehabilitation_exercises_updated_at
  BEFORE UPDATE ON rehabilitation_exercises
  FOR EACH ROW
  EXECUTE FUNCTION update_rehabilitation_exercises_updated_at();

-- Update existing plans with default values if they're NULL (shouldn't happen due to DEFAULT, but just in case)
UPDATE rehabilitation_plans
SET plan_name = 'Recovery Plan'
WHERE plan_name IS NULL;

UPDATE rehabilitation_plans
SET plan_description = 'Daily recovery exercises and activities'
WHERE plan_description IS NULL;

