-- Ensure worker_update_project_error is available to app roles via PostgREST RPC.
CREATE OR REPLACE FUNCTION worker_update_project_error(
  p_project_id UUID,
  p_error_context JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE projects
  SET
    render_error_context = p_error_context,
    updated_at = NOW()
  WHERE id = p_project_id;
END;
$$;

GRANT EXECUTE ON FUNCTION worker_update_project_error(UUID, JSONB)
  TO anon, authenticated, service_role;
