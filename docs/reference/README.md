# Reference apps for v2 mobile UI rebuild

This directory holds visual references used as the spec for the LanaeHealth v2 mobile rebuild. **The reference is the spec** — every section that has a north-star app is built by cloning the reference, not by inventing design.

## Best-of-three design philosophy

| Layer | Source | Applies to |
|-------|--------|-----------|
| Visual language ("vibes") | **Oura** | Shell, home, navigation, data viz, palette, white space |
| Clarity / pedagogy / voice | **Natural Cycles** | All copy: labels, subtext, onboarding, error states |
| Per-section interaction patterns | Cycle = **Natural Cycles**, Food = **MyNetDiary**, Sleep/readiness = **Oura** | The actual section surfaces |

When the three conflict, the per-section pattern wins for that section's surface, but the visual chrome and copy voice stay consistent across the app.

## Directory layout

```
docs/reference/
  oura/
    recordings/<flow>.mov     # raw screen recordings (gitignored)
    frames/<flow>/frame_NNNN.png  # extracted unique frames (gitignored)
    colors.md                 # extracted palette w/ hex codes
    typography.md             # observed type scale
    components.md             # observed primitives + spacing notes
    flows.md                  # navigation patterns
  natural-cycles/             # same structure
  mynetdiary/                 # same structure
  route-mapping.md            # each of our 56 routes -> which reference frame(s)
```

`recordings/` and `frames/` are gitignored because they contain screenshots of third-party apps. Only our derived analysis (`*.md`) is committed.

## Workflow

### 1. Capture (one-time per flow)

iOS Screen Recording of each major flow per app, 3-5 min each. Optionally narrate while recording — audio gives bonus context for transcription later.

Suggested flows:

**Oura** (the visual + readiness reference):
- `home-readiness.mov` — home + readiness ring tap-through
- `sleep.mov` — sleep view + day detail
- `activity.mov` — activity view + drill-down
- `trends.mov` — trends + history scroll

**Natural Cycles** (the cycle UX + clarity reference):
- `today-checkin.mov` — daily check-in flow
- `log-period.mov` — period logging
- `history-predictions.mov` — history scroll + prediction view
- `settings-onboarding.mov` — settings tour, capture explanatory copy

**MyNetDiary** (the food UX reference):
- `today-and-log.mov` — today screen + meal log
- `search-and-pick.mov` — food search + selection
- `food-detail.mov` — FDA Nutrition Facts card
- `plan-and-analysis.mov` — plan, analysis, trends
- `custom-food-recipes.mov` — custom food + recipe builder
- `health-vitals.mov` — weight, BP, HR trackers

### 2. Drop into reference dirs

AirDrop the `.mov` from your phone to your Mac, then move into the right `recordings/` directory:

```
docs/reference/oura/recordings/home-readiness.mov
docs/reference/natural-cycles/recordings/today-checkin.mov
docs/reference/mynetdiary/recordings/today-and-log.mov
```

### 3. Extract frames

```bash
scripts/extract-reference-frames.sh docs/reference/oura/recordings/home-readiness.mov
```

Outputs ~50-200 unique frames to `docs/reference/oura/frames/home-readiness/`. Repeat for each recording.

Tunable: `scripts/extract-reference-frames.sh <file> 0.20` extracts MORE frames (lower threshold); `0.40` extracts fewer (higher threshold).

### 4. Curate

For each `frames/<flow>/` directory:

- Scrub through the PNGs
- Delete obvious non-canonicals (notifications, accidental taps, blank loading frames)
- Rename canonical states semantically:
  - `frame_0007.png` → `food-search-empty.png`
  - `frame_0023.png` → `food-search-results.png`
  - `frame_0031.png` → `food-detail-fda-card.png`
- The keepers become the visual spec for cloning

Time budget: 5-10 min per flow.

### 5. Document derived design system

For each app, write three derived markdown files from the curated frames:

- `colors.md` — palette with hex codes (color-pick from frames)
- `typography.md` — observed type scale (font sizes, weights, line heights)
- `components.md` — observed primitives (buttons, cards, list rows, rings) with spacing notes
- `flows.md` — navigation patterns observed in recordings

These files are committed (they're our analysis, not the original assets).

### 6. Build route mapping

Write `docs/reference/route-mapping.md` linking each of our 56 v2 routes to its reference frame(s). Format:

```markdown
| Our route | Visual layer | Voice layer | Section UX clone | Reference frame(s) |
|---|---|---|---|---|
| /v2/cycle | Oura | NC | NC | natural-cycles/frames/today-checkin/today-default.png |
| /v2/calories | Oura | NC | MFN | mynetdiary/frames/today-and-log/today.png |
| /v2 (home) | Oura | NC | Oura | oura/frames/home-readiness/home-default.png |
| /v2/doctor | Oura | NC | original (no analog) | — |
```

This becomes the master briefing input for every parallel build session.

## Tunables

The scene-change threshold (default `0.30`) is the main knob. Quick guide:

| Threshold | Behavior | When to use |
|-----------|----------|-------------|
| 0.15 | Very sensitive — captures small UI changes (active states, subtle scrolls) | Capturing animation states, micro-interactions |
| 0.30 | Default — captures distinct screens and major state changes | First pass on most recordings |
| 0.50 | Coarse — only major navigation jumps | If your recording has many similar screens you don't need |

Re-run extraction at different thresholds without re-recording: just delete the `frames/<flow>/` dir and re-run the script with a different threshold.
