-- Migration: Add gender and date_of_birth columns to users table
-- Date: 2024-11-XX
-- Description: Adds gender and date_of_birth fields to support user profile information

-- Add gender column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS gender text NULL;

-- Add check constraint for gender (must be 'male' or 'female' if provided)
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_gender_check;

ALTER TABLE public.users
ADD CONSTRAINT users_gender_check CHECK (
  gender IS NULL OR gender IN ('male', 'female')
);

-- Add date_of_birth column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS date_of_birth date NULL;

-- Add check constraint for date_of_birth (must be in the past)
ALTER TABLE public.users
DROP CONSTRAINT IF EXISTS users_date_of_birth_check;

ALTER TABLE public.users
ADD CONSTRAINT users_date_of_birth_check CHECK (
  date_of_birth IS NULL OR date_of_birth < CURRENT_DATE
);

-- Add comment to columns for documentation
COMMENT ON COLUMN public.users.gender IS 'User gender: male or female';
COMMENT ON COLUMN public.users.date_of_birth IS 'User date of birth (must be in the past)';

