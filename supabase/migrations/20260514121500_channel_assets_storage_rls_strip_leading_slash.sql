-- Channel-assets storage: object `name` may be stored with a leading `/`.
-- Then split_part(name, '/', 1) is empty and RLS denies the insert.
-- Strip leading slashes (and trim whitespace) before taking the first segment.

BEGIN;

DROP POLICY IF EXISTS "Authenticated insert own channel assets" ON storage.objects;
CREATE POLICY "Authenticated insert own channel assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'channel-assets'
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id::text = split_part(regexp_replace(btrim(name), '^/+', ''), '/', 1)
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
      WHERE c.id::text = split_part(regexp_replace(btrim(name), '^/+', ''), '/', 1)
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'channel-assets'
    AND EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id::text = split_part(regexp_replace(btrim(name), '^/+', ''), '/', 1)
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
      WHERE c.id::text = split_part(regexp_replace(btrim(name), '^/+', ''), '/', 1)
        AND c.user_id = auth.uid()
    )
  );

COMMIT;
