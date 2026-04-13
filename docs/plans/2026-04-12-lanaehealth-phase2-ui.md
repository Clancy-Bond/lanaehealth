# LanaeHealth Phase 2: Core UI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete user interface for LanaeHealth with Warm Modern design - the home screen with health ring, daily logging flow, records hub, doctor mode, and mobile-first navigation. Every screen connects to the real Supabase data via the backend modules built in Phase 1.

**Architecture:** Next.js 16 App Router with server components where possible, client components for interactivity. Tailwind CSS 4 with custom CSS variables for the Warm Modern design system. Mobile-first responsive design. All data flows through the existing `src/lib/api/` modules to Supabase.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts (charts), Lucide React (icons), date-fns (dates)

**Design System:**
- Background: `#FAFAF7` (warm white)
- Cards: `#FFFFFF` with `shadow-sm` and `rounded-2xl`
- Primary accent: Sage `#6B9080`
- Secondary accent: Blush `#D4A0A0`  
- Pain scale: `#FCD34D` (mild) -> `#F97316` (moderate) -> `#DC2626` (severe)
- Text primary: `#1A1A2E`
- Text secondary: `#6B7280`
- Borders: `#E5E5DC`
- Font: Inter (already available via Geist which is Inter-based)
- Min touch target: 44x44px
- Border radius: `rounded-2xl` for cards, `rounded-xl` for buttons

---

## Task 1: Design System + Global Styles + Root Layout

Create the Warm Modern design system as CSS variables, update the root layout with app metadata, and set up the font/color foundation.

**Files:**
- Modify: `src/app/globals.css` - Replace with Warm Modern design tokens
- Modify: `src/app/layout.tsx` - Update metadata, add viewport meta for mobile

**What to build:**

globals.css: Replace the default Next.js styles with the Warm Modern design system. Define CSS custom properties for all colors (background, card, accent-sage, accent-blush, pain-low/med/high, text-primary, text-secondary, border). Set body font to the Geist Sans variable. Add utility classes for common patterns (card styling, section spacing). Keep it lean - Tailwind handles most styling.

layout.tsx: Update metadata title to "LanaeHealth" and description to "Your complete health story, ready for every doctor." Add viewport meta tag for mobile (width=device-width, initial-scale=1, viewport-fit=cover). Keep the Geist font setup. Add a class to html for the warm background color.

Commit: "feat: add Warm Modern design system and update root layout"

---

## Task 2: Bottom Navigation + App Shell

Build the mobile-first bottom tab navigation and the app shell that wraps all pages.

**Files:**
- Create: `src/components/BottomNav.tsx` - 5-tab bottom navigation bar
- Create: `src/components/AppShell.tsx` - Wrapper with nav + main content area
- Modify: `src/app/layout.tsx` - Wrap children in AppShell

**What to build:**

BottomNav.tsx: Fixed bottom bar with 5 items. Use Lucide icons. Items:
1. Today (Home icon) -> `/`
2. Patterns (BarChart3 icon) -> `/patterns`  
3. +LOG (PlusCircle icon, larger, sage accent background) -> `/log`
4. Records (FolderOpen icon) -> `/records`
5. More (MoreHorizontal icon) -> opens a slide-up menu with: Doctor Mode, AI Research, Settings, Profile, Timeline

The center LOG button should be visually prominent (sage background, slightly larger). Active tab gets sage color, inactive gets text-secondary. Use `usePathname()` from next/navigation for active state detection.

Height: 64px with safe-area-inset-bottom padding for iPhone notch. Background: white with top border.

AppShell.tsx: Flex column layout. Main content area with `flex-1 overflow-y-auto` and bottom padding to account for nav height. The nav is fixed at bottom.

Commit: "feat: add bottom navigation and app shell"

---

## Task 3: Home Screen - Today Page

The most important page. What the user sees first and what the doctor sees first.

