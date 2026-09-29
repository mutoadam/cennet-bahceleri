-- Migration: B20.3 - Add event fields to suggestions
-- Production'da manuel uygulanan event_date ve speaker_role kolonlarini repo history'sine tasir.

BEGIN;

ALTER TABLE public.suggestions
ADD COLUMN IF NOT EXISTS event_date DATE NULL;

ALTER TABLE public.suggestions
ADD COLUMN IF NOT EXISTS speaker_role TEXT NULL;

COMMIT;
