-- Migration: Add AI analysis result column to incidents table
-- This allows storing the AI analysis result when an incident is reported

-- Add ai_analysis_result column (JSONB to store structured analysis data)
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS ai_analysis_result JSONB NULL;

-- Add comment to column
COMMENT ON COLUMN public.incidents.ai_analysis_result IS 'Stores the AI analysis result from OpenAI when incident is analyzed. Contains structured JSON with summary, riskLevel, recommendations, etc.';

-- Create index for efficient querying of incidents with AI analysis
CREATE INDEX IF NOT EXISTS idx_incidents_ai_analysis 
ON public.incidents USING gin (ai_analysis_result) 
WHERE ai_analysis_result IS NOT NULL;

