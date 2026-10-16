-- Autopilot pipeline (design: docs/superpowers/specs/2026-10-16-autopilot-pipeline-design.md)
--
-- Adds:
--   projects:            autopilot run tracking, review gate, thumbnail, YouTube publish result
--   status 'awaiting_review' (between sourcing and render)
--   channels:            autopilot switch + config (weekday slots, publish hour, format mix, voices)
--   channel_topic_ideas: per-idea format, pair count, series
--   subject_facts:       Wikidata facts cache (service role only)
--   youtube_connections: OAuth tokens per channel (service role only; never readable by clients)
--   storage bucket render-assets (public read; service-role writes) for Lambda-fetchable assets
--   SECURITY DEFINER RPCs for every worker write (AGENTS.md §3), EXECUTE granted to service_role only.
--
-- After applying: regenerate src/lib/supabase/types.ts (`supabase gen types typescript`).

BEGIN;

-- ---------------------------------------------------------------- projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS autopilot boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS format_slug text,
  ADD COLUMN IF NOT EXISTS autopilot_run_dir text,
  ADD COLUMN IF NOT EXISTS autopilot_summary jsonb,
  ADD COLUMN IF NOT EXISTS review_status text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS experiment_arm text;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_review_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_review_status_check
  CHECK (review_status IS NULL OR review_status IN ('pending_review', 'approved', 'rejected'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_format_slug_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_format_slug_check
  CHECK (format_slug IS NULL OR format_slug IN ('couples', 'parent-child', 'then-now', 'mega'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text, 'processing'::text, 'awaiting_review'::text, 'rendering'::text,
    'completed'::text, 'failed_ai'::text, 'failed_render'::text
  ]));

CREATE INDEX IF NOT EXISTS projects_autopilot_review_idx
  ON public.projects (channel_id, review_status)
  WHERE autopilot;

CREATE INDEX IF NOT EXISTS projects_publish_at_idx
  ON public.projects (channel_id, publish_at)
  WHERE publish_at IS NOT NULL;

-- ---------------------------------------------------------------- channels
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS autopilot_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS autopilot_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------- topic ideas
ALTER TABLE public.channel_topic_ideas
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS pair_count integer,
  ADD COLUMN IF NOT EXISTS format_slug text,
  ADD COLUMN IF NOT EXISTS series_key text;

ALTER TABLE public.channel_topic_ideas DROP CONSTRAINT IF EXISTS channel_topic_ideas_format_slug_check;
ALTER TABLE public.channel_topic_ideas ADD CONSTRAINT channel_topic_ideas_format_slug_check
  CHECK (format_slug IS NULL OR format_slug IN ('couples', 'parent-child', 'then-now', 'mega'));

ALTER TABLE public.channel_topic_ideas DROP CONSTRAINT IF EXISTS channel_topic_ideas_pair_count_check;
ALTER TABLE public.channel_topic_ideas ADD CONSTRAINT channel_topic_ideas_pair_count_check
  CHECK (pair_count IS NULL OR (pair_count >= 6 AND pair_count <= 150));

-- ---------------------------------------------------------------- subject_facts
CREATE TABLE IF NOT EXISTS public.subject_facts (
  qid text PRIMARY KEY,
  name text NOT NULL,
  facts jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subject_facts ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (bypasses RLS) and SECURITY DEFINER functions touch it.

-- ---------------------------------------------------------------- youtube_connections
CREATE TABLE IF NOT EXISTS public.youtube_connections (
  channel_id uuid PRIMARY KEY REFERENCES public.channels (id) ON DELETE CASCADE,
  youtube_channel_id text,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- Uploads from an unaudited Google Cloud project are locked private; flip after the audit passes.
  upload_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.youtube_connections ENABLE ROW LEVEL SECURITY;
-- No client policies: tokens are never readable from the browser.

-- Owners may see whether a connection exists (without tokens).
CREATE OR REPLACE FUNCTION public.youtube_connection_status(p_channel_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'connected', yc.channel_id IS NOT NULL,
    'youtube_channel_id', yc.youtube_channel_id,
    'upload_enabled', COALESCE(yc.upload_enabled, false)
  )
  FROM public.channels c
  LEFT JOIN public.youtube_connections yc ON yc.channel_id = c.id
  WHERE c.id = p_channel_id
    AND c.user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.youtube_connection_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.youtube_connection_status(uuid) TO authenticated;

-- ---------------------------------------------------------------- storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('render-assets', 'render-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can read render assets" ON storage.objects;
CREATE POLICY "Anyone can read render assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'render-assets');
-- Writes: service_role only (bypasses RLS), from the autopilot worker.

-- ---------------------------------------------------------------- worker RPCs

CREATE OR REPLACE FUNCTION public.autopilot_list_enabled_channels()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'channel_id', c.id,
    'user_id', c.user_id,
    'name', c.name,
    'niche', c.niche,
    'autopilot_config', c.autopilot_config,
    'pending_review', (
      SELECT count(*) FROM public.projects p
      WHERE p.channel_id = c.id AND p.autopilot AND p.review_status = 'pending_review'
    ),
    'scheduled_ahead', (
      SELECT count(*) FROM public.projects p
      WHERE p.channel_id = c.id AND p.autopilot AND p.publish_at > now()
    )
  )), '[]'::jsonb)
  FROM public.channels c
  WHERE c.autopilot_enabled;
$$;

-- Atomically take the oldest backlog idea (skips rows locked by a concurrent run).
CREATE OR REPLACE FUNCTION public.autopilot_claim_next_idea(p_channel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idea public.channel_topic_ideas;
BEGIN
  SELECT * INTO v_idea
  FROM public.channel_topic_ideas
  WHERE channel_id = p_channel_id AND status = 'backlog'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.channel_topic_ideas SET status = 'shot' WHERE id = v_idea.id;

  RETURN jsonb_build_object(
    'id', v_idea.id,
    'idea_text', v_idea.idea_text,
    'format_slug', v_idea.format_slug,
    'pair_count', v_idea.pair_count,
    'series_key', v_idea.series_key,
    'template_id', v_idea.template_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.autopilot_create_project(p_channel_id uuid, p_idea_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_project uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.channels WHERE id = p_channel_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'autopilot_create_project: unknown channel %', p_channel_id;
  END IF;

  INSERT INTO public.projects (
    user_id, channel_id, topic, status, wizard_step, selected_template,
    aspect_ratio, video_quality, caption_style, comparison_overlay_mode,
    background_music, scene_transition, image_motion, text_animation,
    autopilot, format_slug, experiment_arm
  ) VALUES (
    v_user,
    p_channel_id,
    COALESCE(NULLIF(p_payload ->> 'topic', ''), 'Untitled autopilot video'),
    'processing',
    'render',
    'comparison',
    '16:9',
    COALESCE(p_payload ->> 'video_quality', '1080p'),
    'bold',
    'both',
    p_payload ->> 'background_music',
    'fade',
    'zoom-in',
    'fade-in',
    true,
    p_payload ->> 'format_slug',
    p_payload ->> 'experiment_arm'
  )
  RETURNING id INTO v_project;

  IF p_idea_id IS NOT NULL THEN
    UPDATE public.channel_topic_ideas
    SET used_in_project_id = v_project, status = 'shot'
    WHERE id = p_idea_id AND channel_id = p_channel_id;
  END IF;

  RETURN v_project;
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_update_autopilot(
  p_project_id uuid,
  p_status text,
  p_review_status text,
  p_run_dir text,
  p_summary jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET
    status = COALESCE(p_status, status),
    review_status = COALESCE(p_review_status, review_status),
    autopilot_run_dir = COALESCE(p_run_dir, autopilot_run_dir),
    autopilot_summary = COALESCE(p_summary, autopilot_summary),
    video_title = COALESCE(p_summary ->> 'title', video_title),
    video_description = COALESCE(p_summary ->> 'description', video_description),
    video_tags = COALESCE(p_summary ->> 'tags', video_tags),
    updated_at = now()
  WHERE id = p_project_id AND autopilot;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'worker_update_autopilot: autopilot project % not found', p_project_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_set_publish_result(
  p_project_id uuid,
  p_video_url text,
  p_thumbnail_url text,
  p_youtube_video_id text,
  p_publish_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects
  SET
    video_url = COALESCE(p_video_url, video_url),
    thumbnail_url = COALESCE(p_thumbnail_url, thumbnail_url),
    youtube_video_id = COALESCE(p_youtube_video_id, youtube_video_id),
    publish_at = COALESCE(p_publish_at, publish_at),
    updated_at = now()
  WHERE id = p_project_id AND autopilot;
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_cache_subject_facts(p_rows jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.subject_facts (qid, name, facts, fetched_at)
  SELECT item ->> 'qid', item ->> 'name', item -> 'facts', now()
  FROM jsonb_array_elements(p_rows) AS item
  WHERE item ? 'qid'
  ON CONFLICT (qid) DO UPDATE SET name = EXCLUDED.name, facts = EXCLUDED.facts, fetched_at = now();
$$;

CREATE OR REPLACE FUNCTION public.worker_save_youtube_tokens(
  p_channel_id uuid,
  p_youtube_channel_id text,
  p_refresh_token text,
  p_access_token text,
  p_expires_at timestamptz,
  p_scopes text[]
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.youtube_connections (channel_id, youtube_channel_id, refresh_token, access_token, access_token_expires_at, scopes)
  VALUES (p_channel_id, p_youtube_channel_id, p_refresh_token, p_access_token, p_expires_at, COALESCE(p_scopes, ARRAY[]::text[]))
  ON CONFLICT (channel_id) DO UPDATE SET
    youtube_channel_id = EXCLUDED.youtube_channel_id,
    refresh_token = COALESCE(NULLIF(EXCLUDED.refresh_token, ''), public.youtube_connections.refresh_token),
    access_token = EXCLUDED.access_token,
    access_token_expires_at = EXCLUDED.access_token_expires_at,
    scopes = EXCLUDED.scopes,
    updated_at = now();
$$;

CREATE OR REPLACE FUNCTION public.worker_get_youtube_connection(p_channel_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(yc) FROM public.youtube_connections yc WHERE yc.channel_id = p_channel_id;
$$;

-- Lock every worker/autopilot RPC to service_role (the Inngest worker uses SUPABASE_SERVICE_ROLE_KEY).
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.autopilot_list_enabled_channels()',
    'public.autopilot_claim_next_idea(uuid)',
    'public.autopilot_create_project(uuid, uuid, jsonb)',
    'public.worker_update_autopilot(uuid, text, text, text, jsonb)',
    'public.worker_set_publish_result(uuid, text, text, text, timestamptz)',
    'public.worker_cache_subject_facts(jsonb)',
    'public.worker_save_youtube_tokens(uuid, text, text, text, timestamptz, text[])',
    'public.worker_get_youtube_connection(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

COMMIT;
