# Cycle: substantive gaps vs Natural Cycles

Date: 2026-04-29
Author: Claude (cycle-section session, branch claude/jolly-mcnulty-b1a305)

## What this document is

This is the gap analysis the chrome audit (`docs/current-state/audits/cycle.md`)
deliberately did not do. It compares NC's published methodology and observed
UX, as captured in:

- `docs/research/nc-methodology-research.md` (262 lines, every algorithmic claim sourced)
- `docs/research/nc-pattern-recognition-audit.md` (468 lines, 75 distinct NC features catalogued)
- `docs/research/cycle-population-references.md` (66 lines, population baselines we cite)

against what LanaeHealth's cycle section actually ships today, file by file.
The goal is to answer "where does our cycle product fall short of NC's
*helpful* design, *helpful* data, and *helpful* algorithm" so a follow-up
session can start nailing those gaps instead of polishing chrome.

This document is NOT:

- A redesign. NC is one of three references; the v2 design system also
  draws on Oura (chrome) and MyNetDiary (food). Cycle is supposed to take
  *patterns* from NC, not clone the app.
- A critique of the algorithm work. The lib/cycle/* modules are extensive
  and faithful to NC's methodology, with sourced comments. The gap is on
  the presentation and information-architecture side.
- A list of color or typography fixes. The chrome question is open
  (filed as F1 in the chrome audit) but it is not the substantive gap.

## How I read the existing implementation

Top to bottom, file by file:

- `src/app/v2/cycle/page.tsx` (landing)
- `src/app/v2/cycle/insights/page.tsx`
- `src/app/v2/cycle/history/page.tsx`
- `src/app/v2/cycle/log/page.tsx`
- `src/app/v2/cycle/messages/page.tsx`
- `src/app/v2/cycle/predict/page.tsx`
- `src/app/v2/cycle/_components/*` (CycleRingHero, BbtTile, BbtChartPanel,
  BbtChart, PeriodCountdownCard, FertilityAwarenessCard, WeekdayStrip,
  PeriodLogFormV2, etc.)
- `src/app/v2/cycle/insights/_components/*` (CycleInsightsChart,
  MultiCycleCompare, StatisticsRollup, SymptomRadarCard, InsightRow)
- `src/lib/cycle/*` (load-cycle-context, cover-line, signal-fusion,
  period-prediction, fertile-window, cycle-stats, messages, hormones,
  symptom-radar, cycle-insights, phase-insights, phase-symptoms)

## Where LanaeHealth is already strong

Calling out the credit before the criticism. The cycle section has done
real, technically rigorous NC work that should not be re-litigated by the
next session:

- **Cover line as a personal moving baseline** (`cover-line.ts`): NC's
  exact pattern. Outlier rejection at 3 SD, kind-aware (absolute vs
  deviation), confidence ladder keyed to sample size. Comment header
  cites NC's docs verbatim.
- **Signal fusion hierarchy** (`signal-fusion.ts`): NC import wins; then
  BBT + LH; then BBT alone; then LH alone (low confidence); then
  calendar fallback. Faithful to "temperature wins conflicts," with the
  PCOS-aware caveats noted.
- **Period prediction returns ranges, not points** (`period-prediction.ts`):
  Mean +/- max(SD, 2), with a "limited history" caveat at <2 cycles.
  Voice anchor on `/v2/cycle/predict`: "Ranges, not points. When the
  range is wide, our data is thin." That copy is excellent and NC-grade.
- **Fertile window classifier is binary** (`fertile-window.ts`): Green
  or red, never yellow. Conservative-default-red on uncertainty. NC
  imported verdict beats local recomputation. CD 1-5 menstruation rule
  documented explicitly with the bug it fixes.
- **Anovulatory cycle detection** (`detectAnovulatoryCycle` in
  `signal-fusion.ts`) and surfacing on `/v2/cycle/history` (anovulatory
  flag passed to `CycleHistoryRow`). Matches NC's "only retrospectively
  determinable" rule.
- **Statistics rollup with population comparisons**
  (`StatisticsRollup.tsx`): five rows (cycle length, follicular, luteal,
  BBT shift, period length), each with user mean +/- SD, population
  mean +/- SD, source citation, flag when out of band. Cites Bull 2019
  / Lenton 1984 / Bauman 1981 inline.
- **Multi-cycle comparison view** (`MultiCycleCompare.tsx`): NC
  side-by-side comparison pattern, last 6 cycles with cycle length,
  period length, ovulation day, anomaly chips.
- **Symptom radar** (`symptom-radar.ts`, `SymptomRadarCard.tsx`): NC's
  pattern-recognition output. "We have noticed across your last few
  cycles..." voice. Confidence threshold (3 instances, 60% per phase)
  is reasonable.
- **Smart-logging messages** (`messages.ts`, `messages-store.ts`): four
  NC-aligned prompt types implemented (`morning_temp_reminder`,
  `fertile_window_approaching`, `period_start_predicted`,
  `cycle_insight_ready`), generated server-side, persisted with
  `(user_id, dedupe_key)` uniqueness, surfaced at `/v2/cycle/messages`.

This is not a small footprint. The next session should build on it, not
restart it.

## Where the substantive gaps live

Listed by leverage on the user's stated complaint ("the actual helpful
design, the actual helpful UI, the actual helpful data, and how it is
formatted and where it's placed"). Not by effort.

### Tier 1: signal hierarchy on the today screen is wrong

NC's today screen leads with **the verdict**: "Not fertile" or "Use
protection" in big bold text inside the central ring. Cycle day and date
are subtitles (per `nc-pattern-recognition-audit.md` Section 1, frame
0007 / 0010 / 0012). The whole product orbits the verdict because the
verdict is what tells the user how to act today.

LanaeHealth's `/v2/cycle` (`cycle/page.tsx:271`) leads with `NCPhaseCard`,
which shows the phase ("Menstrual", "Luteal") as the headline and a
small pill underneath that reads "Cycle day N · <verdict>". The verdict
is appended to the cycle-day pill, in small text, after a middle dot.

The `CycleRingHero` component (`_components/CycleRingHero.tsx`) was
explicitly rewritten in PR #57/58/59 to make the verdict the dominant
signal ("the dominant text is the binary fertility verdict (Not fertile
/ Use protection), NOT the cycle day"). The component is imported on
line 13 of `cycle/page.tsx` but is not actually rendered anywhere in
the JSX. It is dormant code superseded by `NCPhaseCard`.

**Why this matters:** NC's product value lives in the daily verdict.
Phase is context. By showing phase as the headline and the verdict as a
trailing pill, the today screen tells a Cycler "you are in your luteal
phase" (true but secondary) instead of "you are not fertile today"
(actionable). For a Cycler tracking cycle awareness, the verdict is the
question they came to answer.

**Rough size:** Today-screen layout edit only. Replace `NCPhaseCard` as
the lead block with a re-instated `CycleRingHero` (verdict-first), keep
`NCPhaseCard` as a secondary educational tile below. Both surfaces
already exist; the change is composition.

### Tier 2: smart prompts are buried in the inbox

`generateCycleMessages()` produces high-quality NC-aligned cards. They
are persisted to `cycle_messages` and rendered at `/v2/cycle/messages`.
They are NOT rendered on the today screen.

NC's pattern (per `nc-pattern-recognition-audit.md` 4.10 and Section 5):
the same prompts appear as today-screen cards when relevant
("Time to take an ovulation test," "Your period is coming soon"). They
also live in the messages inbox for asynchronous reading. The today
surface is where the prompt earns its keep, because that is the only
surface the user opens reliably.

LanaeHealth's `cycle/page.tsx` does not consume the messages stream at
all. The bell icon shows an unread count via `countUnreadMessages` but
the cards themselves only render on the dedicated messages route.

**Why this matters:** Prompts that don't appear where the user is
looking lose 90% of their value. "Take an LH test today" is only useful
if the user sees it the morning of, not three days later when they
remember to tap the bell.

**Rough size:** Add a "today's prompt" slot above the period prediction
on `cycle/page.tsx`, render the highest-priority unread message there,
mark it read on impression. Reuse the existing `MessagesList` card
component. Keep `/v2/cycle/messages` as the asynchronous inbox.

### Tier 3: data inputs that degrade the algorithm

#### 3a. Sick / Hungover quick toggles are missing

NC's log sheet has two pill toggles directly under the temperature
readout (per `nc-pattern-recognition-audit.md` Section 3, frames 295,
300, 313): "Sick" (pill icon) and "Hungover" (cup icon). NC's algorithm
**uses these to exclude that day's BBT reading** from the cover line
calculation. Sick days produce false-high BBT (immune response), and
hangover days produce false-low BBT (alcohol's hypothalamic effect).
Including those readings poisons the personal baseline.

LanaeHealth: `grep -rn "sick\|hungover" src/lib/cycle/
src/app/v2/cycle/_components/` returns zero results. The exclusion
flags do not exist in `PeriodLogFormV2` and the cover-line calculation
in `cover-line.ts` has no awareness of them.

**Why this matters:** Every sick day in our data set distorts the
user's cover line. Over 12-24 cycles, that compounds. The algorithm
quality work in `cover-line.ts` is real but is being fed noisy inputs.

**Rough size:** Two-step. (1) Add `is_sick` and `is_hungover` boolean
columns to `cycle_entries` (migration, plus `runScopedQuery` updates).
(2) Add the two pill toggles to `PeriodLogFormV2` directly under the
temperature row. (3) Filter in `cover-line.ts`'s `computeCoverLine` to
exclude readings whose date matches a sick/hungover entry. (4) Decide
whether to surface "we excluded today's reading" in the BBT tile so the
algorithm shows its work.

#### 3b. LH test result is manual chip, not photo-scan

NC's log sheet has a camera icon next to Positive/Negative chips for
LH test result entry (per `nc-pattern-recognition-audit.md` Section 3,
frame 295). The camera scans the test strip and reads the relative
darkness of the test line vs the control line, which gives a
quantitative LH measurement, not a binary. NC then uses the quantitative
value to time ovulation more precisely than positive-then-temperature
alone allows.

LanaeHealth: Manual chip selection only.

**Why this matters:** Smaller leverage than 3a. Camera scan is a real
quality boost but adds image-pipeline work. Defer until the rest of the
algorithm-input gaps close.

#### 3c. Spotting vs Period: present, may be under-exposed

`PeriodLogFormV2.tsx:45` has `{ value: 'spotting', label: 'Spot' }` so
the data model supports the distinction. The follow-up question is
whether Spotting is treated correctly in `cycle-stats.ts` (Spotting
should NOT count as a period day for cycle-length math) and in the
calendar / history rendering (NC distinguishes them visually).

**Rough size:** Verify only; may already be correct.

### Tier 4: pedagogical patterns NC uses that we don't

#### 4a. Education before action

NC's pattern (per `nc-methodology-research.md` Voice & Tone): "Each
algorithm-related help page begins with a definition of the underlying
biology before describing what NC does with it." Their phase-explainer
sheet (frame 0018-0030) opens with the lead paragraph defining the
phase, then "What's happening with hormones?", then "How to make the
most of this phase," then "Luteal phase & the NC degree algorithm."
Four-section IA, consistent across phases.

LanaeHealth's phase explainer (`PhaseTipsCard.tsx`) is one card with
exercise + nutrition tips. There's no "what's happening with hormones"
block, no "how the algorithm uses this phase" explainer. The biology
is implicit.

**Why this matters:** Every NC-grade explainer ends with "and here is
why the algorithm cares about this phase," which builds trust by
showing the work. The user understands the algorithm because they
understand the underlying biology first. Skipping that step makes the
algorithm feel arbitrary.

**Rough size:** Restructure the phase explainer as a four-section sheet.
The hormones content can pull from `hormones.ts` (already there) or be
written inline. Algorithm explainer pulls from the docstrings in
`signal-fusion.ts` and `cover-line.ts` which already describe the
behaviour in plain language. This is a writing job more than a coding
job.

#### 4b. Inline blue-link glossary terms

NC's body copy turns key terms into tappable blue-link words inline
("common", "length", "average", "variation" per
`nc-pattern-recognition-audit.md` Section 7). Tap reveals a small
definition. The pattern reduces the perceived complexity of clinical
copy because the reader can read the body and pull definitions on
demand.

LanaeHealth: muted color labels for similar text but no tappable
definitions. The user sees clinical words and either knows them or
doesn't.

**Rough size:** Add a `<GlossaryTerm term="luteal phase" />` primitive
in `src/v2/components/primitives/`, with a sheet-on-tap that pulls
definitions from a small `cycle-glossary.ts` map. Sprinkle through
`InsightRow`, `StatisticsRollup`, the cycle insights intro, the period
log form headers.

#### 4c. Voice consistency

NC's voice patterns from `nc-methodology-research.md`:
- Calm, second-person, declarative.
- Few hedges in algorithm explanations, many hedges around the user's
  variability.
- "You'll get more Red Days at first" paired with "this is because the
  algorithm doesn't know your cycle yet."
- "It's okay if you miss a day here and there" reduces anxiety.
- "Cyclers" not "users." "Get to know your cycle" not "learn your
  patterns." "Backed by science" / "Hormone-free" recur.
- "Fertile window" never "danger days."

LanaeHealth: voice is mostly good (sage, kind, non-alarmist) but
inconsistent across files. `cycle/predict/page.tsx` opens with "Ranges,
not points. When the range is wide, our data is thin. That's the
honest answer, not a bug." That is excellent NC-grade voice. Other
surfaces are more clinical.

**Rough size:** A copy pass across `cycle/page.tsx`,
`cycle/insights/page.tsx`, `cycle/history/page.tsx`, the
`MetricExplainers` sheets, the cycle messages copy. Bring everything to
the `predict/page.tsx` register. Maintain the no-em-dash rule from
CLAUDE.md.

### Tier 5: information architecture

#### 5a. Personalized "most common symptoms" rail

`NCSymptomChips.tsx:148` is **phase-keyed** ("the chip set is
phase-aware: NC surfaces the symptoms that are most likely to flare in
the current phase"). NC's chip rail is **phase-aware AND
user-history-aware**: the chips on Lanae's screen are the symptoms
**Lanae** has logged most often during this phase across cycles, in
descending frequency. So a Cycler's rail evolves to match her body.

LanaeHealth: the chip set comes from a static phase-keyed map in
`NCSymptomChips`. Every Cycler in luteal phase sees the same chips.

**Why this matters:** NC's personalized rail is one of the strongest
"this app gets me" moments in the product. It says "you usually feel
tired around CD 22; tap to log if that's true today." Static phase
chips say "luteal phase typically involves tiredness." The first is
personal pattern recognition; the second is a generic primer.

**Rough size:** Hybrid ranking. Pull the user's last 6 cycles of logged
symptoms from `cycle_entries.symptoms`, count frequency by phase,
intersect with NC's static phase-typical set, rank by the user's
frequency. Fall back to the static set when the user has fewer than 3
logged instances of any symptom in this phase. `NCSymptomChips` becomes
a thin wrapper over a personalization function in
`src/lib/cycle/personalized-symptoms.ts`.

#### 5b. "Symptoms trends" CTA on today

NC's today screen has a "Symptoms trends >" pill button (per
`nc-pattern-recognition-audit.md` Section 1, frame 0015). Tap drives to
a historical pattern view. Without it, pattern recognition is
discoverable only via the menus.

LanaeHealth: `SymptomRadarCard` lives at `/v2/cycle/insights`, two taps
deep. There is no entry point on the today screen.

**Rough size:** Add a CTA pill below the symptom chips on
`cycle/page.tsx` that navigates to an anchor on `/v2/cycle/insights`
focused on the radar card.

#### 5c. "X cycles tracked" headline as trust anchor

NC's Cycle Insights summary panel (frame 0263) leads with "47 cycles
tracked" as a huge headline, before the stat tiles. It establishes data
depth. The user understands they're looking at meaningful patterns
because the n is right there.

LanaeHealth: `cycle/insights/page.tsx:314` shows "{N} completed cycles
on file" as small body text inside the intro card. It's there but it
doesn't read as a headline.

**Rough size:** Promote `ctx.stats.sampleSize` to a top-of-page hero in
`cycle/insights/page.tsx`. Same data, different visual weight.

#### 5d. Hormone arc educational illustration

NC's phase explainer sheet (frame 0022, 0025, 0030) has a stylized
three-curve illustration: Estrogen (purple), LH (blue), Progesterone
(pink), with an egg-dot marker at the ovulation point. It is a single
glanceable illustration that explains the entire hormonal narrative of
a cycle.

LanaeHealth: `hormones.ts` exists for **tracking** hormone levels but
there is no **illustration** of the canonical hormonal narrative.

**Rough size:** A new SVG primitive in
`src/v2/components/cycle-hormone-arc.tsx`. Three sin/cos-derived curves
with phase markers and an egg dot at ovulation. Embeddable in the
phase explainer (Tier 4a) and the cycle insights surface.

#### 5e. BbtTile last-sync timestamp

NC's BBT readout (frame 0295) shows "97.59 degrees F" and underneath it
"Updated 12:29 PM" as a subline. The timestamp tells the user how
fresh their reading is, which matters for the BBT-must-be-from-today
algorithmic gate.

LanaeHealth's `BbtTile.tsx` shows the temperature and a subtitle of
either "Sustained rise detected" or "Last logged" but not the literal
timestamp.

**Rough size:** Inline edit in `BbtTile.tsx`. Pass the entry's
`logged_at` timestamp from `bbtLog.entries[last]` and format as
"Updated 12:29 PM" when present, fall back to current copy when null.

### Tier 6: visualization

#### 6a. BBT chart is portrait, NC's primary chart is landscape

NC's primary BBT chart (frame 0117, 0123, 0125, 0128, 0130) is
landscape-oriented, full-width, with phase color bands behind the line
(purple Period, pink Fertile, pink Ovulation ribbon with egg dot).
Multi-cycle view is also landscape (multiple cycles laid out
side-by-side).

LanaeHealth: `CycleInsightsChart.tsx` is portrait, ~320px tall, embedded
inside a Card on the insights surface. Phase bands exist (good) but the
landscape rotation feature does not. Multi-cycle is a separate
component (`MultiCycleCompare`) that's a row-based grid, not a stacked
landscape chart.

**Why this matters:** Reading a 28-day BBT pattern in portrait squeezes
the X axis. NC's landscape view gives each day enough horizontal real
estate that the post-ovulation thermal shift is visually obvious. In
portrait it can read as noise.

**Rough size:** Add a "rotate to expand" affordance to
`CycleInsightsChart` that opens a full-screen landscape variant. The
rotation handler is browser-native; the chart is already responsive
to width changes via `ResizeObserver`. Mostly UX scaffolding.

#### 6b. Calendar visual taxonomy depth

NC's calendar (frame 0150-0163) uses a rich visual taxonomy per cell:
solid red = period day (with red bar bridging consecutive days), solid
green = green day (with check), open green outlined = predicted future
green, open red outlined linked by thin pink line = predicted future
period, dotted green = today / predicted ovulation, small black drops
= bleeding amount, black egg = ovulation day, big cycle-day number
inside, small calendar date above. That is six distinct cell states
plus three overlay markers.

**Audit result (2026-04-29):** `CycleCalendarGrid.tsx` already covers
five of the six cell states (period filled, period beads, today
dashed, predicted-period dashed pink, predicted-future-green outline)
and the period-drop marker. The `flow_level` -> opacity ladder
(spotting 0.32, light 0.55, medium 0.78, heavy 1.0) is a different
encoding than NC's 1-4 drops but reads with comparable clarity. The
remaining gap was the **ovulation egg-dot marker** (NC frame_0150 /
0163 / 0165). This is closed: `CycleCalendarGrid` now accepts an
optional `ovulationDates` prop and renders a small black egg-dot
below the cell on those dates; `CycleHistoryClient` and
`/v2/cycle/history/page.tsx` thread the current cycle's confirmed
ovulation date through.

**Still open** (deferred): per-cycle ovulation for past cycles. The
insights page computes per-cycle ovulation via
`detectAnovulatoryCycle` + `fuseOvulationSignal` for `MultiCycleCompare`;
folding that compute into the history page so the calendar marks every
cycle's ovulation, not only the current one, is a small follow-up.

## Tier 7: not gaps but ideas worth flagging

These are NC patterns that may not be appropriate for LanaeHealth's
medical-tracking-hub purpose but are worth noting:

- **"4-star Skilled Cycler" rank.** Gamification of logging consistency.
  NC uses it as a positive reinforcement for the data discipline their
  algorithm needs. For Lanae's medical use case, this could backfire
  (reading a doctor's report under a "1-star Beginner" badge is bad).
  Recommend NOT cloning.
- **"Get free months" / referral.** Acquisition feature. N/A for a
  single-user medical hub.
- **FDA-cleared regulatory badge.** NC has FDA clearance; we don't.
  Don't fake it.
- **NC's tutorial overlay (7 coachmarks).** `CycleTourLauncher` exists.
  Worth reviewing whether all 7 NC steps are mirrored or if we ship a
  shorter tour. Out of scope for the substantive-gap doc.

## Concrete next-session shopping list

For a follow-up session that wants to start nailing these, ordered by
leverage / effort ratio:

| # | Item | Status | File(s) | Tier | Effort | Leverage |
|---|---|---|---|---|---|---|
| 1 | Today screen leads with verdict, not phase | **Shipped (commit 6825a5d)** | `cycle/page.tsx` re-instates `CycleRingHero` as the lead block | Tier 1 | S | High |
| 2 | Smart prompts surface on today | **Shipped (commit 6825a5d)** | `cycle/page.tsx` + new `CycleTodayPromptCard.tsx` | Tier 2 | S | High |
| 3 | Sick / Hungover toggles + cover-line exclusion | Foundation needed | `PeriodLogFormV2.tsx` (in scope) + new migration + `cover-line.ts` filter (locked) | Tier 3a | M | High |
| 4 | Phase explainer 4-section IA | **Shipped** | `MetricExplainers/PhaseExplainer.tsx` rewritten with phase-specific definition / hormones / behaviors / algorithm sections | Tier 4a | M | High |
| 5 | Personalized "most common symptoms" | Foundation needed | Wants `slugs?: string[]` prop + exported `CHIPS` map on `NCSymptomChips.tsx` (locked) | Tier 5a | M | High |
| 6 | "X cycles tracked" headline | **Shipped (commit 6825a5d)** | `cycle/insights/page.tsx` | Tier 5c | XS | Medium |
| 7 | Symptoms trends CTA on today | **Shipped (commit 6825a5d)** | `cycle/page.tsx` anchor-links to `#symptom-radar` on insights | Tier 5b | XS | Medium |
| 8 | BbtTile last-sync timestamp | **Shipped (commit 6825a5d)** | `BbtTile.tsx` (day precision, BbtEntry has no time component) | Tier 5e | XS | Medium |
| 9 | Inline blue-link glossary terms | Foundation needed | new `GlossaryTerm` primitive in `src/v2/components/primitives/` (locked) | Tier 4b | M | Medium |
| 10 | Hormone arc illustration | Foundation needed | new SVG primitive in `src/v2/components/` (locked) | Tier 5d | M | Medium |
| 11 | Voice consistency pass | **Verified, no changes** | grep across `cycle/**/*.tsx`; voice was already NC-grade | Tier 4c | XS | Low (voice was already disciplined) |
| 12 | Calendar visual taxonomy: ovulation egg | **Shipped** | `CycleCalendarGrid.tsx` accepts `ovulationDates` prop; threaded through `CycleHistoryClient.tsx` and `history/page.tsx`. Per-cycle ovulation for past cycles still open. | Tier 6b | M | Medium |
| 13 | Landscape BBT chart | Open | `CycleInsightsChart.tsx` (rotation affordance) | Tier 6a | L | Medium |
| 14 | LH camera scan | Defer | new image pipeline | Tier 3b | XL | Low |

### Foundation amendments needed for the deferred items

Items 3, 5, 9, 10 all want a small additive change to a locked file
or a new primitive. Each fits the "small foundation PR" pattern from
`docs/sessions/README.md` and unblocks the section once merged:

- **Item 3 (Sick / Hungover):** Migration adding `is_sick BOOLEAN`
  and `is_hungover BOOLEAN` columns to `cycle_entries`. Update
  `cover-line.ts` to filter readings whose date matches a sick or
  hungover entry. The form-side change (the two pill toggles) lives
  inside `PeriodLogFormV2.tsx` which is in scope and can land once
  the migration is in.
- **Item 5 (Personalized symptoms):** Two-line additive change to
  `src/v2/components/NCSymptomChips.tsx`: `export { CHIPS }` and
  `slugs?: string[]` optional prop that overrides the default
  phase-keyed set when provided. Cycle then computes a personalized
  slug list in `_components/personalized-symptoms.ts` and passes it.
- **Item 9 (Glossary terms):** New `GlossaryTerm` primitive in
  `src/v2/components/primitives/`. Renders the term as an inline
  underlined chip; tap opens a small sheet with the definition. Cycle
  consumes it in InsightRow, StatisticsRollup, and the predict
  voice-anchor copy.
- **Item 10 (Hormone arc):** New SVG primitive
  `src/v2/components/cycle-hormone-arc.tsx`. Embeddable in the phase
  explainer (Tier 4a) which is now ready to consume it.

Effort scale: XS = under 30 minutes, S = 1-2 hours, M = half a day, L =
a day, XL = multi-day.

If a session can do exactly one thing, do #1. If two, #1 plus #2. If
three, #1, #2, #3. The first three are the difference between "this
app feels like a tracker" and "this app actually helps me cycle by
cycle."

## Open question for this work to be effective

The gap analysis assumes the cycle section is meant to be NC-grade
helpful for the Cycler. If LanaeHealth's strategic intent for cycle is
narrower than that (e.g. "we want a one-tap log for the doctor visit,
not a daily companion"), the priority list above changes substantially.
Worth confirming the strategic intent before committing to Tier 1 / 2
work.

## Sources used to compile this document

- All 75 features in `docs/research/nc-pattern-recognition-audit.md`
- All algorithm citations in `docs/research/nc-methodology-research.md`
- All population baselines in `docs/research/cycle-population-references.md`
- Live read of the cycle code listed above as of commit `d6defcb` on
  branch `claude/jolly-mcnulty-b1a305`.

No new web research was added; the existing in-tree NC research is
already deeper than any single follow-up scrape would be. If the
strategic intent question above resolves toward "go deeper on NC," the
right next move is a Cycle Matters blog read-through plus a fresh look
at NC's recent app updates (2025-2026) for new features the existing
audit may have missed.
