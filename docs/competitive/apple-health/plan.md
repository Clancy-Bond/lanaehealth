# Apple Health -- Implementation Plan

As an aggregator, Apple Health has fewer directly-portable features than specialized apps. Most wins are UX and information-architecture patterns. The top 3 below all reinforce what we already have rather than adding new modules.

Ranking formula: `(impact * 2) / effort-score` where S=1, M=2, L=4, XL=8.

| Rank | Feature | Source pattern | Lanae impact (1-5) | Effort (S/M/L/XL) | Depends on | Notes |
|------|---------|----------------|---------------------|-------------------|------------|-------|
| 1 | Unified Medical Records Timeline view | Health Records / FHIR interleaved timeline | 5 | M | existing labs, imaging, appointments, timeline tables | Merge current 4-tab /records page into single chronological scroll with filter chips. Data already present. |
| 2 | "Today vs Your Baseline" morning home card | Vitals Outlier Card (iOS 18+) | 4 | M | oura_daily (1,187 days already) | Add to home page. Compare today to 28-day rolling median for RHR, HRV, wrist temp, resp rate. Flag anomalies. |
| 3 | Favorites / pinned metrics on home page | Summary View (Favorites) | 4 | M | QuickStatusStrip.tsx | Let Lanae curate which 4-6 metrics appear at the top. Rest hide behind "More". User preference stored in health_profile. |
| 4 | Standardized Day/Week/Month/Year selector on every trend chart | Trends Engine | 4 | S | patterns page charts | Consistency win. Recharts supports this natively. |
| 5 | Emergency Medical Card PDF | Medical ID | 3 | S | health_profile | One-page printable PDF with meds, conditions, allergies, emergency contacts. Lanae carries in wallet. |
| 6 | Medication interaction warnings | Medications module | 3 | M | health_profile.medications, OpenFDA / RxNorm | API wrapper. Warn on drug interactions. |
| 7 | Scoped doctor share links | Sharing with doctor | 3 | L | new row-level share tokens, public read route | "Share last 90 days" link. Requires careful security model. |
| 8 | Category-based navigation on /records | Category IA | 3 | M | re-org of records page | Apple's 12-category model adapted (Heart, Cycle, Sleep, Symptoms, Labs, Imaging, Meds, Mood, Nutrition). |
| 9 | Explicit anomaly explanations on charts | Trends + Vitals | 3 | M | pgvector correlations | "This spike correlates with..." linked from chart. |
| 10 | Mood dial input (State of Mind) | State of Mind | 2 | S | log page | Minor UI polish, replace mood slider with dial. |
| 11 | Highlights/nudges across categories | Summary Highlights | 3 | L | correlation engine + home UI | Partially built via SmartCards. Expand coverage. |
| 12 | Walking steadiness / gait via phone sensors | Walking Steadiness | 1 | XL | iOS app only | Declined. Not web-buildable. |
| 13 | Lock-screen emergency access | Medical ID lock-screen | 1 | XL | iOS app only | Declined. Not web-buildable. |
| 14 | HealthKit read/write integration | HealthKit | 1 | XL | iOS app only | Declined. Requires separate iOS app out of scope. |

---

## Top 3 for Implementation

### Rank 1: Unified Medical Records Timeline view
Score: `(5 * 2) / 2 = 5.0`. Highest impact, existing data, moderate effort. Apple's most-copied aggregator pattern applied to our already-imported CCD data.

### Rank 2: "Today vs Your Baseline" morning home card
Score: `(4 * 2) / 2 = 4.0`. Uses 1,187 days of Oura data we already have. Clinically useful for POTS monitoring (Lanae's standing pulse 106 is anomalous, baseline logic makes that obvious).

### Rank 3: Favorites / pinned metrics on home page
Score: `(4 * 2) / 2 = 4.0`. User-curated dashboard. Removes paternalism of us deciding what goes on home. Low data risk.

---

## Declined / Red Flag Features

Several high-profile Apple Health features cannot be built without an iOS companion app:

- **HealthKit read/write integration**: Requires native iOS app with HealthKit entitlement. Out of scope per task brief.
- **Walking Steadiness / Fall Risk**: Relies on iPhone gait sensors. No web equivalent.
- **Lock-screen Medical ID access**: iOS-only.
- **Apple Watch Vitals Card (native)**: Requires watch. Our adaptation (baseline card) works from web.
- **Wrist Temperature Tracking**: Requires Apple Watch Series 8+ or Oura. We already get this from Oura.

These are flagged as declined in the matrix. Not attempting.

Matrix rows proposed in the task return message.
