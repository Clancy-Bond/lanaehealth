# All-in-One Health Apps -- Competitive Analysis

Last updated: Apr 2026
Research sources: r/appleWatch, r/GoogleFit, r/samsung, r/quantifiedself, Apple developer forums, Samsung Health user reviews, Google Fit deprecation discussions

---

## Apple Health (pre-installed iOS, free)

**Why it's the default**
Every iPhone owner has it. Aggregates from Apple Watch + every HealthKit-compatible app.

**LOVE**
- Free, built-in, no setup
- On-device processing (strong privacy)
- Health Records integration (FHIR with US providers)
- Apple Watch native (Series 8+ has wrist temperature)
- Sleep Focus mode
- PDF export for doctors
- Apple Health Vitals card (iOS 18+, multi-metric outlier detection)
- Clean unified UI
- Accepts data from 1,000+ apps (Oura, MyFitnessPal, Withings, etc.)
- iOS 17+ Medication tracking with interaction warnings
- Cycle tracking with retrospective ovulation estimates

**HATE**
- NO backend API for cross-device web access
- No food database (must use 3rd party)
- No AI insights or patterns
- Cumbersome manual logging
- Killed Apple Health+ (AI coach promised 2023, never shipped)
- Siloed on iOS (no Android, no web)
- Limited export formats (XML only, no CSV/FHIR easily)
- Generic UI (can't customize for specific conditions)
- No partner/caregiver sharing (except Health Records invites)
- Requires Apple Watch for most features

**WISH**
- Web dashboard
- Third-party app for web access to your own data
- Better insights/AI
- Food database
- Cross-device via cloud

---

## Google Fit / Health Connect (Android, free)

**Current state (post-deprecation)**
Google Fit API deprecated. Google Health Connect is the replacement (Android-only, on-device aggregator).

**LOVE**
- Free, pre-installed on many Android devices
- Health Connect unifies Fitbit, Samsung Health, apps
- Strong Android integration
- 2026: AI health coach preview
- CGM integration coming 2026

**HATE**
- Google Fit deprecation chaos (confusing migration)
- Health Connect doesn't sync with Samsung Health (huge fragmentation)
- One-way syncs mostly
- Strava and Garmin don't integrate with Health Connect directly
- Requires third-party sync apps
- Andriod-only
- Google's product killer reputation (trust issue)

**WISH**
- Samsung data access
- Bidirectional sync
- Stable standard that won't be deprecated

---

## Samsung Health (pre-installed on Samsung, free)

**LOVE**
- Deep Samsung Galaxy Watch integration
- Broad metric coverage (steps, sleep, HRV, BIA body composition, BP with Active 2)
- Food tracking built-in
- Women's health tracking

**HATE**
- Designed for Samsung lock-in
- Blocked partner apps from writing step data in 2020
- Won't sync to Health Connect (despite being Android flagship)
- Data gets stuck in Samsung ecosystem
- Limited export
- iOS version is crippled vs Android

**WISH**
- Open data sharing with Health Connect
- Less proprietary lock-in
- Feature parity on iOS

---

## Why All-in-One Apps Fail at the Promise

They call themselves "all-in-one" but:
- **Apple Health** aggregates but can't analyze. Mountains of data with no insights.
- **Google Fit** aggregates but Google abandoned it.
- **Samsung Health** aggregates within Samsung's walled garden only.
- None have food tracking worth using (Samsung has one but limited)
- None have symptom tracking or chronic illness support
- None offer clinical intelligence or AI-driven correlations
- None produce doctor-ready reports
- None handle medication management beyond basic reminders
- None have cycle tracking with multi-signal intelligence
- None integrate with medical record parsing (CCDA, FHIR)

The pattern: they are **infrastructure, not solutions**. That's why 10 specialized apps exist on top of them.

---

## The 10+ App Problem

Typical chronic illness patient's phone (2026):
1. Apple Health (passive aggregation)
2. Oura (sleep/recovery)
3. Natural Cycles (contraception/cycle)
4. MyFitnessPal or MyNetDiary (nutrition)
5. Bearable (symptoms)
6. Medisafe (medications) -- or refugee from 2026 paywall
7. Dexcom or Libre (if CGM user)
8. Withings (if scale/BP owner)
9. Strava (if active)
10. Epic MyChart or hospital patient portal

Each collects data in isolation. No cross-correlation. No unified view. No doctor-ready summary. User manually tries to connect dots.

This is the gap LanaeHealth fills.

---

## LanaeHealth Edge

**We aggregate like Apple Health but:**
- Analyze like no one else (6 clinical personas, 34 medical APIs, Claude reasoning)
- Universal Import Engine accepts ANY file format (FHIR, C-CDA, PDFs, screenshots, CSVs, photos)
- 8 wearable connectors (Dexcom, WHOOP, Garmin, Withings, Fitbit, Libre, Strava, SMART on FHIR)
- Native food, symptom, cycle, medication, vitals, fitness tracking (not just aggregation)
- Web-accessible from any device (not locked to one ecosystem)
- Doctor-ready clinical reports per condition (endo, POTS, IBS)
- Modular architecture: users enable/disable features per preference
- 12 condition-specific presets
- Zero ads, zero aggressive paywalls
- Patient-first privacy (all data in user's Supabase)

**The vision**: one app that replaces 8 out of 10 in that list, and aggregates the remaining 2 (Oura + patient portal) via integrations.
