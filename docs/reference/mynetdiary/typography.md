# MyNetDiary typography

Observed from `docs/reference/mynetdiary/frames/full-tour/frame_{0100,0300}.png`.

## Typeface

System sans (San Francisco on iOS). Less distinctive than Oura's geometric feel. Tight, dense, utilitarian : appropriate to the spreadsheet-like density MFN traffics in.

## Scale

| Token | Rendered size | Weight | Example | Frame |
|---|---|---|---|---|
| xs | 11px | regular | "Breakfast 502 cals" small caption | 0300 |
| sm | 13px | regular | Portion chip label "2 fl oz" | 0300 |
| base | 15px | medium | Item name "Organic lactose free 2% reduced fat milk" | 0300 |
| lg | 17px | semibold | Tab row "Search / Scan / Favs..." | 0100 |
| xl | 22px | bold | Numeric total "33 cals" | 0300 |

## Numeric emphasis

MFN treats numbers as the primary visual element. The calorie count ("33 cals") is in bold blue; the unit ("cals") drops to a lighter weight and muted color. This "big number, small unit" pattern is a reusable idiom we adopted in `MetricTile`.

## Dense list pattern

Food rows pack item name + portion + cals + macro chips + star (favorite) onto one line at `--v2-text-base` or smaller. We retain the density idea in `ListRow` but move optional detail into `subtext` or trailing slots rather than cramming one line.
