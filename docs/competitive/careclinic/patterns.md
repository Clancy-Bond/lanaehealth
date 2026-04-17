# CareClinic - UX Patterns

One pattern per section. Each includes What / Why it works / Trade-offs / Adaptability to LanaeHealth, ranked by Lanae impact (1-5 stars). Patterns that conflict with our rules (aggressive paywalls, streak guilt, closed data) are explicitly rejected at the end.

---

## 1. Cover-page-first clinical PDF report (5 stars)

**What it is**
The CareClinic report opens with a single cover page: patient name, DOB, age, sex, blood type, allergies, current medications, primary diagnoses, reporting period, date generated. Then every subsequent section (symptoms, vitals, labs, meds, journal, correlations) is a named page with a chart + table + caption. Typography is clinical-document (Helvetica 10pt body, 14pt section headers, 18pt report title). No app branding bleeds into the content.

**Why it works**
Doctors scan this PDF like a chart note. The cover acts as a hand-off artifact. When a provider pulls it up on a tablet during the visit, they can flip between sections in seconds. The lack of branding makes it look like a medical document rather than a consumer app export, which is why multiple users report doctors treating it as contemporaneous clinical evidence (including for disability hearings).

**Trade-offs**
Rigid format resists customization. Users complain the full PDF can reach 40+ pages with no per-section toggles. Every item is included even if empty (which produces "No data recorded" placeholder pages that waste space).

**Adaptability to LanaeHealth**
Perfect fit. Our `src/lib/reports/clinical-report.ts` has the scaffolding (jsPDF, per-section functions) but currently opens with a generic title block, not a clinical cover page, and does not render a structured per-symptom chart page. Add: (1) cover page component, (2) per-section toggle UI at export time, (3) condition-filtered report using our SpecialistToggle state, (4) drop brand language entirely from the PDF.

---

## 2. Condition-tagging each symptom entry (5 stars)

**What it is**
When logging a symptom, the user picks one or more "conditions" the symptom belongs to (e.g., endo, POTS, migraine, hEDS). The condition tag propagates through the entire app: the symptom timeline can filter by condition, reports can be generated per condition, and the Care Card shows only currently-active conditions.

**Why it works**
Chronic illness patients rarely have one condition. Lanae has 6. Without condition tags, the symptom graph is noise. With tags, a user can hand their cardiologist a POTS-only report and their PCP a full-spectrum report without re-entering data. It also reduces intra-specialist embarrassment ("why are you showing my OB your fatigue log?").

**Trade-offs**
Requires patients to classify symptoms correctly. Some symptoms are ambiguous (fatigue could be POTS, hypothyroid, post-viral). Needs a "multiple conditions" option.

**Adaptability to LanaeHealth**
Major win and aligned with our SpecialistToggle (`src/lib/doctor/specialist-config.ts` has `bucketVisible` for view-scoping). We can extend: (a) add a `condition_tags` optional column to `symptoms` via additive migration, or (b) use `active_problems.id` as a FK from a new junction table `symptom_conditions`. The latter is clean and preserves read-only constraint on `symptoms`. Update UI on the Log page to offer a condition chip selector under each symptom.

---

## 3. Care Card (printable 1-page emergency summary) (5 stars)

**What it is**
A separate 1-page PDF (or printable HTML) distinct from the full doctor report. Contains: full name, DOB, photo (optional), blood type, emergency contact with phone, primary diagnoses, active medications with doses, severe allergies, DNR status, insurance number. A QR code at the bottom links to an expiring read-only web view for the full record. Designed to print wallet-size or carry in a phone case.

**Why it works**
For patients with dysautonomia, severe allergies, or EDS, ER visits are common and they often cannot speak. A paramedic can scan the QR code and see the full medical summary in under 5 seconds. Multiple users credit it with life-saving effect. It is also fast to refresh (monthly-ish) compared to a full report.

**Trade-offs**
Adds a separate artifact that must stay in sync with the main record. The QR must route to a truly-access-controlled URL with expiration; CareClinic ships this as an un-authed shareable link which is a privacy hole.

