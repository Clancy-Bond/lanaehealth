# Guava Health - Feature Plan for LanaeHealth

Ranked by `(impact * 2) / effort-score` where effort S=1, M=2, L=4, XL=8.

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Notes |
|---|---|---|---|---|---|---|
| 1 | Multi-Specialist Unified Timeline (enhanced) | Pattern 1 | 5 | M | existing appointments, medical_timeline, lab_results, imaging_studies, active_problems tables | FLAGGED for implementation. Upgrade existing `/timeline` page: add provider filter, color-code by specialty, cross-type merge, "past 3 months" default with "all time" toggle. No new tables. Read-only from existing data. |
| 2 | Pre-Visit Doctor Prep Sheet | Pattern 3 | 5 | M | existing `/doctor`, appointments, daily_logs, lab_results, active_problems, Claude context assembler | FLAGGED for implementation. New subroute `/doctor/pre-visit/[appointmentId]`. Generates top-3 summary plus optional full packet. Screenshot-ready mobile mode for in-office viewing. |
| 3 | Multi-Year Lab Trend Sparklines | Pattern 2 | 5 | M | existing lab_results, Recharts | FLAGGED for implementation. Each lab marker gets per-marker sparkline with reference range shaded, delta-from-baseline indicator. Add to `/records` lab detail. Use useRef width per CLAUDE.md rule, not ResponsiveContainer. |
| 4 | Condition Network Graph | Pattern 4 | 4 | L | active_problems, gene_disease_network, new graph component | New page section or sub-view under `/patterns` or `/intelligence`. Graph viz of Lanae's 6 problems with evidence-tier edges. Claude-generated edges require citations. High risk of LLM hallucination, must enforce cite-or-suppress. |
| 5 | Family History Tree | Pattern 5 | 4 | L | new `family_history` table (migration 013) | New section under `/profile`. 3-generation pedigree SVG. One-time entry. Auto-surface relevant conditions per upcoming specialist. New additive migration. |
| 6 | Voice Symptom Capture | Pattern 6 | 4 | M | existing `/log`, Web Speech API, Claude structuring | Mic button on `/log`. Browser transcription, Claude parses to structured symptom, user confirms before save. No audio storage. Writes to existing `symptoms` or `daily_logs`. |
| 7 | Second Opinion PDF Assembly | Pattern 7 | 4 | L | `/doctor`, context assembler, PDF library | "Export for New Provider" button on `/doctor` or `/records`. Assembles standardized packet via context assembler with specialty-specific system prompt. Requires cite-every-claim enforcement. |
| 8 | Insurance Denial Tracker | Pattern 8 | 3 | L | new `insurance_denials` table | Log denial, generate appeal template, track deadlines. US-focused. Lanae has MRI Brain 2027 as potential trigger case. Deferred. |
| 9 | Generic Record Upload + Parse | Pattern 9 | 3 | XL | OCR pipeline, Claude extraction, documents table | Existing CCD parser covers most Lanae cases. Arbitrary PDF parsing is a long tail. Deferred. |
| 10 | Privacy Posture Documentation | Pattern 10 | 3 | S | new `/privacy` page, docs | Foundational, not differentiating alone. Separate docs task. |

---

## Ranking computation

Formula: `(impact * 2) / effort-score`. S=1, M=2, L=4, XL=8.

| Feature | (Impact x 2) / Effort | Score |
|---|---|---|
| Multi-Specialist Unified Timeline | (5 x 2) / 2 | 5.0 |
| Pre-Visit Doctor Prep Sheet | (5 x 2) / 2 | 5.0 |
| Multi-Year Lab Trend Sparklines | (5 x 2) / 2 | 5.0 |
| Voice Symptom Capture | (4 x 2) / 2 | 4.0 |
| Condition Network Graph | (4 x 2) / 4 | 2.0 |
| Family History Tree | (4 x 2) / 4 | 2.0 |
| Second Opinion PDF Assembly | (4 x 2) / 4 | 2.0 |
| Privacy Posture Docs | (3 x 2) / 1 | 6.0 (but 3 stars so lower prio than tied 5s) |
| Insurance Denial Tracker | (3 x 2) / 4 | 1.5 |
| Generic Record Upload + Parse | (3 x 2) / 8 | 0.75 |

Three features tie at 5.0: Multi-Specialist Unified Timeline, Pre-Visit Doctor Prep Sheet, Multi-Year Lab Trend Sparklines. Privacy Posture Docs scores 6.0 but is 3-star impact - documentation task, not app feature. Skipping from implementation scope.

## Top 3 selected (go to implementation-notes.md)

1. Multi-Specialist Unified Timeline (enhanced)
2. Pre-Visit Doctor Prep Sheet
3. Multi-Year Lab Trend Sparklines

All three are Medium effort, read-only on existing tables, no new migrations required. Enables shipping the whole Guava-inspired batch in one cycle without touching the 10-table migration cap.
