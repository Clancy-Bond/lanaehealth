# Sleep Tracking -- Competitive Analysis

Last updated: Apr 2026
Research sources: r/ouraring (200K+ members), r/whoop, r/sleephackers, r/quantifiedself, App Store reviews, sleep medicine research papers, polysomnography validation studies

---

## Oura Ring (Lanae's wearable, market leader)

**Why it's the gold standard**
Best-in-class hardware + app. Ring form factor is discreet. Continuous temperature tracking is unique. Sleep staging accuracy validated against polysomnography at 79% agreement (best consumer device).

**LOVE**
- Accurate sleep stages (light/REM/deep/awake)
- Full-night HRV graph (no other wearable)
- Sleep score with 7 contributors
- Body Clock visualization
- Resting HR, respiratory rate, SpO2, temperature
- 7-day battery life
- Comfortable to wear (no screen = no distraction)
- Integrates with Apple Health, Natural Cycles, others
- Period prediction from temperature
- Illness detection from overnight vitals
- Symptom Radar (morning alert when readiness drops)

**HATE**
- $5.99/mo subscription to access YOUR data (added in 2024)
- Subscription required for advanced features (AI advisor, trends)
- Generic/shallow AI advisor output
- Non-traditional schedules (shift workers) penalized
- Orthosomnia risk (sleep anxiety from score)
- Ring sizing issues
- Occasional wrist/heat sensor errors

**WISH**
- Free tier for owned data
- Better shift-worker support
- Personalized AI insights
- Direct doctor export

---

## WHOOP (4.5/5 iOS, subscription-only)

**LOVE**
- Dynamic Sleep Need calculation (adjusts for strain + debt)
- Sleep Consistency score (bed/wake regularity)
- Recovery score from HRV
- Sleep Coach with bedtime recommendations
- No device cost (pay $30/mo for hardware + software)
- Polysomnography-validated

**HATE**
- Fails to track sleep when user gets up at night
- Thick wristband
- No display (must open phone)
- Pricing tiers confusing
- Over-athletic focus (annoying for general health users)
- $30/mo is steep vs Oura $5.99

---

## Sleep Cycle (50M+ downloads, 4.7/5)

**LOVE**
- Sound-based tracking (no wearable needed)
- Smart alarm wakes during light sleep
- Sleep sound library
- "Who's Snoring?" partner distinction (unique)
- Snoring audio playback (eye-opening for users)

**HATE**
- Phone-based tracking is less accurate
- Opaque scoring methodology
- Subscription for advanced features
- Requires phone near bed
- Battery drain

---

## SleepWatch (Apple Watch AI, 4.6/5)

**LOVE**
- AI-powered personalized insights
- Correlates daytime behaviors (caffeine, exercise) to sleep outcomes
- Apple Watch native

**HATE**
- Subscription required for insights
- Less polished than Oura
- Apple Watch only
- Battery drain

---

## AutoSleep ($5 one-time, 4.7/5)

**LOVE**
- One-time purchase (no subscription!)
- Customizable sensitivity for non-traditional schedules
- Clinical-grade data export
- Respected in quantified-self community
- Works with existing Apple Watch

**HATE**
- Complex UI, steep learning curve
- Apple Watch only
- Limited AI/insights (just data)

---

## Apple Health Sleep (iOS 16+, free)

**LOVE**
- Free, built-in
- Reasonable accuracy with Apple Watch
- Privacy-first (on-device)
- Integrates with Health Records

**HATE**
- Limited insights
- No patterns/correlations
- Basic charts
- Can't export structured data easily

---

## What No App Does Well (Chronic Illness Gaps)

1. **Pain-sleep bidirectional analysis** -- "pain 7/10 yesterday, deep sleep dropped 40%"
2. **Flare prediction from sleep patterns** -- ML detecting pre-flare sleep/HRV/temp changes
3. **POTS-specific metrics** -- overnight autonomic stability, morning orthostatic readiness
4. **Menstrual cycle phase overlay** -- luteal sleep quality differs from follicular
5. **Unrefreshing sleep index** -- adequate duration + low subjective quality (dysautonomia hallmark)
6. **Medication impact comparison** -- before/after medication changes
7. **Hypnogram reconstruction** -- all apps use their own data, no cross-device unification
8. **AGP-style percentile bands for sleep** -- typical sleep pattern visualization

## LanaeHealth Edge

- Self-fetching Hypnogram reconstructs sleep stages from Oura aggregates with realistic cycle pattern (early cycles = more deep, later cycles = more REM)
- SleepOverview with trend-first UI (7-day average prominent, reduces orthosomnia)
- Pain-sleep bidirectional correlation display
- Cycle phase overlay on sleep trends (shows luteal vs follicular differences)
- Unrefreshing Sleep Index (unique metric for dysautonomia patients)
- Sleep Debt (14-day accumulation + recovery trend)
- Sleep Consistency (bed/wake regularity score)
- Dynamic Sleep Need estimation (adjusts for activity, debt, cycle phase, illness recovery)
- No subscription lock on existing Oura data (shows what you're already paying Oura to collect)
- Integrates with broader correlation engine (symptoms, food, cycle)
- Doctor-ready sleep section in clinical reports
