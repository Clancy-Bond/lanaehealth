# Natural Cycles -- Implementation Plan

Ranking formula from design-decisions.md: sort by `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8. Top 3 flagged for implementation.

Lanae's feedback elevated Natural Cycles to a first-class replication target: "for periods and cycles if we copy anything it should be Natural Cycles." This plan reflects that mandate. All ranked features are observations, not code copies. Algorithm behaviors are reimplemented from published papers (Scherwitzl 2015, 2017; NC help documentation; FDA DEN170052 memo).

---

## Feature Ranking

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Score | Depends on | Replicate / Improve / Skip | Notes |
|------|---------|----------------|---------------------|--------------------|-------|-------------|----------------------------|-------|
| 1 | **Multi-signal cycle intelligence engine with individualized uncertainty** | P1, P2, P3, P9 | 5 | M | 5.0 | oura_daily, nc_imported, cycle_entries, lh_test field | **IMPROVE** | FLAGGED. Cover line + BBT shift + LH + HRV + RHR + cycle-stats priors, with per-user SD. Replaces fixed 28-day assumption. Outputs prediction + uncertainty band. |
| 2 | **Cycle Report PDF for OB/GYN (time-sensitive: Apr 30)** | P7, P12, P14 | 5 | M | 5.0 | /doctor page, nc_imported, cycle_entries, cycle stats | **REPLICATE** | FLAGGED. One-tap PDF: cycle length history, period/flow, ovulation days, luteal lengths, symptom distribution, short-luteal flags, anovulatory count. Targeted for Lanae's Apr 30 OB/GYN. |
| 3 | **Clinical anomaly alerts: short luteal, anovulatory, long cycle** | P14 | 5 | S | 10.0 | cycle statistics from rank 1 | **IMPROVE** (NC detects but under-surfaces) | FLAGGED. Proactive warnings: luteal <10d (progesterone deficiency), no BBT shift (anovulatory), cycle >35d (PCOS/perimenopause marker). Written as plain-language InsightBanner alerts. |
| 4 | Period prediction with +/- range display (replace 28-day fallback in cycle-calculator.ts) | P15, P3 | 5 | S | 10.0 | cycle-calculator.ts, NcImported rows | **IMPROVE** | Replace DEFAULT_CYCLE_LENGTH fallback. Show range ("period Apr 24-29"). Already partial in existing code. |
| 5 | Cover-line BBT chart visualization on Patterns page | P5, P8 | 4 | M | 4.0 | Recharts, oura_daily, nc_imported | **REPLICATE** | Chart with user-relative cover line, three-reading confirmation callout, sick-day exclusions visually distinct. |
| 6 | Sick-day / disturbance auto-exclusion | P4, P13 | 4 | S | 8.0 | daily_logs symptoms, oura sleep score | **IMPROVE** (auto vs. manual) | Auto-exclude temp when fever, POTS flare, low-sleep, or alcohol logged. Manual override on BBT row. |
| 7 | LH test "strong prior" in ovulation prediction | P9 | 4 | S | 8.0 | cycle_entries.lh_test_result, nc_imported.lh_test | **REPLICATE** | Positive LH forces ovulation prediction to test day +1. Currently captured as data, not used for prediction. |
| 8 | Cycle Statistics card on Patterns page (mean, SD, shortest, longest, anovulatory count) | P14 | 5 | S | 10.0 | cycle history from NC data | **REPLICATE** | Highly visible, low effort, leverages existing data. Also feeds into rank 2 PDF. |
| 9 | Bayesian shrinkage during early cycles (learning period) | P10 | 4 | S | 8.0 | cycle stats engine | **REPLICATE** | For first 1-3 cycles of a new logging session, use population priors (mean 29.3 d from NC 600K dataset) with progressive data-weight shift. |
| 10 | Partner (Clancy) fertility summary view | P11 | 3 | S | 6.0 | Profile page | **SKIP/SIMPLIFY** | Clancy already has admin. No separate app. A simple "shared summary" page can satisfy this without complexity. |
| 11 | Educational in-flow temperature explanation | P13 | 4 | S | 8.0 | BBTRow, InsightBanner | **IMPROVE** | Contextual tooltips: "We are weighting today's reading lower because Oura sleep score was 42." |
| 12 | Mode switcher (Cycle Awareness, Plan Pregnancy, Manage Symptoms) | P6 | 2 | M | 2.0 | new setting | **SKIP** | Not Lanae's life stage. A goal toggle would be overkill. |
| 13 | CSV data export | P12 | 4 | S | 8.0 | new API route | **REPLICATE** | Covered by Apple Health research; defer to that implementation. |
| 14 | Perimenopause mode | P6 | 1 | L | 0.5 | new subsystem | **SKIP** | Not Lanae's life stage. |
| 15 | Postpartum mode | P6 | 1 | L | 0.5 | new subsystem | **SKIP** | Not Lanae's life stage. |
| 16 | Contraceptive claim / red-green day labels | Core NC | 1 | XL | 0.25 | FDA clearance | **SKIP** | We are NOT a contraceptive. Never present data with contraceptive framing. Legal + safety red line. |

---

## Top 3 (flagged for implementation-notes.md)

### 1. Multi-signal cycle intelligence engine with individualized uncertainty

Reimplement NC's core algorithm behaviors in our code, extended with HRV/RHR signals Lanae already produces via Oura.

Published behaviors to replicate:
- Per-user follicular baseline (current cycle's first 7 days of temp)
- Cover line 0.05-0.1 C above max follicular reading
- Three consecutive elevated readings confirm ovulation
- Fertile window = predicted ovulation day + 5 days prior (6-day window)
- Individualized uncertainty buffer scaling with cycle-length SD

LanaeHealth improvements:
- HRV and RHR as independent phase signals (parasympathetic drop ~3 days pre-ovulation; RHR elevation ~2.7 bpm in luteal phase)
- Auto-exclusion from symptom log (fever, POTS flare, low sleep, alcohol)
- No retroactive silent day-recoloring; show "this changed because X" banner
- Honest "insufficient data" when signal weak; no false certainty

### 2. Cycle Report PDF for Apr 30 OB/GYN visit

Port NC's Cycle Report shape to `/doctor/cycle-report`:
- Last 6-12 cycles: length, period length, ovulation day, luteal length
- Temperature chart (BBT + Oura trend, cover line overlay)
- Symptom distribution by cycle phase (pain, GI, mood, POTS symptoms)
- Flagged anomalies: short luteal, anovulatory, long cycle, heavy flow, severe dyspareunia
- Narrative summary auto-generated via Claude assembler

### 3. Clinical anomaly alerts (short luteal, anovulatory, long cycle)

Three detectors + InsightBanner surfacing on Home and Patterns:
- **Short luteal**: <10 days between BBT shift and period onset. Clinical flag for low progesterone / luteal phase defect, relevant to Lanae's fertility + endo pathway.
- **Anovulatory**: no BBT biphasic shift + no LH surge in a full cycle. Alert after 35-day mark to avoid false positives.
- **Long cycle**: >35 days. PCOS, thyroid (Lanae's TSH 5.1 is borderline), or perimenopause marker.

Each alert links to an explanation card with "what this means," "what your data shows," and "possible next steps including discussing with OB/GYN."

---

## Dependencies and sequencing

1. **Rank 8 (Cycle Statistics) FIRST** -- produces the cycle stats primitive used by ranks 1, 2, 3, 4, 9.
2. **Rank 4 (Period range) THEN** -- simplest win, replaces existing default fallback, validates the stats primitive.
3. **Rank 1 (Intelligence engine) CORE** -- enables cover-line, uncertainty, LH prior, auto-exclusion.
4. **Ranks 2, 3 layer on top** -- PDF report and anomaly alerts consume the engine.

Total estimated effort for top 3: 6-10 days of focused work.

---

## What NC does that we explicitly reject

1. **Red/Green day labels for contraception**. We are not a contraceptive device. We will never output a binary fertility flag.
2. **Retroactive silent recoloring**. If new data changes history, we surface the change.
3. **Opaque uncertainty buffer**. We always display uncertainty as a visible +/- range.
4. **"You are outside the norm" implicit messaging**. Our voice assumes chronic illness, irregular cycles, hormone sensitivity. Lanae is the target, not the edge case.
5. **Learning-period frustration**. We use her existing 1,490 days of NC data as the prior. No 1-3 cycle cold start.
6. **Heteronormative partner copy**. Clancy is specifically named; no assumptions about relationship structure beyond what she has told us.

---

## Cross-references to other research

- **Flo research** covers cycle-symptom correlation (rank 1 in that plan) and phase-matched content. Do not duplicate here.
- **Clue research** covers minimal-UX symptom logging and research backing. Referenceable but distinct.
- **Oura research** covers temperature trend signal quality and wearable fatigue. Integrated into rank 1.
- **Apple Health research** covers CSV / PDF export standardization. Defer rank 13 to that.
