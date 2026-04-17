# LanaeHealth Master Plan: From Personal App to Universal Health Platform

## Context

LanaeHealth is currently a personal medical tracking app for one patient. The vision is to transform it into a public product with two identities:

1. **The Universal Health Data Hub** ("incognito data grabber") -- where ALL health data from every app, wearable, doctor, and file comes to rest in one place and gets analyzed for each user specifically.
2. **The Best-in-Class Standalone** -- for users who want one app to replace their calorie tracker, period tracker, symptom logger, and wearable dashboard. Built by studying what users love/hate about the top apps in each category.

Users choose their path: some use us for everything, others just send their data here and we study it. Both experiences are first-class.

### What's Already In Flight (3 Active Sessions)
- **Clinical Intelligence Engine** -- 6-persona AI reasoning system (Phase 2 landed, 74 tests)
- **Bearable Killer UX** -- logging overhaul with mood, gratitude, custom trackables, clinical scales
- **Medical API Pipeline** -- 34 free research APIs for cross-correlation diagnostics

This master plan originally covered four implementation pillars (Import, Integrations, Competitive Intel, Modular UX) -- all now COMPLETE per `MASTER_PLAN_STATUS.md`. The plan has been extended with three strategic pillars (Privacy, Monetization, Clinical Validation) and five additional phases (F-J) that take LanaeHealth from a built product to a launched, defended, and expanded platform.

---

## Pillar 1: Universal Data Import Engine

**Goal:** Accept health data from ANY source in ANY format. Make import so easy that users dump everything in and we figure it out.

### Current State
Already built: Apple Health XML, MyNetDiary CSV, Natural Cycles CSV, myAH portal text, photo-to-lab OCR, Oura OAuth. No C-CDA/FHIR/HL7 support. No general file parsing pipeline.

### Architecture: The Universal Ingest Pipeline

```
User drops file(s) or screenshot(s)
        |
        v
[Format Detection Layer]
  - MIME type + extension detection
  - Content sniffing (XML headers, JSON structure, CSV heuristics)
  - Known format matching (Apple Health, Flo JSON, MyFitnessPal CSV, etc.)
        |
        v
[Parser Router]
  - Structured parsers (FHIR JSON, C-CDA XML, Apple Health XML, known CSVs)
  - Semi-structured parsers (generic CSV, generic JSON, generic XML)
  - Unstructured parsers (PDF text extraction, screenshot OCR, plain text)
        |
        v
[Claude AI Normalization Layer]
  - For semi-structured and unstructured data
  - Identifies data type (labs, vitals, meds, symptoms, nutrition, etc.)
  - Extracts structured fields using vision or text analysis
  - Confidence scoring per extracted field
        |
        v
[Canonical Data Model]
  - All data normalized to internal schema
  - Source tracking (which app/file/date)
  - Deduplication against existing records
  - Conflict resolution (newer wins, higher-confidence wins)
        |
        v
[Storage + Indexing]
  - Route to appropriate Supabase tables
  - Generate pgvector embeddings for narrative search
  - Update Intelligence Engine knowledge base
```

### Supported Formats (Priority Order)

**Tier 1 -- Build Now (highest impact):**
- Screenshots/photos (Claude Vision OCR) -- lab results, appointment summaries, medication lists, discharge papers
- PDF parsing -- medical records, lab reports, discharge summaries, referral letters
- C-CDA/CCD XML -- standard US healthcare exchange format (every hospital system exports this)
- FHIR JSON -- mandated by 21st Century Cures Act, all US providers must support by 2026

**Tier 2 -- Build Next (common app exports):**
- Generic CSV with intelligent column mapping (covers 80% of app exports)
- Flo period tracker export (JSON format)
- Clue export format
- Bearable export format
- Daylio export (CSV)
- Generic JSON with schema detection

**Tier 3 -- Build Later (specialized):**
- HL7 v2 messages (legacy hospital systems)
- DICOM metadata extraction (beyond current PACS viewer)
- Apple Health .zip auto-extraction and streaming parse (already works)
- Garmin .FIT/.TCX/.GPX fitness files
- Strava export archives
- MyFitnessPal export (if format documented)

### Key Components to Build

1. **`src/lib/import/format-detector.ts`** -- Detect file format from content + extension
2. **`src/lib/import/parser-router.ts`** -- Route to appropriate parser
3. **`src/lib/import/parsers/fhir.ts`** -- FHIR R4 JSON parser (Patient, Observation, Condition, MedicationRequest, DiagnosticReport resources)
4. **`src/lib/import/parsers/ccda.ts`** -- C-CDA XML parser (extract labs, meds, problems, vitals, procedures)
5. **`src/lib/import/parsers/pdf.ts`** -- PDF text extraction + Claude analysis
6. **`src/lib/import/parsers/screenshot.ts`** -- Extend existing lab OCR to handle any medical document type
7. **`src/lib/import/parsers/generic-csv.ts`** -- Intelligent CSV parser with column heuristics
8. **`src/lib/import/parsers/generic-json.ts`** -- JSON schema detection and mapping
9. **`src/lib/import/normalizer.ts`** -- Claude-powered normalization for ambiguous data
10. **`src/lib/import/deduplicator.ts`** -- Cross-source deduplication logic
11. **`src/lib/import/canonical-model.ts`** -- Internal data model all imports normalize to

### New UI: Universal Import Page

Replace current import cards with a unified experience:
- **Drop zone** -- drag and drop any file(s), paste screenshots, or tap to browse
- **Auto-detection banner** -- "We detected 3 lab results and 2 medications from this PDF"
- **Review + confirm** -- show extracted data for user review before saving
- **Import history** -- log of all imports with source, date, record count
- **Connected apps** section -- OAuth integrations (Oura, future wearables)

### New API Route: `POST /api/import/universal`
- Accepts: multipart form data (any file type) or base64 image
- Returns: detected format, extracted records with confidence scores, preview for user confirmation
- Two-phase: detect+extract (returns preview), then confirm (saves to DB)

---

## Pillar 2: App & Wearable Integration Layer

**Goal:** Connect to every health data source that offers an API. For apps without APIs, make file import seamless.

### Integration Tiers

**Tier A -- Direct API (OAuth 2.0):**
These have mature APIs. Build full bidirectional or pull-based integrations.

