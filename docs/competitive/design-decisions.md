# Competitive Research & Implementation: Design Decisions

**Status: APPROVED 2026-04-16. Lanae delegated app-level decisions. Execution in progress.**

This is the single source of truth every research and implementation subagent must read and follow. It prevents drift across parallel work. If a subagent finds a conflict between this doc and anything else, this doc wins.

---

## 1. Mission

Study 10 leading health trackers by OBSERVATION (not code copying). Extract winning UX patterns. Implement the top 3 features per app into LanaeHealth as our own code, matched to our design system and Lanae's real data.

**In scope:** Reviews, app-store research, community forums, published case studies, observed UX patterns, algorithms described publicly.

**Out of scope:** Copying source code, assets, logos, or copy text. Reverse-engineering by decompilation.

---

## 2. Folder Structure

Each app gets a folder under `docs/competitive/<slug>/`:

```
docs/competitive/
├── design-decisions.md      (this doc)
├── matrix.md                (master feature x app x status table)
├── bearable/
│   ├── user-reviews.md
│   ├── patterns.md
│   ├── plan.md
│   └── implementation-notes.md
├── myfitnesspal/            (split from Cronometer, different strengths)
├── cronometer/              (split from MFP, micronutrient precision)
├── flo/
├── oura/
├── finch/                   (split from Daylio, gamification-heavy)
├── daylio/                  (split from Finch, minimalist)
├── careclinic/              (split from Flaredown, comprehensive doctor reports)
├── flaredown/               (split from CareClinic, trigger correlation)
├── headache-diary/          (category folder: Migraine Buddy + N=1 + Migraine Monitor)
├── guava-health/
├── apple-health/
└── clue/
```

Total: 13 app folders. Splits chosen where apps have distinct UX models worth studying separately.

Existing category docs (`symptom-tracking.md` etc.) stay as historical references. Do not delete. New work is app-centric.

**Slug rule:** lowercase, hyphen-separated, no spaces. Use the slugs exactly as listed above.

---

## 3. Required Document Formats

### `user-reviews.md`

- 30+ quoted reviews minimum per app
- Sort into three buckets: **Loves**, **Hates**, **Wishes**
- Each quote must include source (App Store, Play Store, Reddit thread, forum)
- No paraphrasing. Verbatim quotes only.
- Include a "Lanae relevance" one-liner under each quote if the pattern is relevant to chronic illness, POTS, endo, or female health

### `patterns.md`

- One pattern per section, H2 heading
- Each pattern includes: **What it is** / **Why it works** / **Trade-offs** / **Adaptability to LanaeHealth**
- Rank patterns by "Lanae impact" (1-5 stars)
- Ignore patterns that conflict with our rules (e.g., streak guilt systems)

### `plan.md`

Ranked table of features to add to LanaeHealth, columns:

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Notes |

- Top 3 go to implementation
- Rank by `(impact / effort)` with impact weighted 2x

### `implementation-notes.md`

For each top-3 feature:

- **File targets:** exact paths in our codebase to create or modify
- **Data model:** tables, columns, migration number, whether read-only or additive
- **Component plan:** new components + reused existing ones
- **Acceptance criteria:** what "done" looks like
- **Verification plan:** how to test against Lanae's real Supabase data
- **Risks:** what could break

---

## 4. Codebase Pointers

Subagents must reference these when proposing implementations. Do not reinvent.

### Stack
- Next.js 16 + React 19 + TypeScript + Tailwind 4
- Supabase (Postgres + pgvector)
- Anthropic SDK 0.88
- Recharts 3.8 (SSR: use explicit useRef width, NOT ResponsiveContainer)
- vitest for tests

### Architecture layers
- Pages: `src/app/<route>/page.tsx`
- API routes: `src/app/api/<endpoint>/route.ts`
- Server-side data access: `src/lib/api/<domain>.ts` (18 existing: appointments, bowel, cycle, food, gratitude, labs, logs, medication-adherence, mood, nc-cycle, sleep-details, sleep-metrics, symptoms, vitals-classification, etc.)
- Components: `src/components/<domain>/`
- Intelligence engines: `src/lib/intelligence/`
- Context engine: `src/lib/context/` (DO NOT modify without explicit plan, this is core infra)
- Migrations: `src/lib/migrations/`

