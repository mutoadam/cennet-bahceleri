-- Migration: B20.2 - Fix programs_public_select_policy (Remove is_admin() from public select policy)
-- Tarih: 2026-09-29
-- Açıklama:
-- programs_public_select_policy politikasından is_admin() kontrolü çıkarılmıştır.
-- Anon/authenticated kullanıcılar artık yalnızca event_date IS NULL veya event_date >= bugünün tarihini (Europe/Istanbul) görür.
-- Admin kullanıcılar ise geçmiş/tüm kayıtları programs_admin_all_policy üzerinden görmeye devam eder.

BEGIN;

DROP POLICY IF EXISTS "programs_public_select_policy" ON public.programs;

CREATE POLICY "programs_public_select_policy" ON public.programs
FOR SELECT TO anon, authenticated
USING (
    event_date IS NULL
    OR event_date >= (now() AT TIME ZONE 'Europe/Istanbul')::date
);

COMMIT;
