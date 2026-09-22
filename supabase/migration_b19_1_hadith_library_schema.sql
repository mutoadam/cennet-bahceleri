-- B19.1 - HADİS KİTAPLIĞI ŞEMASI

-- 1. Create hadiths table
CREATE TABLE IF NOT EXISTS public.hadiths (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    arabic_text TEXT,
    source TEXT NOT NULL,
    narrator TEXT,
    narration_type TEXT NOT NULL DEFAULT 'UNKNOWN',
    sources TEXT[] NOT NULL DEFAULT '{}'::text[],
    memberships TEXT[] NOT NULL DEFAULT '{}'::text[],
    primary_category TEXT NOT NULL,
    categories TEXT[] NOT NULL DEFAULT '{}'::text[],
    provenance TEXT NOT NULL,
    collection_order INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints for narration_type
    CONSTRAINT chk_hadith_narration_type CHECK (
        narration_type IN ('DIRECT_SAYING', 'PRACTICE', 'DUA', 'TEACHING', 'REPORT', 'UNKNOWN')
    ),

    -- Constraints for primary_category
    CONSTRAINT chk_hadith_primary_category CHECK (
        primary_category IN ('AHLAK', 'IBADET_DUA_ZIKIR', 'AILE', 'IMAN_SUNNET', 'ILIM_KURAN', 'TOPLUM', 'DIL_IFFET', 'RIZIK_TICARET', 'SABIR_TEVBE', 'AHIRET', 'SAGLIK', 'SORUMLULUK')
    ),

    -- Constraints for categories array values
    CONSTRAINT chk_hadith_categories_elements CHECK (
        categories <@ ARRAY['AHLAK', 'IBADET_DUA_ZIKIR', 'AILE', 'IMAN_SUNNET', 'ILIM_KURAN', 'TOPLUM', 'DIL_IFFET', 'RIZIK_TICARET', 'SABIR_TEVBE', 'AHIRET', 'SAGLIK', 'SORUMLULUK']::text[]
    )
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_hadiths_memberships ON public.hadiths USING GIN (memberships);
CREATE INDEX IF NOT EXISTS idx_hadiths_categories ON public.hadiths USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_hadiths_provenance_order ON public.hadiths (provenance, collection_order);

-- 3. RLS
ALTER TABLE public.hadiths ENABLE ROW LEVEL SECURITY;

-- Policy A: Public SELECT (anon and authenticated) for active hadiths
DROP POLICY IF EXISTS "Public SELECT for active hadiths" ON public.hadiths;
CREATE POLICY "Public SELECT for active hadiths"
ON public.hadiths FOR SELECT
USING (is_active = true);

-- Policy B: Admin CRUD
DROP POLICY IF EXISTS "Admin CRUD for hadiths" ON public.hadiths;
CREATE POLICY "Admin CRUD for hadiths"
ON public.hadiths FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
