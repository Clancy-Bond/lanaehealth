# Bearable Feature Plan for LanaeHealth

Ranked by `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8.

Top 3 flagged for implementation-notes.md.

---

## Ranked feature table

| Rank | Feature | Source pattern | Impact (1-5) | Effort | Depends on | Score | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Plain-English insight card with r-value and lag | Insight cards / correlation engine narrative | 5 | S | existing correlation_results | 10.0 | **TOP 3.** No new tables. Reads existing `correlation_results`. New InsightCard component + Claude-templated sentence generator. Straight win. |
| 2 | PRN post-dose efficacy polling | PRN efficacy + delayed prompts | 5 | M | medication_reminders, push_subscriptions (012) | 5.0 | **TOP 3.** New `medication_effectiveness` table. Schedules push 90 min after PRN log; 2-tap response stored as time series. |
| 3 | Non-shaming logging audit (kill streak language) | Non-shaming UX | 5 | S | none | 10.0 | **TOP 3 tie.** Static content sweep across Log, Home, onboarding copy. Verify no streak counters or "missed day" warnings. Update CHECK IN reminders copy. Set design rule formally in CLAUDE.md. |
| 4 | Flare-mode collapsed log layout | Quick-log drawer | 5 | M | FlareToggle + QuickLogSheet | 5.0 | When FlareToggle on, auto-hide non-essential sections; store user's flare template choice. |
| 5 | Lag-aware correlation surfacing (1-day, 2-day, 3+ day badges) | Correlation lag analysis | 5 | M | correlation_results columns already exist | 5.0 | Add lag_days badge to CorrelationCards. Minor Intelligence engine tweak if lag isn't fully computed yet. |
| 6 | Trackable templates for POTS, endo, thyroid, sleep | Blank-slate customization | 4 | M | custom_trackables | 4.0 | One-tap "Apply POTS bundle" creates 8-10 trackables. Stored as static JSON in `/src/lib/trackable-templates.ts`. |
| 7 | Trackable grouping (parent category column) | Blank-slate + flat-library complaint | 4 | S | custom_trackables schema | 8.0 | Small additive migration: add `parent_group` text column. UI shows collapsible sections. Could merge into rank 6 work. |
| 8 | Stacked chart with synchronized time axis | Chart stacking | 4 | M | TrendChart, SleepOverview | 4.0 | New StackedTrendChart component. Shared hover state across sub-charts. |
| 9 | Supplement effectiveness time series (not just single rating) | Supplement effectiveness rating | 5 | M | overlaps with rank 2 | 5.0 | Extension of rank 2 but for non-PRN daily supplements. Prompt once per 2-week cycle. |
| 10 | Monthly summary card | Monthly summary | 3 | M | correlation_results, daily_logs | 3.0 | Home-page or Patterns-page card showing best week / worst week / top 3 correlations this month. |
| 11 | Icon picker for custom trackables | Icon-first identification | 2 | S | custom_trackables.icon | 4.0 | Pleasant grid of icons in create-trackable modal. Polish. |
| 12 | Voice-to-text structured logging | Voice entry wish-list | 3 | L | VoiceNote, Claude parsing | 1.5 | Parse free speech into logged fields. High user value for flare days but complex. |
| 13 | Export enhancement (one-tap PDF for upcoming appointments) | Doctor export | 3 | S | existing Doctor Mode | 6.0 | Add button to Home/Appointments: "Prep report for Apr 30 OB/GYN." Auto-selects date range. |
| 14 | Factor interaction warnings | Interaction warnings | 2 | L | medical-apis pipeline | 1.0 | Widely criticized in Bearable. Skip. |
| 15 | Web-mobile parity polish | Web + mobile parity | 4 | S | Patterns page mobile responsive audit | 8.0 | Audit chart components for mobile usability. Already mostly there. |

---

## Top 3 selected for implementation

By score and strategic fit:

**1. Plain-English insight card with r-value and lag** (score 10.0, S effort, impact 5)
- Biggest bang per unit of work. We already have the correlation data. What's missing is the surfacing.
- Touches Patterns page primarily. Optional secondary surface on Home.

**2. Non-shaming logging audit (kill streak language)** (score 10.0, S effort, impact 5)
- Zero-code risk, protective of Lanae's chronic illness reality.
- Includes copy-sweep, CLAUDE.md rule update, verification.

**3. PRN post-dose efficacy polling** (score 5.0, M effort, impact 5)
- Highest-impact new capability. PRN escalation detection needs this data.
- Uses existing push_subscriptions from migration 012. One new table.

Ranks 1 and 2 both score 10.0 because impact is 5 and effort is S. Rank 3 is selected over equally-scored ranks 7 and 13 because impact is 5 vs their 4 and 3.

---

## Not selected, rationale

- Rank 4 (flare-mode collapsed log) is a very strong feature but overlaps with Top 3 in spirit; defer to next wave.
- Rank 5 (lag badges) could fold into rank 1 if lag isn't already displayed. Check during implementation.
- Rank 6-7 (templates + grouping) are good but non-urgent; Lanae has her core trackables set up.
- Rank 12 (voice structured logging) is exciting but too speculative for this wave.

---

## Red flags for main session

1. **Correlation data freshness.** Lanae's `correlation_results` has 8 rows but their `computed_at` timestamps need verifying before we build an insight card that might display stale data. Main session should trigger an analysis_runs refresh before rank 1 ships.

2. **Push notification platform parity.** iOS PWA push is flaky vs native. PRN efficacy polling depends on reliable delivery. Main session should confirm which channels Lanae has set up in her push_subscriptions table.

3. **PRN dose logging granularity.** Current medication-adherence schema captures doses but does it capture the exact timestamp needed for 90-minute-later scheduling? Verify before rank 3 implementation starts.

4. **"Non-shaming" audit scope.** No existing streak UI is known, but the check-in reminder copy has not been swept recently. This is fast to verify.

5. **Insight card surfacing decision.** Rank 1 could live on Patterns only, or also elevate one finding to Home. Deferred to main session / Lanae.
