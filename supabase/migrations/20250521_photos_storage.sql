-- Photos bucket for student/staff face images (private; app serves via service role /api/photo)
-- Run in Supabase SQL Editor if uploads fail with "bucket not found"

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'photos',
  'photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- Service role (used by Next.js API) can read/write all objects in photos bucket
DROP POLICY IF EXISTS "Service role photos all" ON storage.objects;
CREATE POLICY "Service role photos all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'photos')
  WITH CHECK (bucket_id = 'photos');

COMMENT ON COLUMN students.photo_url IS 'Storage path under photos bucket (e.g. students/{school_id}/{id}.jpg) or legacy public URL';
COMMENT ON COLUMN teacher_profiles.photo_url IS 'Storage path under photos bucket or legacy public URL';
