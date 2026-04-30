# Current state: Data / Records / Labs / Imaging surfaces

**Recording:** `docs/current-state/recordings/2026-04-29-app-tour.mp4`
**Frames:** *None directly.* The recording does not exercise `/v2/records`, `/v2/labs`, `/v2/imaging`, or `/v2/import/*` as standalone surfaces.

The data **content** is visible inside the doctor analysis (frames 0057-0113): TSH 1.88 -> 5.1, hs-CRP 3.2 / 5 mg/L, ferritin nadir 10 ng/mL, CT head 8/2026 maxillary sinusitis, MRI brain (April 8 2026) "Brain tissue at foramen magnum", September 11 2025 thyroid panel, B6 deficiency timeline (May 2025 -> Apr 2026), ALT trend, etc. So the *records exist in the database* but the dedicated UI screens were not opened during this recording.

## What this means for a Data session

You are starting from a recording that does not show you what the surface looks like. Two options:

1. **Run the dev server and capture your own frames.** Start `lanaehealth-dev` on port 3005 (per CLAUDE.md), navigate `/v2/records`, `/v2/labs`, `/v2/imaging`, `/v2/import/*`, screen-record, drop into `docs/current-state/recordings/<YYYY-MM-DD>-data-tour.mp4`, run `scripts/extract-reference-frames.sh`, then re-write this brief. **Recommended path.**
2. **Read the route source directly.** The data surfaces are owned by the "Doctor & Records" v2 session per `docs/sessions/README.md`. Files to start with:
   - `src/app/v2/records/`
   - `src/app/v2/labs/`
   - `src/app/v2/imaging/`
   - `src/app/v2/import/`

## Database tables behind these surfaces

Per CLAUDE.md "Database":

- `lab_results` (existing)
- `documents` (existing)
- `nc_imported` (existing)
- `imaging_studies` (new)
- `medical_timeline` (new)
- `health_embeddings` (new pgvector index over per-day chunks)

Critical rule (CLAUDE.md "Critical Rules"): ZERO data loss. Never delete, truncate, or modify existing Supabase data without explicit user confirmation.

## Routes that own this surface

- `/v2/records`
- `/v2/labs`
- `/v2/imaging`
- `/v2/import/*`

Per `docs/sessions/README.md`, these are bundled with `/v2/doctor/*` under the "Doctor & Records" section session. If you want a *separate* Data session, raise that as a coordination question first.

## Why this brief is thin

The 6m24s recording was a quick walk-through of the four most-used surfaces (chat input, home, cycle, settings, doctor). Records / labs / imaging / import live a few taps deeper and were not visited. This is normal, not a gap to fix in the recording itself.
