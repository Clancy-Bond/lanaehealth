# Session Handoff: v2 Mobile Rebuild + Productization

**Date:** 2026-04-24 to 2026-04-25 (multi-day session)
**Format:** 9-section compaction template (per CLAUDE.md)
**Purpose:** Allow a fresh Claude Code session to pick up this work without context loss

---

## SECTION 1 - Verified Facts (what is true on main right now)

**Repo:** `/Users/clancybond/lanaehealth` (canonical) + worktrees under `.claude/worktrees/`
**Production URL:** https://lanaehealth.vercel.app (canonical) - `/` redirects to `/v2` via PR #53
**Deployment:** Vercel auto-deploys main + per-PR previews
**Vercel CLI:** authenticated as `stockcryptobots-2055` on this machine
**Vercel project ID:** `prj_trGcary6oGM...` (in `.vercel/project.json`)

**Tech stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Supabase (Postgres + pgvector), Claude API (`@anthropic-ai/sdk`), Voyage embeddings, Sentry. Vitest tests.

**Recent main commits (most recent first, this session's contribution):**
- `5d23750` feat(v2): multi-user auth foundation (#69)
- `e9af701` feat(v2/calories): food photos + Open Food Facts database (#67)
- `7b8895b` feat(v2/log): clinically-validated pain scales (#68)
- `ce2fbb9` feat(v2): light theme variant + Dark/Light/System toggle (#65)
- `[hash]` security(v2): production-readiness hardening (#66)
- `dd76712` feat(oura): wave 1 utilization gaps (#61)
- `2d43423` polish(v2/calories): MFN visual fidelity push (#64)
- `e9b2f2c` polish(v2/cycle): NC visual fidelity push (#63)
- `3aea268` fix(calories): USDA Nutrient fetch 404 (#62)
- `e61d782` feat(v2): /v2/chat with Three-Layer Context Engine (#60)
- Plus the entire foundation (#22), section PRs (#23, #25, #26, #28, #30 still open), polish PRs (#42-#52), Oura BBT (#58), cycle deep rebuild (#57, #58, #59)

**Production Supabase env (Vercel Preview is also fully configured):**
- All 18 env vars set on Preview (Supabase + Oura + Anthropic + USDA + NCBI + VAPID + Voyage + Health Sync)
- Migration `029_normalize_nc_imported_menstruation.sql` already executed on production (39 rows backfilled via REST PATCH)

**Open PRs on remote:**
- `#30` Phase 4 doctor mode (HELD per real-visit acceptance gate, do not merge without user approval)
- `#20` older labs PDF upload (not this session's work)

**Known good state:** Production is functional; all critical UX gaps the user complained about have been addressed in shipped PRs.

---

## SECTION 2 - User Intent / Priorities

**Primary goal:** Build a mobile health app for the user's wife Lanae, then productize for chronic-illness patients (POTS, migraine, EDS+MCAS clusters).

**Lanae's specific conditions:** POTS, migraine, cycle issues. Uses Oura Ring. Located in Oahu, Hawaii. Insurance: HMSA Quest.

**Doctor visit prep is the moat:** Most health apps are wellness journals. This app's differentiator is the Three-Layer Context Engine + doctor briefing pipeline + per-day pgvector retrieval.

**User's design philosophy (codified in CLAUDE.md):**
- Visual chrome: Oura (premium dark default, light variant added in #65)
- Voice / pedagogy: Natural Cycles (gentle, explanatory, never preachy, NEVER "false precision")
- Per-section UX patterns: cycle clones NC, food clones MyNetDiary, sleep/data viz clones Oura, doctor mode is original
- NC palette (cream/blush/sage) reserved for educational modals + onboarding + printable doctor summaries via `--v2-surface-explanatory-*`
- NEVER use em-dashes anywhere (code, copy, docs, commit messages, PR titles)

**User's stated priorities this session (in order):**
1. ✅ Cycle section deep-rebuild to NC fidelity (3 PRs shipped)
2. ✅ Oura BBT auto-import (PR #58)
3. ✅ AI chat in v2 (PR #60)
4. ✅ Light theme variant (Lanae cannot see in dark - PR #65)
5. ✅ MFN-grade calories with photos (PR #67)
6. ✅ Pain scales clinically validated (PR #68)
7. ✅ Multi-user auth foundation (PR #69)
8. ✅ Security hardening (PR #66)
9. ⏳ Cycle deeper polish + cool interactions (queued, not yet dispatched)
10. ⏳ Data correction UI + AI memory persistence (queued)
11. ⏳ Editable home + priority bubble-up (queued)
12. ⏳ Insurance navigator MVP - HMSA Quest baseline (queued, user said back-burner)
13. ⏳ Legacy → v2 unified merge (queued, user wants single look-and-feel)
14. ⏳ Cool interactions / animations / graphics (queued)
15. ⏳ AI formula explanations / "why this matters" (queued)

---

## SECTION 3 - Decisions Made

**Architecture:**
- v2 lives at `/v2/*` routes, foundation at `src/v2/{theme,components/primitives,components/shell}`, section work at `src/app/v2/<section>/_components/`
- Foundation primitives are FOUNDATION-REQUEST only EXCEPT user explicitly authorizes a foundation amendment
- Backend stays in `src/lib/*` (engine layer) and `src/app/api/*` (route handlers)
- v2 chrome (MobileShell) defaults `bottom={<StandardTabBar />}` so all v2 pages get the bottom nav unless they opt out with `bottom={null}` - fixed in PR #56

**Multi-user (PR #69 - foundation only, RLS not yet enforced):**
- Email/password signup is v1 method
- `LANAE_REQUIRE_AUTH=true` is the default
- 22 PHI tables got `user_id` column (additive migration `035_user_id_phi_tables.sql`)
- Lanae's existing data MUST be backfilled by running `LANAE_EMAIL=<her-email> node src/lib/migrations/run-035-backfill-lanae.mjs` AFTER she signs up at /v2/signup
- RLS enforcement on all 22 tables is the NEXT productization PR

**Cycle algorithm (PR #58 - NC-faithful):**
- Cover line is a personal moving baseline, NOT a clinical 97.7°F threshold
- Signal fusion uses BBT + LH + calendar only (NC's published algorithm explicitly excludes mucus/mood/sleep)
- Yellow fertility tier removed (NC is strictly binary red/green)
- Phase boundaries personalized to user's actual cycle length (no fixed 1-5 menstrual etc.)
- BBT source priority: Oura `body_temp_deviation` → NC `nc_imported.temperature` → manual `health_profile.bbt_log`

**MFN-grade calories (PR #67 + #64):**
- Open Food Facts integrated as parallel search source (USDA + OFF run via Promise.allSettled)
- Photos via OFF, cached 30-day in api_cache
- MFN scraping deliberately rejected (proprietary + legal exposure, OFF + USDA give equivalent coverage)

**Theme (PR #65):**
- `[data-theme="light"]` attribute on `.v2` root scopes light overrides
- Dark/Light/System toggle in /v2/settings → Appearance section
- `--v2-on-accent` semantic token introduced (always dark in BOTH themes) so primary CTAs don't lose contrast on light bg

**Security (PR #66):**
- `safeReturnPath()` helper extracted from PR #54 for all redirect routes
- `jsonError()` reflects errors without leaking DB schema details
- Middleware-level auth gate is the primary defense; per-route `requireAuth()` is deferred (defense-in-depth)

**Pain scales (PR #68):**
- Clinically-validated multi-dimensional logging at `/v2/log/pain`
- NRS + Wong-Baker FACES + MPQ quality + PEG functional + HIT-6 (migraine) + COMPASS-31 (orthostatic)
- Drill-down requires migration `035_pain_points_context.sql` to be run for the `context_json` column

---

## SECTION 4 - Pending Work (in priority order)

### High priority (queued from current user directive)

1. **Cycle deeper polish - cool interactions, animations, missing NC features**
   - Smart-logging Messages tab pattern (NC sends prompts to a Messages inbox, not push)
   - Cycle insights with population comparison stats ("Your luteal: 15 ±2 vs all cyclers: 12 ±2")
   - NC's 7-step in-app tutorial pattern
   - Subtle animations on ring fill, weekday strip, calendar transitions

2. **Data correction UI** - user said "place where we can correct data and it'll go into its database, solve the issue, and come back with a correct storyline that it'll remember forever"
   - View any data point Lanae sees
   - Edit + reason
   - Writes correction to underlying table + adds to `medical_narrative` for AI to remember
   - AI uses corrections in future context assembly via permanent-core

3. **Editable home + priority bubble-up** - user wants home customizable but important things auto-elevated
   - Drag-to-reorder home cards (legacy has this in module-customizer; needs v2 port)
   - Priority queue: red flags, doctor visit due, missed log streaks bubble to top
   - Persist user's layout preference per user_id (multi-user safe)

### Medium priority

4. **Cycle redirect bug** - couldn't reproduce on current production, but if user reports it again, suspect a stale browser cache or the doctor-mode service worker (`public/sw.js`)

5. **Legacy → v2 unified merge** - user wants single look/feel
   - Currently: `/` redirects to `/v2`, but specific legacy paths (`/cycle`, `/log`, etc.) still resolve to legacy
   - Plan: per-section, replace each legacy route with a redirect to `/v2/...` and archive legacy components into `src/legacy/`
   - Safe to do once v2 has full feature parity per section

6. **AI conversational depth** - `/v2/chat` shipped (PR #60) but currently JSON-only response
   - Wire SSE streaming from `/api/chat/route.ts`
   - Surface formula explanations ("This score = 0.4 × HRV + 0.3 × sleep_score + ...")
   - Show retrieved-context citations with the response

7. **Cool interactions / graphics** - user explicitly asked
   - Subtle ring fill animations
   - Hover/tap micro-interactions
   - Decorative SVG elements
   - Use Motion library if not already present

### Lower priority / back-burner

8. **Insurance navigator MVP** - user said back-burner but wants it started
   - HMSA Quest Hawaii baseline (Lanae's current insurance)
   - Page for every major US insurance
   - PCP role explainer
   - Anti-gaslighting strategies (study Bearable's approach)
   - Test/specialist referral navigation guide

9. **Full RLS enforcement** - productization blocker
   - Add RLS policies to all 22 PHI tables
   - Refactor every API route from service-role to user-scoped client
   - Per architecture audit: 28-35 working days of work

10. **Onboarding flow rebuild** - currently legacy
    - First-run wizard in v2 chrome
    - Connect Oura
    - Set conditions / medications
    - Voice tour

11. **OAuth providers** - Apple + Google sign-in
    - Currently email/password only

12. **Per-route `requireAuth()` defense-in-depth** - deferred from PR #66
    - Middleware gate is current defense; per-route is hardening

---

## SECTION 5 - Open Questions / Ambiguities

1. **Doctor visit gate**: PR #30 has been held for the entire session per user's own acceptance criterion ("must be used at a real doctor visit and survive without falling back to legacy /doctor"). When does the user want to flip the canonical `/v2/doctor` route?

2. **Data correction UI scope**: How much of the data correction is "edit a value" vs "tell the AI it was wrong, AI re-narrates"? The latter is more powerful but requires AI memory persistence design.

3. **Insurance navigator depth**: Is this a content-curation effort (one page per insurance with help articles) or an AI-driven navigator (chat + insurance-aware)? User implied the former with a "page for every insurance in the book."

4. **OFF API reliability**: Open Food Facts had intermittent 200-with-HTML responses during PR #67's build. Cache TTL for negative results was kept at 30 days for simplicity - should be 1 day to recover from transient OFF outages. Follow-up.

5. **Pain `context_json` migration**: PR #68 added `context_json` jsonb column but didn't run migration in this session. Need to run via `npm run db:migrate` once `SUPABASE_DB_URL` is set, OR via REST PATCH per the pattern used for migration 029.

---

## SECTION 6 - User Preferences (persistent across sessions)

**Communication style:**
- Wants forward momentum, not over-explanation
- Frustrated by surface polish on broken foundations - fix basics first
- Wants honest acknowledgment when something's wrong, not defensive justification
- Appreciates brief synthesis at end of each substantial change
- Asks for "head honcho mode" - autonomous execution within authorized scope

**Standing authorizations (granted 2026-04-17 per CLAUDE.md):**
- Push to remote without asking (treat as part of normal commit flow)
- Deploy to Vercel without asking (run `vercel --prod` or let auto-deploy fire)
- Set upstream branches automatically (`git push -u`) on new branches
- Force-push and destructive git ops STILL require explicit confirmation
- Wife's medical data - ZERO data loss is non-negotiable

**Voice rules (everywhere):**
- NC explanatory voice (gentle, never preachy)
- "Honest with context" on uncertainty (G3 rule from PR #24): always state confidence/range when genuinely uncertain
- Never "false precision" on medical predictions
- No em-dashes ANYWHERE (code, copy, docs, commit messages, PR titles)

**Workflow patterns user likes:**
- Parallel sub-agents for independent tasks
- Browser automation (Playwright MCP) for visual verification, NOT just code reads
- Side-by-side reference frame comparison for any visual claim
- Run real Vercel auto-deploys, test on phone, iterate
- The `<<autonomous-loop-dynamic>>` sentinel = continue the loop autonomously
- Building handoff docs preemptively when context is running thin (this very document)

---

## SECTION 7 - Architecture / Convention Notes

### Three-Layer Context Engine (the moat)

Every Claude API call goes through `src/lib/context/assembler.ts`:
- **Layer 1 - Permanent Core** (`permanent-core.ts`): patient identity, diagnoses, medications, active problems, key events. ~800 tokens. ALWAYS injected.
- **Layer 2 - Smart Summaries** (`summary-engine.ts`): 32 fine-grained micro-summaries. Selectively injected based on query topic. Max 6 per query. 7-day cache TTL.
- **Layer 3 - Deep Retrieval** (`vector-store.ts`): pgvector semantic search + full-text fallback over per-day chunks in `health_embeddings`.

### Static / Dynamic Boundary Pattern (mandatory)

Every Claude prompt MUST follow:
```
[STATIC - cached, essentially free after first call]
  System identity, rules, self-distrust principle, tool definitions
__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__
[DYNAMIC - generated fresh from DB every call]
  Patient permanent core, relevant summaries, session handoff, retrieval results
```

### Section conventions (PR #24 codified)

- Section-local components live at `src/app/v2/<section>/_components/` (Next.js excludes `_`-prefixed dirs from routing)
- Foundation primitives at `src/v2/components/primitives/` are FOUNDATION-REQUEST only
- Foundation shell at `src/v2/components/shell/` same rule
- Theme tokens at `src/v2/theme/tokens.css` same rule
- Cross-section imports forbidden (a calorie component cannot import a cycle component)

### MobileShell defaults (PR #56)

- `MobileShell` now defaults `bottom` to `<StandardTabBar />` if no prop passed
- Pages opt out with `bottom={null}` (only doctor mode currently)
- All 5 tabs: Home `/v2` | Cycle `/v2/cycle` | (center FAB) | Food `/v2/calories` | More `/v2/settings` (catches topics, labs, imaging, records, patterns, sleep, timeline, doctor, import via regex)

### Best-of-three design philosophy

| Layer | Source | Applies to |
|-------|--------|------------|
| Visual chrome | Oura (dark default + light variant from #65) | Shell, palette, ring metaphors, white space |
| Voice / pedagogy | Natural Cycles | All copy: labels, subtext, error states |
| Per-section UX | Section-specific | Cycle = NC, Food = MFN, Sleep = Oura, Doctor = original |

When the three conflict on a specific surface, the per-section pattern wins for that surface, but visual chrome and copy voice stay consistent app-wide.

---

## SECTION 8 - Critical Files

### Engine (NEVER MODIFY without explicit user authorization)

- `src/lib/context/assembler.ts` - Three-Layer Context Engine entry point
- `src/lib/context/{permanent-core,summary-engine,vector-store,sync-pipeline,compaction,handoff}.ts`
- `src/lib/api/*` - typed data access helpers for every domain
- `src/lib/cycle/*` - cycle engine + new bbt-source/cover-line/signal-fusion (PR #58)
- `src/lib/calories/*` - calorie engine
- `src/lib/doctor/*` - doctor briefing pipeline
- `src/lib/ai/*` - Claude API integrations, intelligence engines
- `src/lib/auth/*` - auth helpers (PR #69)
- `src/app/api/**/*.ts` - all API route handlers
- `src/lib/supabase.ts`, `src/lib/types.ts`, `src/lib/migrations/`

### v2 Foundation (FOUNDATION-REQUEST only)

- `src/v2/theme/tokens.css` - design tokens (now includes light variant)
- `src/v2/components/primitives/*` - Button, Card, ListRow, MetricRing, MetricTile, Sheet, Stepper, EmptyState, Skeleton, Banner, Toggle, SegmentedControl, ProgressBar, TabStrip
- `src/v2/components/shell/*` - MobileShell, TopAppBar, BottomTabBar, StandardTabBar, FAB, ThemeToggle
- `src/app/v2/layout.tsx` - root v2 layout

### Per-section (free to modify)

- `src/app/v2/{cycle,calories,sleep,today,log,doctor,records,labs,imaging,topics,patterns,settings,chat,import,login,signup,forgot-password}/`
- Each has `page.tsx` and `_components/` directory

### Reference assets (gitignored, local only)

- `docs/reference/{oura,natural-cycles,mynetdiary}/frames/full-tour/` - 998 PNG frames extracted from screen recordings (255 + 319 + 424)
- `docs/reference/<app>/recordings/full-tour.mp4` - original screen recordings
- `scripts/extract-reference-frames.sh` - ffmpeg extraction script

### Persistent research outputs (in /tmp/, NOT in repo)

- `/tmp/nc-pattern-recognition-audit.md` - 75 NC features across 8 sections
- `/tmp/nc-methodology-research.md` - algorithm details, 21 cited sources
- `/tmp/v2-cycle-current-state.md` - code map, gap inventory
- `/tmp/oura-integrations-research.md` - 14 apps, 22 unused fields
- `/tmp/oura-codebase-audit.md` - gap analysis with severity
- `/tmp/oura-condition-mapping.md` - POTS/migraine specific signals
- `/tmp/food-database-research.md` - OFF + MFN scraping rejection rationale
- `/tmp/pain-scales-research.md` - clinical scale validation notes
- `/tmp/v2-security-audit.md` - security findings by severity
- (These could be moved into the repo at `docs/research/` for next-session continuity)

---

## SECTION 9 - Next Concrete Actions (for fresh session pickup)

### Immediate (user told us to keep going)

1. **Move research outputs from /tmp/ to repo** at `docs/research/<topic>.md` so they survive across sessions. The fresh session will need them.

2. **Dispatch the queued workstreams that didn't fire in this turn** (limited by the 5-parallel-agent batch):
   - Cycle deeper polish + animations
   - Data correction UI
   - Editable home + priority bubble-up
   - Cool interactions/graphics
   - Insurance navigator MVP (back-burner per user)
   - AI streaming + formula explanations
   - Legacy → v2 unified merge (per-section)

3. **Run pending migrations on production Supabase** (REST PATCH approach since `SUPABASE_DB_URL` not in env):
   - `035_user_id_phi_tables.sql` - adds user_id column to 22 PHI tables (idempotent)
   - `035_backfill_lanae_user_id.sql` - links Lanae's data after she signs up at /v2/signup
   - `035_pain_points_context.sql` - adds context_json jsonb to pain_points
   - The runners exist as `.mjs` files in `src/lib/migrations/`

4. **Verify the multi-user auth flow works end-to-end** - agent reported it wasn't tested against live Supabase Auth. Lanae needs to sign up, then run the backfill, then verify she still sees her data.

### Medium-term (the productization roadmap)

Per the architecture audit (28-35 days):
- Full RLS enforcement on all 22 PHI tables
- BAA with Supabase (HIPAA paperwork)
- OAuth providers (Apple + Google)
- Audit logging for PHI routes
- Encryption at rest verification
- Data deletion workflows (account deletion already in PR #69 but not tested)
- SOC 2 if going enterprise

### Long-term (post-launch)

- Onboarding flow v2 rebuild
- Custom design language evolution (depart from direct trade-dress cloning of NC/Oura/MFN)
- Insurance navigator full content build-out
- Multi-tenant data architecture
- Cost optimization (Claude API + pgvector at scale)

---

## How to use this document in a fresh session

1. Open Claude Code in the source worktree: `/Users/clancybond/lanaehealth/.claude/worktrees/sweet-rosalind-cea925/`
2. First message to fresh session: "Read `docs/sessions/handoff-2026-04-24-v2-mobile-rebuild.md` and pick up where the previous session left off. Sections 4 and 9 have the priority queue."
3. Fresh session should:
   - Read this doc fully
   - Read CLAUDE.md
   - `git fetch && git checkout main && git pull --ff-only` to get the latest state
   - Check `gh pr list --state open` for any PRs that landed since this doc was written
   - Pick one workstream from Section 9 and dispatch
   - Update this doc as work progresses (or supersede with a new dated handoff)

The user is patient with autonomous work but frustrated by lost context. This handoff exists specifically to prevent re-doing already-done work.
