-- ============================================================================
-- MIGRATION B21.2: Program Instagram Username Column
-- Target: public.programs
-- Description: Adds optional instagram_username TEXT column to public.programs
-- for direct public Android access and program-level social media linking.
-- Idempotent: safe to run multiple times without throwing errors.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'programs'
          AND column_name = 'instagram_username'
    ) THEN
        ALTER TABLE public.programs ADD COLUMN instagram_username TEXT;
    END IF;
END $$;
