-- Epic 25.14: Inngest worker reads channel + watermark via anon client (RLS-safe SECURITY DEFINER).

BEGIN;

CREATE OR REPLACE FUNCTION public.worker_fetch_channel_for_project(p_project_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'channel_id', c.id,
    'niche', c.niche,
    'target_language', c.target_language,
    'target_audience', c.target_audience,
    'tone', c.tone,
    'logo_url', c.logo_url,
    'watermark_position', c.watermark_position,
    'watermark_opacity', c.watermark_opacity
  )
  FROM public.projects p
  INNER JOIN public.channels c ON c.id = p.channel_id
  WHERE p.id = p_project_id;
$$;

GRANT EXECUTE ON FUNCTION public.worker_fetch_channel_for_project(uuid) TO anon, authenticated, service_role;

COMMIT;
