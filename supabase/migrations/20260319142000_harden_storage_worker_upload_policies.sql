-- Harden storage writes for local worker uploads:
-- 1) Remove anon write policies added for temporary local testing.
-- 2) Restrict worker uploads to service_role and to renders/videos/*.

DROP POLICY IF EXISTS "Anon can insert worker renders" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update worker renders" ON storage.objects;

DROP POLICY IF EXISTS "Service role can insert worker renders" ON storage.objects;
CREATE POLICY "Service role can insert worker renders"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (
  bucket_id = 'renders'
  AND name LIKE 'videos/%'
);

DROP POLICY IF EXISTS "Service role can update worker renders" ON storage.objects;
CREATE POLICY "Service role can update worker renders"
ON storage.objects
FOR UPDATE
TO service_role
USING (
  bucket_id = 'renders'
  AND name LIKE 'videos/%'
)
WITH CHECK (
  bucket_id = 'renders'
  AND name LIKE 'videos/%'
);
