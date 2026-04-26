# Bearable Patterns Research

User direction (verbatim): "you can find a lot of stuff like this on
bearable on their website. You can study that."

This file consolidates the Bearable research that informs the
Bearable-pattern feature ship in this PR. It does not re-do the
deep teardown that already lives at `docs/research/bearable/teardown.md`
and `docs/competitive/bearable/patterns.md`. It points there and
adds the precise pattern-to-implementation mapping for the five
features shipped in this PR.

## Sources

The Bearable site, help docs, and App Store listing were scraped
into `.firecrawl/` and reviewed for this PR. Key sources:

1. https://bearable.app - landing page, hero / features / proof copy.
   Local: `.firecrawl/bearable-home.md`
2. https://bearable.app/symptom-tracker-app - symptom tracker page,
   the four-quadrant log pattern. Local: `.firecrawl/bearable-symptom-tracker.md`
3. https://bearable.app/migraine-tracker-app - migraine tracker page,
   prodrome/aura/attack/postdrome four-stage chip set.
   Local: `.firecrawl/bearable-migraine.md`
4. https://bearable.app/health-tracker-app - health tracker landing,
   factor explorer copy. Local: `.firecrawl/bearable-health-tracker.md`
5. https://bearable.app/chronic-pain-tracker-app - chronic-pain
   tracker page, "what's affecting your pain" framing.
   Local: `.firecrawl/bearable-chronic.md`
6. https://bearable.app/depression-tracker-app - mood-energy log,
   2x2 daily check-in. Local: `.firecrawl/bearable-depression.md`
7. https://bearable.app/mental-health-app - care-team sharing,
   read-only doctor link copy. Local: `.firecrawl/bearable-gaslighting-app.md`
8. https://bearable.app/blog - blog index, doctor-handout / printable
   workbook articles. Local: `.firecrawl/bearable-blog.md`
9. App Store listing (Apple App Store) - review patterns + feature
   list. Reviewed in the existing teardown file at section "Review
   patterns / what users like".
10. Existing local prior work: `docs/research/bearable/teardown.md`
    (251 lines), `docs/competitive/bearable/patterns.md` (318 lines),
    `docs/competitive/bearable/implementation-notes.md`,
    `docs/competitive/bearable/user-reviews.md`,
    `docs/competitive/bearable/plan.md`.

## Patterns adapted in this PR

Each pattern is cited inline in the source code where it is used.
This list is the high-level map for the PR reviewer.

### 1. Migraine four-stage chips (ICHD-3, surfaced like Bearable)

- Source: bearable.app/migraine-tracker-app - "track Prodrome / Aura
  / Attack / Postdrome symptoms".
- Implementation: `src/app/v2/log/pain/_components/MigraineStageChips.tsx`
  + `src/app/v2/log/pain/_components/migraine-stages.ts` (pure, unit-
  testable).
- Where it shows: the existing pain-log page, conditionally shown
  when the user has migraine on file and the head region is selected.
- Storage: appended into the existing free-text `trigger_guess` field
  (no new DB column or migration). Helper: `buildTriggerGuess`.
- Why it matters: most migraine patients do not know the four phases
  by name, but doctors do. Logging "I was in postdrome four days
  running after each cycle" is a signal a doctor will act on.

### 2. Outcome-first factor explorer ("Factors")

- Source: bearable.app - factor explorer / "discover what is
  affecting how you feel". Bearable picks one outcome (Pain, Sleep,
  Mood, Energy) and ranks the factors that move it.
- Implementation:
  - `src/lib/v2/triggers.ts` (pure shape + rank, unit tested at
    `src/lib/v2/__tests__/triggers.test.ts`).
  - `src/app/v2/patterns/factors/page.tsx` - server-rendered.
  - `src/app/v2/patterns/factors/_components/FactorExplorer.tsx` -
    client component with the chip set.
- Data source: existing `correlation_results` table. No new compute.
- Voice rules: confidence chip on every row, "based on N days" sample
  size always shown, "appears to track" / "tends to" never "causes".
- Hub tile: the patterns hub (`/v2/patterns`) now includes a Factors
  tile alongside Cycle / Food / Sleep / Labs.

### 3. One-page printable doctor handoff

- Source: bearable.app/blog and the broader Bearable workbook
  pattern - even doctors who do not open patient apps will glance
  at a single sheet. "Print, fold, hand it over."
- Implementation:
  - `src/app/v2/doctor/one-page/page.tsx` - server-rendered, reads
    from `health_profile`, `daily_logs`, `pain_points`.
  - `src/app/v2/doctor/one-page/_components/OnePagePrintHelper.tsx`
    - screen-only chrome (Print button + print-only CSS that hides
    the app shell).
  - `src/lib/v2/one-page-stats.ts` (pure stat helpers, unit tested
    at `src/lib/v2/__tests__/one-page-stats.test.ts`).
- Surfaced from `/v2/doctor` via a new "Print or hand off" card.

### 4. Bearable cite on the patterns hub

- The patterns hub (`/v2/patterns`) gains a Factors tile that links
  to the new explorer. The explorer page itself carries an explicit
  `Bearable` link as required attribution. We do not copy code or
  visual treatments - only the framing.

### 5. Pain log enhanced with migraine staging

- Source: same as #1. The chips are wired into the existing
  PainLogClient so the staging signal lands in the existing
  `pain_points.context_json` blob via `trigger_guess` without a
  schema change.

## What we did not adopt (and why)

- Streak counters / guilt UI. Documented in the existing teardown:
  Bearable explicitly avoids streaks because chronic illness has
  variable days. Lanae's POTS + endo profile makes this rule even
  more important. We hold the line.
- Public symptom-sharing community. Out of scope for a single-
  patient app and conflicts with PHI rules.
- A blank-slate custom tracker creator. Lanae's tracker set is
  curated by clinical priors (PEG, HIT-6, COMPASS-31, BBT, EnergyMode);
  letting the user create arbitrary trackers would dilute the
  curated set. Already documented in the patterns teardown.

## Fair use note

Bearable is a competitor product. We adapted UX patterns and
framings; we did not copy code, visual treatments, or trademarked
assets. Each adapted surface carries an inline source cite. The
research files in this repo are short summaries and excerpts for
internal product reasoning; they are not public-facing.