### Log page is the nerve center
`src/app/log/` + `src/components/log/` (60 components). Daily entry UI. Most features will surface here.

### Pages that exist
Home, Log, Patterns, Records, Doctor, Chat, Profile, Settings, Timeline, Imaging, Intelligence, Onboarding, myAH Import.

---

## 5. Design System (locked)

### Colors (use CSS vars, never hex)
- Background: `var(--bg-primary)` (#FAFAF7 cream)
- Cards: `var(--bg-card)` (#FFFFFF)
- Elevated surfaces: `var(--bg-elevated)` (#F5F5F0)
- Primary accent: `var(--accent-sage)` (#6B9080)
- Secondary accent: `var(--accent-blush)` (#D4A0A0)
- Text primary: `var(--text-primary)` (#1A1A2E)
- Text secondary: `var(--text-secondary)` (#6B7280)
- Severity scale: `--pain-none` through `--pain-extreme` (always use these, never raw red/orange/yellow)
- Cycle phases: `--phase-menstrual`, `--phase-follicular`, `--phase-ovulatory`, `--phase-luteal`

### Typography
- Use `--text-xs` through `--text-3xl` tokens. No raw px values.

### Shape
- `--radius-sm` (8px), `--radius-md` (12px), `--radius-lg` (16px), `--radius-full`
- Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-glow`
- No sharp corners anywhere except data tables

### Voice
- Warm, friendly, clinically precise
- NO em dashes. Use commas, periods, or "and/or" instead
- Second person when addressing Lanae directly ("your morning pulse")
- Plain language with optional clinical detail on tap

### Interaction
- Touch targets 44px minimum (WCAG)
- Skeleton loading states, never spinners for data loads > 200ms
- Optimistic UI on log actions; errors surface non-blocking

---

## 6. Data Rules (HARD RULES, NO EXCEPTIONS)

1. **Existing tables are read-only.** `daily_logs`, `oura_daily`, `nc_imported`, `food_entries`, `lab_results`, `appointments`, `pain_points`, `symptoms`, `cycle_entries`, `documents`, `chat_messages` cannot have their schema changed or existing rows modified. New columns added via migration ONLY with explicit user approval.

2. **New tables use additive migrations.** Migration number = highest existing + 1. Must include `up` only (no destructive `down`). Name pattern: `0XX-feature-name.sql`.

3. **Every feature must work with Lanae's REAL data.** No placeholder or seed data in production paths. If a feature needs data Lanae doesn't have, it must gracefully empty-state, not fake it.

4. **Supabase writes go through `src/lib/api/<domain>.ts`.** Never direct client calls from components.

5. **Every DB write must be reversible.** Log operations to `analysis_runs` if they transform data, so we can audit.

6. **pgvector embeddings.** If a feature generates narrative text worth searching later, it must chunk per-day and write to `health_embeddings` with proper metadata (date, content_type, cycle_phase, pain_level).

---

## 7. Claude API Rules

When a feature calls Anthropic API:

- Always route through `src/lib/context/assembler.ts`. No direct Anthropic calls from features.
- Model: `claude-sonnet-4-6` unless explicitly reasoning-heavy (then `claude-opus-4-7`).
- Static/Dynamic boundary: cached system prompt FIRST, dynamic context LAST, with the literal `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` marker.
- Prompt caching ON by default.
- Never send full chat history. Use the 9-section compaction (`src/lib/context/compaction.ts`).

---

## 8. Feature Ranking Rubric (for plan.md)

**Lanae Impact (1-5):**
- 5: Directly addresses POTS, endo, chronic fatigue, cycle-hormone correlation, or doctor-visit prep
- 4: Improves daily logging friction for someone with limited energy
- 3: General UX polish that makes tracking habitual
- 2: Nice-to-have feature without clear Lanae benefit
- 1: Skip (listed only to document we considered it)

**Effort (S/M/L/XL):**
- S: < 4 hours, single file change, no new migration
- M: 4-12 hours, new component, possibly new migration
- L: 1-3 days, new subsystem, multiple migrations
- XL: > 3 days, requires design iteration (probably means split it)

**Ranking formula:** sort by `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Top 3 by this formula become the implementation targets.

---

## 9. Matrix Schema

`docs/competitive/matrix.md` is a flat table, one row per (feature, app) pair.

Columns:
- **Feature** (canonical name for the pattern)
- **Origin app** (where we observed it)
- **Exists in our app?** (Y / Partial / N)
- **Planned?** (Y / N / Declined)
- **Status** (Researched / Planned / In-progress / Shipped / Declined)
- **Impact** (1-5)
- **Effort** (S/M/L/XL)
- **Owner subagent ID** (after dispatch)
- **Code location** (when shipped)
- **Notes**

Main session owns the matrix. Subagents propose rows; main session merges.

---

## 10. Implementation Subagent Brief Template

Every implementation subagent receives this shape as its prompt:

```
MISSION: Implement <feature name> in LanaeHealth.

READ FIRST:
- /Users/clancybond/lanaehealth/docs/competitive/design-decisions.md
- /Users/clancybond/lanaehealth/docs/competitive/<app>/implementation-notes.md
- /Users/clancybond/lanaehealth/CLAUDE.md

FEATURE BRIEF:
  <detailed description>
  <source pattern reference>
  <acceptance criteria>

FILE TARGETS:
  <exact paths from implementation-notes.md>

DATA MODEL:
  <tables, migration number, read/write>

VERIFY:
  1. `npm run build` passes
  2. `npm test` passes (add new tests for new logic)
  3. Run migration via scripts/run-migration.mjs
  4. Manually verify against Lanae's real Supabase rows
  5. Screenshot the UI at /log (or relevant page) on port 3005

OUTPUT:
  - Git commit(s) on branch `feat/<app>-<feature-slug>`
  - Summary: files changed, migrations added, test counts, screenshots path
  - Any blockers or decisions deferred to main session
```

---

## 11. Subagent Isolation Rules

- Each implementation subagent runs in a `worktree` isolation (separate git worktree).
- Multiple implementation subagents may NOT touch the same file simultaneously. Main session serializes overlapping files.
- Research subagents may run fully parallel (disk writes only, different folders).
- NO subagent may modify `design-decisions.md`, `matrix.md`, `CLAUDE.md`, or `AGENTS.md`. Only main session edits these.
- NO subagent may run destructive operations on Lanae's Supabase database (no DELETE, no UPDATE without WHERE, no DROP).

---

## 12. Red Flags That Pause the Pipeline

If a subagent encounters ANY of these, it stops and reports to main session rather than proceeding:

- A feature requires modifying existing Supabase rows
- A feature requires data Lanae does not have
- A migration conflicts with an existing one
- Acceptance criteria cannot be verified against real data
- A pattern from another app depends on a data source LanaeHealth cannot access (e.g., another wearable)
- Clinical scales proposed differ from those already in `src/lib/clinical-scales.ts`

---

## 13. Done Definition

A feature is "shipped" when:

1. Code merged to main branch
2. `npm run build` passes
3. Tests added and passing
4. Migration (if any) applied to Supabase
5. UI verified against Lanae's real data at the relevant page on port 3005
6. Screenshot attached in implementation-notes.md
7. matrix.md updated to Status: Shipped with code location

Anything short of all 7 is "in-progress."

---

## 14. Resolved Decisions (Lanae delegated, 2026-04-16)

1. **Finch and Daylio: SEPARATE folders.** Finch = gamification + pet mechanics + mental health scaffolding. Daylio = minimalist mood-habit grid. Different models, different signal. Split.
2. **CareClinic and Flaredown: SEPARATE folders.** CareClinic = comprehensive doctor reports. Flaredown = trigger-symptom correlation. Different focus. Split.
3. **MyFitnessPal and Cronometer: SEPARATE folders.** MFP = barcode DB + social. Cronometer = micronutrient precision (matters for endo, iron, vitamin D tracking). Split.
4. **Headache Diary: ONE folder** comparatively covering Migraine Buddy + N=1 Headache Tracker + Migraine Monitor. Narrow domain, comparative analysis is higher signal than splitting.
5. **Commits: feature branches.** Each implementation subagent commits on `feat/<app>-<feature-slug>`. Main session reviews the branch diff, then merges. No direct-to-main for implementation work. Research subagents commit their docs directly (docs-only changes are low risk).
6. **New Supabase table cap: 10** for this push. If total estimate exceeds 10 after all 13 plan.md files are written, pause and prioritize.
7. **No apps skipped.** Apple Health and Clue will have fewer expected implementation features (aggregator + marketing positioning respectively), but researched in full.
