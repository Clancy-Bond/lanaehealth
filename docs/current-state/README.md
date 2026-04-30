# Current state of LanaeHealth (v2 mobile)

This directory captures **what the app looks like right now**, not the design target. Reference apps live in `docs/reference/` (Oura, Natural Cycles, MyNetDiary). This directory holds recordings of LanaeHealth itself so downstream sessions can see exactly what they are starting from.

## Why this exists

The v2 mobile rebuild fans out into parallel sessions, one per surface (cycle, calorie, AI chat, login, doctors, data). Each session needs to know what its surface looks like today before deciding what to change. A 6-minute screen recording of the running app gives every section session the same visual ground truth in one artifact, replacing "open the dev server and click around" with a curated set of frames.

## Run order

1. **Priority 0 (blocker).** [`prompts/00-viewport-fix.md`](prompts/00-viewport-fix.md) - app-wide horizontal-overflow fix. Land this first. Section work is blocked on it. See `known-issues.md` #1 and #2.
2. **Section sessions (parallel after Priority 0 lands).** [`prompts/cycle.md`](prompts/cycle.md), [`prompts/calorie.md`](prompts/calorie.md), [`prompts/chat.md`](prompts/chat.md), [`prompts/login.md`](prompts/login.md), [`prompts/doctors.md`](prompts/doctors.md), [`prompts/data.md`](prompts/data.md).

## Layout

```
docs/current-state/
  recordings/<date>-app-tour.mp4         # gitignored, 100s of MB
  frames/<date>-app-tour/frame_NNNN.png  # gitignored, scene-change extract
  INDEX.md                               # frame -> section map (committed)
  sessions/
    cycle.md      # current state of /v2/cycle/*
    calorie.md    # current state of /v2/calories/*
    chat.md       # current state of AI chat surfaces
    login.md      # current state of auth/login flow
    doctors.md    # current state of /v2/doctor/*
    data.md       # current state of /v2/records, /v2/labs, /v2/imaging, /v2/import/*
```

Recordings and frames are gitignored. Only the curated `INDEX.md` and per-section briefs are committed.

## How to add a new recording

1. Record the relevant flow on the iPhone (Settings -> Control Center -> Screen Recording).
2. AirDrop to the Mac, drop into `docs/current-state/recordings/<YYYY-MM-DD>-<flow>.mp4`.
3. Run the extractor:
   ```
   scripts/extract-reference-frames.sh \
     docs/current-state/recordings/<YYYY-MM-DD>-<flow>.mp4 0.30
   ```
4. Update `INDEX.md` with the new frame ranges per section.
5. Update the relevant `sessions/*.md` brief if the surface changed materially.

## Threshold tuning

`0.30` is the default. A higher value (`0.50`) keeps only major navigation jumps. Lower (`0.15`) catches subtle state changes (focused inputs, sheet drag states). Re-run is cheap; re-record is not.
