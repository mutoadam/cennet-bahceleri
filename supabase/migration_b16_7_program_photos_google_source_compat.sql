-- B16.7 - program_photos Google Places uyumluluğu için nullability düzeltmesi

-- Google Places'tan gelen fotoğraflar Storage upload olmadığı için bu alanlar NULL olabilmeli.
ALTER TABLE public.program_photos
ALTER COLUMN bucket_name DROP NOT NULL,
ALTER COLUMN storage_path DROP NOT NULL;

-- Açıklama: Source type 'GOOGLE_PLACES' ise bu alanlar boş kalacaktır.
COMMENT ON COLUMN public.program_photos.bucket_name IS 'Supabase Storage bucket adı (Google kaynaklılarda NULL)';
COMMENT ON COLUMN public.program_photos.storage_path IS 'Storage içindeki dosya yolu (Google kaynaklılarda NULL)';
