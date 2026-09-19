-- B16.4 - CAMİ ÇOKLU FOTOĞRAF GALERİSİ

-- 1. Create mosque_images table
CREATE TABLE IF NOT EXISTS public.mosque_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mosque_id UUID NOT NULL REFERENCES public.mosque_locations(id) ON DELETE CASCADE,

    image_url TEXT NOT NULL,
    image_attribution TEXT,
    storage_path TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,
    is_cover BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_mosque_images_mosque_id ON mosque_images(mosque_id);
CREATE INDEX IF NOT EXISTS idx_mosque_images_mosque_id_sort ON mosque_images(mosque_id, sort_order);

-- 3. RLS
ALTER TABLE public.mosque_images ENABLE ROW LEVEL SECURITY;

-- Policy A: Public SELECT
-- Everyone can see images of active mosques
DROP POLICY IF EXISTS "Public SELECT for mosque images" ON public.mosque_images;
CREATE POLICY "Public SELECT for mosque images"
ON public.mosque_images FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.mosque_locations
        WHERE id = mosque_images.mosque_id AND status = 'active'
    )
);

-- Policy B: Admin CRUD
-- Only authenticated admins can manage gallery
DROP POLICY IF EXISTS "Admin CRUD for mosque images" ON public.mosque_images;
CREATE POLICY "Admin CRUD for mosque images"
ON public.mosque_images FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
