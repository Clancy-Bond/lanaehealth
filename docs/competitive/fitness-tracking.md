# Fitness/Workout Tracking -- Competitive Analysis

Last updated: Apr 2026
Research sources: r/fitness, r/xxfitness, r/Strava, r/homegym, r/PowerlifterEst, r/ChronicPain, r/POTS, App Store reviews, MacroFactor vs competitors threads

---

## Strava (100M+ users, 4.7/5)

**Why it's dominant for cardio**
Social network for runners/cyclists. Segments, leaderboards, clubs. Strong community.

**LOVE**
- Social feed drives motivation
- Segment leaderboards (compete with friends/strangers)
- Device-agnostic (Garmin, Apple Watch, Wahoo, Polar)
- Route discovery and heatmaps
- Year in Sport recap
- Strong GPS tracking

**HATE**
- Subscription creep (features moved behind paywall)
- Sued Garmin in 2024 -- user backlash threatened mass cancellation
- Gamification can't be disabled (constant challenges)
- Not useful for strength training (cardio-biased)
- Apple Health sync unreliable
- Heavy social pressure for casual users

**WISH**
- Disable gamification
- Strength training features
- Less subscription pressure

---

## Strong (4.9/5, strength training champion)

**LOVE**
- 3-tap set logging (fastest in class)
- Templates for common programs (Stronglifts 5x5, PPL)
- Progressive overload tracking
- CSV export
- Lifetime purchase option ($99)
- No ads
- Clean UI

**HATE**
- No AI suggestions or programming
- Premium-gated features (plate calculator, custom exercises in free tier limit)
- Limited free tier (3 routines)
- No social
- No cardio integration

**WISH**
- AI programming
- Cardio workouts
- Generous free tier

---

## Fitbod (4.8/5, AI workout generator)

**LOVE**
- AI generates daily workouts based on recovery
- Muscle recovery heat map
- Equipment adaptability (home gym, hotel gym, bodyweight)
- 3D exercise animations
- Apple Watch companion
- Progressive overload automation

**HATE**
- Wild weight suggestions occasionally (e.g. 1,300 lbs shrugs bug)
- No injury/pain filter
- $16/mo (expensive)
- Poor retention (users drop off after ~7 workouts)
- Limited to gym-style workouts

---

## Hevy (4.9/5, rising community favorite)

**LOVE**
- Unlimited workouts free
- Social network built in (follow friends)
- Modern clean UI
- Cheapest serious tracker ($24/yr)
- HevyGPT workout suggestions
- Comprehensive exercise library

**HATE**
- Less advanced analytics than Strong
- Limited set type tracking
- Social can distract from focus
- No workout programming built-in

---

## FitrWoman / WILD.AI (cycle-aware fitness)

**LOVE**
- 5 cycle phases tracked (vs standard 4)
- Phase-specific training recommendations
- Nutrition + supplement guidance per phase
- Wearable integration
- Covers full reproductive lifespan

**HATE**
- Limited beyond cycle awareness
- Premium for advanced features
- Smaller exercise library

---

## Visible (chronic illness pacing, unique positioning)

**Why this matters for Lanae**
Designed for ME/CFS and Long COVID. Treats exercise tolerance as finite resource.

**LOVE**
- Morning Stability Score (daily readiness)
- PacePoints (energy budget system)
- Real-time pacing notifications (HR-based)
- 86% of users feel more in control of their illness
- Validates chronic illness experience
- Heart rate threshold alerts to prevent PEM

**HATE**
- Not a traditional fitness app (helps you do LESS)
- Requires compatible chest strap HRM
- Subscription ($15/mo)
- Small community

**WISH**
- Broader chronic illness support
- Integration with traditional fitness tracking

---

## Apple Activity Rings / Apple Fitness+

**LOVE**
- Free (Rings), $9.99/mo Fitness+
- Seamless Apple Watch integration
- Clean UI
- Fitness+ workout library (thousands of videos)

**HATE**
- Rings system punishes rest days (no modulation)
- No consideration for illness/PEM
- Apple ecosystem only
- Basic for advanced lifters

---

## What No App Does Well (Chronic Illness Gap)

1. **Chronic illness exercise mode** -- Visible is closest but narrow
2. **Safe exercise ceiling from PEM history** -- no app calculates this
3. **Position-aware for POTS** (recumbent -> seated -> standing progression)
4. **Post-exercise symptom tracking** (12-48h follow-up -- PEM appears delayed)
5. **HR delta from resting** (meaningful for POTS: 130 bpm walking is different for POTS vs athlete)
6. **Cycle-phase + chronic condition** (WILD.AI + Visible combined)
7. **Recovery intelligence** factoring autonomic dysfunction + sleep + cycle + symptoms
8. **"Gentle wins" celebration** (most apps celebrate PRs, not tolerance)

## LanaeHealth Edge

- Chronic illness exercise intelligence engine with:
  - Safe exercise ceiling per intensity (max duration without flare)
  - PEM detection (post-symptom >=4 OR next-day pain +2)
  - POTS position progression (recumbent -> seated -> standing, Levine/Dallas protocol)
  - Weekly capacity tracking with remaining minutes
  - Flare rate by activity type (identifies safe vs risky)
  - Readiness-to-progress assessment
- Integration with cycle intelligence (flag workouts during high-risk luteal days)
- HR delta calculation (not absolute HR)
- Pre/post symptom check on each workout
- Self-fetching ExerciseTolerance component with real-time weekly capacity display
- Oura activity data integration
- Doctor-ready output of exercise tolerance trends
- No "rings punish rest" gamification
- Celebrates gentle wins (10 min recumbent bike = success during POTS flare)
