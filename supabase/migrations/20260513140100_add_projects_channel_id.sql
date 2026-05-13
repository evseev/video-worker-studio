-- Epic 25.2: projects.channel_id — lock, backfill via default channel RPC, verify, NOT NULL + FK.

BEGIN;

LOCK TABLE public.projects IN EXCLUSIVE MODE;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS channel_id uuid;

DO $$
DECLARE
  r record;
  cid uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id
    FROM public.projects
    WHERE channel_id IS NULL
  LOOP
    SELECT public.worker_create_default_channel_for_user(r.user_id) INTO cid;
    UPDATE public.projects
    SET channel_id = cid
    WHERE user_id = r.user_id
      AND channel_id IS NULL;
  END LOOP;
END $$;

DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*)::integer INTO n FROM public.projects WHERE channel_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'projects.channel_id backfill failed: % rows still null', n;
  END IF;
END $$;

ALTER TABLE public.projects
  ALTER COLUMN channel_id SET NOT NULL;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS projects_channel_id_idx
  ON public.projects (channel_id);

COMMIT;
