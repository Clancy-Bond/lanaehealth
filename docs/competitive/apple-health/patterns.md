# Apple Health -- Patterns

Apple Health is the aggregator standard. Fewer shippable feature patterns than specialized apps, but its information architecture and dashboard design set expectations that every other health app is measured against. Our /records and /page (home) are both compared, subconsciously, to the Apple Health Summary view.

Patterns ranked by Lanae impact (1-5 stars).

---

## Summary View (Favorites + Highlights)

**What it is:** The top-level Home tab in Apple Health shows a vertical scroll of category cards the user has starred as Favorites, followed by a Highlights section that surfaces algorithmic nudges like "Your resting heart rate has been trending up" or "You slept longer this week than last." Time-of-day adaptive: fewer cards at night, more morning.

**Why it works:** The user curates ONCE (star the metrics they care about) and Apple never pushes uncurated data to the top. The Highlights section does the "what's interesting?" work the user can't be bothered to do.

**Trade-offs:**
- No global AI reasoning, just pre-computed rules per metric
- Favorites list is manual, not learned from behavior
- Highlights cannot cross categories (no "your sleep AND heart rate both dropped")

**Adaptability to LanaeHealth:**
HIGH. Our home page has Quick Status Strip + Smart Cards + Calendar Heatmap but is not user-curated. The Favorites pattern (user picks 3-6 metrics they want at the top) is directly portable. Our Highlights equivalent exists as SmartCards but we could be more explicit about "trending up/down over 7 days."

Rating: 4/5

---

## Category Information Architecture

**What it is:** Apple Health groups every metric into 12 canonical categories: Activity, Body Measurements, Cycle Tracking, Hearing, Heart, Mindfulness, Mobility, Nutrition, Respiratory, Sleep, Symptoms, Vitals. Every third-party app that writes to HealthKit MUST tag data with one of these. The Browse tab is a pure alphabetical category list.

**Why it works:** Users have a mental model. "I want to see heart stuff" -> tap Heart -> everything heart-related. No app-brand confusion. No duplication. When a new metric ships (wrist temp, walking steadiness), it lives in a predictable place.

**Trade-offs:**
- Categories are Apple's choices, not user's
- Some metrics span categories awkwardly (mood is in Mindfulness, not its own place until iOS 17)
- Deep tapping required to see details

**Adaptability to LanaeHealth:**
HIGH. Our /records page shows Labs, Imaging, Appointments, Timeline as four horizontal tabs. But daily vital data (Oura, pain logs, cycle) lives on different pages. A single unified /records or /health with Apple-style category navigation would reduce page-hopping. Particularly good for Lanae who has data in 6+ domains.

Rating: 5/5

---

## Health Records / FHIR Aggregation

**What it is:** iPhone pulls from any US hospital's patient portal that supports SMART on FHIR (Epic, Cerner, Athena, etc.) and puts labs, conditions, medications, immunizations, and visits into a unified timeline. User authenticates once per provider and data flows automatically.

**Why it works:** It consolidates the hospital-portal hellscape. Patients with multiple providers (Lanae has HPH + Kaiser + others) normally juggle multiple MyChart-style apps. Apple unifies without owning the data.

