-- Ensure deleting a project removes its scenes (required for dashboard delete).
ALTER TABLE scenes DROP CONSTRAINT IF EXISTS scenes_project_id_fkey;

ALTER TABLE scenes
  ADD CONSTRAINT scenes_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES projects(id)
  ON DELETE CASCADE;
