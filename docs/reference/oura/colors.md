# Oura palette

Derived from `docs/reference/oura/frames/full-tour/frame_{0001,0030,0050,0100,0150,0200}.png`.

## Surfaces

| Hex | Role | Frame evidence |
|---|---|---|
| `#0A0A0B` | Page base, status bar area | 0001, 0050 (darkest surface under chrome) |
| `#111114` | Content surface (subtle lift from base) | 0030, 0100 (reading-heavy sections) |
| `#17171B` | Card surface | 0050 contributor cards, 0150 rows |
| `#1F1F25` | Sheet / elevated surface | 0150 contributor button pill |

## Text

| Hex | Role | Frame evidence |
|---|---|---|
| `#F2F2F4` | Primary body + headings | 0030 title "Training frequency", 0050 "62 FAIR" |
| `#B0B3BD` | Secondary labels | 0150 "Resting heart rate" label |
| `#7E8088` | Muted captions | 0030 explanatory paragraph fade |

## Accents

| Hex | Role | Frame evidence |
|---|---|---|
| `#4DB8A8` | Teal, primary CTA, readiness bars | 0150 bar chart |
| `#E5C952` | Mustard, emphasized data | 0150 single highlighted bar (value 53) |
| `#D9775C` | Terracotta, "Pay attention" warning | 0050 contributor rows, 0150 activity balance |
| `#F0955A` | Orange, active tab underline | 0030 under "Training frequency" tab |
| `#5DADE6` | Blue, high activity bars | 0050 bar chart (ascending saturation) |

## Borders and dividers

Oura cards have no drop shadow. Separation comes from:

- Hairline borders at `rgba(255, 255, 255, 0.10)` around cards and rows.
- Fainter `rgba(255, 255, 255, 0.06)` for in-card row dividers.
- Underline progress bars at 2-3pt tall under each contributor row.

## Observations

- The "Pay attention" warning color sits close in hue to the active-tab orange but is noticeably desaturated. They are visually different signals.
- The teal primary and mustard highlight are the only two fills used in the bar chart; everything else is a slightly darker shade of the card surface.
- Study cards (frame_0200) use full-bleed photography with a dark overlay; the CTA pill on top is white with black text, which we capture in a separate "photo-backed" card variant to be added in a later phase.
