# Oura primitives observed

From `docs/reference/oura/frames/full-tour/frame_{0001,0030,0050,0100,0150,0200}.png`.

## Metric ring

Large circular progress ring with a ~10-12% stroke relative to diameter. Stroke caps are rounded. Track uses `--v2-border` at low opacity; value stroke uses `--v2-accent-primary` (readiness) or `--v2-ring-sleep` / `--v2-ring-activity`. Number centered, uppercase label below.

Our implementation: `src/v2/components/primitives/MetricRing.tsx`.

## Metric tile strip

Horizontal scroll of 72-80pt tiles on the home screen (frame_0001). Each tile is a thin-border rounded square with icon + number + caption. Strip is a flex row with overflow-x auto, snapping to tile edges.

Our implementation: `src/v2/components/primitives/MetricTile.tsx`.

## Bar chart

Flat-colored bars with 8-12pt gaps. One "primary" color (teal) for standard values, one "highlight" color (mustard) for emphasized. No gradients or shadows. Grouped by day with weekday labels below (Readiness frame_0150). Legend sits below the chart in --v2-text-muted.

## Contributor list row

`<row>`: leading slot (sometimes blank) + label (left-aligned, primary text) + trailing value or status chip (right-aligned, muted or accent-colored if warning). Hairline bottom divider. Chevron on rows that drill deeper. 44pt minimum touch target.

Our implementation: `src/v2/components/primitives/ListRow.tsx`.

## Pill CTAs

Two variants observed:

- Filled pill: solid background (teal or white depending on surface), inverse text. Used for primary actions ("Learn more" in frame_0200, "Get help" in frame_0001).
- Outlined pill: transparent fill, 1pt border, primary-colored text. Used for secondary actions ("Find my ring" in frame_0001).

Full radius (`--v2-radius-full`), minimum 44pt height.

Our implementation: `src/v2/components/primitives/Button.tsx`.

## Top app bar

Two variants:

- Standard (~56pt): back arrow, centered title, trailing action icon.
- Large (~112pt): actions on top row, big title left-aligned below (frame_0030 "Training frequency" tabs appear within large header).

Our implementation: `src/v2/components/shell/TopAppBar.tsx`.

## Bottom tab bar

Bottom nav with icon + label. Active tab shows filled icon + primary-color label + a 2pt accent underline above the icon. We interpolated this pattern plus NC's FAB-in-tab-bar for `BottomTabBar`.

Our implementation: `src/v2/components/shell/BottomTabBar.tsx`.
