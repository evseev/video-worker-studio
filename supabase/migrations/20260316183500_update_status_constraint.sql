ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'processing'::text, 'rendering'::text, 'completed'::text, 'failed_ai'::text, 'failed_render'::text]));