**Files:**
- Rewrite: `src/app/page.tsx` - The home/today page
- Create: `src/components/home/HealthRing.tsx` - Central status ring
- Create: `src/components/home/QuickStatusStrip.tsx` - Horizontal metric indicators
- Create: `src/components/home/SmartCards.tsx` - Contextual insight cards
- Create: `src/components/home/OneBigThing.tsx` - Dynamic primary insight

**What to build:**

page.tsx (server component that fetches data, passes to client components):
- Fetch today's daily log, latest Oura data, current cycle info, recent labs
- Pass data to the component hierarchy below

HealthRing.tsx (client component):
- Large SVG circle (200px) in the center of the screen
- Ring color: sage (good day), amber (moderate), rose (rough day)
- Determined by: average of today's pain (inverted), energy, sleep score
- Inside the ring: cycle day number (large text) + phase label (small text below)
- Below ring: "Day X of your cycle" or "No data logged yet - tap to log"
- If no data logged today, ring is grey with a pulsing prompt to log

OneBigThing.tsx:
- Single card below the ring showing THE most important insight right now
- Logic priority: (1) If flare risk is high, show warning (2) If upcoming appointment, show prep reminder (3) If lab trend is concerning, show it (4) If correlation was recently found, show it (5) Default: show last 7 days summary
- Card has sage left border, warm white background, clear text

QuickStatusStrip.tsx:
- Horizontal scrollable row of small circular indicators
- Each shows: metric name (tiny), value (medium), colored dot
- Metrics: Pain, Energy, Sleep, HRV, Cycle Phase
- Colors based on personal baselines (not absolute thresholds)
- Tappable - each links to the relevant detail in Patterns or Records

SmartCards.tsx:
- 2-3 contextual cards that change based on what's relevant today
- "Log your morning check-in" if not logged yet
- "Appointment with Dr. X in 3 days" if upcoming
- "Your ferritin is trending down" if lab trend is concerning
- Each card has an action button (tap to log, tap to prep, tap to view)

Commit: "feat: add home screen with health ring, status strip, and smart cards"

---

## Task 4: Daily Log Page - Morning + Evening Flow

The daily check-in. Must complete in under 3 minutes. Tap-based inputs, not typing.

**Files:**
- Create: `src/app/log/page.tsx` - Daily log page
- Create: `src/components/log/PainSlider.tsx` - 0-10 pain input with face emojis
- Create: `src/components/log/EnergySlider.tsx` - 0-10 energy input
- Create: `src/components/log/SymptomPills.tsx` - Tap-to-toggle symptom selector
- Create: `src/components/log/QuickMealLog.tsx` - Meal logging with favorites
- Create: `src/components/log/CycleQuickEntry.tsx` - Period/flow/CM quick entry
- Create: `src/components/log/MedicationQuickEntry.tsx` - Tap saved meds
- Create: `src/components/log/NotesSection.tsx` - Optional text fields
- Create: `src/components/log/LogHeader.tsx` - Date + streak counter

**What to build:**

page.tsx: Vertical scrollable page with collapsible sections. Each section auto-saves on change (no submit button). Sections in order:
1. Header with date and logging streak count
2. Pain (0-10 slider with emoji faces, large touch targets)
3. Energy (0-10 slider)
4. Symptoms (toggleable pills grouped by category)
5. Cycle (period yes/no, flow level, cervical mucus)
6. Food (quick meal buttons: Breakfast/Lunch/Dinner/Snack with text entry and trigger detection)
7. Medications (tap from saved favorites, or add new)
8. Notes (optional: triggers, what helped, daily impact)

Each section is a collapsible card. Only Pain and Energy are open by default. Others show a summary line when collapsed ("3 symptoms logged", "Period day 2", etc.)

PainSlider.tsx: Horizontal slider 0-10 with large thumb (44px). Five emoji faces above at positions 0, 2, 5, 7, 10. Color gradient from green (0) through amber (5) to red (10). Haptic-style visual feedback on change. Shows number prominently.

