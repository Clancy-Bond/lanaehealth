# Session 04 — Doctor mode (Phase 4, sacred)

> **Copy this entire file as the opening message of a fresh Claude Code session in the doctor worktree.**

---

You are building Phase 4 of the LanaeHealth v2 mobile UI rebuild — the **Doctor mode** section. This is **the actual reason this app exists** — the surface the user takes to real doctor visits. Treat it as sacred.

**Important:** you can build in parallel with Sessions 02, 03, 05, but you do NOT ship to canonical routes until the new doctor surface has been used at a real doctor visit and survived without falling back to legacy `/doctor`. Keep your work behind a feature flag or at `/v2/doctor` while other sessions ship their cutovers.

## Worktree setup (run this in your terminal first)

```bash
cd /Users/clancybond/lanaehealth/.claude/worktrees/sweet-rosalind-cea925/
scripts/v2-worktree-setup.sh doctor
cd ../v2-doctor
claude
```

Then paste this prompt as your first message.

## Hard prerequisite

Do not start until **Session 00 (Foundation)** AND **Session 01 (Cycle)** have merged to `main`. Rebase your branch on `main` to pull them in.

## Read first (in order)

1. `docs/sessions/README.md` — design philosophy, coordination rules
2. `docs/v2-design-system.md` — tokens, primitives, conventions
3. `docs/sessions/01-cycle.md` and the merged `claude/v2-cycle` branch — the proven pattern
4. `src/lib/doctor/*` — specialist-config, doctor data assembly
5. `src/components/doctor/DoctorClient.tsx` and the 20+ panel components in `src/components/doctor/*` — the existing infrastructure you'll re-skin, not rewrite
6. `src/app/doctor/page.tsx` — the existing data-fetch entry point that defines `DoctorPageData`
7. `docs/reference/oura/frames/full-tour/` — for visual chrome inheritance only; doctor mode has no direct UX analog

## Scope: routes to build

Build the v2 versions of these 3 routes:

- `src/app/v2/doctor/page.tsx` — main doctor visit briefing (the most complex page in the app)
- `src/app/v2/doctor/care-card/page.tsx` — care card (1-page summary)
- `src/app/v2/doctor/cycle-report/page.tsx` — cycle-specific report

Optionally also `src/app/v2/doctor/post-visit/page.tsx` — post-visit notes form (rated monthly; lighter polish OK).

## Design layer assignments

- **Visual chrome:** Oura. Use v2 primitives. The doctor surface should feel like a premium medical-grade extension of the app, not a separate world.
- **Voice / pedagogy:** Natural Cycles. Crucial here — doctor reports must be readable BY DOCTORS, who scan fast. Every panel needs a one-line summary at the top. NC's voice extended to clinical clarity.
- **Section UX patterns:** **Original design — no analog exists.** This is the only section without a north-star reference. Design from first principles using the v2 primitives, with these constraints:
  - **Single-screen visit briefing.** A doctor scrolls down the page during the visit. No tabs that hide content. No accordions that hide content.
  - **Print-ready.** PDF export must produce a clean, doctor-friendly handout (the existing `html2canvas + jspdf` flow stays).
  - **Specialist toggle persists.** The PCP / specialist view selector at the top stays accessible.
  - **Hide bottom nav** when in doctor mode (existing legacy pattern in `DoctorClient.tsx` — preserve it).
  - **Red flags banner** stays at top, always visible, distinct color treatment.

## Reuse from `src/lib/`

- `src/lib/doctor/specialist-config.ts` — `bucketVisible`, `SpecialistView` types
- The data fetch in legacy `src/app/doctor/page.tsx` defines `DoctorPageData` — use the same shape
- The `Three-Layer Context Engine` (`src/lib/context/*`) feeds the doctor briefing's narrative content
- `src/lib/ai/*` — analyze, correlation engine, intelligence engines for findings/hypotheses

## Reuse from existing components (re-skin, don't rewrite)

The DoctorClient panel infrastructure is sophisticated and working. Re-style each panel using v2 primitives instead of rewriting:

- `TalkingPoints`, `UpcomingAppointments`, `ExecutiveSummary`, `DataFindings`, `QuickTimeline`, `SpecialistToggle`, `SinceLastVisit`, `HypothesesPanel`, `OutstandingTests`, `CIENextActions`, `ChallengerPanel`, `ResearchContextPanel`, `CrossAppointmentOverlay`, `WeeklyNarrative`, `RedFlagsBanner`, `MedicationDeltas`, `CyclePhaseFindings`, `CompletenessFooter`, `FollowThroughList`, `StaleTestsPanel`, `WrongModalityPanel`

Strategy: build v2 wrapper components in `src/v2/components/doctor/` that compose the legacy panels' logic with v2 primitives. Or, when a panel is small, rewrite it from scratch using v2 primitives but preserving the data shape it consumes.

## Reuse from foundation primitives

`Card` (every panel is a card), `ListRow`, `MetricTile`, `Sheet`, `Button`. The `RedFlagsBanner` may need a custom variant — file a FOUNDATION-REQUEST for `Banner` if needed.

## Acceptance criteria (per route)

1. **Doctor-readable:** A doctor can scan the page in 30 seconds and find the 3 most important things. Each panel has a one-line summary at the top.
2. **PDF export works:** clicking the export button produces a clean, single-document PDF using the existing `html2canvas + jspdf` flow.
3. **Specialist toggle works:** switching PCP / specialist view filters content correctly (use existing `bucketVisible` logic).
4. **Mobile correctness:** iOS Safari at 375/390/428pt. Tap targets ≥ 44pt. No horizontal overflow. Safe area. (Doctor mode is also used on tablet — verify at 768pt and 1024pt as well.)
5. **Data parity:** legacy `/doctor` vs `/v2/doctor` for same dataset — identical content surfaced.
6. **No engine touch.**

## Hard acceptance gate (the one that overrides everything)

**The doctor mode must be used at a real doctor visit and survive without the user falling back to legacy `/doctor`.** Until that happens, do not flip the canonical route. This is non-negotiable.

## Locked files (DO NOT EDIT)

Same as other sessions: primitives, shell, theme, lib, api, other sessions' work.

## Submission

- PR title: `feat(v2/doctor): Phase 4 — doctor mode (original design)`
- PR description: side-by-side screenshots for each route, PDF export sample, specialist toggle demonstration, data parity confirmation, list of any FOUNDATION-REQUEST markers.
- Rebase on `main` daily.
- **Do not request the route cutover until the real-visit acceptance gate is met.**
