---
date: 2026-04-16
session: QA pass 2 (orchestrated)
status: DRAFT - awaiting user approval before dispatch
---

# QA Session 2: Design Decisions Contract

## Purpose
Lock the conventions every parallel research and implementation subagent must follow. Written BEFORE any dispatch so agents cannot drift.

## Scope (what this session covers)
Deferred items from Session 1's [final report](final-report.md):
- Computed values vs hand-written SQL (streaks, averages, progress rings, flare-risk, sleep stages, orthostatic vitals, food-trigger correlations)
- Importer end-to-end verification (7 import routes)
- Chart visual correctness (Recharts across every page)
- Claude API grounded-response audit (chat, intelligence personas, doctor report)
- Mutation endpoints (POST/PUT/DELETE dry-run audit)
- Vector store integrity (health_embeddings consistency with source rows)

Out of scope: new features, UI redesign, triggering the correlation pipeline (needs separate user approval).

## Non-negotiable constraints
1. **Zero Data Loss**: no `INSERT`, `UPDATE`, or `DELETE` from any subagent during this session. Read-only via `/api/admin/peek?table=...` and GET API routes.
2. **Memory is hints, not truth**: every claim must be backed by a live DB query or HTTP response saved as evidence.
3. **Static/Dynamic boundary**: preserved in every Claude API prompt. Verify by inspection, never reorder.
4. **No em-dashes** anywhere. Use `--` or restructure.
5. **One dev server (port 3005), one Supabase DB**: research agents share read-only. Implementation agents use isolated git worktrees and must not restart the shared server.
6. **Do not trigger expensive pipelines** (`/api/analyze/correlations`, long-running Claude runs) without user opt-in.

## Research doc schema (every research agent writes to this shape)

```markdown
---
date: 2026-04-16
agent: <agent-name>
area: <computed-values | importers | charts | claude-grounding | mutations | vector-store>
status: PASS | FAIL | FLAGGED
severity: LOW | MEDIUM | HIGH
verification_method: <sql-vs-api | api-vs-api | visual | static-analysis>
---

# Finding title

## One-sentence finding
## Expected
## Actual
## Verification evidence (paste the query/response)
## Recommended action
  - FIX: file path and exact diff
  - INVESTIGATE: what to look into
  - ACCEPT: why this is expected behavior
```

## File locations (locked)
- Research output: `docs/qa/research/<agent-name>.md`
- Individual findings: `docs/qa/YYYY-MM-DD-<slug>.md`
- Implementation diffs: `docs/qa/fixes/<slug>.md`
- Final matrix: `docs/qa/session-2-matrix.md`

## Research wave assignments (parallel, N=7)

| Agent | Domain | Read-only surfaces | Output |
|---|---|---|---|
| R1 | Computed-value truth | `/api/admin/peek`, all GET `/api/intelligence/*`, all GET `/api/reports/*`, all GET `/api/analyze/flare-risk` | research/computed-values.md |
| R2 | Importer static audit | source in `src/lib/importers/*`, `src/app/api/import/*`, `src/lib/migrations/*.mjs`; no actual imports run | research/importers.md |
| R3 | Chart verification | `src/components/**/*Chart*.tsx`, page-level chart consumers, Recharts tooltip handlers | research/charts.md |
| R4 | Claude grounding (static) | `src/lib/ai/*`, `src/lib/intelligence/personas/*`, `src/lib/context/*` (inspect prompts, don't call) | research/claude-grounding.md |
| R5 | Mutation endpoint catalog | every POST/PUT/DELETE route under `src/app/api/*` - inspect request shape, response shape, DB writes; NO actual writes | research/mutations.md |
| R6 | Vector store integrity | `src/lib/context/vector-store.ts`, `src/lib/context/sync-pipeline.ts`, `health_embeddings` count vs source | research/vector-store.md |
| R7 | Migration execution trail | `src/lib/migrations/*.sql` and `.mjs`, git log for migration runs, confirm which ran in live DB | research/migration-trail.md |

Each agent works from this contract, produces one research/*.md plus individual finding docs per bug, and returns a summary to main.

## Planning wave (after research)
Single synthesis agent (or main) reads all 7 research docs and produces `session-2-matrix.md` with a ranked list: issue, severity, fix complexity, dependency graph, recommended wave.

## Implementation wave rules
- One fix per subagent, one worktree per subagent.
- Each fix must ship with:
  1. A failing test that reproduces the bug
  2. The fix
  3. The test passing
  4. An updated finding doc moving status from FLAGGED to FIXED
- No DB mutations. If a fix requires backfill/migration, it is deferred to a dedicated human-approved session.
- Main session serializes merges to keep the shared dev server / DB stable.

## Go / no-go gates
- Gate 1 (now): user approves this doc. Dispatch research wave.
- Gate 2: user reviews `session-2-matrix.md`. Approves which fixes to dispatch.
- Gate 3: user signs off after each implementation wave before the next.

## Open decisions for user (answer before dispatch)
1. **Claude grounding audit** -- do we inspect prompts only (static), or also execute a handful of chat queries against real Claude API? Static is free; live costs $ and hits cache. Recommend static first, live audit deferred.
2. **Importer audit depth** -- static source audit only, or also dry-run against a sample file if one is committed? If you have sample fixtures somewhere, point me at them.
3. **Parallelism cap** -- default is 7 research agents. Drop to 4 if you are concerned about concurrent peek-endpoint load. (Negligible load, but your call.)
4. **Cycle-intelligence fix from Session 1** -- do you want that bundled into Session 2 or handled standalone? The semantic call (SPOTTING vs MENSTRUATION) is still yours to make.
