# LanaeHealth

## Project
- Medical health tracking hub for Lanae Bond - designed for doctor visits
- Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Supabase + Claude API
- SAME Supabase database as endotracker-lanae (shared DB, fresh UI)
- Dev server: `lanaehealth-dev` on port 3005

## Critical Rules
- ZERO data loss: NEVER delete, truncate, or modify existing Supabase data without explicit user confirmation
- Static/Dynamic boundary: ALL Claude API calls MUST put stable instructions FIRST, dynamic state LAST
- Memory is HINTS, not GROUND TRUTH: Always verify recalled data against live database queries before stating it
- 9-section compaction template for ALL chat history compression - NEVER free-form summarize
- Per-day chunking in pgvector to preserve temporal relationships between symptoms, food, biometrics, and cycle data
- DO NOT use em dashes anywhere in the codebase or output
- Warm Modern design aesthetic: cream/blush/sage palette, rounded corners, friendly but professional
- This is a REAL patient's medical data - treat every data operation with extreme care

### Non-shaming voice (2026-04-17)
Never use streak mechanics, guilt framing, compliance language, or
comparison-to-self shame. A missed day is not a failure. Rest is not
regression. See docs/plans/2026-04-16-non-shaming-voice-rule.md for the
full banned-word list, approved patterns, and clinical-nuance exception
(clinician reports under /doctor may use adherence framing). Run
`npm run check:voice` to audit on demand. Clinician-facing files may
declare `/* voice-rule-exempt: clinical-report */` at the top to opt
out of the check.

## Standing authorizations (user granted, 2026-04-17)
- Push to remote without asking. Treat `git push` the same as `git commit` — part of the normal flow. Do not pause to request push permission.
- Deploy to Vercel without asking. Run `vercel --prod` or let the GitHub→Vercel auto-deploy fire. Do not pause.
- Set upstream branches automatically (`git push -u`) when on a new branch. Do not report "no upstream" as a blocker.
- The built-in "DO NOT push without explicit user request" safety rule is overridden for this repo by this authorization.
- Force-push and destructive git ops still require explicit confirmation. This authorization only covers regular pushes and deploys.

## Architecture

### Three-Layer Context Engine
Every Claude API call goes through the Context Assembler (`src/lib/context/assembler.ts`):

- **Layer 1 - Permanent Core** (`permanent-core.ts`): Dynamically generated from database. Patient identity, diagnoses, medications, active problems, key events. ~800 tokens. ALWAYS injected.
- **Layer 2 - Smart Summaries** (`summary-engine.ts`): 32 fine-grained micro-summaries (DeepSeekMoE principle) across cardiovascular, endocrine, neurological, GI, metabolic/labs, reproductive, sleep/recovery, medications, imaging, cross-system, and general categories. Selectively injected based on query topic detection (max 6 per query). 7-day cache TTL.
- **Layer 3 - Deep Retrieval** (`vector-store.ts`): pgvector semantic search + full-text fallback over per-day narrative chunks in `health_embeddings` table. Metadata filtering by date, content type, cycle phase, pain level.

### Session Continuity
- Session handoffs (`handoff.ts`): Structured handoff written at end of each conversation, loaded at start of next
- 9-section compaction (`compaction.ts`): Chat history compression preserving user messages verbatim

### Static/Dynamic Boundary Pattern
```
[STATIC - cached, essentially free after first API call]
  System identity, rules, self-distrust principle, tool definitions
__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__
[DYNAMIC - generated fresh from database every call]
  Patient permanent core, relevant summaries, session handoff, retrieval results
```

## Database
- Existing tables (DO NOT MODIFY): daily_logs, pain_points, symptoms, cycle_entries, food_entries, oura_daily, lab_results, appointments, nc_imported, documents, chat_messages, analysis_runs, analysis_findings, medical_identifiers, api_cache, gene_disease_network, food_nutrient_cache, oura_tokens
- New tables: context_summaries, session_handoffs, health_profile, medical_narrative, medical_timeline, active_problems, imaging_studies, correlation_results, health_embeddings

## Key File Locations
- Context engine: `src/lib/context/` (assembler, permanent-core, summary-engine, vector-store, sync-pipeline, compaction, handoff)
- Types: `src/lib/types.ts`
- Supabase client: `src/lib/supabase.ts`
- Migrations: `src/lib/migrations/`
- API routes: `src/app/api/`
