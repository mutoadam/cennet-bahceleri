-- B16.3C2 - TÜRBELER ÇOKLU FOTOĞRAF GALERİSİ

-- 1. Create tomb_images table
CREATE TABLE IF NOT EXISTS public.tomb_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tomb_id UUID NOT NULL REFERENCES public.tomb_locations(id) ON DELETE CASCADE,

    image_url TEXT NOT NULL,
    image_attribution TEXT,
    storage_path TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0,
    is_cover BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_tomb_images_tomb_id ON tomb_images(tomb_id);
CREATE INDEX IF NOT EXISTS idx_tomb_images_tomb_id_sort ON tomb_images(tomb_id, sort_order);

-- 3. RLS
ALTER TABLE public.tomb_images ENABLE ROW LEVEL SECURITY;

-- Policy A: Public SELECT
-- Everyone can see images of active tombs
DROP POLICY IF EXISTS "Public SELECT for tomb images" ON public.tomb_images;
CREATE POLICY "Public SELECT for tomb images"
ON public.tomb_images FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.tomb_locations
        WHERE id = tomb_images.tomb_id AND is_active = true
    )
);

-- Policy B: Admin CRUD
-- Only authenticated admins can manage gallery
DROP POLICY IF EXISTS "Admin CRUD for tomb images" ON public.tomb_images;
CREATE POLICY "Admin CRUD for tomb images"
ON public.tomb_images FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 4. Trigger to keep tomb_locations.image_url in sync (Optional but recommended for reliability)
-- Alternatively handle this via application logic as requested.
