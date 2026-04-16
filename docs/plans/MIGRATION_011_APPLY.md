# Apply Migration 011 (Endometriosis Mode)

This migration adds 8 new nullable columns to `cycle_entries` for endo-specific
tracking. It is **safe to run repeatedly** (uses `IF NOT EXISTS`).

## Why manual apply is required

Supabase does not expose arbitrary DDL (`ALTER TABLE`) through PostgREST, and the
project's DB password is not stored in this repo or in Vercel env. The direct
Postgres connection rejects the service role JWT as a password.

There are two supported paths: apply via the Supabase dashboard (easiest), or
give the DB password to the migration runner in `.env.local`.

## Path A - Supabase dashboard (30 seconds)

1. Open https://supabase.com/dashboard/project/dmvzonbqbkfptkfrsfuz/sql/new
2. Paste the SQL below.
3. Click **Run**.

```sql
ALTER TABLE cycle_entries
  ADD COLUMN IF NOT EXISTS bowel_symptoms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bladder_symptoms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dyspareunia boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dyspareunia_intensity smallint
    CHECK (dyspareunia_intensity IS NULL OR (dyspareunia_intensity BETWEEN 0 AND 10)),
  ADD COLUMN IF NOT EXISTS clots_present boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS clot_size text
    CHECK (clot_size IS NULL OR clot_size IN ('small', 'medium', 'large', 'very_large')),
  ADD COLUMN IF NOT EXISTS clot_count smallint,
  ADD COLUMN IF NOT EXISTS endo_notes text;

CREATE INDEX IF NOT EXISTS idx_cycle_entries_clots
  ON cycle_entries (date, clots_present)
  WHERE clots_present = true;
```

## Path B - local runner (if you have the DB password)

Add the actual Postgres password (from **Settings -> Database -> Connection string**
in the Supabase dashboard) to `.env.local`:

```bash
SUPABASE_DB_PASSWORD=<actual-db-password>
```

Then run:

```bash
node src/lib/migrations/run-011-endo-mode.mjs
```

## Verify

After applying, confirm columns exist by hitting the admin probe route:

```bash
curl -X POST http://localhost:3005/api/admin/apply-migration-011 \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected response:

```json
{ "status": "already_applied", "message": "Migration 011 columns already exist in cycle_entries." }
```

## Graceful degradation

The `EndoMode` component and cycle API both guard their writes - if the
columns are missing, the write silently falls back to writing only the
existing fields. So the app will not crash if you forget to run this
migration, but the endo-specific data will not persist until you do.
