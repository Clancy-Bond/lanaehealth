# Current state: Cycle section

**Recording:** `docs/current-state/recordings/2026-04-29-app-tour.mp4`
**Frames:** `docs/current-state/frames/2026-04-29-app-tour/frame_0011.png` through `frame_0019.png`, plus `frame_0045.png` and `frame_0046.png` for a cycle-day-4 recommendation tile reached from elsewhere.

## What is on screen today

- **Landing.** Title "Cycle" with a small symbol (looks like a degree mark or annotation). A "History" affordance and a notifications bell with a badge of 2 sit top-right. The first big tile is "Resetting time" with subtext "Estrogen and progesterone are at their lowest. Energy may dip and cravings can show up. Honor what your body needs today" and a "Full graph >" button. Below that is a "Cycle Phase / Menstrual / Cycle day 4 - not fertile" card with Exercise and Nutrition recommendations. A floating green + button in the lower-right is the global add affordance.
- **Cycle insights.** Reached by tapping into the section. Header reads "Cycle insights" with the standard back chevron labeled "Cycle". Subtext: "How your numbers compare to large population studies. Numbers here are for orientation, not judgment, the goal is understanding your rhythm. 15 completed cycles on file." First sub-card: "Temperature pattern" with empty plot region.

## Voice and palette

- Pink accent ("Cycle" title in pink, "Resetting time" copy in cool greys). Otherwise the dark Oura-derived chrome.
- Copy is on-voice for v2: short, kind, explanatory. No em-dashes. Example: "Honor what your body needs today."
- The "Full graph" affordance uses a pill with chevron, consistent with v2 primitives.

## Routes that own this surface

- `/v2/cycle`
- `/v2/cycle/*`

These are the only routes a Cycle session is permitted to edit (per `docs/sessions/README.md` "Locked files rule"). Anything outside `src/app/v2/cycle/**` requires a FOUNDATION-REQUEST.

## Reference

- North-star UX: Natural Cycles. See `docs/reference/natural-cycles/{flows,components,colors,typography}.md`.
- North-star chrome: Oura. See `docs/reference/oura/`.