**Adaptability to LanaeHealth**
Direct fit. Lanae has POTS (syncope risk), multiple allergies, and confirmed diagnoses. We already render the data in `ExecutiveSummary.tsx`. Add a new route `/doctor/care-card` that renders a 1-page layout printable to a wallet card. QR code must route through our `src/app/api/share/` (new) with a signed token expiring in 7 days. Include insurance member ID from health_profile.

---

## 4. Medication effectiveness-per-dose rating (4 stars)

**What it is**
Every time the user confirms a dose, the app asks (non-blocking, optional) for an effectiveness rating: Worked / Partial / No effect / Made worse, plus an optional side-effects multi-select with a controlled vocabulary (dizziness, nausea, dry mouth, headache, etc). Over time, the app computes a per-medication effectiveness average and a side-effects frequency table.

**Why it works**
"Did the Tylenol help?" is a question doctors ask constantly and patients rarely remember after the fact. Capturing it at dose time is the only reliable way. A controlled vocabulary (rather than free text) makes the data analyzable. Users report this is the feature Medisafe does not have and why they switch.

**Trade-offs**
Adds friction to the one-tap dose confirmation. Needs to be truly dismissible so PRN logging stays fast. The controlled vocabulary must be robust enough to avoid "other" being 40% of entries.

**Adaptability to LanaeHealth**
Strong fit with our PRN intelligence engine. `src/lib/api/medication-adherence.ts` already tracks doses. Add optional `effectiveness` enum + `side_effects` jsonb to a new table `medication_outcomes` that FK's to adherence rows. The dose confirmation UI on the Log page can show a 2-second slide-up "did it help?" prompt that auto-dismisses if ignored.

---

## 5. Per-visit appointment prep + post-visit capture (4 stars)

**What it is**
Each appointment row expands to show two editable sections: Prep (questions to ask, symptoms to mention, recent flares to highlight) and Post-Visit (what was discussed, diagnoses made, meds changed, follow-up date, free-text notes). Both fields persist, survive to the next app session, and are included in the next report.

**Why it works**
Patients routinely forget what they wanted to ask or what the doctor said. Structured capture preserves continuity across appointments. Reports can reference "the anxiety symptom pattern first discussed at PCP visit on Feb 12" with a link.

**Trade-offs**
More data entry. Users only fill in fields they find valuable, so empty-state handling must not look judgmental.

**Adaptability to LanaeHealth**
Partial fit, we already have `UpcomingAppointments.tsx` and `/doctor/post-visit/` exists. We need to unify the prep + post flow onto the same appointment row, and ensure prep notes surface on the doctor report rendered for that appointment's specialist view. Data model: extend `appointments` via additive `prep_notes` and `post_visit_notes` text columns (requires migration, OR create a sibling `appointment_notes` table if we must preserve `appointments` as read-only).

---

## 6. Condition-filtered timeline view (4 stars)

**What it is**
A single long-scroll timeline that renders all symptoms, meds, labs, appointments, and vitals chronologically, with a condition-chip filter bar at the top. Toggling a condition filters the timeline to only events tagged to that condition. Multi-select shows intersections.

**Why it works**
Chronic illness flares are patterns in time. A timeline is the honest view. Filtering by condition lets patients (and doctors) study one disease process at a time without losing chronological context.

**Trade-offs**
Timeline rendering at scale (1000+ events) needs virtualization. Condition filters assume tagging is done; un-tagged events are orphaned.

