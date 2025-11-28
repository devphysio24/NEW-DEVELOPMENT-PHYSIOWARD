-- Migration: Add photo_url column to incidents table
-- This column stores the URL of incident photos uploaded to Cloudflare R2

-- Add photo_url column to incidents table
ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.incidents.photo_url IS 'URL of incident photo stored in Cloudflare R2. Format: https://pub-xxx.r2.dev/incidents/incident-{userId}-{incidentId}-{timestamp}-{random}.{ext}';

-- Create index for faster lookups on photo_url (useful for finding incidents with photos)
CREATE INDEX IF NOT EXISTS idx_incidents_photo_url 
ON public.incidents (photo_url) 
WHERE photo_url IS NOT NULL;

