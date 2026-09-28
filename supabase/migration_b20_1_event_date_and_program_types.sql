-- Migration: B20.1 - Tarihli Program Desteği ve Program Türleri Seed
-- Tarih: 2026-09-28
-- Açıklama:
-- 1. public.programs tablosuna event_date (DATE) ve speaker_role (TEXT) kolonları eklenir.
-- 2. event_date için arama indeksi oluşturulur.
-- 3. RLS public SELECT politikası güncellenir:
--    - Admin (is_admin() = true) veya (event_date IS NULL OR event_date >= Europe/Istanbul bugünkü tarih)
--    - Hiçbir yeni status kısıtlaması (status = 'active') eklenmez; mevcut semantik korunur.
-- 4. public.program_types tablosuna "Cuma Vaazı", "Cumartesi Vaazı", "Hafta İçi Vaazı / İrşad" seed edilir (icon_key NULL, dinamik sort_order).

BEGIN;

-- 1. programs tablosuna yeni kolonlar
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS event_date DATE NULL;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS speaker_role TEXT NULL;

-- 2. İndeksler (Sadece gerekli olan event_date indeksi)
CREATE INDEX IF NOT EXISTS idx_programs_event_date ON public.programs(event_date);

-- 3. Public RLS SELECT Politikasının Güncellenmesi (Exact preservation of existing semantics + date expiration rule)
DROP POLICY IF EXISTS "programs_public_select_policy" ON public.programs;

CREATE POLICY "programs_public_select_policy" ON public.programs
FOR SELECT TO anon, authenticated
USING (
  public.is_admin() OR (
    event_date IS NULL OR event_date >= (now() AT TIME ZONE 'Europe/Istanbul')::date
  )
);

-- 4. program_types seed (Idempotent INSERT with dynamic sort_order and NULL icon_key to prevent invented icons)
INSERT INTO public.program_types (name, slug, icon_key, sort_order, status)
SELECT 'Cuma Vaazı', 'cuma-vaazi', NULL, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM public.program_types), 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.program_types WHERE slug = 'cuma-vaazi' OR name = 'Cuma Vaazı');

INSERT INTO public.program_types (name, slug, icon_key, sort_order, status)
SELECT 'Cumartesi Vaazı', 'cumartesi-vaazi', NULL, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM public.program_types), 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.program_types WHERE slug = 'cumartesi-vaazi' OR name = 'Cumartesi Vaazı');

INSERT INTO public.program_types (name, slug, icon_key, sort_order, status)
SELECT 'Hafta İçi Vaazı / İrşad', 'hafta-ici-vaazi', NULL, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM public.program_types), 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.program_types WHERE slug = 'hafta-ici-vaazi' OR name = 'Hafta İçi Vaazı / İrşad');

COMMIT;
