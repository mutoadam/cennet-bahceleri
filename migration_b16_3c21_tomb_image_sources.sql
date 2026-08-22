-- B16.3C2.1 - TÜRBELER İÇİN GOOGLE PLACES KAYNAK DESTEĞİ (HARDENED)

-- 1. tomb_images tablosuna yeni alanlar ekle
ALTER TABLE public.tomb_images
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'MANUAL_UPLOAD',
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS google_photo_name TEXT,
ADD COLUMN IF NOT EXISTS google_photo_index INTEGER,
ADD COLUMN IF NOT EXISTS google_author_attribution TEXT;

-- 2. CHECK Constraint: Geçerli kaynak tipleri
ALTER TABLE public.tomb_images
DROP CONSTRAINT IF EXISTS check_tomb_image_source_type;

ALTER TABLE public.tomb_images
ADD CONSTRAINT check_tomb_image_source_type
CHECK (source_type IN ('MANUAL_UPLOAD', 'GOOGLE_PLACES'));

-- 3. Mevcut kayıtları MANUAL_UPLOAD olarak işaretle
UPDATE public.tomb_images
SET source_type = 'MANUAL_UPLOAD'
WHERE source_type IS NULL OR source_type = '';

-- 4. Duplicate Koruması: Google kaynaklı aynı fotoğrafın aynı türbeye mükerrer eklenmesini önle
DROP INDEX IF EXISTS idx_tomb_images_google_unique;
CREATE UNIQUE INDEX idx_tomb_images_google_unique
ON public.tomb_images (tomb_id, google_place_id, google_photo_name)
WHERE source_type = 'GOOGLE_PLACES';

-- 5. tomb_locations tablosuna cover attribution alanı ekle (Eğer yoksa)
ALTER TABLE public.tomb_locations
ADD COLUMN IF NOT EXISTS image_attribution TEXT;

COMMENT ON COLUMN public.tomb_images.source_type IS 'Fotoğrafın kaynağı: MANUAL_UPLOAD veya GOOGLE_PLACES';
COMMENT ON COLUMN public.tomb_images.google_photo_name IS 'Google Places API Photo Resource Name (Refreshable)';
COMMENT ON COLUMN public.tomb_images.google_photo_index IS 'Arama sonucundaki fotoğraf sırası (Yenileme için yardımcı)';
