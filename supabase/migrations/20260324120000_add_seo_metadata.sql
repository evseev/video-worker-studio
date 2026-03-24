-- Add YouTube SEO metadata columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_description text DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_tags text DEFAULT NULL;
