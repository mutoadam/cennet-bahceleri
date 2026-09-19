-- B16.5 - CAMİ FOTOĞRAFLARI STORAGE VE GOOGLE METADATA

-- 0. Create mosque-images bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('mosque-images', 'mosque-images', true)
ON CONFLICT (id) DO NOTHING;

-- 1. Storage Policies for mosque-images
DROP POLICY IF EXISTS "Public Read Access for mosque-images" ON storage.objects;
CREATE POLICY "Public Read Access for mosque-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'mosque-images');

DROP POLICY IF EXISTS "Admin CRUD Access for mosque-images" ON storage.objects;
CREATE POLICY "Admin CRUD Access for mosque-images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'mosque-images' AND public.is_admin())
WITH CHECK (bucket_id = 'mosque-images' AND public.is_admin());

-- 2. mosque_images tablosuna Google Places metadata alanlarını ekle
ALTER TABLE public.mosque_images
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'MANUAL_UPLOAD',
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS google_photo_name TEXT,
ADD COLUMN IF NOT EXISTS google_photo_index INTEGER,
ADD COLUMN IF NOT EXISTS google_author_attribution TEXT;

-- 3. CHECK Constraint: Geçerli kaynak tipleri
ALTER TABLE public.mosque_images
DROP CONSTRAINT IF EXISTS check_mosque_photo_source_type;

ALTER TABLE public.mosque_images
ADD CONSTRAINT check_mosque_photo_source_type
CHECK (source_type IN ('MANUAL_UPLOAD', 'GOOGLE_PLACES'));

-- 4. Duplicate Koruması: Google kaynaklı aynı fotoğrafın aynı camiye mükerrer eklenmesini önle
DROP INDEX IF EXISTS idx_mosque_images_google_unique;
CREATE UNIQUE INDEX idx_mosque_images_google_unique
ON public.mosque_images (mosque_id, google_place_id, google_photo_name)
WHERE source_type = 'GOOGLE_PLACES';
