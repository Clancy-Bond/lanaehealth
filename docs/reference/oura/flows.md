# Oura flows

From the 255-frame full tour under `docs/reference/oura/frames/full-tour/`. Annotated at key frames.

## Home (Today)

- Metric tile strip along the top: Readiness / Sleep / Activity / Cycle day. Horizontally scrollable when more than four.
- Large hero below: either a bedtime arc (frame_0001) or a study card (frame_0200).
- "What's new" horizontal card carousel.
- Bottom tab bar: Today (active), Vitals, My Health, plus a center FAB for quick log.

## Section drill-down (Readiness / Activity / Sleep)

- Top: large app bar with yesterday/today segmented control.
- Bar chart spanning full width, with weekday labels.
- Big score + qualitative label ("62 FAIR").
- Contributor list below. Each row drills into a dedicated explainer with the same chart-then-prose pattern.

## Explainer surface

- Reached by tapping any contributor row.
- Heading, multi-paragraph explainer, bold inline terms ("METs", "cardiovascular fitness"), and a "Learn more" pill or inline link to a sub-topic.
- Dismissable via `X` at the bottom center.

## Voice and copy

- Qualitative status words ("Optimal", "Good", "Pay attention", "Fair") are used liberally. Numbers are never presented without a qualitative framing.
- Warnings are phrased as actions, not indictments: "Pay attention" rather than "Bad."
- Body copy speaks in second person: "When this happens, it's a good idea to take your temperature..."
