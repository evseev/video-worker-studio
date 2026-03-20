-- Add scene configuration to projects
-- scene_count: number of scenes (2-100, default 5)
-- scene_duration: duration per scene in seconds (2-60, default 5)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS scene_count integer DEFAULT 5;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS scene_duration integer DEFAULT 5;

ALTER TABLE projects ADD CONSTRAINT check_scene_count
  CHECK (scene_count >= 2 AND scene_count <= 100);
ALTER TABLE projects ADD CONSTRAINT check_scene_duration
  CHECK (scene_duration >= 2 AND scene_duration <= 60);
