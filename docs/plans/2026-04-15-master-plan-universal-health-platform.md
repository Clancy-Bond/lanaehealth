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

This master plan covers the REMAINING four pillars needed to complete the product vision.

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