**Adaptability to LanaeHealth**
We have `QuickTimeline.tsx` but it is event-only, not multi-signal. We also have `src/app/timeline/page.tsx`. The larger timeline page could adopt condition filters once we have condition tags (pattern #2). This is a natural follow-on to the tagging work.

---

## 7. Side-effects controlled vocabulary (4 stars)

**What it is**
When logging a medication side effect, the user picks from a curated list (~60 items grouped into categories: neuro, GI, sleep, cardiovascular, skin, mood, sexual, metabolic). Free-text only as a last resort under "Other".

**Why it works**
Makes side-effect data searchable, aggregatable, and correlatable. Enables the app to flag "you reported dizziness on 4 of the 5 days since starting metoprolol". Also enables cross-medication comparison.

**Trade-offs**
Requires clinical literature to build the vocabulary. List can feel overwhelming; needs good search / smart ordering (recent + common first).

**Adaptability to LanaeHealth**
Pairs with pattern #4. We would maintain a side-effects reference table (`side_effect_vocabulary`) with category and common name, mapped from MedDRA or SNOMED subsets. API at `src/lib/api/side-effects.ts`.

---

## 8. Orthostatic vitals module (BP lying / sitting / standing) (4 stars)

**What it is**
A dedicated vitals entry that prompts three BP + HR measurements (lying 5min, sitting, standing 3 and 10 min). Computes delta HR and delta BP across positions. Flags POTS criteria (HR increase 30+ bpm within 10 min of standing, no orthostatic hypotension).

**Why it works**
Orthostatic vitals are how POTS is clinically diagnosed. Doing it with an app means the patient actually captures repeated measurements at home, which is the gold standard since in-office measurements are often normal in POTS patients.

**Trade-offs**
Requires discipline (set timer, stay still, multiple measurements). Needs hardware (BP cuff) which not everyone has.

**Adaptability to LanaeHealth**
Extremely strong fit for Lanae specifically. She has confirmed POTS criteria (+58 bpm standing per myAH import). We already have `src/lib/api/vitals-classification.ts`. Extend with a dedicated orthostatic log flow on the Log page: one entry, three measurements, auto-computed deltas, POTS flag.

---

## 9. Morning/evening short check-in (3 stars)

**What it is**
Two configurable daily check-ins, 3-5 sliders each, takes 20 seconds. Morning might be: how did you sleep, pain now, fatigue now. Evening might be: worst pain today, mood, energy at end of day. Reminders at preferred times.

**Why it works**
Low-friction logging beats ambitious logging. Data quality from 20-second check-ins twice a day is higher than from 5-minute logs once a day because compliance is higher.

**Trade-offs**
Capped depth. Misses in-the-moment spikes.

**Adaptability to LanaeHealth**
Largely already present in our Log page UI. We could add a "quick check-in" mode that collapses to 4 sliders on mobile and auto-dismisses after submission. Optional notification layer via `src/app/api/push/`.

---

## 10. Photo medication import with OCR (2 stars)

**What it is**
Camera scans a pill bottle label and auto-populates medication name, dose, frequency, and prescriber. User confirms.

**Why it works**
First-med onboarding takes seconds instead of 2 minutes of typing.

**Trade-offs**
OCR accuracy is poor per user reviews (4 out of 5 meds wrong). Depends on external OCR service, which adds cost and privacy exposure.

**Adaptability to LanaeHealth**
Skip for now. We can import medications structured from myAH (we already do). OCR is a nice-to-have for meds Lanae adds manually, but not worth the infrastructure.

---

## 11. Caregiver read-only mode (2 stars)

**What it is**
Add a trusted person as "caregiver". They get read access to designated sections (e.g., meds and vitals but not journal). Their app shows the patient's dashboard alongside their own.

**Why it works**
Chronic illness involves care teams. Partners, parents, and adult children often help manage adherence.

**Trade-offs**
Access control is non-trivial and has liability implications. CareClinic's implementation is shareable links, which is not real ACL.

**Adaptability to LanaeHealth**
Out of scope for now. Lanae manages her own care, no caregiver requirement today. Revisit if patient need emerges.

---

## Patterns REJECTED (conflict with our rules)

- **Upgrade modal mid-log**: violates brain-fog-accessible design and our no-paywall stance.
- **Sharing via un-auth link**: privacy hole. We require signed tokens with expiration.
- **Streak-of-consecutive-days log counter**: guilt-inducing for chronic illness; rejected by category.
- **Cover-page branded with app logo**: our clinical PDF should read as a medical document, not a consumer app artifact.
