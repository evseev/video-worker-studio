-- Local render worker uploads with anon role unless service key is configured.
-- Allow writes only in renders/videos/* to keep scope narrow.
DROP POLICY IF EXISTS "Anon can insert worker renders" ON storage.objects;
CREATE POLICY "Anon can insert worker renders"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'renders'
  AND name LIKE 'videos/%'
);

DROP POLICY IF EXISTS "Anon can update worker renders" ON storage.objects;
CREATE POLICY "Anon can update worker renders"
ON storage.objects
FOR UPDATE
TO anon
USING (
  bucket_id = 'renders'
  AND name LIKE 'videos/%'
)
WITH CHECK (
  bucket_id = 'renders'
  AND name LIKE 'videos/%'
);
