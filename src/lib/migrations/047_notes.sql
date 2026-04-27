-- Migration 047: notes table
--
-- Free-form note/voice composer (the "+" FAB modal). Every save = one
-- row. Time-stamped at modal-open (not save), so a note about "took
-- Tylenol 5 mins ago" carries the right clinical timestamp.
--
-- Verbatim body always preserved. The AI extraction pipeline reads each
-- new row and proposes structured stamps (PRN dose, headache attack,
-- pain rating, etc.) which the user confirms via chip toast. Confirmed
-- extractions write their own typed rows and link back here via
-- source_note_id.
--
-- Indexed for the Three-Layer Context Engine: each note becomes a
-- per-day chunk fed to health_embeddings.
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The verbatim note. Always preserved exactly as composed.
  body TEXT NOT NULL,
  -- 'text'  = typed
  -- 'voice' = transcribed via /api/transcribe (Whisper)
  -- 'mixed' = voice transcript edited before save
  source TEXT NOT NULL DEFAULT 'text'
    CHECK (source IN ('text', 'voice', 'mixed')),
  -- Clinically meaningful timestamp = composer-open time. We log this
  -- separately from created_at so a "took Tylenol 5 mins ago" note
  -- gets the right anchor even if she takes 30 seconds to type and save.
  captured_at TIMESTAMPTZ NOT NULL,
  -- Extraction state machine.
  --   'pending'  = AI extractor has not run yet
  --   'queued'   = enqueued, results not back
  --   'ready'    = extractor ran, suggestions available (may be empty)
  --   'applied'  = user confirmed at least one chip
  --   'dismissed' = user explicitly dismissed all chips
  --   'failed'   = extractor errored; verbatim still preserved
  extraction_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (extraction_status IN
      ('pending','queued','ready','applied','dismissed','failed')),
  -- AI-extracted candidate entities + their structured payloads.
  -- See src/lib/notes/extraction.ts for the full schema. Always JSONB
  -- so the schema can grow without a migration.
  extractions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- The set of extraction ids the user confirmed (subset of `extractions[].id`).
  applied_extractions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Optional client-supplied metadata (device, location coarseness,
  -- whether the keyboard was on a watch, etc). Never used for safety;
  -- helps debugging.
  client_meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recent feed query.
CREATE INDEX IF NOT EXISTS notes_user_captured_idx
  ON public.notes (user_id, captured_at DESC);

-- Daily chunk + embedding pipeline.
CREATE INDEX IF NOT EXISTS notes_user_captured_date_idx
  ON public.notes (user_id, (captured_at::date) DESC);

-- Background extractor worker picks up rows in pending/queued state.
CREATE INDEX IF NOT EXISTS notes_extraction_pending_idx
  ON public.notes (extraction_status, created_at)
  WHERE extraction_status IN ('pending', 'queued');

-- Cross-link extracted entities back to their source note.
-- Adds source_note_id columns to existing event tables WITHOUT
-- breaking older inserts (column is optional).
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['med_doses', 'pain_points', 'headache_attacks', 'symptoms'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS source_note_id UUID REFERENCES public.notes(id) ON DELETE SET NULL',
        t
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (source_note_id) WHERE source_note_id IS NOT NULL',
        t || '_source_note_idx', t
      );
    END IF;
  END LOOP;
END $$;