**Trade-offs:**
- US only for full coverage
- Read-only (can't write back to provider)
- Some providers delay or restrict what data flows

**Adaptability to LanaeHealth:**
VERY HIGH and already partially done. We have 1,490 days of imported CCD data from myAH. The PATTERN TO STEAL is not the mechanism (FHIR integration needs iOS) but the UNIFIED RECORD TIMELINE UI. Apple shows a single vertical chronological list of every lab, med, visit, problem, from all providers interleaved. We should consider a "Medical Timeline" view that interleaves labs + imaging + appointments + meds + diagnoses in one scroll, not four separate tabs.

Rating: 5/5

---

## Trends Engine (Weekly / Monthly / Yearly Scaling)

**What it is:** When you tap any metric, Apple Health automatically presents Day / Week / Month / 6M / Year ranges. It shows rolling averages, highlights anomalies (dots outside the band), and labels the average value. The range selector is always at top.

**Why it works:** Consistent UX across every metric. User never has to learn a new chart paradigm. Automatic rolling average visually cuts through noise.

**Trade-offs:**
- No custom date ranges
- No overlay of two metrics (can't view sleep and HRV together)
- Anomaly detection is primitive (just standard deviation bands)

**Adaptability to LanaeHealth:**
MEDIUM-HIGH. Our /patterns page has various time-range views but inconsistently applied. Standardizing on Day/Week/Month/Year selector at the top of every metric chart is a low-effort win. Recharts supports this easily.

Rating: 4/5

---

## Medical ID / Emergency Profile

**What it is:** A profile accessible from lock screen during emergencies: blood type, allergies, medications, conditions, emergency contacts, organ donor status. EMTs and ER staff are trained to look for it.

**Why it works:** High-stakes, low-friction. Setup once, save lives during an emergency. Integrates with Emergency SOS calls.

**Trade-offs:**
- Adoption is low (users don't set it up)
- iOS-only feature
- No export to a universal format

**Adaptability to LanaeHealth:**
MEDIUM. We can't replicate the "lock screen" access without being an iOS app. But we COULD generate a printable Emergency Medical Card (PDF, credit-card size) from Lanae's health_profile data that she carries in her wallet. Low effort, high value for someone with POTS who might syncope.

Rating: 3/5

---

## Medications Module (iOS 17+)

**What it is:** Dedicated Medications tab with schedule, reminders, interaction warnings (powered by Epocrates), natural-remedy tracking, and a visual log of doses taken. "Critical Alert" notifications even when Do Not Disturb is on.

**Why it works:** Reminders + interactions + adherence log all in one UI. Not separate apps.

**Trade-offs:**
- Manual entry for each medication
- Interaction database US-centric
- No auto-reorder or pharmacy integration

**Adaptability to LanaeHealth:**
MEDIUM. We already have medications in health_profile and medication adherence logic. The INTERACTION WARNINGS pattern is a potential add. Epocrates is paid but NIH DailyMed / RxNorm / OpenFDA APIs are free and we already use some of them. A "check for interactions" feature on the medications page would be a differentiator.

Rating: 3/5

---

## State of Mind (Mood) Interaction

**What it is:** A single gesture-first mood logger. User turns a virtual dial from "Very Unpleasant" to "Very Pleasant," picks 1-3 emotion words (anxious, calm, energized, etc.), and 1-3 "what's contributing" factors. Completes in under 15 seconds.

**Why it works:** Novel input method (dial) feels tactile and fun. Minimal friction, low cognitive load, no numeric scale that feels clinical.

**Trade-offs:**
- No ability to log multiple moods per day easily
- Doesn't feed into sophisticated analysis
- Dial feels gimmicky to some users

**Adaptability to LanaeHealth:**
MEDIUM. Our log page uses sliders and chips. A dial-style input for mood/overall-state could be a nicer tactile element than a 1-10 slider. BUT we already have good mood tracking, and this is UI polish not substance.

Rating: 3/5

---

## Privacy Model (On-Device + Encrypted)

**What it is:** Health data is processed on-device when possible, encrypted in iCloud backups with a key that Apple does not hold, and third-party apps must ask permission per data type.

**Why it works:** Trust. Users share sensitive cycle, mental health, and medical data with Apple Health when they wouldn't with Google or Facebook. Privacy-first positioning is a moat.

**Trade-offs:**
- On-device processing limits cloud features
- No cross-family data sharing by default
- Recovery is hard if iCloud key is lost

**Adaptability to LanaeHealth:**
LOW-MEDIUM for patterns to steal. We already use Supabase with RLS and Lanae's data is in her own project. The PATTERN to carry is EXPLICIT CONSENT per data category when a new integration is added. When we hook up a new wearable, we should show "This app will read X, Y, Z" and let her decline specific categories.

Rating: 2/5

---

## Vitals Outlier Card (iOS 18+)

**What it is:** The Apple Watch Series 10 Vitals app shows an overnight summary of heart rate, HRV, resp rate, wrist temp, blood oxygen and explicitly flags which are "outside your typical range." Presented as a single glanceable card each morning.

**Why it works:** Your own baseline is the ground truth. "Typical range" is personalized, calculated from 28 days of your data. Anomalies stand out because they're compared to YOU, not to a population norm.

**Trade-offs:**
- Requires 28 days of data to start
- Doesn't explain WHY something is out of range
- No clinical interpretation

**Adaptability to LanaeHealth:**
HIGH. We have Oura data (HRV, RHR, temp, resp rate) for 1,187 days. A morning "Today vs Your Baseline" card on the home page showing what is outside her 28-day median would be a clinically useful pattern. Low effort because the data and comparison logic is straightforward.

Rating: 4/5

---

## Walking Steadiness / Fall Risk

**What it is:** Apple uses gait sensors in iPhone to estimate walking steadiness (OK/Low/Very Low) and alerts users when it declines. Geared toward elderly fall prevention.

**Why it works:** Passive, no user action. Long-term trend detection with a clinical framework.

**Trade-offs:**
- iPhone-only (sensor-based)
- Age-oriented (Lanae is 24)
- Binary/tertiary classification is coarse

**Adaptability to LanaeHealth:**
LOW. Lanae is 24 and doesn't need fall risk. But the CONCEPT of a passive, always-on, long-term health signal with an alert threshold could apply to her POTS data. "Your standing pulse has been trending up for 10 days." We already have this in correlation_results.

Rating: 2/5

---

## Sharing with Family / Doctor

**What it is:** User can share specific categories of Health data with a family member or doctor. The receiver sees a curated view; not full access.

**Why it works:** Permission granularity. User controls what's shared without all-or-nothing.

**Trade-offs:**
- Apple-to-Apple only
- No public-link option
- Doctor side is awkward (requires doctor to have an iPhone)

**Adaptability to LanaeHealth:**
MEDIUM. We already have /doctor page generating reports. A FEATURE we don't have: a shareable link that exposes a date-scoped, category-scoped, read-only snapshot of data. Lanae's PCP could see "last 90 days of vitals + symptoms" via a URL without logging in. Privacy and implementation design needed, but the pattern is worth studying.

Rating: 3/5

---

## Health Checklist (Setup Nudges)

**What it is:** A guided setup screen that suggests "features you might want to enable": Medical ID, Medications, Cycle Tracking, Sleep Focus, etc. User goes through one at a time.

**Why it works:** Onboarding debt management. Most users never configure more than 20% of Apple Health features. Checklist surfaces what they're missing.

**Trade-offs:**
- One-time prompt, doesn't re-engage
- Generic, not personalized to user profile

**Adaptability to LanaeHealth:**
LOW-MEDIUM. We have /onboarding but it's not a living checklist. A "Complete your profile" card on the home page that persists until 90% of profile sections are filled could drive completion. Already mostly done via DataCompleteness component.

Rating: 2/5
