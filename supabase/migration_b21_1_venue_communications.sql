-- ============================================================================
-- MIGRATION B21.1: Venue Communications & Confirmation Tracking Schema
-- Target: public.venue_communications
-- Description: Nationwide venue-level communication tracking for Zikir Halkaları,
-- supporting Instagram handles, confirmation statuses, message statuses, and notes.
-- Uses a composite unique key (city, district, venue_name) for robust disambiguation.
-- SECURITY HARDENING: Restricted strictly to verified Admin users via public.is_admin().
-- No public read or write access is granted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.venue_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    instagram_username TEXT,
    instagram_profile_link TEXT,
    match_confidence TEXT DEFAULT 'unverified', -- 'unverified', 'verified', 'low'
    message_status TEXT DEFAULT 'not_messaged', -- 'not_messaged', 'message_sent', 'awaiting_reply', 'confirmed', 'schedule_changed', 'ended', 'account_not_found'
    confirmation_status TEXT DEFAULT 'pending', -- 'pending', 'confirmed'
    last_communication_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT venue_composite_unique UNIQUE (city, district, venue_name)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.venue_communications ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present to prevent conflict on re-run
DROP POLICY IF EXISTS "venue_communications_admin_all_policy" ON public.venue_communications;
DROP POLICY IF EXISTS "Allow public read venue_communications" ON public.venue_communications;
DROP POLICY IF EXISTS "Allow admin all venue_communications" ON public.venue_communications;

-- Strict Admin-Only Policy using public.is_admin()
CREATE POLICY "venue_communications_admin_all_policy"
    ON public.venue_communications
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_venue_communications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_venue_communications_updated_at ON public.venue_communications;
CREATE TRIGGER tr_venue_communications_updated_at
    BEFORE UPDATE ON public.venue_communications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_venue_communications_updated_at();
