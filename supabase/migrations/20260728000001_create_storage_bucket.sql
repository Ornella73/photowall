-- Migration: Create Storage Bucket for Photos
-- Date: 2026-07-28

-- 1. Create a public bucket 'photos' if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for 'photos' bucket

-- Public read access to photos bucket
CREATE POLICY "Public Read Access for Photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'photos');

-- Anyone can upload photos to the bucket (for /upload page)
CREATE POLICY "Anyone can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'photos');

-- Only authenticated users (Admin) can update or delete objects
CREATE POLICY "Admin update photos storage"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'photos');

CREATE POLICY "Admin delete photos storage"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'photos');
