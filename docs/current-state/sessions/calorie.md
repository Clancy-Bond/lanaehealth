# Current state: Calorie / Food section

**Recording:** `docs/current-state/recordings/2026-04-29-app-tour.mp4`
**Frames:** `docs/current-state/frames/2026-04-29-app-tour/frame_0020.png` through `frame_0029.png`.

## What is on screen today

- **Find a food.** A "< Find a food" header lands but the body renders as a uniform grey wash. The recording catches the page mid-load (skeleton state) rather than a populated search results state. Treat this as evidence the route is wired and reachable from the bottom-tab Food icon, not as evidence of the search UX.
- **Food / Home shell.** Several frames show the Home grid with the Food bottom-tab highlighted, suggesting the user tapped Food and was bounced back, or the recording is mid-transition.

## Known gaps in this recording

- No populated search results.
- No food detail / picker.
- No grams / unit picker (despite recent work on `feat(food/units)` and `feat(food/search)` per recent commits).
- No saved-meal flow, no day total, no nutrition breakdown.

A Calorie session looking for visual ground truth on those flows should request a focused follow-up recording (Food only, ~3 min, drive a real food search and add).

## Routes that own this surface

- `/v2/calories`
- `/v2/calories/*`

A Calorie session is locked out of any other route. FOUNDATION-REQUEST applies to `src/v2/components/primitives/**` changes.

## Recent commits that touched this area

```
d7bb5e7 feat(food/search): live autocomplete (debounced URL push)
fe004a9 feat(food/units): wire UnitOption into picker (g/mg/kg/oz/lb/ml/L/fl oz/cup/tbsp/tsp)
```

`git log --oneline -- src/app/v2/calories` will give a fuller picture before changes.

## Reference

- North-star UX: MyNetDiary. See `docs/reference/mynetdiary/{flows,components,colors,typography}.md`.
- North-star chrome: Oura.
