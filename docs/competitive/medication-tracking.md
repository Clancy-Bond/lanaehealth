# Medication Tracking -- Competitive Analysis

Last updated: Apr 2026
Research sources: r/chronicillness, r/ADHD (medication management), r/epilepsy, r/RheumatoidArthritis, App Store reviews, adherence research papers, PDC (Proportion of Days Covered) studies

---

## Medisafe (8M+ users, 4.7/5, US/EU dominant)

**Why it was the #1 medication app (pre-paywall)**
Persistent reminders, comprehensive med library, caregiver alerts.

**LOVE (historical)**
- Never missed a dose reminders (persistent until acknowledged)
- Drug-drug interaction checker
- Caregiver alerts when doses missed
- Over 30 languages
- Pharmacy pickup reminders
- Refill tracking
- Health measurements (BP, glucose, weight)

**HATE (current, 2026)**
- January 2026 paywall change: FREE TIER LIMITED TO 2 MEDICATIONS
- Massive Reddit backlash ("cruel for polypharmacy patients")
- 22% of US adults 40-79 take 5+ medications -- they're now locked out
- Subscription prompts appear on every action
- Not brain-fog friendly (3+ taps to log a dose)
- Can't skip without selecting a reason
- Limited offline functionality
- Dose time rigid (no flexibility for real life)

**WISH**
- Bring back free tier
- One-tap dose confirmation
- Forgiving reminder windows

---

## CareClinic (4.5/5, chronic illness power tool)

**LOVE**
- Medication-symptom correlation engine
- PRN (as-needed) tracking with max dose warnings
- Tapering schedule support (prednisone, SSRIs)
- Variable interval scheduling
- Doctor/pharmacy sharing
- Photo medication import
- Caregiver mode

**HATE**
- Overwhelming complexity for simple users
- Slow app performance
- "Everything behind paywall" reputation
- Steep learning curve

**WISH**
- Cleaner UX
- Lighter-weight option

---

## Round Health (4.9/5 iOS minimalist)

**LOVE**
- One-tap dose confirmation (unique!)
- Beautiful minimal UI (Apple Design Award)
- Birth control pack tracking
- Reminder windows (flexible timing, not rigid)
- No streak shame (doesn't reset on miss)
- Free for basic use

**HATE**
- iOS only (no Android)
- No drug interaction checking
- No adherence reports
- No correlation analysis
- Limited to simple scheduling

**WISH**
- Android version
- Basic interaction warnings
- Doctor reports

---

## MyTherapy (4.6/5, European, free)

**LOVE**
- Free forever, no ads
- Reliable reminders
- Symptom + mood tracking
- GDPR-compliant
- Mass medication import
- Monthly reports

**HATE**
- No drug interaction checking
- No correlation analysis
- Limited US drug database
- Basic customization

---

## Theraview (ADHD-specific, innovative)

**LOVE**
- Onset/peak/duration curves showing when meds are active (unique visualization)
- Per-dose effectiveness notes
- ADHD-specific profiles
- Local-only data (strong privacy)

**HATE**
- Niche (ADHD stimulants only)
- iOS only
- Limited medication library

**WISH**
- Broader medication coverage
- This visualization applied to other medications

---

## Apple Health Medications (iOS 16+, free)

**LOVE**
- Free, built-in
- Interaction warnings (basic)
- Pill shape/color
- Daily reminders
- Privacy-first

**HATE**
- Limited library
- No customization
- No correlation
- No caregiver sharing
- Basic tracking only

---

## What No App Does Well

1. **PRN as first-class citizen** -- all treat as-needed meds as afterthought
2. **Time-since-last-dose** -- always visible so users know when it's safe to redose
3. **Max daily dose enforcement** -- button disabled when at limit
4. **Minimum-hours-between enforcement** -- gray button + countdown
5. **Frequency escalation detection** -- 30%+ increase in PRN use = possible symptom worsening
6. **Medication-symptom correlation via Intelligence Engine**
7. **Wearable-correlated adherence** -- med timing vs Oura sleep/HRV
8. **Onset/peak/duration curves for all medications** (Theraview does only ADHD)
9. **Cycle-aware scheduling** -- some meds interact with hormonal contraceptives
10. **Free unlimited medication slots** (Medisafe just killed this)

## LanaeHealth Edge

- One-tap dose confirmation like Round Health
- PRN intelligence engine with:
  - Time-since-last-dose always visible
  - Doses today / max doses with remaining counter
  - At-limit detection (button disabled + red message)
  - Minimum-hours-between enforcement (Tylenol 4h, Ibuprofen 6h, Naproxen 8h)
  - Weekly frequency trend (4-week mini chart)
  - Escalation detection (30%+ increase flagged)
  - Symptom correlation (which symptoms trigger PRN use)
  - Cycle phase PRN patterns
- MedTimeline with onset/peak/duration curves (Theraview-style, all medications)
- Free unlimited medications
- No streak shame (cumulative %, never resets)
- Wearable-correlated adherence visualization
- Brain-fog accessible design
- Forgiving reminder windows
- PDC (Proportion of Days Covered) calculation for clinical use
- Integration with doctor report output
