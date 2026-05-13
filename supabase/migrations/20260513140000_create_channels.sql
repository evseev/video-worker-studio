-- Epic 25.1: channels + RLS + worker RPCs (youtube meta + default channel).
-- worker_persist_topic_suggestions lives in 20260513140300_create_channel_topic_ideas.sql (needs table).

BEGIN;

CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  thumbnail_template_url text,
  niche text,
  target_language text,
  target_audience text,
  tone text,
  youtube_handle text,
  youtube_channel_id text,
  youtube_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  subject_memory_lookback integer NOT NULL DEFAULT 5,
  watermark_position text NOT NULL DEFAULT 'br',
  watermark_opacity numeric(3, 2) NOT NULL DEFAULT 0.70,
  default_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channels_subject_memory_lookback_check
    CHECK (subject_memory_lookback >= 1 AND subject_memory_lookback <= 50),
  CONSTRAINT channels_watermark_position_check
    CHECK (watermark_position IN ('tl', 'tr', 'bl', 'br', 'none')),
  CONSTRAINT channels_watermark_opacity_check
    CHECK (watermark_opacity >= 0::numeric AND watermark_opacity <= 1::numeric),
  CONSTRAINT channels_user_slug_key UNIQUE (user_id, slug)
);

CREATE INDEX channels_user_id_created_idx
  ON public.channels (user_id, created_at DESC);

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channels_select_own" ON public.channels;
CREATE POLICY "channels_select_own"
  ON public.channels FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "channels_insert_own" ON public.channels;
CREATE POLICY "channels_insert_own"
  ON public.channels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "channels_update_own" ON public.channels;
CREATE POLICY "channels_update_own"
  ON public.channels FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "channels_delete_own" ON public.channels;
CREATE POLICY "channels_delete_own"
  ON public.channels FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.worker_create_default_channel_for_user(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'worker_create_default_channel_for_user: forbidden';
  END IF;

  SELECT c.id
  INTO v_id
  FROM public.channels c
  WHERE c.user_id = p_user_id
    AND c.slug = 'my-channel'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.channels (
    user_id,
    name,
    slug,
    watermark_position,
    watermark_opacity
  )
  VALUES (
    p_user_id,
    'My Channel',
    'my-channel',
    'none',
    0.70
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.worker_update_channel_youtube_meta(p_channel_id uuid, p_meta jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.channels
  SET
    youtube_meta = COALESCE(p_meta, '{}'::jsonb),
    updated_at = now()
  WHERE id = p_channel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_create_default_channel_for_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.worker_update_channel_youtube_meta(uuid, jsonb) TO service_role;

COMMIT;
