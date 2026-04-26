# LanaeHealth

A medical health tracking hub built for one patient (Lanae Bond), tuned
for doctor visits. Symptoms, cycle, food, biometrics, labs, imaging,
appointments, and an AI assistant that reads from a three-layer context
engine over the same Supabase database the original endotracker used.

The app coexists in two surfaces: a legacy desktop-first Warm Modern
shell at `/` and a mobile-first dark Oura-derived shell at `/v2/*`.
v2 is the active build; legacy is kept healthy during the rollout.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3005
npm run test         # vitest, node env
npm run test:e2e     # Playwright (WebKit + mobile Chromium)
npm run build        # production build
```

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` for the database
- `ANTHROPIC_API_KEY` for the Claude assistant
- `OPENAI_API_KEY` for embeddings and transcription fallback
- `VOYAGE_API_KEY` for the primary embedding provider
- `PINECONE_API_KEY`, `PINECONE_INDEX` for the vector store (optional;
  falls back to pgvector + full-text)
- `OURA_*`, `EDAMAM_*`, `USDA_*` for integration credentials (optional)
- `LANAE_REQUIRE_AUTH` set to `false` only for local Playwright runs

The middleware (`src/middleware.ts`) gates `/v2` behind a session
cookie. Production always requires auth.

## Architecture

### Three-layer context engine

Every Claude API call funnels through `src/lib/context/assembler.ts`:

1. **Permanent core** (`permanent-core.ts`) is generated from live
   database queries. Patient identity, diagnoses, active medications,
   active problems, and key events. About 800 tokens. Always injected.
2. **Smart summaries** (`summary-engine.ts`) are 32 fine-grained
   micro-summaries across cardiovascular, endocrine, neurological, GI,
   metabolic, reproductive, sleep, medications, imaging, cross-system,
   and general categories. The query is topic-classified and at most
   six relevant summaries are injected per call. Cached for 7 days.
3. **Deep retrieval** (`vector-store.ts`) is pgvector semantic search
   with full-text fallback over per-day narrative chunks in
   `health_embeddings`, with metadata filters on date, content type,
   cycle phase, and pain level.

### Static / dynamic boundary

Anthropic prompt-cache rules: stable instructions go FIRST, dynamic
state goes LAST.

```
[STATIC, cached]
  System identity, rules, self-distrust principle, tool definitions
__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__
[DYNAMIC, generated each call]
  Patient permanent core, relevant summaries, session handoff,
  retrieval results
```

Session continuity is preserved by `handoff.ts` (structured handoff
written at the end of each conversation) and `compaction.ts` (a
9-section template for chat history compression that preserves user
messages verbatim).

### v2 vs legacy

- `src/v2/*` and `src/app/v2/*` use the dark Oura-derived chrome
  (tokens at `src/v2/theme/tokens.css`, prefix `--v2-*`).
- `src/components/**` and `src/app/globals.css` keep the cream, blush,
  and sage Warm Modern aesthetic for the legacy surface and for v2's
  explanatory views (`v2-surface-explanatory`).
- Voice rules apply everywhere: short, kind, explanatory. No em-dashes
  in code, copy, docs, commits, or PR titles.
- Foundation primitives in `src/v2/theme/`,
  `src/v2/components/primitives/`, `src/v2/components/shell/`, and
  `src/app/v2/layout.tsx` are edited via FOUNDATION-REQUEST only.

## Database

Same Supabase project as the endotracker app. Existing tables (do not
modify): `daily_logs`, `pain_points`, `symptoms`, `cycle_entries`,
`food_entries`, `oura_daily`, `lab_results`, `appointments`,
`nc_imported`, `documents`, `chat_messages`, `analysis_runs`,
`analysis_findings`, `medical_identifiers`, `api_cache`,
`gene_disease_network`, `food_nutrient_cache`, `oura_tokens`.

Tables added by this app: `context_summaries`, `session_handoffs`,
`health_profile`, `medical_narrative`, `medical_timeline`,
`active_problems`, `imaging_studies`, `correlation_results`,
`health_embeddings`.

## Migration application path

```bash
npm run db:migrate                # runs scripts/migrate.mjs
npm run embed:backfill            # backfills voyage embeddings
npm run embed:backfill:fast       # same, at higher concurrency
```

Migration files live in `src/lib/migrations/`. Backfill scripts read
`.env.local` directly via Node's `--env-file` flag.

## Critical rules

- Zero data loss. Never delete, truncate, or modify Supabase data
  without explicit user confirmation.
- Memory is a HINT, not ground truth. Verify recalled data against a
  live database query before stating it.
- Per-day chunking in pgvector preserves temporal relationships
  between symptoms, food, biometrics, and cycle data.
- This is a real patient's medical data. Treat every operation with
  extreme care.

See `CLAUDE.md` for the full project rules and `docs/research/` for
deep architectural notes.