| Integration | API Status | Data Types | Priority |
|---|---|---|---|
| Oura Ring | **Already built** | Sleep, HR, HRV, SpO2, stress, temp | Done |
| Apple HealthKit | Requires iOS companion app | Everything Apple Health collects | High (requires native app) |
| Google Health Connect | Android SDK (requires native app) | Everything on Android | High (requires native app) |
| Dexcom CGM | Mature REST API, OAuth 2.0, 90+ partners | Glucose readings, trends, events | High |
| WHOOP | OAuth 2.0, established API | Recovery, strain, sleep, workouts | Medium |
| Garmin Connect | Health API (ping/pull or push) | HR, steps, sleep, stress, SpO2, body comp | Medium |
| Withings | REST API | Weight, BP, body comp, sleep | Medium |
| Abbott Libre CGM | LibreView API | Glucose readings (1,440/day) | Medium |
| Fitbit/Google | Transitioning to Google Health API by Sept 2026 | Activity, sleep, HR | Medium |
| Strava | REST API (limited -- cardio only) | Workouts, distance, pace | Low |

**Tier B -- Export File Integration (no API):**
These apps have NO public API. Users must export data and import files.

| App | Export Format | Category | Our Import Strategy |
|---|---|---|---|
| MyFitnessPal | CSV (if available) | Calories/nutrition | Generic CSV parser with MFP column mapping |
| Cronometer | CSV export | Calories/nutrition | Generic CSV parser with Cronometer mapping |
| MacroFactor | Unknown export format | Calories/nutrition | Research format, build parser |
| Flo | JSON export | Period tracking | Dedicated Flo JSON parser |
| Clue | Export available | Period tracking | Research format, build parser |
| Bearable | Data export | Symptom tracking | Research format, build parser |
| Daylio | CSV export | Mood/mental health | Generic CSV parser with Daylio mapping |
| Sleep Cycle | Export available | Sleep | Research format, build parser |
| Strong | Apple Health sync | Workouts | Via Apple Health import |

**Tier C -- Healthcare System Integrations (FHIR/SMART):**
The 21st Century Cures Act mandates all US healthcare providers offer FHIR APIs.

| Integration | Standard | Data Types | Notes |
|---|---|---|---|
| Epic MyChart | SMART on FHIR | Full medical records | Largest US EHR (280M patients) |
| Cerner/Oracle Health | SMART on FHIR | Full medical records | Second largest |
| Athenahealth | SMART on FHIR + TEFCA | Full medical records | 80K+ providers on TEFCA |
| Any FHIR-compliant portal | SMART on FHIR | Labs, meds, conditions, vitals | Universal connector |

### Architecture: Integration Hub

```
src/lib/integrations/
  hub.ts              -- Central registry of all integrations
  types.ts            -- Shared types (IntegrationConfig, SyncResult, etc.)
  oauth-manager.ts    -- Generic OAuth 2.0 flow handler
  sync-scheduler.ts   -- Background sync scheduling (per-integration cadence)
  
  connectors/
    oura.ts           -- (already exists, move here)
    dexcom.ts         -- Dexcom CGM connector
    whoop.ts          -- WHOOP connector
    garmin.ts         -- Garmin Health API connector
    withings.ts       -- Withings connector
    fitbit.ts         -- Fitbit/Google Health connector
    libre.ts          -- Abbott Libre connector
    fhir-smart.ts     -- Generic SMART on FHIR connector (works with any compliant portal)
```

### Key Insight: The Native App Question

Apple HealthKit and Google Health Connect require native mobile apps. For the web-only MVP, the workaround is:
- **Phase 1 (now):** Accept Apple Health XML export (already built) and encourage manual export
- **Phase 2 (later):** Build a lightweight iOS/Android companion app that:
  - Reads HealthKit / Health Connect data
  - Syncs to LanaeHealth backend via API
  - Runs in background, syncs daily
  - Minimal UI -- just a sync status screen
  - This is NOT the full app, just a data bridge

### Settings Page Redesign: Integration Hub

```
Connected Apps & Devices
  [Oura Ring]      -- Connected (synced 2 hours ago) [Sync Now] [Disconnect]
  [Dexcom G7]      -- Connect >
  [WHOOP]          -- Connect >
  [Garmin]         -- Connect >
  [Withings]       -- Connect >
  [+ More devices...]

Import Your Data
  [Drop files here or tap to browse]
  Supported: PDF, screenshots, CSV, XML, JSON, Apple Health export, and more
  
  Recent Imports:
    Apr 14 -- MyAH portal labs (38 results) 
    Apr 13 -- Oura daily sync (1,187 days)
    Apr 10 -- Apple Health export (1,490 days)

Medical Records (FHIR)
  Connect your patient portal to automatically sync medical records.
  [Epic MyChart]   -- Connect >
  [Other portal]   -- Connect >
```

---

## Pillar 3: Competitive Intelligence System

**Goal:** Systematically study the top apps in every category. Mine their reviews for gold. Document what to build, what to fix, and what to add.

### Research Process (Per Category)

For each app category (symptom tracking, calorie tracking, period tracking, wearable companion, mental health, sleep, fitness):

1. **Identify top 3-5 apps** by downloads, ratings, and community mindshare
2. **Mine reviews** from: App Store, Play Store, Reddit (category-specific subs), community forums
3. **Extract patterns** into three columns:
   - **LOVE** (must match or exceed)
   - **HATE** (must avoid or fix)
   - **WISH** (our differentiating features)
4. **Document findings** in `docs/competitive/` per category
5. **Derive feature requirements** that feed into implementation plans

### Initial Research Summary (Already Completed)

#### Symptom Tracking (vs. Bearable, Flaredown, CareClinic)
- **LOVE:** Total customization, privacy-first, replaces multiple apps, built by patients
- **HATE:** Performance issues during flares, overwhelming options, aggressive paywalls (CareClinic)
- **WISH:** Adaptive UI that simplifies during bad days, integrated community, wearable unification
- **Our edge:** AI analysis (no competitor has this), medical API pipeline, Doctor Mode

#### Calorie/Nutrition (vs. MyFitnessPal, Cronometer, MacroFactor, Lose It)
- **LOVE:** Large food database (MFP), USDA-verified accuracy (Cronometer), adaptive algorithm (MacroFactor)
- **HATE:** Full-screen video ads mid-logging, user-submitted bad data, $20/mo paywalls, data breaches
- **WISH:** Verified food database, ad-free experience, desktop/web version, workout integration
- **Our edge:** No ads ever, USDA FoodData API (already planned in medical pipeline), Claude-powered food identification from photos

#### Period/Cycle Tracking (vs. Flo, Clue, Natural Cycles, Stardust)
- **LOVE:** Privacy-first (Clue, Stardust), FDA-cleared contraception (NC), fun design (Stardust)
- **HATE:** Privacy violations (Flo -- $56M settlement), data sharing with Facebook/advertisers
- **WISH:** Privacy with features, wearable integration, symptom correlation with cycle
- **Our edge:** Zero data monetization (subscription model), Oura cycle correlation, endometriosis-specific intelligence

