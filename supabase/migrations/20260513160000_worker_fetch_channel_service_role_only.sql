-- Lock down worker_fetch_channel_for_project: SECURITY DEFINER read was callable
-- with the public anon key by anyone who knew a project UUID. Restrict EXECUTE to
-- service_role only; the Inngest worker calls this RPC via SUPABASE_SERVICE_ROLE_KEY.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.worker_fetch_channel_for_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.worker_fetch_channel_for_project(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.worker_fetch_channel_for_project(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.worker_fetch_channel_for_project(uuid) TO service_role;

COMMIT;
