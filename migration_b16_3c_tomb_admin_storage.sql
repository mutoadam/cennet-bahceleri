-- B16.3C - TÜRBELER ADMIN & STORAGE SETUP (SECURITY FIX v1.1)

-- 1. Create tomb-images bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('tomb-images', 'tomb-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for tomb-images

-- Allow public read access
DROP POLICY IF EXISTS "Public Read Access for tomb-images" ON storage.objects;
CREATE POLICY "Public Read Access for tomb-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'tomb-images');

-- Allow ONLY authenticated admins to upload/update/delete
-- Uses the existing public.is_admin() function
DROP POLICY IF EXISTS "Admin CRUD Access for tomb-images" ON storage.objects;
CREATE POLICY "Admin CRUD Access for tomb-images"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'tomb-images' AND public.is_admin())
WITH CHECK (bucket_id = 'tomb-images' AND public.is_admin());

-- 3. Database RLS Policies for tomb_locations

-- Ensure RLS is enabled
ALTER TABLE public.tomb_locations ENABLE ROW LEVEL SECURITY;

-- Policy A: Public SELECT (Reinforced)
-- Everyone (including anonymous) can read active tombs
DROP POLICY IF EXISTS "tomb_locations_public_select" ON public.tomb_locations;
CREATE POLICY "tomb_locations_public_select"
ON public.tomb_locations FOR SELECT
USING (is_active = true);

-- Policy B: Admin SELECT ALL
-- Authenticated admins can see ALL rows (active or not)
DROP POLICY IF EXISTS "tomb_locations_auth_select_all" ON public.tomb_locations;
CREATE POLICY "tomb_locations_auth_select_all"
ON public.tomb_locations FOR SELECT
TO authenticated
USING (public.is_admin());

-- Policy C: Admin CRUD
-- Authenticated admins can perform INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "tomb_locations_admin_crud" ON public.tomb_locations;
CREATE POLICY "tomb_locations_admin_crud"
ON public.tomb_locations FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Note:
-- Non-admin authenticated users will only pass Policy A (if row is_active).
-- They will FAIL Policy B and Policy C.
-- The dataset_origin and source_key immutability for SAKARYA_BB
-- is enforced at the Application Logic (admin.js) level.
