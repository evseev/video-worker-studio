-- Epic 25.3: video_subjects.channel_id, drop user_id, new indexes + RLS, worker_insert_video_subjects(channel_id, ...).

BEGIN;

ALTER TABLE public.video_subjects
  ADD COLUMN IF NOT EXISTS channel_id uuid;

UPDATE public.video_subjects vs
SET channel_id = p.channel_id
FROM public.projects p
WHERE p.id = vs.project_id
  AND vs.channel_id IS NULL;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*)::integer INTO n FROM public.video_subjects WHERE channel_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'video_subjects.channel_id backfill failed: % rows still null', n;
  END IF;
END $$;

ALTER TABLE public.video_subjects
  ALTER COLUMN channel_id SET NOT NULL;

ALTER TABLE public.video_subjects
  ADD CONSTRAINT video_subjects_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels (id) ON DELETE CASCADE;

-- Same (uuid, uuid, jsonb) signature as the old RPC, but first param renamed p_user_id → p_channel_id.
-- Postgres forbids that via CREATE OR REPLACE alone (42P13); drop first.
DROP FUNCTION IF EXISTS public.worker_insert_video_subjects(uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.worker_insert_video_subjects(
  p_channel_id uuid,
  p_project_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.channel_id = p_channel_id
  ) THEN
    RAISE EXCEPTION 'worker_insert_video_subjects: project % not in channel %', p_project_id, p_channel_id;
  END IF;

  INSERT INTO public.video_subjects (
    channel_id,
    project_id,
    subject_key,
    subject_normalized,
    embedding
  )
  SELECT
    p_channel_id,
    p_project_id,
    item ->> 'subject_key',
    item ->> 'subject_normalized',
    CASE
      WHEN item ? 'embedding' AND item -> 'embedding' IS NOT NULL
      THEN (item ->> 'embedding')::vector
      ELSE NULL
    END
  FROM jsonb_array_elements(p_rows) AS item
  WHERE item ? 'subject_key'
    AND item ? 'subject_normalized';
END;
$$;

DROP POLICY IF EXISTS "video_subjects_select_own" ON public.video_subjects;

DROP INDEX IF EXISTS video_subjects_user_idx;
DROP INDEX IF EXISTS video_subjects_norm_idx;

ALTER TABLE public.video_subjects
  DROP COLUMN IF EXISTS user_id;

CREATE INDEX IF NOT EXISTS video_subjects_channel_idx
  ON public.video_subjects (channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS video_subjects_channel_norm_idx
  ON public.video_subjects (channel_id, subject_normalized);

DROP POLICY IF EXISTS "video_subjects_select_via_channel" ON public.video_subjects;
CREATE POLICY "video_subjects_select_via_channel"
  ON public.video_subjects FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id = video_subjects.channel_id
        AND c.user_id = auth.uid()
    )
  );

GRANT EXECUTE ON FUNCTION public.worker_insert_video_subjects(uuid, uuid, jsonb) TO anon, authenticated, service_role;

COMMIT;
