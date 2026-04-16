# LanaeHealth Feature Specs: All Native Trackers

Companion document to the Master Plan. Each section specifies exactly what our version of each tracker looks like, what we steal from the best, what we fix, and what's unique to us.

---

## 1. Period/Cycle Tracker

### Competitors Studied
Natural Cycles (Lanae's current app), Flo (420M downloads), Clue (science-first), Stardust (privacy-first), Apple Health Cycle Tracking

### What We Steal (Best-in-Class Features)
- **From Natural Cycles:** Oura temperature integration, Red/Green day simplicity
- **From Flo:** One-tap symptom logging flow, neural network predictions that improve with data, educational content
- **From Clue:** 200+ trackable factors, DOT fertility algorithm, privacy-first ethos, research partnerships
- **From Stardust:** Privacy architecture (de-identification), fun daily insights
- **From Apple Health:** Wrist temperature integration, 12-month PDF export

### What We Fix (Top User Complaints)
- NC: Too many Red Days early on, cervical mucus data collected but ignored, price doubled
- Flo: Privacy scandal ($56M settlement), aggressive premium upselling, cluttered UI
- Clue: Paywalled ovulation/fertility features that were previously free, data loss bugs
- ALL: Shallow pain tracking, no food/trigger correlation, no doctor-shareable reports, poor irregular cycle handling

### What Makes Us Unique
1. **Multi-signal cycle intelligence** -- BBT + Oura temp + HRV + RHR + cervical mucus + LH in one unified model
2. **Pain body map** -- tap-to-log location, type (sharp/dull/burning/aching/stabbing/pressure), severity 0-10, track multiple simultaneous locations
3. **Food-symptom correlation** -- leverage existing 5,781 MyNetDiary meals to show "pain increases 48h after dairy"
4. **Endometriosis mode** -- bowel symptoms, bladder symptoms, dyspareunia, clot tracking, post-surgical tracking, flare diary
5. **Honest predictions with confidence intervals** -- "Period likely in 3-5 days (85% confidence)" instead of false certainty
6. **Doctor-ready clinical report** -- cycle length history, BBT chart with coverline, luteal phase length, pain-cycle correlation, medication adherence

### Complete Data Model

**Cycle fundamentals:** period start/end, flow per day (spotting/light/medium/heavy), clot presence/size, bleeding type (multiple selection), cycle day (auto)

**Fertility signals:** BBT (manual or Oura), overnight temp trend, LH test (pos/neg/peak), PdG test, cervical mucus (amount + quality), cervical position (for FAM users), sexual activity (protected/unprotected + timing)

**Auto from Oura (already have 1,187 days):** RHR, HRV, sleep stages, temp deviation, respiratory rate

**Symptoms (tap to log, severity where applicable):**
- Pain: cramps, headache, migraine, back pain, pelvic pain, ovulation pain, breast tenderness, joint pain, muscle aches (each with body map option)
- Mood: happy, calm, energized, anxious, irritable, sad, sensitive, mood swings, depressed, angry, weepy
- Energy: high/normal/low/exhausted
- Digestion: bloating, gas, constipation, diarrhea, nausea, acid reflux, pain with bowel movement
- Bladder: frequency, urgency, pain
- Skin: oily, dry, acne, clear/glowing
- Hair: oily, dry, falling out
- Sleep quality: good/fair/poor
- Libido: high/normal/low
- Appetite/cravings

**Medications:** birth control adherence, prescriptions, supplements, pain med usage (type, dose, timing, effectiveness)

**Lifestyle:** exercise type/duration/intensity, stress, alcohol, travel

### Irregular Cycle Strategy
- Never rely on calendar prediction alone
- Multi-signal detection (temp + HRV + mucus + LH)
- Show confidence intervals, not false certainty
- Detect anovulatory cycles and flag them
- Support symptom-based fertility awareness (sympto-thermal) natively
- Say "insufficient data" rather than giving a bad prediction

---

## 2. Calorie/Nutrition Tracker

### Competitors Studied
MyNetDiary (Lanae's current app), MyFitnessPal (200M+ users), Cronometer (accuracy champion), MacroFactor (adaptive algorithm), Lose It, Yazio

### What We Steal
- **From MyNetDiary:** Clean daily logging, comprehensive nutrient tracking, meal-by-meal structure
- **From Cronometer:** USDA-verified database accuracy, deep micronutrient tracking (40+ vitamins/minerals)
- **From MacroFactor:** Adaptive calorie algorithm that adjusts weekly based on weight trends, research-backed approach
- **From MFP:** Barcode scanning, restaurant/chain database coverage, recipe creation
- **From Lose It:** Simple mental model, intuitive UI

### What We Fix
- MFP: Full-screen video ads mid-logging, user-submitted bad data, $20/mo paywall, data breach reputation
- Cronometer: Ads bullying users into subscription, limited macro focus
- MacroFactor: No free tier, no desktop version, no workout integration
- ALL: No food-symptom correlation, no anti-inflammatory/histamine/FODMAP classification, no clinical nutrition for chronic illness

### What Makes Us Unique
1. **USDA FoodData Central API** (380K+ verified foods) as primary database -- not user-submitted garbage
2. **Claude-powered food photo recognition** -- snap a photo of your meal, AI identifies foods and estimates portions
3. **Anti-inflammatory scoring** -- every food gets an inflammation score based on nutrient profile (omega-3 vs omega-6 ratio, antioxidant content)
4. **Trigger classification per food** -- FODMAP category, histamine level, common allergen flags, iron content (absorption enhancers vs inhibitors)
5. **Adaptive calorie algorithm** (like MacroFactor) -- adjusts targets weekly based on actual weight trends
6. **Symptom-food correlation engine** -- "your pain averages 2 points higher on days following high-histamine meals"
7. **Iron absorption optimizer** -- for endo/anemia patients, flag which foods enhance vs inhibit iron absorption at each meal

### Complete Data Model

**Per meal entry:** date, meal type (breakfast/lunch/dinner/snack), food items, portion sizes, calories, macros (protein/fat/carbs/fiber/sugar/sodium)

**Micronutrients (Cronometer-level depth):** iron (heme + non-heme), calcium, vitamin D, vitamin C, vitamin B12, folate, magnesium, zinc, potassium, omega-3, omega-6

**Food classifications (auto-tagged):**
- FODMAP category (low/moderate/high per food)
- Histamine level (low/moderate/high)
- Common allergens (gluten, dairy, soy, nuts, eggs, shellfish)
- NOVA processing score (1-4, from Open Food Facts)
- Anti-inflammatory score (computed from nutrient profile)
- Iron absorption context (enhancer: vitamin C; inhibitor: calcium, tannins, phytates)

**Logging methods (multiple entry paths):**
- Manual text search (USDA database)
- Barcode scan (Open Food Facts + USDA)
- Meal photo AI (Claude Vision)
- Quick-add calories/macros (no food lookup needed)
- Recipe builder (combine ingredients, save as reusable meal)
- Recent/favorites for repeat meals
- Import from MyNetDiary CSV (already built)

**Visualizations:**
- Daily calorie/macro summary with ring/bar charts
- Micronutrient dashboard (% of RDA per nutrient)
- Weekly nutrition trends
- Food-symptom heatmap (which foods correlate with which symptoms)
- Iron absorption report (daily iron intake + absorption context)

### Food Database Strategy
- **Primary:** USDA FoodData Central (380K+ foods, free API, verified data)
- **Secondary:** Open Food Facts (4M+ products, barcode lookup, NOVA scores, additive data)
- **Tertiary:** User-submitted entries (clearly marked as unverified)
- Cache results in `food_nutrient_cache` table (already exists from Medical API Pipeline plan)

---

## 3. Sleep Tracker UI

### Competitors Studied
Oura Ring app (Lanae's wearable), WHOOP, Sleep Cycle, SleepWatch, AutoSleep, Pillow, Apple Health Sleep

### What We Steal
- **From Oura:** Hypnogram visualization, 7-contributor sleep score, full-night HRV graph, Body Clock circular view
- **From WHOOP:** Sleep Need calculation (dynamic based on strain + debt), Sleep Consistency metric, Recovery-to-sleep feedback loop, Sleep Coach bedtime recommendations
- **From Sleep Cycle:** Smart alarm concept, sleep sound library, snoring detection
- **From SleepWatch:** AI insights correlating daytime behaviors to sleep outcomes
- **From AutoSleep:** No-subscription model, customizable sensitivity, clinical data export
- **From Pillow:** Audio event correlation with wake events, chronotype detection

### What We Fix
- Oura: Subscription lock on data YOU collected, non-traditional schedules penalized, generic advisor
- WHOOP: Fails when user gets up at night, too athlete-focused, pricing mess
- Sleep Cycle: Low accuracy without wearable, opaque scoring methodology
- ALL: No chronic illness sleep intelligence, no pain-sleep bidirectional analysis, generic insights

### What Makes Us Unique
1. **Pain-sleep bidirectional analysis** -- "your pain was 7/10 yesterday and deep sleep dropped 40%" + "after nights with <5h sleep, your pain averages 2 points higher"
2. **Flare prediction from sleep patterns** -- ML detecting pre-flare signatures in HRV/temp/sleep data
3. **POTS-specific metrics** -- overnight HR recovery, autonomic stability during sleep, morning orthostatic readiness
4. **Menstrual cycle phase overlay** -- show how luteal vs follicular affects sleep architecture
5. **Fatigue vs sleep quality separation** -- "unrefreshing sleep" as its own metric (hallmark of dysautonomia)
6. **Medication impact tracking** -- before/after comparisons when medications change
7. **Trend-first, score-second UI** -- reduce orthosomnia by showing weekly averages prominently, daily scores below

### Complete Data Model

**Core sleep metrics (from Oura, already synced):** sleep score, total sleep time, sleep efficiency, sleep latency, REM/light/deep/awake time and %, HRV (full night), RHR, respiratory rate, temperature deviation, SpO2, restfulness score, sleep timing

**Manual additions (user-logged):** subjective sleep quality (1-5), sleep notes (free text), wake reasons (pain, bathroom, noise, anxiety, partner, other), nap start/end time, bedtime routine (wind-down activity), sleep environment (room temp, noise level, light level)

**Derived metrics (calculated):**
- Sleep Consistency (bed/wake time regularity over 7 days, like WHOOP)
- Sleep Need estimate (based on activity, sleep debt, menstrual phase)
- Sleep Debt accumulation/recovery
- Unrefreshing Sleep Index (adequate duration + low subjective quality)
- Next-day symptom risk (based on sleep quality + historical patterns)

**Visualizations:**
- **Primary:** Hypnogram (stepped cityscape chart, 5-min intervals, color-coded stages) with HR overlay
- **Secondary:** Sleep timing consistency (vertical bars showing bed/wake patterns across days)
- **Tertiary:** Trend charts (7-day, 30-day rolling averages for all key metrics)
- **Supporting:** Body Clock (24-hour circular view), Sleep score breakdown donut, Cycle phase overlay on sleep trends
- **Chronic illness specific:** Pain-sleep correlation scatter plot, pre-flare sleep pattern detection alert, medication change impact comparison

### Design Principles for Sleep UI
- Trend-first: weekly/monthly averages prominent, daily score secondary
- No score anxiety: use gentle language ("your sleep is trending well" vs "score: 62/100")
- Manual override: let users correct wrong bed/wake times
- Multi-segment support: handle interrupted sleep (common in chronic illness)
- Nap-aware: detect and display naps without penalizing nighttime sleep score

---

## 4. Fitness/Workout Tracker

### Competitors Studied
Strava (cardio/GPS), Strong (strength gold standard), Fitbod (AI workouts), JEFIT (free community), Hevy (social strength), FitrWoman/WILD.AI (cycle-aware), Apple Activity Rings, Visible (chronic illness)

### What We Steal
- **From Strong:** 3-tap set logging, template system, progressive overload tracking, CSV export
- **From Fitbod:** AI workout generation, muscle recovery heat map, equipment adaptability
- **From WHOOP:** Strain-to-recovery feedback loop
- **From WILD.AI:** Cycle-phase-adapted training recommendations across 5 phases
- **From Visible:** Energy budget system, PEM tracking, "do less" philosophy for chronic illness
- **From Strava:** Social sharing (optional), GPS route tracking for walks/runs

### What We Fix
- ALL fitness apps: Assume "more is better" -- punish rest days, no concept of exercise intolerance
- Strong: No AI suggestions, no social features
- Fitbod: Wild weight recommendations, no injury filter, poor retention
- Strava: Not for strength, subscription creep
- Apple Rings: Penalize rest, no recovery intelligence

### What Makes Us Unique
1. **Chronic illness exercise mode** -- built-in "safe exercise ceiling" based on PEM history
2. **Position-aware for POTS** -- tag exercises as recumbent/seated/standing, track graduated progression (Levine/Dallas protocol)
3. **Post-exercise symptom tracking** -- 12-48h follow-up asking "how did you feel after this workout?"
4. **HR delta from resting** -- for POTS, show meaningful context (130 bpm during a walk means something different for POTS vs healthy athlete)
5. **Cycle-phase + chronic condition** -- combine WILD.AI-style cycle awareness with Visible-style illness pacing
6. **Recovery intelligence** -- whole-body recovery factoring autonomic dysfunction, sleep quality, menstrual phase, symptom burden
7. **"Gentle wins" celebration** -- celebrate completing 10-min recumbent bike during a POTS flare, not just PRs

### Complete Data Model

**Per workout:** type (from library + custom), start/end time, duration, exercise position (recumbent/seated/standing/mixed), overall RPE (1-10), pre-workout symptom check (1-5), post-workout symptom check (immediate), notes, cycle day + phase (auto)

**Per exercise (strength):** name, muscle group(s), sets with reps/weight/set type (warmup/working/failure/drop), RPE per set, rest time

**Per exercise (cardio/movement):** activity type, duration, intensity (gentle/moderate/vigorous), HR data (from wearable), distance

**Post-exercise follow-up (12-48h notification):** symptom flare rating 0-10, specific symptoms, recovery time, "would you do this again at this intensity?" (yes/maybe/no)

**Derived metrics:** HR delta from resting, HR recovery at 1min/5min, weekly volume trends, exercise tolerance trend, symptom-exercise correlation, safe ceiling estimate, cycle phase performance patterns

---

## 5. Medication Management

### Competitors Studied
Medisafe (#1 before paywall), CareClinic (chronic illness power tool), Round Health (UX minimalist), MyTherapy (free all-rounder), Apple Health Medications, Theraview (ADHD), Bearable

### What We Steal
- **From Medisafe:** Persistent reminders, Medfriend caregiver alerts, PDF adherence reports
- **From CareClinic:** Medication-symptom correlation engine, PRN tracking with max dose limits, tapering schedules, variable interval scheduling
- **From Round Health:** One-tap confirmation UX, birth control pack flow, forgiving reminder windows
- **From MyTherapy:** Free unlimited medications, injection site tracking, monthly reports
- **From Theraview:** Medication onset/peak/duration visualization curves

### What We Fix
- Medisafe: 2-medication free cap (cruel for polypharmacy), not brain-fog friendly
- CareClinic: Overwhelming complexity, steep learning curve
- Round: No interaction checking, no reports, iOS-only
- ALL: No supplement interaction checking, PRN as afterthought, streak shame, data not linked to symptoms

### What Makes Us Unique
1. **One-tap dose confirmation** -- core action takes exactly one tap
2. **PRN as first-class citizen** -- time-since-last-dose always visible, smart max-dose warnings, frequency trend tracking, PRN-to-symptom correlation
3. **Medication-symptom correlation** -- leverage Intelligence Engine to detect "new symptom started 3 days after dose change"
4. **Wearable-correlated adherence** -- correlate med timing with Oura sleep/HRV/temp changes
5. **No streak shame** -- cumulative adherence %, never streak resets
6. **Free unlimited medications** -- never cap count
7. **Onset/peak/duration visualization** -- Theraview-style curves showing when meds kick in and wear off
8. **Cycle-aware scheduling** -- some meds interact with hormones, some symptoms are cycle-dependent

### Complete Data Model

**Per medication:** name (freetext -- accepts any supplement, compounded med, off-label), dose, unit, route (oral/topical/injection/inhaled/sublingual/other), frequency, scheduled times, prescriber, purpose/reason, start date, end date, refill date, is_prn flag, max_daily_dose (for PRN), taper_schedule (jsonb), special_instructions (before/after meals, etc.)

**Per dose log:** medication_id, scheduled_time, taken_at (actual time), status (taken/skipped/late/missed), skip_reason (forgot/side_effects/cost/ran_out/felt_fine/other), symptom_at_dose (optional quick 1-5 rating)

**Derived metrics:**
- PDC (Proportion of Days Covered) -- gold standard adherence metric
- Taking adherence, regimen adherence, timing adherence (three types)
- PRN frequency trend (daily/weekly/monthly)
- Medication-symptom correlation scores
- Time-to-effect (onset/peak/duration) from user feedback
- Side effect pattern detection

**Interaction checking:**
- Phase 1: Use DailyMed labels (free) + OpenFDA adverse events for safety signals
- Phase 2: Consider DrugBank academic tier or IMgateway for supplement interactions
- Always clearly mark as "informational, not medical advice"

---

## 6. Vitals Tracker

### Competitors Studied
Withings Health Mate, Dexcom G7/Clarity, Abbott Libre/LibreView, Omron Connect, Apple Health Vitals, Google Health/Fitbit, SmartBP

### What We Steal
- **From Withings:** AHA color-coded BP readings, comprehensive body composition display, polished trend graphics
- **From Dexcom Clarity:** AGP (Ambulatory Glucose Profile) standard, 7 report types, Time in Range visualization
- **From Apple Health Vitals:** Multi-metric outlier detection (2+ metrics deviating = alert), personal baseline approach
- **From WHOOP:** Recovery-to-vitals feedback loop
- **From SmartBP:** Tagging system (position, arm, time of day), colorful PDF reports

### What We Fix
- Withings: App updates break features, data loss after updates
- Omron: PDF export broken, email sharing broken, premium paywall, privacy concerns
- Apple Health: Only overnight vitals, no daytime comparison, no clinical-grade data
- ALL: No positional vitals for POTS, no cycle correlation, broken doctor exports

### What Makes Us Unique
1. **Positional vital signs for POTS** -- supine/seated/standing HR and BP with automatic delta calculation (the single most requested POTS feature)
2. **Poor Man's Tilt Table Test** -- guided flow: lie 5-10 min (baseline), stand 10 min, record at 1/3/5/7/10 min, chart the rise/recovery
3. **AGP-style visualization for any continuous data** -- percentile bands for HR patterns, BP patterns, temperature (not just glucose)
4. **Multi-vital outlier detection** -- alert when 2+ metrics deviate from personal baseline simultaneously
5. **Cycle phase overlay on all vitals** -- show how menstrual phase affects HR, BP, temp, HRV
6. **Doctor-ready PDF** -- AHA categories, positional deltas, medication timing context, trend over weeks

### Complete Data Model

**Blood pressure:** systolic, diastolic, pulse, position (supine/seated/standing), arm (left/right), time of day, medication_timing (before/after dose), context tags (resting/post-exercise/stressed), AHA category (auto-calculated)

**Heart rate (beyond Oura auto-sync):** manual readings with position tag, orthostatic test results (supine + standing sequence)

**Blood glucose (for CGM integration):** reading, time, meal context (fasting/pre-meal/post-meal/bedtime), trend arrow (rising/stable/falling), source (Dexcom/Libre/manual)

**Body composition (manual or from Withings/smart scale):** weight, body fat %, muscle mass, body water %, bone mass, visceral fat rating, BMR

**Temperature:** BBT (manual oral), wearable overnight temp (Oura), fever check (manual), temp deviation from baseline

**Derived metrics:**
- Orthostatic HR delta (standing - supine)
- Orthostatic BP delta
- BP morning/evening pattern
- Time in Range (for glucose)
- GMI (Glucose Management Indicator)
- Weight trend (7-day, 30-day moving averages, filtering daily fluctuations)
- Body composition trends
- Multi-vital outlier score (Apple-style)

**Visualizations:**
- BP trend chart with AHA color zones
- Positional vital comparison (side-by-side supine/seated/standing)
- Tilt table test chart (HR over 10 minutes of standing)
- AGP-style percentile bands for HR/BP/temp patterns
- Body composition stacked trend (weight broken into fat/muscle/water)
- Weight trend with smoothed line + raw data points
- Glucose Time in Range colored bars (if CGM data present)

---

## Cross-Cutting Design Principles

1. **Every tracker is independently toggleable** -- users enable what they need
2. **Import-only mode available for every category** -- aggregator users see imported data without native logging UI
3. **All data feeds the correlation engine** -- regardless of source (native vs imported)
4. **All data feeds the Intelligence Engine** -- 6 personas analyze everything
5. **Doctor-ready export from every category** -- one-tap PDF with clinically formatted data
6. **Warm Modern aesthetic throughout** -- cream/blush/sage, never clinical white
7. **No ads, no aggressive paywalls, no streak shame**
8. **Brain-fog accessible** -- core actions in 1-3 taps, progressive disclosure for detail
9. **Mobile-first (375px)** -- but fully functional on desktop
10. **Privacy by architecture** -- all data in user's Supabase, zero third-party analytics
