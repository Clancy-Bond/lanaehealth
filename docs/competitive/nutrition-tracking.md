# Nutrition Tracking -- Competitive Analysis

Last updated: Apr 2026
Research sources: r/loseit (2M+ members), r/nutrition, r/CICO, r/MacroFactor, r/MyFitnessPal, App Store reviews, MacroFactor's public comparison pages, Reddit head-to-head threads

---

## MyFitnessPal (200M+ users, 4.4/5 iOS)

**Why it's dominant**
Largest food database (14M+ items, user-submitted + verified). Network effect keeps people locked in despite complaints. Recent acquisition by Francisco Partners ($1.5B).

**LOVE patterns**
- Largest database, including most restaurant menus
- Barcode scanning works for 95% of packaged foods
- Recipe import from URLs
- Community/friends feature
- Broad integration (Fitbit, Garmin, Oura, Apple Health)
- Good for casual users

**HATE patterns (extremely common in reviews)**
- "Full-screen video ads mid-logging" -- 30-second unskippable ads during meal entry
- User-submitted food entries have wrong macros (no verification)
- Same food appears 50+ times with different values
- $19.99/month paywall for basic features
- 2018 data breach (150M users) still hurts trust
- "Premium" buttons on EVERY screen
- Macro tracking locked behind paywall since 2022
- Recipes require premium
- Export data requires premium

**WISH**
- Verified database
- Ad-free even in free tier
- Better free tier
- Desktop-first design

---

## Cronometer (4.7/5, accuracy champion)

**Why data-driven users switch from MFP**
USDA-verified database. 82+ micronutrients tracked (MFP tracks ~15). Science-focused.

**LOVE**
- USDA + NCCDB database (government-verified nutrition data)
- Tracks 82+ micronutrients (vitamins, minerals, amino acids)
- Oracle nutrient ratio insights
- Gold standard for quantified-self users
- Verified database prevents garbage entries
- Works for specialized diets (keto, vegan, carnivore) accurately
- Recipe builder with nutrient calculation
- Better barcode recognition than MFP

**HATE**
- Also full-screen video ads mid-logging (same as MFP)
- UI is clinical/intimidating for casual users
- $60/yr Gold feels expensive for casual tracking
- Charts are ugly
- Mobile app slower than MFP
- Some users "bullied" by subscription prompts

**WISH**
- Cleaner UI
- Ad-free base tier
- Better charts

---

## MacroFactor (4.9/5, rising cult following)

**Why Reddit swears by it**
Adaptive algorithm that recalculates TDEE from actual weight + intake weekly. No guessing. Built by powerlifting coach Greg Nuckols (science YouTuber with 500K+ subscribers).

**LOVE**
- Adaptive algorithm learns your actual metabolism
- Fastest logging flow (10 taps vs MFP's 15)
- No ads ever
- Science-backed approach (detailed methodology published)
- Hunger-based "expenditure" visualizations
- Great for weight loss/maintenance
- Excellent food photo AI
- Apple Watch + Health Connect integration

**HATE**
- No free tier (7-day trial only)
- $11.99/mo or $71.99/yr
- No desktop/web version
- No workout tracking (requires separate app)
- Limited recipe builder
- Niche for general health tracking (calories-first focus)
- Predatory billing per some users (forgot to cancel)

**WISH**
- Free/freemium tier
- Desktop version
- Workout integration

---

## MyNetDiary (Lanae's current app, 4.6/5)

**LOVE**
- Clean UI, meal-by-meal structure
- Good for portion tracking
- CSV export
- Premium is reasonable ($8.99/mo)

**HATE**
- Smaller database than MFP
- Less community/ecosystem
- Some features require premium
- No food photo AI
- No adaptive algorithm

---

## Lose It (4.6/5, simpler option)

**LOVE**
- Simple calorie focus
- Clean UI
- Snap It (food photo recognition)
- Reasonable pricing
- Good for beginners

**HATE**
- Database quality issues (user-submitted like MFP)
- Ads in free tier
- Less sophisticated than MacroFactor

---

## Yazio, Lifesum (international)

Similar patterns -- clean UI, limited free tier, subscription-heavy. Strong in Europe.

---

## What No App Does Well

1. **Anti-inflammatory scoring per food** -- none rate foods for inflammation
2. **FODMAP/histamine/allergen auto-tagging** -- none auto-classify for chronic illness
3. **Iron absorption optimizer** -- none flag absorption enhancers vs inhibitors per meal
4. **Food-symptom next-day correlation** -- none compute baseline-relative impact
5. **Cycle-aware nutrition** -- none adjust macros for luteal phase
6. **No ads in logging flow** -- MacroFactor is the only one

## LanaeHealth Edge

- USDA FoodData Central (380K+ verified foods, no user-submitted garbage)
- Claude-powered meal photo recognition
- Auto-classification: FODMAP level, histamine level, allergens, anti-inflammatory score, iron absorption
- Adaptive calorie algorithm (MacroFactor-style) with actual TDEE calculation from weight trends
- Open Food Facts barcode scanner with NOVA processing scores
- Symptom-food correlation engine computing next-day baseline-relative impact
- Zero ads, zero aggressive upsells
- Integrates with cycle intelligence (flag high-inflammation foods during luteal)
- Iron deficiency alert with absorption context (pair with vitamin C, avoid calcium within 1hr)
