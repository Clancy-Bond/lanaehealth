# Vitals Tracking (BP, HR, Glucose, Temp, Weight) -- Competitive Analysis

Last updated: Apr 2026
Research sources: r/POTS, r/Diabetes, r/Hypertension, r/CGM, Withings/Dexcom/Omron user reviews, POTS diagnosis protocols

---

## Withings Health Mate (4.4/5, scale/BP/watch ecosystem)

**LOVE**
- AHA color-coded BP readings (green/yellow/orange/red)
- Body composition from single scale step-on
- Clean trend graphics
- Broad device ecosystem (scale, BPM, scanwatch)
- No subscription needed (pay-for-hardware model)
- Sleep tracking (Sleep Analyzer under mattress)
- Arterial health insights

**HATE**
- 2024 app rebrand lost data and features (major backlash)
- Sleep tracking accuracy inconsistent
- Syncing unreliable (Bluetooth + Wi-Fi issues)
- BP cuff positioning errors not flagged
- Basic trend analysis (no ML insights)

---

## Dexcom G7 / Clarity (gold standard CGM)

**Why it's the clinical standard**
FDA-cleared continuous glucose monitor. 5-minute readings. Integrates with Clarity cloud + Tidepool + many apps.

**LOVE**
- 14-day wear with no fingersticks
- 5-minute glucose readings
- Gold standard for Type 1 diabetes
- AGP (Ambulatory Glucose Profile) -- percentile band standard
- Time in Range (70-180 mg/dL) calculation
- 7-day/14-day/30-day views
- Clinical-grade accuracy
- Share with caregivers/doctors

**HATE**
- App crashes requiring reinstall
- Expensive without insurance ($300+/mo)
- Sensor adhesive skin irritation
- Pairing issues with pumps
- Over-engineered for non-diabetes users

---

## Abbott Libre / LibreView (CGM, competitor to Dexcom)

**LOVE**
- Cheaper than Dexcom
- 14-day wear
- No fingersticks
- AI food guidance (Libre Assist 2026)
- Epic EHR integration

**HATE**
- Missing overlay/spaghetti graph (Dexcom has this)
- Can't filter by day of week
- Limited customer support hours
- FDA disputes with Abbott in 2024

---

## Omron Connect (BP monitor app, 4.2/5)

**LOVE**
- Bluetooth auto-sync BP readings
- AHA color coding
- EKG on premium models
- Unlimited data storage

**HATE (from 2025 reviews)**
- APP UPDATES BROKE PDF EXPORT in Feb 2025
- Email sharing to doctors stopped working
- $99/yr premium paywall angered users
- 10+ taps to transfer a single reading
- Privacy concerns (data sharing settings unclear)

---

## Apple Health Vitals (iOS 18+, free)

**Why it matters**
Built-in. Aggregates overnight heart rate, respiratory rate, wrist temperature, blood oxygen, sleep into one Vitals card. Multi-metric outlier detection.

**LOVE**
- Free, built-in
- Unified 5-metric overnight card
- Multi-metric outlier detection (if 2+ metrics deviate, alert fires)
- Personal baseline approach (not population norms)
- Passive tracking
- Privacy-first (on-device)

**HATE**
- Only overnight vitals (no daytime)
- No absolute temperature (only deviation)
- Requires Apple Watch 8+
- Not clinical-grade (disclaimer everywhere)
- Limited export

---

## SmartBP / Blood Pressure Monitor apps

Generic BP tracking apps. Most have:
- Simple manual entry
- Chart over time
- CSV/PDF export
- Occasional Bluetooth integration

Complaints: limited features, paywall for reports, generic UI.

---

## POTS-Specific Gap

**None of the mainstream vitals apps do positional vitals well.**

Clarity DTX POTS Tracker is the closest, but it's a standalone niche app with:
- Supine/seated/standing HR logging
- Orthostatic delta calculation

This is the #1 most-requested feature in r/POTS. Mainstream apps don't touch it.

---

## What No App Does Well

1. **Positional vital signs** (supine/seated/standing HR with delta)
2. **Poor Man's Tilt Table Test** (guided 10-min standing test)
3. **AGP-style percentile bands for ANY vital** (Dexcom has it for glucose, no one for HR/BP/temp)
4. **Multi-vital outlier detection** (Apple has it but iOS-only, Oura-free)
5. **Cycle phase overlay on vitals** (HRV differs luteal vs follicular, no app shows this)
6. **Orthostatic trend analysis** (30-day delta trajectory: improving/stable/worsening?)
7. **Doctor-ready PDF that works** (Omron broke theirs)
8. **Integration between BP + HR + glucose + temp + HRV**

## LanaeHealth Edge

- Positional vitals intelligence with:
  - Supine/seated/standing HR and BP logging
  - Automatic orthostatic delta calculation
  - POTS threshold detection (30+ bpm rise flagged)
  - Classification (normal / elevated / POTS / significant)
- Poor Man's Tilt Table Test guided flow:
  - Lie 5-10 min (baseline)
  - Stand 10 min with HR at 1/3/5/7/10 min checkpoints
  - Auto-calculation of max standing HR delta
- AHA blood pressure classification (normal/elevated/stage1/stage2/crisis)
- 30-day orthostatic trend (improving/stable/worsening direction)
- Multi-vital outlier detection (z-score based, alerts when 2+ metrics deviate from baseline)
- AGP-style percentile bands for HR and HRV (extending Dexcom's glucose standard)
- Cycle phase overlay on all vitals
- Integration with Dexcom + Libre CGM data
- Withings scale integration (weight, body composition)
- Doctor-ready clinical report with positional vitals, trends, and tilt test results
- Zero broken export functionality (unlike Omron)
