-- B16.6 - PROGRAM FOTOĞRAFLARI İÇİN GOOGLE METADATA DESTEĞİ

-- 1. program_photos tablosuna Google Places metadata alanlarını ekle
ALTER TABLE public.program_photos
ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'MANUAL_UPLOAD',
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS google_photo_name TEXT,
ADD COLUMN IF NOT EXISTS google_photo_index INTEGER,
ADD COLUMN IF NOT EXISTS google_author_attribution TEXT,
ADD COLUMN IF NOT EXISTS image_attribution TEXT;

-- 2. CHECK Constraint: Geçerli kaynak tipleri
ALTER TABLE public.program_photos
DROP CONSTRAINT IF EXISTS check_program_photo_source_type;

ALTER TABLE public.program_photos
ADD CONSTRAINT check_program_photo_source_type
CHECK (source_type IN ('MANUAL_UPLOAD', 'GOOGLE_PLACES'));

-- 3. Duplicate Koruması: Google kaynaklı aynı fotoğrafın aynı programa mükerrer eklenmesini önle
DROP INDEX IF EXISTS idx_program_photos_google_unique;
CREATE UNIQUE INDEX idx_program_photos_google_unique
ON public.program_photos (program_id, google_place_id, google_photo_name)
WHERE source_type = 'GOOGLE_PLACES';

-- 4. Açıklamalar
COMMENT ON COLUMN public.program_photos.source_type IS 'Fotoğrafın kaynağı: MANUAL_UPLOAD veya GOOGLE_PLACES';
COMMENT ON COLUMN public.program_photos.google_photo_name IS 'Google Places API Photo Resource Name (Refreshable)';
COMMENT ON COLUMN public.program_photos.image_attribution IS 'Manuel düzenlenen veya Google''dan gelen atıf metni';
