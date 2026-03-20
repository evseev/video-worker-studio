-- Add caption style selection to projects
-- Stores preset ID (e.g. "minimal", "bold", "strip", "split") or null for default
ALTER TABLE projects ADD COLUMN IF NOT EXISTS caption_style text DEFAULT NULL;
