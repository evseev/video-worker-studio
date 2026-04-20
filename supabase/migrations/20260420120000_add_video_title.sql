-- Add separate YouTube video title column to projects table.
-- Before this, the long "topic" string (often a description sentence) was being
-- used as the title at publish time. Idea step now captures a short catchy title
-- from AI and persists it here. Reads fall back to projects.topic when null.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_title text DEFAULT NULL;
