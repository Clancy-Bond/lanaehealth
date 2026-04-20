# Natural Cycles primitives observed

From `docs/reference/natural-cycles/frames/full-tour/frame_{0080,0160}.png`.

## Day circle on timeline rail

The core NC primitive. A 36-40pt colored circle labeled with the cycle day number, threaded onto a vertical rail colored the same as the current phase. Menstrual days are pink circles on a pink rail; fertile days are green. Predicted days are outlined rather than filled.

We do not have a direct v2 equivalent in Phase 0; the Cycle section session will build it when cloning the NC history flow.

## Weekly calendar grid

Frame_0160 shows a month view organized as weeks (Sun-Sat). Each week is a card. Days are rendered as circles inside the grid with the same phase coloring as the rail view.

## Day row (history)

`<circle on rail>` + `<label "Cycle Day N">` + `<subtext ...>` + `<pill-shaped temperature value>` + `<chevron>`. Our v2 equivalent is `ListRow` with a custom leading slot.

## Bottom tab bar

Five-slot tab bar: Today / Calendar / [center FAB] / Messages / Learn. The center FAB is a filled deep-plum circle with a plus glyph, slightly larger than the adjacent icons and with a subtle shadow. This is the pattern we adopted for `BottomTabBar` with the `centerAction` slot.

## Brand header

Frame_0160 shows a small centered brand logotype "NC° Birth Control" as the top app bar title. We do not replicate the brand mark, but the centered-title-with-hamburger-left pattern is standard for v2's `TopAppBar` `standard` variant.

## Empty and loading states

NC uses short headlines paired with an illustration slot. Copy follows the voice rules: short, kind, explanatory. Our `EmptyState` primitive encodes this shape.
