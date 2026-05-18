-- Epic 25.5: channel_scene_presets + RLS via EXISTS on channels.

BEGIN;

CREATE TABLE public.channel_scene_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels (id) ON DELETE CASCADE,
  name text NOT NULL,
  template_id text NOT NULL,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_scene_presets_template_id_check
    CHECK (template_id IN ('slideshow', 'comparison', 'fact-card')),
  CONSTRAINT channel_scene_presets_channel_name_key UNIQUE (channel_id, name)
);

CREATE INDEX channel_scene_presets_channel_created_idx
  ON public.channel_scene_presets (channel_id, created_at DESC);

ALTER TABLE public.channel_scene_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_scene_presets_select" ON public.channel_scene_presets;
CREATE POLICY "channel_scene_presets_select"
  ON public.channel_scene_presets FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_scene_presets.channel_id
        AND ch.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "channel_scene_presets_insert" ON public.channel_scene_presets;
CREATE POLICY "channel_scene_presets_insert"
  ON public.channel_scene_presets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_scene_presets.channel_id
        AND ch.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "channel_scene_presets_update" ON public.channel_scene_presets;
CREATE POLICY "channel_scene_presets_update"
  ON public.channel_scene_presets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_scene_presets.channel_id
        AND ch.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_scene_presets.channel_id
        AND ch.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "channel_scene_presets_delete" ON public.channel_scene_presets;
CREATE POLICY "channel_scene_presets_delete"
  ON public.channel_scene_presets FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.channels ch
      WHERE ch.id = channel_scene_presets.channel_id
        AND ch.user_id = auth.uid()
    )
  );

COMMIT;