SymptomPills.tsx: Categorized toggle pills. Categories: Digestive, Hormonal, Neurological, Physical, Urinary (from existing symptom-options.ts). Each symptom is a rounded pill that toggles on/off. When on, shows severity selector (mild/moderate/severe) as small dots below. Use existing SYMPTOM_OPTIONS from the lib.

QuickMealLog.tsx: Four meal type buttons at top (Breakfast, Lunch, Dinner, Snack). Text input for food items. Real-time trigger detection using existing detectTriggers() function. Show trigger flags as colored pills (from existing TriggerFlags pattern). Recent meals / favorites for one-tap re-entry. Auto-save on blur.

CycleQuickEntry.tsx: Simple toggles - Period (yes/no), Flow (light/medium/heavy as tap buttons), optional LH test and cervical mucus entries. If Natural Cycles data exists for today, show it read-only.

MedicationQuickEntry.tsx: Show saved favorites as tap-to-add pills (stored in localStorage like existing app). "Add new" button for one-off entries. Each added med shows in a small list below with time and optional dose.

All components use auto-save via the existing `src/lib/api/logs.ts` functions (getOrCreateTodayLog, updateDailyLog, addPainPoint, addSymptom) and `src/lib/api/food.ts`, `src/lib/api/cycle.ts`.

Commit: "feat: add daily log page with tap-based inputs and auto-save"

---

## Task 5: Records Hub

A tabbed interface for all medical records: Labs, Imaging, Documents, Appointments.

**Files:**
- Create: `src/app/records/page.tsx` - Records hub with tabs
- Create: `src/components/records/LabsTab.tsx` - Lab results with trend charts
- Create: `src/components/records/ImagingTab.tsx` - Imaging studies list
- Create: `src/components/records/AppointmentsTab.tsx` - Past + upcoming
- Create: `src/components/records/TimelineTab.tsx` - Chronological medical timeline

**What to build:**

page.tsx: Tab bar at top with 4 tabs: Labs, Imaging, Appointments, Timeline. Default to Labs tab. Each tab is a client component that fetches its own data.

LabsTab.tsx: 
- List of all lab results grouped by date, most recent first
- Each test shows: name, value, unit, flag (color-coded: green normal, amber low/high, red critical), reference range
- Tap a test name to see a trend chart (Recharts LineChart showing all historical values for that test)
- Special highlight for ferritin trajectory (the most important lab to track)
- Uses existing `src/lib/api/labs.ts`

ImagingTab.tsx:
- List of imaging studies from imaging_studies table
- Each shows: date, modality (CT/XR/MRI), body part, indication
- Tap to expand: findings summary, full report text
- Future: link to embedded PACS viewer (Phase 4)

AppointmentsTab.tsx:
- Split into "Upcoming" and "Past" sections
- Each shows: date, doctor, specialty, clinic, reason
- Tap to expand: notes, action items, follow-up date
- "Add Appointment" button at top
- Uses existing `src/lib/api/appointments.ts`

TimelineTab.tsx:
- Vertical chronological timeline from medical_timeline table
- Each event: colored dot (by type), date, title, description
- Color coding: blue (diagnosis), orange (symptom), green (test), purple (medication), grey (appointment), teal (imaging)
- Filter chips at top: All, Diagnoses, Tests, Medications, Appointments, Imaging

Commit: "feat: add records hub with labs, imaging, appointments, and timeline tabs"

---

## Task 6: Doctor Mode

A clean, professional view designed for the 7-minute doctor appointment.

**Files:**
- Create: `src/app/doctor/page.tsx` - Doctor mode view
- Create: `src/components/doctor/ExecutiveSummary.tsx` - One-page medical summary
- Create: `src/components/doctor/DataFindings.tsx` - Correlation evidence
- Create: `src/components/doctor/QuickTimeline.tsx` - Condensed timeline

**What to build:**

page.tsx: Clean, printable layout optimized for showing a doctor. Minimal chrome, maximum information density. Three scrollable sections:

