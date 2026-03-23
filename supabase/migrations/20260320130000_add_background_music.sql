-- Add background music selection to projects
-- Stores the track identifier (e.g. "upbeat", "chill") or null for no music
ALTER TABLE projects ADD COLUMN IF NOT EXISTS background_music text DEFAULT NULL;
