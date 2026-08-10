-- B16.2A – GOOGLE PLACES & DATA INFRASTRUCTURE EXTENSION
-- mosque_locations tablosunu Google Places ve OSM entegrasyonu için genişletir.

-- 1. Yeni kolonların eklenmesi (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mosque_locations' AND column_name='source') THEN
        ALTER TABLE public.mosque_locations ADD COLUMN source text DEFAULT 'admin';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mosque_locations' AND column_name='osm_id') THEN
        ALTER TABLE public.mosque_locations ADD COLUMN osm_id text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mosque_locations' AND column_name='google_place_id') THEN
        ALTER TABLE public.mosque_locations ADD COLUMN google_place_id text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mosque_locations' AND column_name='image_url') THEN
        ALTER TABLE public.mosque_locations ADD COLUMN image_url text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mosque_locations' AND column_name='approved') THEN
        ALTER TABLE public.mosque_locations ADD COLUMN approved boolean DEFAULT false;
    END IF;
END $$;

-- 2. Mevcut kayıtların onaylı (approved=true) olarak işaretlenmesi
-- Sadece daha önce approved değeri atanmamış (yeni eklenen kolon) kayıtlar için çalışır.
UPDATE public.mosque_locations
SET approved = true
WHERE approved IS FALSE AND source = 'admin' AND google_place_id IS NULL AND osm_id IS NULL;

-- Alternatif olarak tüm mevcut kayıtları bir defaya mahsus true yapalım:
UPDATE public.mosque_locations
SET approved = true
WHERE approved IS FALSE;

-- 3. İndekslerin oluşturulması
CREATE INDEX IF NOT EXISTS idx_mosque_locations_google_place_id ON public.mosque_locations(google_place_id);
CREATE INDEX IF NOT EXISTS idx_mosque_locations_osm_id ON public.mosque_locations(osm_id);
CREATE INDEX IF NOT EXISTS idx_mosque_locations_approved ON public.mosque_locations(approved);

-- Not: Bu migration manuel olarak Supabase SQL Editor üzerinden çalıştırılmalıdır.