ExecutiveSummary.tsx:
- Patient header: Name, age, sex, blood type, height, weight
- "Presenting Complaints" section with the active problems
- Current medications and supplements
- Latest vitals from Oura (HRV, resting HR, sleep score, temp deviation) with personal baseline comparison
- Recent abnormal labs highlighted
- Cycle status (current phase, last period, cycle length)
- All data pulled from permanent core + health_profile table

DataFindings.tsx:
- Top correlations found by the analysis engine (from correlation_results table)
- Each shows: plain English description, confidence level, sample size
- Key charts: ferritin trajectory, HRV trend, pain over time
- Phase-dependent patterns if any

QuickTimeline.tsx:
- Condensed version of the timeline - only important/critical events
- Most recent first
- Designed to give the doctor the full story in 30 seconds of scrolling

Bottom of page: "Export as PDF" button (uses existing report generation) and "Share" button.

Commit: "feat: add doctor mode with executive summary and data findings"

---

## Task 7: Patterns Page (Basic Version)

Overview of health patterns and trends. Full correlation engine is Phase 3, but this page shows existing data beautifully.

**Files:**
- Create: `src/app/patterns/page.tsx` - Patterns overview
- Create: `src/components/patterns/TrendChart.tsx` - Multi-metric trend chart
- Create: `src/components/patterns/CycleOverview.tsx` - Cycle statistics
- Create: `src/components/patterns/FoodTriggers.tsx` - Food trigger summary

**What to build:**

page.tsx: Scrollable page with chart cards showing health trends.

TrendChart.tsx:
- Recharts LineChart showing selectable metrics over time
- Metric selector: Pain, Energy, HRV, Resting HR, Sleep Score, Temperature
- Time range selector: 7d, 30d, 90d, 1y
- Cycle phase overlay (colored bands behind the chart)
- Data from oura_daily and daily_logs

CycleOverview.tsx:
- Average cycle length, period length, regularity score
- Phase timeline bar showing last 3-6 cycles
- Uses existing cycle-calculator.ts

FoodTriggers.tsx:
- Bar chart of most common food triggers
- Data from food_entries flagged_triggers
- Shows: trigger category, frequency count, most recent occurrence

Commit: "feat: add patterns page with trend charts, cycle overview, and food triggers"

---

## Task 8: More Menu Pages - Settings + Profile

The settings and profile pages accessible from the More menu.

**Files:**
- Create: `src/app/settings/page.tsx` - Settings page
- Create: `src/app/profile/page.tsx` - Patient profile editor
- Create: `src/components/profile/ProfileSection.tsx` - Editable profile section

**What to build:**

settings/page.tsx:
- Oura Ring connection (OAuth link + sync button + last sync time)
- Data Import section (Natural Cycles CSV, MyNetDiary CSV, Apple Health XML)
- Data Export (download all data as JSON)
- About section

profile/page.tsx:
- Structured profile editor reading from health_profile table
- Sections: Personal Info, Confirmed Diagnoses, Suspected Conditions, Medications, Supplements, Allergies, Family History
- Each section is an editable card with save button
- Also: free-form "My Medical Story" text editor (saves to medical_narrative table)

ProfileSection.tsx:
- Reusable component for each profile section
- Shows current values with edit toggle
- Save button writes back to health_profile table via Supabase

Commit: "feat: add settings and profile pages"

---

## Verification Checklist

After all tasks:
- [ ] Home screen loads with health ring showing real cycle data
- [ ] Quick status strip shows real Oura metrics
- [ ] Daily log page saves all inputs to Supabase
- [ ] Records hub shows real lab results, imaging studies, appointments
- [ ] Doctor mode displays clean executive summary
- [ ] Patterns page shows trend charts with real data
- [ ] Bottom navigation works between all pages
- [ ] All pages are mobile-responsive (test at 375px width)
- [ ] No em dashes anywhere
- [ ] Warm Modern color palette consistent throughout
- [ ] Touch targets are minimum 44x44px

---

**Next Phases:**
- Phase 3: AI Engine Upgrades (correlation engine, enhanced research assistant, flare prediction)
- Phase 4: Data Import (myAH scraper, PACS viewer integration, universal import)
