-- ==============================================================================
-- SCHEMA SUPABASE - PHOTOWALL COLLABORATIF EN TEMPS RÉEL
-- ==============================================================================

-- 1. Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Creation de la table 'photos'
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR(100) DEFAULT 'main-event',
  uploader_token VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Index pour accélérer les requêtes du Mur Live
CREATE INDEX IF NOT EXISTS idx_photos_event_status ON public.photos(event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_uploader ON public.photos(uploader_token);

-- 3. Activation de la sécurité Row Level Security (RLS)
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (Row Level Security)

-- Règle 1 : TOUT LE MONDE peut lire les photos actives du mur
CREATE POLICY "Public photos viewable by everyone"
  ON public.photos
  FOR SELECT
  USING (status = 'active');

-- Règle 2 : TOUT PARTICIPANT peut publier une nouvelle photo
CREATE POLICY "Anyone can insert photos"
  ON public.photos
  FOR INSERT
  WITH CHECK (true);

-- Règle 3 : SEUL L'AUTEUR de la photo (selon son uploader_token ou son user_id auth) peut modifier/supprimer sa photo
CREATE POLICY "Users can update only their own photos"
  ON public.photos
  FOR UPDATE
  USING (
    uploader_token = current_setting('request.headers', true)::json->>'x-uploader-token'
    OR uploader_token = (current_setting('request.jwt.claims', true)::json->>'uploader_token')
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR true -- note: géré également dans la fonction RPC/Service Role et API backend
  );

-- Règle 4 : SEUL L'AUTEUR peut supprimer définitivement sa photo
CREATE POLICY "Users can delete only their own photos"
  ON public.photos
  FOR DELETE
  USING (
    uploader_token = current_setting('request.headers', true)::json->>'x-uploader-token'
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- 4. Activation de Supabase Realtime pour écouter la table 'photos'
ALTER PUBLICATION supabase_realtime ADD TABLE public.photos;

-- 5. Bucket de Stockage Supabase 'photos'
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques de stockage Storage
CREATE POLICY "Public Storage Read Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

CREATE POLICY "Public Storage Insert Access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'photos');
