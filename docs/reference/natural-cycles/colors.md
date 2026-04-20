# Natural Cycles palette

Derived from `docs/reference/natural-cycles/frames/full-tour/frame_{0080,0160}.png`. NC drives the **explanatory surface** palette in LanaeHealth v2; primary chrome stays dark per Oura.

## Surfaces

| Hex | Role | Frame evidence |
|---|---|---|
| `#FAF5ED` | Page base, warm cream | 0080, 0160 |
| `#FFFFFF` | Card surface | 0080 (history day rows) |
| `#F4EEE2` | Subtle alternating row tint | 0080 background strip |
| `#E8E2D5` | Border, divider | 0080 card edges, 0160 week row |

## Text

| Hex | Role | Frame evidence |
|---|---|---|
| `#2B2B2B` | Body, headings | 0080 "Cycle Day 7" |
| `#6B7280` | Secondary labels | 0080 empty-state ellipsis "..." |
| `#9AA0A6` | Muted captions | 0160 day-of-week letters |

## Accents

| Hex | Role | Frame evidence |
|---|---|---|
| `#E84570` | Menstrual pink, primary brand | 0080 day circles 1-9, 0160 days 1-11 |
| `#5DBC82` | Fertile green | 0080 days 10-18, 0160 green days |
| `#5B2852` | Deep plum, CTA FAB | 0160 center FAB |
| `#F4A0B7` | Outlined predicted days | 0160 days 19-26 |

## Icons

NC uses single-weight outlined glyphs (sun for Today, calendar book, speech bubble for Messages, graduation cap for Learn). Glyphs are muted by default and filled with the accent pink when the tab is active.

## Observations

- The pink is more saturated than a typical brand pink, approaching magenta. Do not use it on dark chrome without an explicit surface inversion.
- Green and pink are never used on the same primitive except on the cycle calendar (where they represent different cycle phases). Do not try to combine them in charts.
- The deep-plum CTA color is brand-reserved; general CTAs on explanatory surfaces should use `--v2-surface-explanatory-accent` (pink) unless specifically representing a "start new cycle" or commitment action.
