-- Migration: Add transcriptions table for voice recording transcriptions
-- Stores transcriptions and their AI analysis for clinicians

CREATE TABLE IF NOT EXISTS transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transcription_text TEXT NOT NULL,
  analysis JSONB,
  recording_duration_seconds INTEGER,
  estimated_cost DECIMAL(10, 6),
  audio_file_size_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT transcription_text_not_empty CHECK (length(trim(transcription_text)) > 0),
  CONSTRAINT recording_duration_positive CHECK (recording_duration_seconds IS NULL OR recording_duration_seconds >= 0),
  CONSTRAINT estimated_cost_positive CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  CONSTRAINT audio_file_size_positive CHECK (audio_file_size_bytes IS NULL OR audio_file_size_bytes >= 0)
);

COMMENT ON TABLE transcriptions IS 'Stores voice recording transcriptions and their AI analysis for clinicians';
COMMENT ON COLUMN transcriptions.clinician_id IS 'Clinician who created this transcription';
COMMENT ON COLUMN transcriptions.transcription_text IS 'The transcribed text from the audio recording';
COMMENT ON COLUMN transcriptions.analysis IS 'JSON object containing AI analysis (summary, keyPoints, clinicalNotes, recommendations, actionItems)';
COMMENT ON COLUMN transcriptions.recording_duration_seconds IS 'Duration of the recording in seconds';
COMMENT ON COLUMN transcriptions.estimated_cost IS 'Estimated cost of the transcription in USD';
COMMENT ON COLUMN transcriptions.audio_file_size_bytes IS 'Size of the audio file in bytes';

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_transcriptions_clinician_id ON transcriptions(clinician_id);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcriptions_clinician_created ON transcriptions(clinician_id, created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_transcriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transcriptions_updated_at
  BEFORE UPDATE ON transcriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_transcriptions_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE transcriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Clinicians can only see their own transcriptions
CREATE POLICY "Clinicians can view their own transcriptions"
  ON transcriptions
  FOR SELECT
  USING (auth.uid() = clinician_id);

-- RLS Policy: Clinicians can insert their own transcriptions
CREATE POLICY "Clinicians can insert their own transcriptions"
  ON transcriptions
  FOR INSERT
  WITH CHECK (auth.uid() = clinician_id);

-- RLS Policy: Clinicians can update their own transcriptions
CREATE POLICY "Clinicians can update their own transcriptions"
  ON transcriptions
  FOR UPDATE
  USING (auth.uid() = clinician_id)
  WITH CHECK (auth.uid() = clinician_id);

-- RLS Policy: Clinicians can delete their own transcriptions
CREATE POLICY "Clinicians can delete their own transcriptions"
  ON transcriptions
  FOR DELETE
  USING (auth.uid() = clinician_id);

