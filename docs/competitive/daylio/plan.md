# Daylio Implementation Plan

Ranked by `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8.

---

## Ranked table

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Notes |
|------|---------|---------------|--------------------|-|------------|-------|
| 1 | **Lite Log (30-second entry path)** | Pattern 1 + Pattern 2 | 5 | M | existing MoodCard, custom_trackables | Top-of-log quick entry: mood face + activity icon grid. No body map, no sliders. Single card, fits above the fold. |
| 2 | **Year-in-Pixels view** | Pattern 3 | 5 | M | daily_logs, mood_entries, cycle_entries | New view on Patterns page. 365 squares colored by selected metric. Toggle: mood, pain, fatigue, sleep, flow, HRV. Cycle phase border overlay. |
| 3 | **Top 5 best vs worst days** | Pattern 4 | 4 | S | existing correlation engine, custom_trackable_entries | New card on Patterns page. Side-by-side columns showing the 5 most common factors on Rad vs Awful days. |
| 4 | Multiple daily mood entries | Pattern 5 | 4 | M | schema change on mood_entries.UNIQUE(log_id) | Drop unique constraint, add sub_entry_index or timestamp as sort key. Requires small migration. |
| 5 | Renameable mood labels | Pattern 7 | 3 | S | new user_preferences table | Settings panel. Persists custom label mapping. Applied across MoodCard, year-in-pixels legend. |
| 6 | Activity icon library seed | Pattern 2 continued | 3 | S | custom_trackables | Seed ~30 Lanae-relevant icons (compression, salt, lying flat, bath, sage, pacing). Stored in default_trackables or migration. |
| 7 | "Welcome back" copy for gaps | Pattern 6 | 3 | S | DailyLogClient.tsx | String change + logic: detect last entry > 2 days ago, show warm re-engagement copy. |
| 8 | Mood CSV export | Pattern 8 | 2 | S | mood_entries | Extend Doctor Report to include mood time series or add dedicated CSV export route. |
| 9 | Voice note tied to mood entry | Pattern 9 | 2 | M | VoiceNote.tsx, mood_entries | Add optional voice_note_id column on mood_entries. Render inline. |
| 10 | Home screen widget | Pattern 10 | 2 | XL | native PWA work | Out of scope for now. |

---

## Ranking calculation

Formula: `score = (impact * 2) / effort_weight`. Effort weights: S=1, M=2, L=4, XL=8.

| Rank | Feature | Impact | Effort | Score |
|------|---------|--------|--------|-------|
| 1 | Lite Log | 5 | M | 10/2 = **5.0** |
| 2 | Year-in-Pixels | 5 | M | 10/2 = **5.0** |
| 3 | Top 5 best vs worst | 4 | S | 8/1 = **8.0** |
| 4 | Multiple daily entries | 4 | M | 8/2 = 4.0 |
| 5 | Renameable labels | 3 | S | 6/1 = 6.0 |

Re-sorting by pure score shifts rank 3 above rank 1 and 2. But qualitative judgement matters: **Lite Log** is the flagship user-visible win and hits Lanae's biggest pain (heavy log on low-energy days), so it is featured first. Year-in-Pixels is the most doctor-visit-visible feature. Top-5 is the easiest of the three and carries high signal.

**Final top 3 for implementation:**
1. Lite Log (30-second entry)
2. Year-in-Pixels view
3. Top 5 best vs worst days correlation card

These 3 go to `implementation-notes.md`.

---

## Dependencies and sequencing

- Lite Log and Top-5 can run in parallel.
- Year-in-Pixels depends on mood data volume. Lanae currently has minimal mood_entries rows (daily_logs is scaffold). First rolled out, the grid will be sparse. This is an empty-state challenge, not a blocker.
- Multiple daily entries (rank 4) is a potential fast follow for POTS morning-vs-afternoon tracking.
- Renameable labels (rank 5) is a nice follow-up once Lanae has lived with the default labels and felt friction.

---

## Table cap check

Per design-decisions.md section 14.6, total new table cap is 10 for this push. Daylio implementation proposals:

- Zero new tables for rank 1 (uses existing mood_entries and custom_trackables).
- Zero new tables for rank 2 (uses existing daily_logs, mood_entries, cycle_entries).
- Zero new tables for rank 3 (uses existing custom_trackable_entries and mood_entries).

**Daylio consumes 0 of 10 new tables.** Strong fit within the budget.

---

## Flagged risks

- `mood_entries.UNIQUE(log_id)` blocks multiple entries per day. Blocker for rank 4, not for rank 1 through 3.
- Lanae's existing mood_entries row count is low. Year-in-Pixels will be mostly empty until Lite Log drives daily entry. Sequence Lite Log first.
- Icon rendering library choice: react-icons, Heroicons, or custom SVG set. Must match cream/blush/sage aesthetic, not generic material icons.