#### Wearable Companions (vs. Oura, WHOOP, Fitbit, Apple Health)
- **LOVE:** Detailed biometrics, sleep scoring, recovery metrics
- **HATE:** Data silos (every wearable is its own island), privacy inconsistency, no cross-device view
- **WISH:** Unified wearable dashboard, cross-platform data, standardized data model
- **Our edge:** We ARE the unified platform. All wearables feed into one view.

#### All-in-One (vs. Apple Health, Google Fit, Samsung Health)
- **LOVE:** Single place for data (in theory)
- **HATE:** No backend API (Apple), no food tracking, no insights, no AI, cumbersome manual logging, deprecation (Google Fit)
- **WISH:** Better insights, actual AI coaching, cross-device access, food integration
- **Our edge:** Real AI analysis, web-accessible, food tracking, medical record integration

### Ongoing Competitive Intelligence

Create a living document at `docs/competitive/README.md` that tracks:
- Per-category competitive matrix (updated quarterly)
- Review mining playbook (specific Reddit subs, review sites, community forums to monitor)
- Feature gap analysis (what competitors have that we lack)
- Our unique advantages per category

---

## Pillar 4: Product Architecture -- The Modular Experience

**Goal:** Users customize LanaeHealth to their needs. No one is forced to use features they don't want. The app adapts to each user.

### User Archetypes

1. **The Aggregator** -- "I love my existing apps. I just want all my data in one place for analysis."
   - Minimal native features enabled
   - Heavy use of import and integrations
   - Primary value: AI analysis, correlations, Doctor Mode
   
2. **The Power Tracker** -- "I want one app for everything. Replace all my other apps."
   - All native features enabled (calories, cycle, symptoms, mood, sleep, etc.)
   - Wearable connected
   - Primary value: comprehensive logging + AI insights
   
3. **The Condition Manager** -- "I have a specific condition and need to track what matters for it."
   - Condition-specific preset (endometriosis, POTS, IBS, fibro, PCOS, etc.)
   - Relevant features auto-enabled, others hidden
   - Primary value: condition-specific correlations + Doctor Mode

4. **The Health Curious** -- "I just want to understand my health better."
   - Guided onboarding, progressive disclosure
   - Start simple (mood + 1-2 metrics), add complexity over time
   - Primary value: insights and education

### Modular Feature System

Each feature area is a **module** that can be enabled/disabled independently:

| Module | Native Tracking | Import-Only | Both |
|---|---|---|---|
| Symptoms | Full symptom logger | Import from Bearable/Flaredown | Yes |
| Nutrition | Calorie/macro tracker | Import from MFP/Cronometer/CSV | Yes |
| Cycle | Period/fertility tracker | Import from Flo/Clue/NC | Yes |
| Mood | 5-point mood + emotions | Import from Daylio | Yes |
| Sleep | Sleep detail logger | Import from Oura/Apple/wearables | Yes |
| Fitness | Workout logger | Import from Strava/Strong/Garmin | Yes |
| Medications | Med tracker + reminders | Import from pharmacy records | Yes |
| Labs | Lab result viewer | Import from portals/photos/PDFs | Yes |
| Vitals | BP, glucose, weight, temp | Import from Withings/Dexcom/wearables | Yes |
| Gratitude | Daily wins/gratitude journal | N/A (native only) | Native |
| Clinical Scales | PHQ-9, GAD-7 | Import from provider | Yes |
| Weather | Auto-fetch for correlation | N/A (auto) | Auto |

### Onboarding Flow (Customization Wizard)

The Bearable Killer session already includes a 6-step onboarding wizard. Extend it:

1. **Welcome** -- "LanaeHealth adapts to you"
2. **Your situation** -- "What best describes you?"
   - I have a specific condition to manage
   - I want to track my overall health
   - I just want all my health data in one place
   - I'm preparing for a doctor appointment
