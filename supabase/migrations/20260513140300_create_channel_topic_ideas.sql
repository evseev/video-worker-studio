-- Epic 25.4: channel_topic_ideas + RLS (EXISTS on channels) + worker_persist_topic_suggestions.

BEGIN;

CREATE TABLE public.channel_topic_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
  idea_text text NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'backlog',
  ai_reasoning text,
  youtube_seed_video_id text,
  used_in_project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_topic_ideas_source_check
    CHECK (source IN ('manual', 'ai', 'youtube_performance')),
  CONSTRAINT channel_topic_ideas_status_check
    CHECK (status IN ('backlog', 'shot', 'skipped'))
);

CREATE INDEX channel_topic_ideas_channel_created_idx
  ON public.channel_topic_ideas (channel_id, created_at DESC);

ALTER TABLE public.channel_topic_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_topic_ideas_select" ON public.channel_topic_ideas;
CREATE POLICY "channel_topic_ideas_select"
  ON public.channel_topic_ideas FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_topic_ideas.channel_id
        AND ch.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "channel_topic_ideas_insert" ON public.channel_topic_ideas;
CREATE POLICY "channel_topic_ideas_insert"
  ON public.channel_topic_ideas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_topic_ideas.channel_id
        AND ch.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "channel_topic_ideas_update" ON public.channel_topic_ideas;
CREATE POLICY "channel_topic_ideas_update"
  ON public.channel_topic_ideas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_topic_ideas.channel_id
        AND ch.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_topic_ideas.channel_id
        AND ch.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "channel_topic_ideas_delete" ON public.channel_topic_ideas;
CREATE POLICY "channel_topic_ideas_delete"
  ON public.channel_topic_ideas FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_topic_ideas.channel_id
        AND ch.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.worker_persist_topic_suggestions(p_channel_id uuid, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.channels c WHERE c.id = p_channel_id) THEN
    RAISE EXCEPTION 'worker_persist_topic_suggestions: unknown channel %', p_channel_id;
  END IF;

  INSERT INTO public.channel_topic_ideas (
    channel_id,
    idea_text,
    source,
    status,
    ai_reasoning,
    youtube_seed_video_id
  )
  SELECT
    p_channel_id,
    item ->> 'idea_text',
    COALESCE(item ->> 'source', 'ai'),
    COALESCE(item ->> 'status', 'backlog'),
    NULLIF(item ->> 'ai_reasoning', ''),
    NULLIF(item ->> 'youtube_seed_video_id', '')
  FROM jsonb_array_elements(p_rows) AS item
  WHERE item ? 'idea_text'
    AND length(trim(item ->> 'idea_text')) > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.worker_persist_topic_suggestions(uuid, jsonb) TO service_role;

COMMIT;
