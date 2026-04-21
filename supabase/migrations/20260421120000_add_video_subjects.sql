CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.video_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subject_key TEXT NOT NULL,
  subject_normalized TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS video_subjects_user_idx
  ON public.video_subjects(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS video_subjects_norm_idx
  ON public.video_subjects(user_id, subject_normalized);

CREATE INDEX IF NOT EXISTS video_subjects_embedding_idx
  ON public.video_subjects
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE public.video_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_subjects_select_own" ON public.video_subjects;
CREATE POLICY "video_subjects_select_own"
  ON public.video_subjects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION worker_insert_video_subjects(
  p_user_id UUID,
  p_project_id UUID,
  p_rows JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO video_subjects (
    user_id,
    project_id,
    subject_key,
    subject_normalized,
    embedding
  )
  SELECT
    p_user_id,
    p_project_id,
    item->>'subject_key',
    item->>'subject_normalized',
    CASE
      WHEN item ? 'embedding' AND item->'embedding' IS NOT NULL
      THEN (item->>'embedding')::vector
      ELSE NULL
    END
  FROM jsonb_array_elements(p_rows) AS item
  WHERE item ? 'subject_key' AND item ? 'subject_normalized';
END;
$$;

GRANT EXECUTE ON FUNCTION worker_insert_video_subjects(UUID, UUID, JSONB)
  TO anon, authenticated, service_role;