3. **Conditions** (if applicable) -- Multi-select condition presets
4. **Your apps** -- "Which apps do you currently use?" (we'll show you how to import)
   - Oura, Fitbit, Apple Watch, Garmin, WHOOP, Dexcom...
   - MyFitnessPal, Cronometer, Flo, Clue, Bearable, Daylio, Strava...
5. **Your features** -- Toggle which native modules to enable
   - Pre-populated based on archetype + conditions
   - "You can always add or remove these later"
6. **First action** -- Guide to either:
   - Connect first wearable, OR
   - Import first file, OR
   - Start first daily log

### Database: User Preferences

```sql
-- New table (extends user_onboarding from Bearable Killer)
CREATE TABLE user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_archetype text CHECK (user_archetype IN ('aggregator', 'power_tracker', 'condition_manager', 'health_curious')),
  enabled_modules text[] DEFAULT '{}',
  conditions text[] DEFAULT '{}',
  connected_apps text[] DEFAULT '{}',
  log_section_order text[] DEFAULT '{}',
  hidden_sections text[] DEFAULT '{}',
  onboarding_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Navigation Adaptation

Bottom nav and page content adapt based on enabled modules:
- **5 bottom tabs are fixed:** Home, Log, Patterns, Records, Chat
- **Log page** shows only enabled module cards in the carousel
- **Patterns page** shows correlations only for enabled data types
- **Records page** shows relevant record categories
- **Settings > Customize** lets users add/remove modules anytime
- **"More" menu** items reflect enabled features (Doctor Mode, Timeline, Imaging, etc.)

### The Import-Only Experience

For Aggregator users who use import-only for a category:
- The module card in Records shows imported data with source attribution
- No native logging UI for that category (unless they enable it)
- Data still feeds into correlations and AI analysis
- "Start tracking natively?" prompt available but not aggressive

---

## Implementation Priorities

### Now (Aligns with Active Sessions)
The Bearable Killer session is already building the native tracking UX (mood, vitals, gratitude, custom trackables, clinical scales, onboarding wizard). The Intelligence Engine and Medical API Pipeline are building the analysis backend. This plan focuses on what comes NEXT.

### Phase A: Universal Import Engine (Highest Impact)
1. Build format detection + parser router
2. Screenshot/photo OCR for any medical document (extend existing lab scanner)
3. PDF text extraction + Claude analysis
4. C-CDA XML parser (covers most hospital exports)
5. FHIR R4 JSON parser (future-proofs for Cures Act mandates)
6. Generic CSV intelligent mapper
7. New universal import UI (drop zone + review + confirm)

### Phase B: Core Integrations
1. Dexcom CGM connector (OAuth 2.0, high clinical value)
2. WHOOP connector (popular with health-conscious users)
3. Garmin connector (large user base)
4. Withings connector (clinical-grade devices)
5. SMART on FHIR patient portal connector (Epic MyChart, Cerner)

### Phase C: Modular Product Architecture
1. User preferences table + archetype selection
2. Onboarding wizard extension (archetype + app + module selection)
3. Module enable/disable system
4. Navigation adaptation based on preferences
5. Import-only vs native toggle per module

### Phase D: Competitive Feature Parity
1. Calorie/nutrition native tracker (USDA FoodData API, barcode scanning, meal photos)
2. Enhanced period/cycle tracker (beyond Natural Cycles import)
3. Fitness/workout logger
4. Medication reminders with notifications
5. Data export in multiple formats (CSV with all data, PDF clinical summary)

### Phase E: Native Mobile Companion App
1. Lightweight iOS app for HealthKit bridge
2. Lightweight Android app for Health Connect bridge
3. Background sync to LanaeHealth backend
4. Push notifications for medication reminders

---

## Verification Strategy

- **Import Engine:** Test with real files -- Apple Health XML, myAH PDFs, sample C-CDA from healthIT.gov, sample FHIR bundles from HAPI FHIR server
- **Integrations:** Test OAuth flows end-to-end with real developer accounts
- **Modular UX:** Test all 4 archetypes through onboarding, verify correct modules shown
- **Data flow:** Import data via file, verify it appears in Records, Patterns, and Chat context
- **Deduplication:** Import overlapping data from two sources, verify no duplicates
- **Mobile viewport:** All new UI tested at 375px width
- **Existing features:** Regression check -- all current pages still work after changes

---

## Key Design Principles

1. **Import is the killer feature.** Make it stupidly easy. Drag, drop, done.
2. **No ads, ever.** Subscription model. Users' trust is the product.
3. **Privacy first.** All data stays in user's database. Zero data monetization. Be the anti-Flo.
4. **Adaptive, not overwhelming.** Show users what they need, hide what they don't. Progressive disclosure.
5. **Study reviews obsessively.** Every feature we build should address a real pain point from real users.
6. **Native or import -- both are first-class.** No feature should assume users track natively.
7. **AI analysis is the moat.** Anyone can build a tracker. No one else has the Intelligence Engine + 34 medical APIs + Claude reasoning.

---

## Pillar 5: Privacy, Security & Compliance -- The Anti-Flo Blueprint

**Goal:** Make privacy a product feature, not a policy footnote. When users compare LanaeHealth to Flo, MyFitnessPal, or any consumer health app, privacy should be the reason they switch.

### The Flo Baseline (What We Refuse To Do)

Flo paid $56M in 2024 for sharing cycle data with Facebook, Google, AppsFlyer, Flurry. The FTC order bars Flo from sharing health data for advertising, ever. Our positioning starts there and goes further:

- **Zero third-party analytics on health pages.** No Google Analytics, no Meta Pixel, no Amplitude on any route that renders patient data. Product analytics use self-hosted PostHog or nothing.
- **Zero advertising IDs touched.** We do not collect IDFA, GAID, or fingerprint signals.
- **Zero data brokers.** No data enrichment vendors, no people-search APIs, no credit header data.
- **Zero data sales.** Contractually prohibited in our Terms, not just privacy policy. Audited annually.

### Data Architecture Layers

**Layer A -- Transport & At-Rest Encryption (Baseline):**
- TLS 1.3 everywhere (Vercel default)
- AES-256 at rest (Supabase default for Postgres + Storage)
- No plaintext logs -- request bodies scrubbed before log ingestion
- Secrets in Vercel environment vars, rotated quarterly

**Layer B -- Row-Level Security & Tenancy (Current: single-tenant, Future: multi-tenant):**
- Every table adds `user_id uuid NOT NULL REFERENCES auth.users` before public launch
- Supabase RLS policies enforce `user_id = auth.uid()` on every SELECT/INSERT/UPDATE/DELETE
- Service-role key never reaches client -- only used in server routes
- Service-role operations audit-logged to `audit_trail` table with actor, action, target_user_id, timestamp

**Layer C -- AI Processing Boundary:**
- Anthropic API calls: use the enterprise BAA-eligible endpoint once available; until then, no direct PHI in prompts for the public product (current personal app is exempt -- one-patient consent)
- Zero-retention flag set on all Anthropic calls (`anthropic-beta: prompt-caching-2024-07-31` does NOT cause retention -- confirmed, but we also set org-level retention=0)
- Prompt + response pairs never logged verbatim, only token counts + latency
- User can view full AI interaction history in Settings > AI Activity (transparency)

**Layer D -- Optional Client-Side Encryption (Phase H):**
- Vault mode: user-held key encrypts sensitive fields (mental-health notes, free-text symptoms) client-side
- Server stores only ciphertext for vault fields -- AI analysis opt-in per field
- Recovery via Shamir secret sharing with user-nominated trustees

### Compliance Roadmap

| Phase | Standard | Scope | Status |
|---|---|---|---|
| Pre-launch | Privacy policy rewrite (readable, FTC-compliant) | Entire app | Pending |
| Pre-launch | Terms of Service with contractual no-sale pledge | Entire app | Pending |
| Public beta | HIPAA-aligned practices + Supabase BAA | US users | Supabase BAA available on Pro+ plan |
| Public beta | Vercel HIPAA BAA (Enterprise plan) or self-host edge routes | US users | Decide before public launch |
| GA + 3mo | SOC 2 Type II audit (via Vanta or Drata) | Org + platform | Plan kickoff at 1K paid users |
| GA + 6mo | Third-party penetration test (annual thereafter) | Platform | Budget allocated |
| GA + 12mo | HITRUST r2 (if B2B clinical customers demand) | Platform | Defer until demand |
| EU launch | GDPR DPA + EU representative + data residency | EU users | Phase H |
| CA users | CCPA/CPRA compliance (already required at 100K CA residents) | CA users | Monitor thresholds |

### User-Facing Privacy Controls

Settings > Privacy becomes a first-class surface, not a buried link:

```
Your Data
  [Download everything]       -- CSV + JSON export, one click, includes raw source files
  [Delete my account]          -- 30-day soft delete with recovery, then permanent purge
  [Pause AI analysis]          -- Stop all Claude calls, keep data local
  [Export + quit]              -- One button: download, delete, confirm email sent

AI Transparency
  Last 30 days: 247 AI calls, 1.2M tokens processed, 0 retained by Anthropic
  [View activity log]
  [Disable specific engines] (Cycle, Nutrition, Medication, etc.)

Sharing
  No data shared. Ever. Not for ads, analytics, research, or any other purpose.
  [Read our no-share commitment]   -- links to Terms section with contractual obligation
```

### Incident Response Plan

- **24-hour internal detection** target for breach or data-exposure incident (log alerts, Sentry anomalies)
- **72-hour user notification** for any incident affecting user data, regardless of jurisdiction minimums
- **Post-mortem published within 30 days** to `docs/incidents/` -- public blameless retrospective
- **Annual red team exercise** once at 10K users

### Key Files to Add

- `docs/privacy/threat-model.md` -- STRIDE analysis across app layers
- `docs/privacy/data-map.md` -- Every field, where it lives, who can read it, how long
- `docs/privacy/subprocessors.md` -- Living list of all third parties, their access scope, BAA status
- `src/lib/audit/trail.ts` -- Append-only audit log writer
- `src/lib/privacy/export.ts` -- User-data export assembler
- `src/lib/privacy/deletion.ts` -- Account deletion with cascade + soft-delete window

---

## Pillar 6: Monetization & Business Model

**Goal:** Build a sustainable subscription business that stays aligned with user interests forever. Zero VC pressure, zero ad incentives, zero reason to monetize data.

### Pricing Model

**Free Tier -- "Personal Aggregator":**
- Unlimited imports (all formats)
- Up to 2 connected wearables/apps
- 90-day data retention on AI analysis (raw data retained forever)
- Core modules: symptoms, cycle, mood, sleep (import-only)
- No Doctor Mode, no condition reports, no deep correlations

**Plus -- $9/month or $79/year:**
- Unlimited connected integrations
- Unlimited AI analysis history
- All native trackers (nutrition, fitness, medications, vitals)
- Doctor Mode PDF reports (3/month)
- Standard correlations + condition-specific intelligence

**Pro -- $19/month or $159/year:**
- Everything in Plus
- Unlimited Doctor Mode reports
- FHIR portal integrations (Epic MyChart, Cerner)
- Medical API pipeline (all 34 research APIs)
- Priority Claude model (Opus-tier) for chat + analysis
- Condition presets with specialist-grade correlations (endo, POTS, IBS, fibro, PCOS, IBD, MS, long-COVID)
- Family sharing (up to 4 members on one household plan) -- Phase F

**Lifetime -- $499 one-time:**
- All Pro features, forever, for one user
- Capped at first 5,000 users -- creates founder-grade loyal base
- Positioned as "buy once, trust forever" -- direct anti-Flo messaging

**Clinical -- Custom (Phase I):**
- B2B for clinics/researchers
- Multi-patient dashboards, cohort analytics, audit logs
- BAA + HITRUST included
- Per-seat pricing with volume discount

### Why These Numbers

Flo Premium = $50/year. MyFitnessPal = $20/month. Bearable = $15/month. Our $9 starting tier undercuts MFP, matches Flo's annual value, and beats Bearable. The $19 Pro tier captures power users who currently stack 3 apps ($60/mo combined). Lifetime at $499 = 4 years of Pro, a no-brainer for the chronic-illness cohort who will use this for life.

### Revenue Principles

- **No free trial of Pro.** Free tier is permanently useful on its own. Paid users pay because the analysis + Doctor Mode genuinely save them money/time at appointments.
- **No dark patterns.** Cancel in one click from Settings. Refunds for first 14 days, no questions. Annual plans prorated on cancel.
- **No price increases for existing subscribers** grandfathered for 2 years minimum.
- **Student and hardship discount** (50% off with application, no documentation required -- honor system).
- **Open revenue reporting** once at 1K paid users: MRR, churn, cost-to-serve published quarterly in a public transparency post.

### Customer Acquisition Math (Target)

- LTV: Plus user = $79 × 3 years = $237. Pro user = $159 × 4 years = $636. Lifetime user = $499.
- CAC target: <$30 blended. Organic + referral-first. No paid ads on Meta (principle + Flo precedent).
- Referral program: existing user gets 2 months free per referred paying user. Capped at 12 months/year free.
- Content-led: in-depth medical content (the Competitive Intelligence pillar doubles as SEO moat).
- Community-led: Reddit presence on r/endo, r/POTS, r/IBS, r/fibromyalgia, r/PCOS -- no shilling, just genuinely helpful presence. Long game.

### Payment Infrastructure

- Stripe Billing for subscriptions (already integrated in Vercel ecosystem)
- Apple IAP + Google Play Billing when native apps ship (Phase E) -- eat the 15-30% cut on mobile, keep web direct
- Annual prepay discount: 34% (functionally two months free)
- Regional pricing for low-GDP countries (Phase H) via Stripe's built-in PPP
- No crypto, no BNPL -- simplicity over edge cases

---

## Pillar 7: Clinical Validation & Scientific Credibility

**Goal:** Be the one consumer health app with real peer-reviewed evidence behind its correlations and claims. Turn AI-flagged patterns into publishable research.

### Why This Matters

Every competitor makes vague "insights" claims. None have published validation. A single peer-reviewed paper showing the LanaeHealth correlation engine reliably detects POTS severity changes (or endometriosis flare prediction, or hypothyroid symptom burden) creates a moat no VC-funded competitor can match in under 2 years.

### Clinical Advisory Board

Recruit 5 specialists at launch. Target:
- Gynecologist with endometriosis specialty (Lanae's condition + large patient segment)
- Cardiologist with POTS/dysautonomia focus
- Gastroenterologist for IBS/IBD
- Endocrinologist for thyroid/PCOS
- Primary-care physician for generalist review

Advisory structure: quarterly 1-hour video review of correlation outputs, small equity grant or cash retainer ($500/quarter), named on About page with disclaimer that advisors review but do not diagnose.

### Research Agenda

**Year 1:**
- Paper 1: "Smartphone-wearable correlation engine detects POTS orthostatic severity: validation against tilt-table testing" -- retrospective analysis on opt-in users with confirmed POTS + worn CGM/HR monitor
- Paper 2: "Cycle-symptom correlation using AI pattern mining: agreement with physician-assessed endometriosis flare patterns" -- retrospective on endo cohort

**Year 2:**
- Paper 3: "Nutrient-symptom correlations in chronic illness: AI-surfaced patterns across 10K users" -- observational
- Paper 4: "Pre-appointment clinical summary generation: physician-rated clinical utility of AI-assembled patient reports" -- prospective RCT arm
- File for FDA Software as Medical Device (SaMD) Class II clearance IF Paper 1 supports clinical claim

**Ongoing:**
- Open data opt-in: "Contribute anonymized data to research" toggle in Settings > Research
- Dataset of opt-in longitudinal health data becomes a standalone asset for academic partners
- Revenue share for users who opt in: free 1 year Plus for each dataset contribution

### Disclosures & Ethics

- No diagnostic claims without FDA clearance. Intelligence engine outputs are "patterns to discuss with your doctor" not "diagnoses."
- Every correlation card labeled with evidence tier (matches existing Clinical Intelligence Engine design)
- IRB approval for any prospective research before user enrollment
- Consent flow for research participation separate from product consent -- opt-in, revocable, not bundled
- Published negative results too -- if a correlation doesn't replicate, say so publicly

### FDA Pathway Decision Framework

Default: stay a wellness app (no FDA involvement), positioned as "tool for discussion with your doctor."

Trigger reevaluation to pursue SaMD Class II if ANY of:
- Clinical advisory recommends a specific diagnostic claim is defensible with our data
- A clinical customer (Phase I) requires FDA clearance for reimbursement
- A correlation hits ≥90% sensitivity + specificity vs. gold-standard diagnostic in a ≥500-person study

Until trigger: operate safely within wellness-app boundary. Claims language reviewed quarterly by counsel.

---

## Extended Roadmap: Phases F Through J

### Phase F -- Multi-User, Family & Caregiver Accounts (Post-GA, 6-12mo)

Many users tracking chronic illness are ALSO managing a family member's health (aging parent, child with condition, partner's diagnoses). Family accounts unlock a large segment.

**Scope:**
- Household plan (up to 4 profiles)
- Caregiver permission model: full-access (spouse), view-only (adult child helping parent), emergency-only (designated contact)
- Pediatric profiles with parent as primary account holder, transfer-to-self at age 18
- Shared calendar view for household appointments
- Delegated Doctor Mode: caregiver can generate reports for dependent's appointments
- HIPAA Minor Consent handling varies by state -- start with consent by parent, age-transition flow

**Database:**
- `household` + `household_member` tables
- `permissions` table (subject_user_id, actor_user_id, scope, expires_at)
- Every existing RLS policy updated to include permission checks

**UI:**
- Profile switcher in AppShell (like Netflix profiles)
- Settings > Household > invite, permissions, remove
- Clear visual indicator when viewing another person's data ("Viewing: Mom's account")

### Phase G -- Developer Platform & Third-Party Ecosystem (12-18mo)

Become the connective tissue of personal health data. Let third-party tools read (with user consent) and write to LanaeHealth.

**Scope:**
- OAuth 2.0 public API (read + write scopes per module)
- Webhook system (notify external apps of new data)
- Developer portal: register app, get client_id, browse API docs
- Standard FHIR R4 export endpoint -- any FHIR-compliant tool can read user data
- SDKs: TypeScript, Python, Swift, Kotlin
- Published as first-class: "Apps connected to LanaeHealth" directory

**Economic model:**
- Free for read access with user consent
- Revenue share OR developer subscription ($50/mo) for write access
- "Recommend on LanaeHealth" directory drives app installs, we take a cut or flat fee

**Risks:**
- API surface expands attack surface -- dedicated security review before launch
- Developer policy: no resale of user data, no ads against user data, audited annually
- Users see and revoke app access per scope in Settings > Connected Apps

### Phase H -- International Expansion & Localization (18-24mo)

**Target order (by chronic-illness community size + regulatory ease):**
1. United Kingdom (shared language, NHS data via FHIR, GDPR)
2. Canada (shared language, similar healthcare data patterns, PIPEDA)
3. Australia (shared language, My Health Record via FHIR)
4. Germany + France + Netherlands (EU, GDPR, eIDAS)
5. Japan (wearable-heavy culture, requires JP translation)
6. Brazil (LGPD, large patient population, portuguese translation)

**Per-market work:**
- Translation (i18n framework, likely next-intl, ~15K strings)
- Date/time/unit localization (metric vs imperial, cycle tracking conventions)
- Regional food database (USDA US-only, CIQUAL for France, NEVO for Netherlands)
- Healthcare integration mapping (NHS FHIR, Australia My Health Record, etc.)
- Regional pricing via Stripe PPP
- Local payment methods (SEPA, iDEAL, PIX)
- Privacy: GDPR DPA, EU representative, data residency

**Data residency:**
- EU users: Supabase EU region (Frankfurt or Dublin)
- Data never leaves region for primary storage
- AI processing: Anthropic EU endpoint when GA; interim disclose to user + opt-in

### Phase I -- Provider-Side Tools & Clinical Integration (24-36mo)

The natural B2B extension: put LanaeHealth-generated reports inside provider EHRs so doctors actually see the data.

**Scope:**
- Provider portal: doctor logs in, sees patients who have shared data
- EHR-embedded app: SMART on FHIR app that runs inside Epic/Cerner
- Patient-generated data (PGD) formatted for clinical review
- Pre-visit summary auto-delivered 24h before appointment
- Visit outcomes logged back: diagnoses updated, prescriptions started, orders placed

**Pricing:**
- Free for providers (patients drive demand -- "my doctor uses LanaeHealth")
- Or per-patient monthly fee paid by practice ($5-10/patient for practices using it heavily)

**Regulatory:**
- HIPAA BAA with practice
- SOC 2 Type II + HITRUST becoming table stakes
- Possibly FDA clearance depending on Phase 7 research outcomes

### Phase J -- Longitudinal Research Platform (36mo+)

If we get 100K+ users with 2+ years of data, the dataset becomes unique in the world: consumer-generated longitudinal multi-modal chronic-illness data.

**Scope:**
- Opt-in research enclave (de-identified, aggregate-only)
- Academic partnerships (NIH All of Us style, but patient-owned)
- Pharma partnerships ONLY on user opt-in with cash compensation direct to user
- Revenue: licensing fee to research partners + per-project
- Governance: patient advisory board reviews every proposed study, blocks predatory asks

**Ethical guardrails:**
- Users own their data. Partners get access, not ownership.
- No genetic data unless separately consented with specific study
- No insurance industry access, ever
- Annual transparency report: every access, every partner, every dollar

---

## Success Metrics & KPIs

### North Star Metric

**Weekly Active Deep Users (WADU):** users who logged/imported in the last 7 days AND viewed an AI-generated insight AND engaged (tapped, saved, shared, exported). This captures real value delivery, not vanity activity.

### Phase-Gated KPIs

**Pre-launch (now):**
- Personal app stable (Lanae uses it daily, data integrity verified)
- Test coverage ≥70% on import, intelligence, integrations
- All 6 native trackers feature-complete

**Private beta (first 100 users):**
- Time-to-first-insight ≤ 5 minutes from signup
- Import success rate ≥90% on Tier 1 formats
- Day-7 retention ≥40%
- NPS ≥40 (health apps benchmark: 25-35)

**Public beta (first 10K users):**
- WADU / MAU ≥35%
- Free-to-Plus conversion ≥5% within 30 days
- Churn (Plus) ≤6% monthly
- Organic referral rate ≥15% of signups
- CAC ≤$30 blended

**GA + 12 months (target: 50K users, 5K paid):**
- WADU / MAU ≥40%
- Plus-to-Pro conversion ≥15%
- Annual-plan adoption ≥50% of paid
- Churn (Plus) ≤4% monthly, Churn (Pro) ≤2%
- MRR ≥$75K
- Gross margin ≥80% (after Supabase + Vercel + Anthropic)

### Leading Indicators (watch weekly)

- Imports per new user in first 7 days (health = imports happen in week 1)
- Integrations connected per user (median target: 2)
- Time-to-first-Doctor-Mode-report (target: <30 days post-signup for Plus users)
- AI chat messages per week per user (engagement with intelligence surface)
- Support ticket rate per 1K active users (target: <5/week, action-threshold: >15)

### Lagging Indicators (watch monthly)

- MRR, churn, CAC, LTV
- Clinical-intelligence flag acceptance rate (user clicks "this matches my experience" on correlations)
- Advisory-board review: % of AI outputs flagged as clinically sound
- NPS by cohort (condition, archetype, tenure)

---

## Risk Register

Top risks ranked by (impact × likelihood), with mitigations.

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| 1 | Anthropic pricing or policy change makes AI analysis uneconomical | High | Medium | Multi-provider adapter pattern (swap to local Llama or OpenAI within 2 weeks). Revenue model includes AI cost buffer at 30% of ARPU. |
| 2 | Major privacy breach from subprocessor (Supabase, Vercel, Anthropic) | Critical | Low-Medium | Minimize data in third-party services. Audit BAAs annually. Pentest before GA. Incident response plan drilled quarterly. |
| 3 | FDA reclassifies consumer health tracking as medical device | High | Low | Wellness-app boundary held strictly; FDA pathway (Phase 7) optional, not required. Claims language reviewed by counsel. |
| 4 | Large competitor copies features + outspends us | Medium | High | Moat is import breadth + AI depth + privacy positioning, not individual features. Compete on trust + depth. |
| 5 | Apple/Google deprecate web-based health data import paths | Medium | Low-Medium | Phase E native companion app is the insurance policy. Don't delay past GA + 6mo. |
| 6 | Solo-dev bus factor (one person hit by a bus) | High | Low | Quarterly codebase walkthrough document. Every major system has a README. Cold-start runbook in `docs/handoff.md`. |
| 7 | User generates Doctor Mode report, doctor dismisses it as junk, user churns | Medium | Medium | Clinical advisory board validates reports. Physician feedback survey embedded in report. Iterate report format quarterly. |
| 8 | Data corruption from bad import (user dumps 10 years of MFP and it wipes their logs) | High | Medium | Every import is additive, never destructive. Soft-delete with 30-day recovery. Snapshot before bulk import. |
| 9 | Cost-of-serve (AI + infra) exceeds ARPU on free tier | Medium | Medium-High | Free-tier caps on AI calls. Rate limits per user. Upgrade prompts at limit, not blocking. |
| 10 | Regulatory cease-and-desist from state medical board | Medium | Low | Wellness-app positioning + "not diagnostic" disclaimers. Counsel on retainer at GA. |

---

## Launch Strategy

### Stage 1 -- Personal App (Now)
- Single user (Lanae), real medical data, full feature surface
- Prove the intelligence engine actually helps at real doctor appointments
- Stress-test import, integrations, edge cases
- Goal: 1 year of daily use with zero data-loss incidents

### Stage 2 -- Friends & Family Beta (Pre-launch, 2-4 weeks)
- 10-20 users from personal network with chronic illness
- Free Pro tier, direct founder access via Slack/email
- Weekly feedback calls, bug bounty program (gift cards for real bugs)
- Goal: find the 20 highest-impact UX friction points

### Stage 3 -- Private Beta (Invitation-Only, 2-3 months)
- Waitlist signups via landing page + targeted posts in condition subreddits
- Invite 1,000 users in waves of 100, monitoring onboarding completion + retention
- Feedback loop: in-app feedback button, bi-weekly survey, community Discord
- Goal: retention curve flattens at ≥30% day-30

### Stage 4 -- Public Beta (Open Signup, 3-6 months)
- Open signup, free tier available, Plus/Pro launched
- Content marketing active: blog posts, SEO, partnerships with patient advocacy groups
- Product Hunt launch
- Community-built: Discord mod team, moderated Reddit presence
- Goal: 10K users, 500 paid, NPS ≥40

### Stage 5 -- General Availability (6 months+)
- Lifetime tier opens (first 5,000)
- Native iOS/Android apps ship
- Partnership with 1-2 condition-specific advocacy orgs (endo, POTS)
- First peer-reviewed paper published
- Goal: 50K users, 5K paid, $75K MRR

### Stage 6 -- Platform (Year 2+)
- Phase F (family), G (developer API), H (international), I (provider tools) in sequence or parallel based on demand

---

## Team & Resource Plan

### Current State (2026-Q2)
- 1 founder (solo dev, uses Claude Code heavily for leverage)
- Personal app stable, public platform not yet launched
- No employees, no contractors, no VC

### Through Public Beta (Solo + Fractional)
- Founder stays on product + eng
- Fractional medical advisor (clinical board member, few hours/month, equity)
- Fractional legal counsel (pre-launch: privacy policy, Terms; ongoing: retainer)
- Fractional privacy/security consultant (SOC 2 prep)
- Cost: <$4K/month outside infrastructure

### At 5K Paid Users / $75K MRR (Target: GA + 12mo)
- First hire: Senior full-stack engineer (iOS/Android native, or backend depth)
- Customer success lead (fractional initially, FT at 10K paid)
- Retain founder on product + strategy + AI/intelligence engine (where leverage is highest)

### At 20K Paid Users / $300K MRR
- Clinical product manager (MD or nurse with tech experience)
- Security/privacy engineer (SOC 2 ownership)
- Designer (currently Claude + founder; eventually needs a real one)

### Hiring Principles
- Remote-first, global
- No VC, so compensation is market cash + meaningful equity
- No ads, no dark patterns -- filter hires who share the values
- Small team preference: optimize for leverage, not headcount

---

## Legal & Ethical Framework

### Terms & Policies (Pre-launch Required)
- Privacy Policy (readable, specific, not generic)
- Terms of Service (contractual no-sale clause, no-ads clause, termination rights)
- Data Processing Addendum (for future B2B + GDPR)
- Acceptable Use Policy
- Research Consent (separate from product consent)
- Cookie Policy (minimal -- functional + anonymous self-hosted analytics only)

### Ethical Commitments (Published)
- No data sold to advertisers, insurers, data brokers, pharma, or any third party, ever
- No "surprise" feature changes that weaken privacy
- No dark patterns in subscription or deletion flows
- Annual transparency report (users, revenue, incidents, data requests)
- Bug bounty program (once platform is stable)
- Safe harbor for security researchers (no prosecution, pay fair bounty)

### Disclosures
- Every AI output labeled with evidence tier and limitations
- Clinical advisory board named publicly with credentials
- Subprocessors listed publicly, updated within 7 days of change
- Breach history disclosed in perpetuity (even if zero)

---

## Updated Current State (April 2026)

### Implementation Complete (per MASTER_PLAN_STATUS.md)
- **Pillar 1** Universal Import: format detector, parser router, canonical model, 8 Tier-1 parsers, 6 Tier-2 parsers, universal import UI, history
- **Pillar 2** Integrations: 8 OAuth connectors (Oura, Dexcom, WHOOP, Garmin, Withings, Libre, Fitbit, Strava) + SMART-on-FHIR, sync scheduler, cron jobs
- **Pillar 3** Competitive Intelligence: README + 8 category docs with review mining playbook
- **Pillar 4** Modular Architecture: 12 modules, 4 archetypes, 8 condition presets, 5-step onboarding, adaptive nav
- **6 Native Trackers:** Cycle (endo mode), Nutrition (USDA + AI), Sleep (hypnogram + debt), Fitness (chronic-illness mode), Medication (PRN + PDC), Vitals (tilt-table + orthostatic)
- **Intelligence:** 5-engine dashboard, Clinical Intelligence with 6 personas, 34 medical APIs integrated
- **Infrastructure:** 158 tests passing, production on Vercel, PACS viewer at /imaging

### Remaining (Explicit Out-of-Scope Web)
- HL7 v2 parser (legacy hospital format, niche)
- DICOM metadata beyond PACS viewer
- Garmin .FIT/.TCX/.GPX binary parsers
- iOS HealthKit bridge (Phase E)
- Android Health Connect bridge (Phase E)

### Pre-Launch Blockers (Net-New from Pillars 5-7)
- Privacy policy + Terms of Service (legal counsel engagement)
- Supabase + Vercel BAAs executed
- User authentication (currently single-tenant; add Supabase Auth + RLS migration)
- Multi-tenant RLS policies on every table
- Stripe Billing integration for Plus/Pro/Lifetime
- SOC 2 readiness kickoff (Vanta or Drata)
- Clinical advisory board recruited (5 specialists)
- Landing page + waitlist
- Subprocessor page + data map + threat model docs

---

## Pillar 8: Daily Story -- The Check-In UX That Makes This Usable

**Goal:** Replace the 14-card LogCarousel as the primary logging surface with a narrative two-check-in flow that opens already filled in from wearable data. Users confirm and annotate; they do not build the picture from scratch.

### Why This Pillar Exists (Honest Diagnosis)

All four implementation pillars shipped, but the product failed its own purpose: logging is slow, ugly, and asks the user for data the app already has. A chronic-illness patient on a bad day will not navigate 14 carousel cards. The symbolic failure: Oura data sits in `oura_daily` while the user is asked "how did you sleep?" in a blank card. This pillar corrects that.

### The Two Check-Ins

**Morning check-in (6am-11am window) -- "Here's your night":**
- Prefilled from Oura: total sleep, sleep score, deep/REM split, HRV, resting HR, readiness
- Prefilled from cycle: day X of Y, predicted phase
- User confirms with one tap ("matches" / "felt worse" / "felt better") or corrects
- One slider: pain on waking (0-10), defaulted to yesterday's evening value
- Optional voice: "anything notable about the night?"
- Target: ≤30 seconds to complete, ≤800ms to render

**Evening check-in (6pm-midnight window) -- "Here's your day":**
- Prefilled from Oura: steps, active calories, resting HR trend, stress minutes
- Prefilled from weather: temp, pressure, humidity (for migraine/joint correlation)
- Prefilled from meds: which PRN/scheduled meds were logged today vs missed
- User provides: overall 1-5 feeling, symptom pills (top 6 for this user, not all), optional voice narrative
- Smart ask: "pain was 6 yesterday evening -- how is it now?" slider
- Target: ≤90 seconds to complete

### Decisions Locked (as of 2026-04-16)

1. **Two check-ins, not one.** Morning captures sleep freshness; evening captures day integration. Push-notification reminders at user-configured times.
2. **Data-first, not question-first.** Show what the app already knows, ask the user to confirm/correct/annotate. Eliminates the "blank card asking what the app knows" failure.

### Architecture

```
/log (route)
  |
  v
[Time-of-day router]
  - 6am-11am:    <MorningCheckIn />
  - 6pm-midnight: <EveningCheckIn />
  - Other:        Show "next check-in at Xpm" + quick-log button + details link
  |
  v
[Prefill API: /api/log/prefill]
  Parallel fetches:
  - Oura daily (sleep for morning, activity for evening)
  - Weather (lat/lon from user profile)
  - Cycle (current day, phase)
  - Yesterday's pain/mood (for anchor + pattern continuity)
  - Medication schedule (taken vs pending)
  - Returns: single prefill object rendered into the check-in
  |
  v
[CheckIn component]
  - Renders prefilled cards at top
  - Minimal question surface (1-3 taps for morning, 3-5 for evening)
  - "Log more detail" reveals existing LogCarousel as power-user mode
  - Saves on every interaction (optimistic + SaveIndicator)
```

### Files to Build

- `src/app/api/log/prefill/route.ts` -- parallel data prefill endpoint
- `src/components/log/MorningCheckIn.tsx` -- sleep data-first, pain-on-waking, notable
- `src/components/log/EveningCheckIn.tsx` -- day data-first, feeling/symptoms, notable
- `src/components/log/PrefilledDataCard.tsx` -- shared card showing wearable data with "matches / worse / better" tap targets
- `src/components/log/VoiceNote.tsx` -- Whisper-based voice-to-text for "anything notable" field
- `src/lib/log/prefill.ts` -- server-side prefill assembler
- `src/lib/log/checkin-window.ts` -- time-of-day routing logic

### What Happens to the Existing Carousel

- Not deleted. Becomes "Detail mode" accessible from check-in via a "Log more detail" button.
- Power-user path for Lanae or users who want granular control.
- Archetype-based filtering still applies.
- Also remains the source of truth for module data structures.

### Success Metrics

- Check-in completion rate ≥ 80% on days with a wearable sync
- Median time-to-complete ≤ 45 seconds across both check-ins
- User overrides prefill ≤ 15% of the time (high prefill = low friction + high accuracy)
- Voice-note usage ≥ 30% of evening check-ins (proves voice is the right primitive)

---

## Closing Principle

Every decision in this plan optimizes for a single long-term bet: **the patient-aligned health platform wins because patients eventually figure out who actually has their interests at heart.** Flo optimized for ad revenue and lost $56M + their reputation. MyFitnessPal optimized for acquisitions and got acquired three times, each time degrading. We optimize for the patient, forever. Every feature, every policy, every hire filters through: does this serve the patient, or does it serve something else at their expense?

If in doubt, the patient wins. That's the moat. That's the product.

