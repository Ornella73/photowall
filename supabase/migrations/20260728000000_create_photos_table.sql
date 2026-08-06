-- Migration: Create photos table with RLS, Realtime and uploader_token
-- Date: 2026-07-28

-- 1. Create photos table
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    uploader_token TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- Ensure uploader_token column exists if table was created previously
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'photos' AND column_name = 'uploader_token'
  ) THEN
    ALTER TABLE public.photos ADD COLUMN uploader_token TEXT NULL;
  END IF;
END $$;

-- 2. Enable REPLICA IDENTITY FULL to ensure DELETE and UPDATE events contain the full row data in Realtime
ALTER TABLE public.photos REPLICA IDENTITY FULL;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_photos_status_created_at ON public.photos (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_uploader_token ON public.photos (uploader_token);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Public Policy: Anyone (anonymous & authenticated) can view active photos
CREATE POLICY "Public photos are viewable by everyone"
ON public.photos
FOR SELECT
USING (status = 'active');

-- Public Policy: Anyone can insert photos
CREATE POLICY "Public photos insert"
ON public.photos
FOR INSERT
WITH CHECK (true);

-- Public Policy: Anyone can update photos (e.g. uploader deleting their photo via uploader_token match)
CREATE POLICY "Public photos update"
ON public.photos
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Public Policy: Anyone can delete photos (e.g. uploader deleting their photo via uploader_token match)
CREATE POLICY "Public photos delete"
ON public.photos
FOR DELETE
USING (true);

-- Admin Policies: Authenticated Supabase Auth users have full access
CREATE POLICY "Admins can view all photos"
ON public.photos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert photos"
ON public.photos
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update photos"
ON public.photos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can delete photos"
ON public.photos
FOR DELETE
TO authenticated
USING (true);

-- 6. Enable Supabase Realtime for photos table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;
  END IF;
END $$;
