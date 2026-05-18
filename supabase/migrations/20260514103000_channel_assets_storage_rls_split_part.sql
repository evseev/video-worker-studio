-- Epic 25 follow-up: channel-assets storage write policies.
-- Prefer split_part(name, '/', 1) over (storage.foldername(name))[1] so the first path
-- segment always matches our object keys `{channelId}/logo.ext` (avoids edge cases
-- where foldername() does not return the channel id segment and owner uploads fail
-- with "new row violates row-level security policy" on storage.objects).

BEGIN;

DROP POLICY IF EXISTS "Authenticated insert own channel assets" ON storage.objects;
CREATE POLICY "Authenticated insert own channel assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'channel-assets'
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id::text = split_part(name, '/', 1)
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
      WHERE c.id::text = split_part(name, '/', 1)
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'channel-assets'
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id::text = split_part(name, '/', 1)
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
      WHERE c.id::text = split_part(name, '/', 1)
        AND c.user_id = auth.uid()
    )
  );

COMMIT;
