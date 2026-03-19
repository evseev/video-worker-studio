ALTER TABLE projects
ADD COLUMN IF NOT EXISTS render_error_context JSONB DEFAULT NULL;

CREATE OR REPLACE FUNCTION worker_update_project_error(
  p_project_id UUID,
  p_error_context JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE projects
  SET
    render_error_context = p_error_context,
    updated_at = NOW()
  WHERE id = p_project_id;
END;
$$;
