# MyNetDiary palette

Derived from `docs/reference/mynetdiary/frames/full-tour/frame_{0100,0300}.png`. MFN is consulted only for **list density and food-tracking primitive reference**, not for visual chrome. Its palette is noted here for completeness and for the food-section session that will reference it.

## Surfaces

| Hex | Role | Frame evidence |
|---|---|---|
| `#FFFFFF` | Page base (food lists) | 0300 |
| `#F4F4F4` | Alternating row tint | 0300 meal header "Breakfast 502 cals" bar |
| `#E0E0E0` | Divider | 0300 portion pills borders |

## Brand

| Hex | Role | Frame evidence |
|---|---|---|
| `#1E9B4E` | MFN brand green, top nav | 0100, 0300 |
| `#F5FAF7` | Soft green tint | 0100 tab row bg |

## Text

| Hex | Role | Frame evidence |
|---|---|---|
| `#1A1A1A` | Primary | 0300 "Organic lactose free..." item name |
| `#6B7280` | Secondary | 0300 "Weight: N/A" |
| `#FFFFFF` | Inverse on brand nav | 0100 scan mode label |

## Accents

| Hex | Role | Frame evidence |
|---|---|---|
| `#2B8FD9` | Blue, numeric inputs and total | 0300 "33 cals" |
| `#F6C26B` | Yellow, time-sensitive banner | 0300 "30% OFF" promo |
| `#F04D53` | Red/coral, "Claim Now" CTA | 0300 |

## Notes

- MFN's visual density is higher than Oura or NC. Rows are ~40pt tall with multiple chips per row.
- The brand green should not leak into v2 chrome. Food-section surfaces in v2 use `--v2-accent-primary` (teal) where MFN would use its green.
- Portion-selector chips (the "2 fl oz / 2.25 fl oz / ..." strip) are a strong reusable pattern for v2's calorie-logging flows.
