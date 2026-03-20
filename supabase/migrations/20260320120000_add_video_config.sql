-- Add video configuration columns to projects table
-- aspect_ratio: "16:9" (landscape) or "9:16" (portrait, default)
-- video_quality: "720p" or "1080p" (default)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT '9:16';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS video_quality text DEFAULT '1080p';
