# Oura typography

Observed from `docs/reference/oura/frames/full-tour/frame_{0001,0030,0050,0100,0150,0200}.png`.

## Typeface

A modern geometric sans with open apertures and neutral character. Consistent with SF Pro Display/Text on iOS. The number style uses tabular figures with a slightly narrower width.

## Scale

| Token | Rendered size | Weight | Example | Frame |
|---|---|---|---|---|
| xs | 11px | medium | "LOW MEDIUM HIGH" legend | 0050 |
| sm | 13px | regular | Contributor label below the row | 0150 |
| base | 15px | regular | Paragraph body "Training frequency shows how often..." | 0030 |
| lg | 17px | semibold | "Training frequency" section header | 0030 |
| xl | 22px | semibold | "Contributors" section header | 0050 |
| 2xl | 28px | bold | "62 FAIR" score display | 0050 |
| 3xl | 34px | bold | "9:30 - 11:00 PM" bedtime display | 0001 |

## Line height

- 1.2 for display numbers and tight headlines.
- 1.45 for body paragraphs (observed in 0030 "About METs" section).
- 1.6 for long-form explainers (frame_0100 body temperature text).

## Letter spacing

- `-0.02em` for display numbers ("62 FAIR") and large headlines.
- `-0.01em` for body.
- `+0.04em` uppercase for eyebrow labels like "KEY METRICS" (frame_0150).

## Weight usage

- Regular (400) for body paragraphs.
- Medium (500) for list row values on the right.
- Semibold (600) for section headers and card titles.
- Bold (700) for display numbers only.

## Numbers

Tabular figures throughout. When a number sits inline with a unit ("1h 37m inactivity", "48 bpm"), the number is the emphasized weight and the unit drops to a smaller, lighter treatment.
