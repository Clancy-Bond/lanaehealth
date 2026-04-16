# Period/Cycle Tracking -- Competitive Analysis

Last updated: Apr 2026
Research sources: r/birthcontrol, r/ttc, r/endometriosis, r/FAMnNFP, r/menstrualcups, App Store reviews, Cochrane reviews of tracking app accuracy, privacy researcher analyses

---

## Natural Cycles (Lanae's current app, FDA-cleared, $99.99/yr)

**Why people use it**
Only FDA-cleared digital contraceptive. Science-backed algorithm, BBT + LH-based. Popular with NFP practitioners.

**LOVE**
- FDA Class II clearance (actually tested in 15,000+ user study)
- Accurate ovulation detection from BBT
- Oura Ring temperature integration (huge win -- no morning thermometer needed)
- Apple Watch wrist temperature (Series 8+)
- Red/Green day simplicity
- Learning about cycle patterns empowers users
- Hormone-free birth control
- Clinical study support

**HATE**
- Price doubled in 2025 ($49 -> $99/yr) angered long-time users
- Too many Red Days (conservative algorithm)
- Misses cervical mucus signal (BBT-only)
- Requires morning measurement ritual (unless Oura connected)
- Not actually hormonal birth control-friendly
- Retroactively changes Red/Green days (can't trust past data)
- Partner app lags
- No symptom correlation beyond basics
- Limited POTS/endo-specific tracking

**WISH**
- More signals beyond BBT (add mucus, HRV, RHR)
- Symptom correlation
- Lower price

---

## Flo (450M+ users, 4.7/5, dominant by volume)

**LOVE**
- Most downloads, biggest community
- 70+ trackable symptoms
- AI-powered predictions
- Pregnancy mode
- Anonymous mode for privacy-conscious users
- Educational content

**HATE (major privacy issues)**
- $56M class action settlement in 2025 for sharing cycle data with Facebook/Google
- Privacy scandal (2021 FTC settlement, ongoing trust issues)
- Aggressive upselling to Flo Premium
- Ad-heavy free tier
- Cluttered UI
- Misleading "free" onboarding that pushes premium
- Post-Roe privacy concerns (US users worry about prosecution data)

**WISH**
- Actual privacy
- Less aggressive monetization

---

## Clue (50M+ downloads, 4.6/5, privacy-first)

**LOVE**
- European privacy focus (GDPR-native)
- No data sharing with third parties
- Science-backed (partners with Stanford, UCL)
- Clean, minimal UI
- Doesn't gender-code "feminine" design
- Clue Plus for advanced users

**HATE**
- Subscription creep (features moved to Clue Plus)
- Paywall prompts increased in 2024
- Free tier becoming limited
- Basic symptom library
- No wearable integration

**WISH**
- More signals
- Less paywall pressure

---

## Stardust (4.4/5, privacy-first viral app)

**LOVE**
- Privacy-first architecture (de-identification, no cross-device tracking)
- Fun lunar/astrology UI
- Anonymous partner sharing
- Post-Roe privacy marketing resonates
- Young demographic

**HATE**
- Less clinical depth
- Limited symptom options
- No BBT
- Astrology integration is divisive
- Small team, slow updates

---

## Apple Health Cycle Tracking (built-in iOS, free)

**LOVE**
- Free, built-in
- Integrates with Apple Watch wrist temperature
- PDF export for doctors
- Strong privacy (on-device)
- No ads ever

**HATE**
- Shallow symptom library
- No cycle intelligence beyond predictions
- No partner sharing
- No food/trigger correlation
- Limited charts

---

## Fertility Friend (smaller, TTC-focused)

**LOVE**
- BBT charting gold standard
- TTC community
- Chart analysis

**HATE**
- UI from 2010
- Steep learning curve
- Not general-purpose

---

## What No App Does Well

1. **Multi-signal cycle intelligence** -- combining BBT + Oura temp + HRV + RHR + cervical mucus + LH
2. **Confidence intervals on predictions** -- all give point estimates, none show +/- ranges
3. **Anovulatory cycle detection** -- all assume ovulation, none flag when it doesn't happen
4. **Short luteal phase warning** -- clinically important but no app alerts
5. **Endo-specific tracking** -- pain by location, dyspareunia, GI/bladder symptoms tied to cycle
6. **POTS cycle integration** -- POTS symptoms worsen luteal, no app correlates
7. **Food-cycle correlation** -- do certain foods trigger worse cramps?
8. **Clinical report output** -- none produce OB/GYN-ready structured reports

## LanaeHealth Edge

- Multi-signal cycle intelligence engine (BBT + Oura temp + HRV + RHR + mucus + LH with weighted confidence)
- Temperature biphasic shift detection (0.2C+ sustained for 3 days)
- HRV phase transition detection (parasympathetic->sympathetic)
- RHR elevation detection (~2.7 bpm luteal rise)
- Period prediction with +/- days confidence window
- Short luteal phase flag (<10 days) -- clinical red flag for low progesterone
- Long cycle flag (>35 days) -- PCOS/perimenopause marker
- Anovulatory cycle detection (no temp shift + no LH surge)
- Honest "insufficient data" when signals are weak
- Oura Ring native integration (already has 1,187 days)
- Integration with endometriosis-specific tracking (pain location, dyspareunia, GI symptoms)
- Doctor report API with cycle history, BBT chart data, luteal length, flow pattern
- Zero data monetization, zero ads
