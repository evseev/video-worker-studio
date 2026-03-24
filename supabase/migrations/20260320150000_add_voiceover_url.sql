-- Add voice-over URL to projects
-- Stores the Supabase Storage URL for the uploaded audio file
ALTER TABLE projects ADD COLUMN IF NOT EXISTS voiceover_url text DEFAULT NULL;
