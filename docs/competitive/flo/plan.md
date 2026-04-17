# Flo -- Implementation Plan

Ranking formula from design-decisions.md: sort by `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Top 3 flagged for implementation.

---

## Feature Ranking

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Score | Depends on | Notes |
|------|---------|----------------|---------------------|--------------------|-------|-------------|-------|
| 1 | **Cycle-symptom correlation surfacing** | P2 | 5 | M | 5.0 | Existing correlation_results, nc_imported | FLAGGED. Phase-banded correlation across symptoms, mood, pain, GI. Leverages 1,490 NC days + correlation engine. |
| 2 | **Phase-matched content layer (Home InsightBanner)** | P1 | 4 | S | 8.0 | Existing summary-engine, nc-cycle.ts | FLAGGED. Tag Layer 2 summaries + InsightBanner entries by phase. Show phase-appropriate content on Home. |
| 3 | **Cycle Health Report for OB/GYN** | P5 | 5 | M | 5.0 | Existing /doctor page, nc_imported | FLAGGED. One-tap PDF for Apr 30 OB/GYN appointment. Cycle lengths, flow pattern, symptom distribution, short luteal flag. |
| 4 | Phase-aware Chat context injection | P6 | 4 | S | 8.0 | assembler.ts | Single addition to dynamic context layer. Already close to working. |
| 5 | BBT biphasic shift auto-annotation on chart | P9 | 4 | M | 4.0 | oura_daily, Recharts | Strong clinical value but overlap with existing cycle intelligence work. |
| 6 | Cervical mucus entry with descriptive labels | P4 | 3 | S | 6.0 | BBTRow, cycle_entries | Lanae logs via NC already; additive but lower marginal value. |
| 7 | Circular cycle wheel on Home | P8 | 3 | M | 3.0 | CycleCard | Visual polish. Existing CycleCard may already cover this; audit first. |
| 8 | Low-energy symptom pills | P10 | 4 | - | - | Already implemented | No action. SymptomPills.tsx ships. |
| 9 | Partner mode | P7 | 1 | L | 0.5 | New table, auth | Declined. Not a Lanae need. |
| 10 | Anonymous mode | P3 | 2 | L | 1.0 | Auth rewrite | Declined. Single-patient app, RLS already enforces. |
| 11 | Pregnancy mode | P11 | 1 | XL | 0.25 | New subsystem | Declined. Not a Lanae need. |

Tie-break: among ties, favor features that address Lanae's Apr 30 OB/GYN appointment (Cycle Health Report) and daily felt value (correlation surfacing). Rank 2 (Phase-matched content) is highest by raw formula score but smallest lift, so slot it between the two high-impact features to land one visible win quickly.

---

## Top 3 (flagged for implementation-notes.md)

1. **Cycle-symptom correlation surfacing** -- phase-banded correlation output on Patterns page
2. **Phase-matched Home InsightBanner** -- tag summaries and tips by phase, filter to current
3. **Cycle Health Report** -- one-tap export from /doctor for OB/GYN visits

All three leverage data Lanae already has. None require touching existing rows. All additive.
