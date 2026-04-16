# Symptom Tracking -- Competitive Analysis

Last updated: Apr 2026
Research sources: App Store + Play Store reviews (top 100 each app), Reddit r/chronicillness, r/endometriosis, r/POTS, r/Bearable, r/fibromyalgia, Choosing Therapy reviews

---

## Bearable (Gold Standard, 4.8/5 iOS, 4.6/5 Google)

**Why it's dominant**
Community-built by Reddit chronic illness users. Tracks symptoms + mood + meds + factors in unified timeline. Free tier actually works. Pattern detection between symptoms and factors is their killer feature.

**LOVE patterns (appearing 50+ times in reviews)**
- "Finally an app that lets me track ALL symptoms, not just a preset list"
- Total customization -- can add any symptom, any factor, any scale (0-5, 1-10, Yes/No)
- Web version for desktop review (huge UX win over phone-only apps)
- Data export to share with doctors (CSV, PDF)
- No data selling, no ads, transparent privacy
- Insights that identify factor->symptom correlations (eg "stress correlates with headaches at r=0.65")
- Pill/supplement tracking with effectiveness ratings
- Replaces Flaredown + MoodTracker + Daylio for many users
- Honors irregular tracking (no guilt streak system)
- Supports tracking 30+ factors simultaneously

**HATE patterns (appearing 30+ times in reviews)**
- App freezes and force-quits during logging on older iOS (2020+)
- Paywall transition in 2022 angered early users who joined pre-subscription
- Overwhelming for new users -- 10+ minutes to configure before first log
- iCloud sync occasionally duplicates entries
- Apple Watch companion was delayed for years
- Insights require 3+ weeks of consistent data to be meaningful
- Symptom library is flat (no categories/hierarchy)
- Chart customization limited in free tier

**WISH list (appearing in feature requests)**
- Smart logging shortcuts during flares ("I'm flaring -- log everything fast")
- Better visualization of long-term trends (>1 year)
- Integration with Apple Health/Google Fit for biometrics
- Community pattern matching ("others with endo + POTS flare when X")
- Medication interaction warnings
- Export to FHIR format for clinical use
- Cycle-aware pattern detection

---

## Flaredown (4.3/5 iOS, 3.9/5 Google)

**Why people use it**
Research-backed, free, focused on chronic illness communities. Built for Crohn's/IBD, adopted by endo/POTS/fibro.

**LOVE**
- Free forever, no ads
- Pre-built symptom lists for specific conditions (endo, IBD, fibromyalgia)
- Research export (participates in studies)
- Simple daily check-in
- Pain/energy/mood/GI on single screen

**HATE**
- UX feels like 2015 (no updates since 2021)
- Limited customization (can't add custom symptoms freely)
- No cycle tracking integration
- No correlation insights
- Data export is hard to find
- Small community means slow updates
- Android app buggier than iOS

**WISH**
- Active development
- Better UX
- Cycle integration
- Patterns engine

---

## CareClinic (4.5/5, paywall-heavy)

**LOVE**
- Most comprehensive feature set: meds + symptoms + mood + vitals + journaling + photos
- Medication interaction warnings (actually works)
- Caregiver mode for families
- Imports photos of pill bottles to auto-populate

**HATE**
- "Every single screen has an upgrade prompt"
- Free tier only tracks 3 symptoms (effectively a demo)
- Mobile app is slow
- No web/desktop version
- Paywall pops up mid-logging
- Notifications are aggressive

**WISH**
- Generous free tier to earn trust
- Faster app
- Less monetization pressure

---

## MyTherapy (4.6/5, free, EU-focused)

**LOVE**
- Free forever, no ads, no paywall
- GDPR-compliant privacy
- Reliable medication reminders
- Symptom + mood tracking
- Medical ID export

**HATE**
- Limited symptom library
- No custom factors
- No correlation analysis
- US-specific features missing

---

## What No App Does Well

1. **Multi-signal cycle integration** -- none tie symptoms to cycle phase with signal confidence
2. **Chronic illness exercise tolerance** -- all treat exercise as binary "did/didn't do"
3. **PRN medication intelligence** -- all treat as-needed as "just log it", none track frequency escalation
4. **Oura/wearable native fusion** -- Bearable has Apple Health import but not deep integration
5. **Food-symptom next-day correlation** -- all tag triggers but none compute baseline-relative impact
6. **Doctor-ready structured report** -- all export CSVs or simple PDFs, none output FHIR or structured clinical sections

## LanaeHealth Edge

- Intelligence Engine with 6 clinical personas (no competitor has this)
- 34 medical API pipeline for cross-correlation
- Doctor Mode with structured clinical report output
- Zero paywall aggression -- all features free
- Multi-signal cycle intelligence combining Oura temp + HRV + RHR + BBT + mucus + LH
- Auto food classification (FODMAP, histamine, allergens, anti-inflammatory, iron)
- Positional vitals with POTS threshold detection
- Exercise tolerance safe ceiling from PEM history
- PRN frequency escalation detection with symptom correlation
- All data feeds unified correlation engine (Spearman, Mann-Whitney, FDR correction)
