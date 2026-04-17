# Clue -- Implementation Plan

Last updated: 2026-04-16

Top 3 flagged for implementation. Clue is more minimalist than Flo, so fewer features cross the bar. Rank formula: (impact * 2) / effort_score where S=1, M=2, L=4, XL=8.

---

## Ranked feature table

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Notes |
|------|---------|----------------|---------------------|--------------------|------------|-------|
| 1 | Uncertainty-honest cycle prediction (dashed vs solid, confidence range, plain-language note) | Clue cycle view | 5 | M | Existing cycle intelligence engine at `src/lib/intelligence/` | HIGHEST priority. Direct fit with our multi-signal architecture. Implementation gives Lanae honest predictions for irregular cycles. |
| 2 | Privacy settings page with granular consent toggles and full data export | Clue consent flow | 5 | M | New `src/app/settings/privacy/` page, no new migration | Our Supabase-local data lets us over-deliver on trust. Export as CSV+JSON ZIP. Three toggles: Claude API, correlation analysis, long-term storage. |
| 3 | Anovulatory cycle detection flag with reassuring-but-honest copy | Clue anovulatory flag | 5 | S | Existing multi-signal cycle engine | Lowest effort, highest honesty. Flag surfaces on patterns page and doctor report. |
| 4 | Probabilistic fertile window curve (replace binary block) | Clue fertile probability curve | 4 | M | Cycle intelligence engine, patterns page chart | Strong adopt, but lower priority than top 3. Queue for next push. |
| 5 | Contextual articles after logging (Claude-generated with PubMed citations) | Clue learn-more prompt | 4 | L | Intelligence page + context engine | Good fit but L effort. Queue next. |
| 6 | Clinician-grouped symptom taxonomy (organ systems) | Clue symptom categories | 4 | L | Log page refactor, `symptoms` table remains read-only | Larger refactor of 60 Log components. Queue. |
| 7 | Cycle exclusion flag ("this cycle doesn't count, I was sick/traveling") | Clue's gap (user wish) | 3 | S | `cycle_entries` read-only, need new flag table or client-side filter | Quick win but lower priority. |
| 8 | Menopause mode (hormone tracking, perimenopause patterns) | Clue menopause mode | 1 | L | Lanae is 24, declined | Not relevant for Lanae. |
| 9 | Partner sharing (one-way, minimal) | Clue Connect | 2 | L | Auth changes | Declined for v1. |
| 10 | Reflective journaling prompt after logging | Clue "why" prompt | 2 | S | None | Already partly supported. Skip. |

Ranking math for top 3:
- #1 Uncertainty predictions: (5*2)/2 = 5.0
- #2 Privacy settings + export: (5*2)/2 = 5.0
- #3 Anovulatory detection: (5*2)/1 = 10.0 (highest ratio, lowest cost)

Actual implementation order by ratio: 3, 1, 2. Keep table rank by Lanae impact order.

---

## Top 3 go to implementation

1. Uncertainty-honest cycle prediction
2. Privacy settings page with granular consent and full data export
3. Anovulatory cycle detection flag

Details for each are in `implementation-notes.md`.

---

## Rationale for declining the rest

- Features 4-6 are strong but tripled effort vs top 3. Queue for the next research push.
- Features 7, 10 are small but low Lanae impact.
- Features 8, 9 are out of scope for Lanae's current life stage or relationship model.
- Menopause mode: Lanae is 24. Defer indefinitely unless platform goal shifts.
