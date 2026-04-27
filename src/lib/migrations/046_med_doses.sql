-- Migration 046: med_doses table
--
-- One row per dose taken. Every tap on the home meds card writes here.
-- Scheduled doses (Zyrtec morning, etc.) and PRN doses (Hydroxyzine
-- when she has a flare, Tylenol for headaches) share this table, told
-- apart by `kind`.
--
-- The med "id" is a stable slug derived from the medication name in
-- health_profile.medications (e.g. "zyrtec", "wixela", "antihistamine-spray").
-- We deliberately do NOT introduce a separate `medications` reference table
-- yet; the source of truth is the JSONB content in health_profile so
-- additions/removals stay editable from one place. If we eventually need
-- per-med metadata at SQL level, this table joins to that future table
-- via med_slug.
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.med_doses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Stable slug for the med ("zyrtec", "wixela", etc.). Kept loose
  -- (no FK) so a medication rename in health_profile does not
  -- invalidate dose history; renames update the slug + the historical
  -- rows in a single migration step when needed.
  med_slug TEXT NOT NULL,
  -- Display name at the time of dose (in case the slug ever shifts).
  -- Lets the doctor view show what was named-then, not what we'd name
  -- it today.
  med_name TEXT NOT NULL,
  -- 'scheduled' = part of her daily plan (morning/night batches).
  -- 'prn'       = as-needed rescue meds.
  kind TEXT NOT NULL CHECK (kind IN ('scheduled', 'prn')),
  -- Which slot in the daily plan this satisfied. Null for PRN doses
  -- and for late-logged scheduled doses where she did not specify.
  slot TEXT CHECK (slot IS NULL OR slot IN ('morning', 'midday', 'night')),
  -- Source of the row so the audit trail is honest.
  --   'tap'             = single tap on the home meds card
  --   'note_extraction' = AI parsed it from a free-form note
  --   'manual_edit'     = she edited a previously-logged time
  source TEXT NOT NULL DEFAULT 'tap'
    CHECK (source IN ('tap', 'note_extraction', 'manual_edit')),
  -- Optional dose amount string ("100 mg", "1 tablet", "2 sprays each
  -- nostril"). PRN doses default to the standard dose stored on the
  -- med record; scheduled rows are usually null.
  dose_text TEXT,
  -- The clinically meaningful timestamp: when she actually took it.
  -- Distinct from created_at which is when the row was written.
  taken_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Most queries look up "what did Lanae take today by slot".
CREATE INDEX IF NOT EXISTS med_doses_user_taken_idx
  ON public.med_doses (user_id, taken_at DESC);

CREATE INDEX IF NOT EXISTS med_doses_user_slug_taken_idx
  ON public.med_doses (user_id, med_slug, taken_at DESC);

-- Doctor view: "show me PRN frequency by week".
CREATE INDEX IF NOT EXISTS med_doses_kind_taken_idx
  ON public.med_doses (kind, taken_at DESC);
