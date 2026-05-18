-- Epic 25.6: Storage bucket `channel-assets` — object keys `{channelId}/...`; owner-only writes, public reads.

BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('channel-assets', 'channel-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can read channel assets" ON storage.objects;
CREATE POLICY "Anyone can read channel assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'channel-assets');

DROP POLICY IF EXISTS "Authenticated insert own channel assets" ON storage.objects;
CREATE POLICY "Authenticated insert own channel assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'channel-assets'
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id::text = (storage.foldername (name))[1]
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated update own channel assets" ON storage.objects;
CREATE POLICY "Authenticated update own channel assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'channel-assets'
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id::text = (storage.foldername (name))[1]
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'channel-assets'
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id::text = (storage.foldername (name))[1]
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated delete own channel assets" ON storage.objects;
CREATE POLICY "Authenticated delete own channel assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'channel-assets'
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id::text = (storage.foldername (name))[1]
        AND c.user_id = auth.uid()
    )
  );

COMMIT;
