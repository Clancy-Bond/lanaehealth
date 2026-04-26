# Post-Deploy Smoke Test Checklist

**Use after each Vercel deploy.** Works the app end-to-end as Lanae would.

Deploy URL: https://lanaehealth.vercel.app

---

## Part 1: Pages render (no login assumed)

- [ ] `/` (home) loads in < 5s, shows SmartCards, AdaptiveMovementCard, BaselineCard, FavoritesStrip
- [ ] `/log` loads, shows EnergyModeToggle + RestDayCard + LiteLogCard + HeadacheQuickLog + NutrientRollupCard
- [ ] `/patterns` loads, shows InsightCardList + CyclePredictionCard + MenstrualMigraineCard + NutrientLabAlertsCard + YearInPixels + BestWorstDaysCard
- [ ] `/doctor` loads with pageData, shows findings + timeline
- [ ] `/doctor/cycle-report` renders with Lanae's real cycle stats, printable
- [ ] `/doctor/care-card` renders emergency summary + QR button
- [ ] `/settings/privacy` renders 3 toggles + export button
- [ ] `/records` shows labs tab with sparkline trends + ref-range shading
- [ ] `/imaging` iframe loads PACS viewer
- [ ] `/chat` loads

## Part 2: New Wave 2 features work

### Headache logging
- [ ] Click "I have a headache right now" on /log
- [ ] Timer starts, severity slider works
- [ ] HeadZoneMap shows 10 zones, tapping highlights them with severity color
- [ ] Aura picker: click motor → advisory banner appears with "contact your doctor" language
- [ ] Close without losing data (optimistic save)
- [ ] End attack → record lands in `headache_attacks`

### Energy + Rest Day
- [ ] Toggle energy mode (Minimal/Gentle/Full) - persists on reload
- [ ] Mark rest day - positive frame, no shame copy
- [ ] Rest day row excluded from adherence denominators in `/intelligence`

### Care Card
- [ ] Generate share URL from /doctor/care-card
- [ ] Open URL in private window - shows summary, no auth required
- [ ] Token expires in 7 days (check expiry timestamp)
- [ ] QR renders correctly

### Privacy + Export
- [ ] Toggle "Share data with Claude" OFF
- [ ] Ask a question in /chat - response lacks patient context (fails closed)
- [ ] Toggle back ON
- [ ] Click "Download all data" - ZIP downloads with CSVs + README

### Cycle Health Report
- [ ] Visit /doctor/cycle-report
- [ ] Confirm cycle length + luteal length match NC data
- [ ] Short luteal (<10 days) flagged in red
- [ ] Print preview looks clean (@media print CSS)

### Plain-English Insight Cards
- [ ] /patterns shows r-value + lag badges
- [ ] At least 3 cards render (enough confident insights)
- [ ] `computed_at` freshness shown

### Nutrient x Lab Alerts
- [ ] /patterns shows NutrientLabAlertsCard
- [ ] Lanae's iron (low ferritin + low iron intake) fires an alert
- [ ] Action copy is observation, not diagnosis

### Micro-Care Drawer
- [ ] From /log or designated entry, open drawer
- [ ] 10 actions listed (salt, hydrate, elevate legs, heat pad, breathing, grounding, stretch, cold wrist, compression, legs-up-wall)
- [ ] Tap "Box breathing" → 4-4-4-4 cycle animates
- [ ] Complete action → stored in `micro_care_completions`

### AI Nutrition Coach
- [ ] Ask "What should I eat more of this week?"
- [ ] Response grounded in food_entries + cycle phase
- [ ] No diet prescriptions, sources cited

## Part 3: Voice rule enforcement

- [ ] `npm run check:voice` locally returns exit 0
- [ ] Grep site for "streak" - should only hit `/doctor` clinical report (pragma allowed)
- [ ] No "missed X days" hero copy on home

## Part 4: Database integrity

- [ ] `select count(*) from headache_attacks` - 0 on first run, increments on log
- [ ] `select count(*) from daily_logs where rest_day = true` - 0+ after toggling
- [ ] `select count(*) from user_nutrient_targets` - 25 RDA rows after seed
- [ ] `select count(*) from weather_daily` - populates after `/api/weather/sync` POST
- [ ] `select count(*) from cycle_engine_state` - rows after runCycleEngine executes

## Part 5: Performance

- [ ] Home page < 5s cold load
- [ ] `/patterns` < 10s cold load (lots of charts)
- [ ] No console errors in browser devtools
- [ ] No hydration mismatches

## Part 6: Accessibility

- [ ] Touch targets >= 44px on mobile viewport
- [ ] Warm modern palette renders correctly (cream bg, sage accents)
- [ ] No em dashes in any rendered copy

---

## Known issues (not gated)

- F7 PRN post-dose poll: mount into medication-logging flow not yet wired
- D5 ConditionTagSelector: wired into symptom UI location unverified
- D1+F6 Unified Timeline: scaffold components exist, /records still uses 4-tab layout
- 12 pre-existing tests fixed by D4 cover-page integration (`db36029`)

---

## Abort conditions

If ANY of these are true, revert the deploy:

- /, /log, /patterns, or /doctor return 500
- Supabase queries return permission-denied for Lanae's patient_id
- Any page leaks patient data when `allow_claude_context=false`
- Build time > 3 min on Vercel

---

## Re-run

After any hotfix, run this checklist again from the top. Append findings below the abort-conditions section with timestamp.
