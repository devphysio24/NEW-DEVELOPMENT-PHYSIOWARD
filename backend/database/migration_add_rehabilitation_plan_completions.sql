-- Migration: Add rehabilitation_plan_completions table
-- This tracks daily exercise completions for workers

CREATE TABLE IF NOT EXISTS rehabilitation_plan_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES rehabilitation_plans(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES rehabilitation_exercises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completion_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plan_id, exercise_id, user_id, completion_date)
);

COMMENT ON TABLE rehabilitation_plan_completions IS 'Tracks daily exercise completions for rehabilitation plans';
COMMENT ON COLUMN rehabilitation_plan_completions.plan_id IS 'Reference to the rehabilitation plan';
COMMENT ON COLUMN rehabilitation_plan_completions.exercise_id IS 'Reference to the exercise that was completed';
COMMENT ON COLUMN rehabilitation_plan_completions.user_id IS 'Worker who completed the exercise';
COMMENT ON COLUMN rehabilitation_plan_completions.completion_date IS 'Date when the exercise was completed';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_rehabilitation_plan_completions_plan_id ON rehabilitation_plan_completions(plan_id);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_plan_completions_exercise_id ON rehabilitation_plan_completions(exercise_id);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_plan_completions_user_id ON rehabilitation_plan_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_plan_completions_date ON rehabilitation_plan_completions(completion_date);
CREATE INDEX IF NOT EXISTS idx_rehabilitation_plan_completions_composite ON rehabilitation_plan_completions(plan_id, exercise_id, user_id, completion_date);

