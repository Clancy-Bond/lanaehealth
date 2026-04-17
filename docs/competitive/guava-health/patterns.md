# Guava Health - UX Patterns

Each pattern observed in Guava Health, ranked by Lanae impact (1 to 5 stars).

---

## 1. Multi-Specialist Unified Timeline (5 stars)

**What it is**
A single chronological feed that merges appointments, labs, imaging, diagnoses, and prescriptions across every specialist the patient sees. Filterable by provider, organ system, or date range. Each entry expands to the source document or note. Providers are color-coded (PCP blue, Cardio red, OB/GYN pink, etc.).

**Why it works**
Chronic illness patients live in a world where PCP does not see what cardio ordered, which does not see what OB/GYN prescribed. Patients become their own care coordinators by default. A unified timeline turns that unpaid job into a view, not a spreadsheet. Users report walking into visits and physically scrolling the timeline on screen to update a doctor in 90 seconds.

**Trade-offs**
Density. Lanae's case has 6 problems, 7 timeline events, 2 imaging studies, 52 labs, and 5 appointments. Past 5 years of data that could create visual overload. Mitigation: default collapse to "last 3 months" with an "all time" toggle.

**Adaptability to LanaeHealth**
We already have `medical_timeline`, `appointments`, `lab_results`, `imaging_studies`, `active_problems` tables. A unified view at `/timeline` exists but is basic. Enhancement: add provider facet filter, cross-type merge, color coding by specialty. No new tables needed.

---

## 2. Lab Trend Visualization Over Multiple Years (5 stars)

**What it is**
Each lab marker gets its own sparkline showing every historical value back as far as records go, with the reference range shaded. Hovering a point shows source lab, date, ordering provider. Multi-lab overlay (e.g., TSH + Free T4 + TPO on one chart). Delta indicators highlight when a value crosses a threshold or trends 2+ standard deviations from the patient's own baseline.

**Why it works**
Lab PDFs show one point in time. Portal views show one test at a time. Trends hidden in plain sight: TSH drifting up over 3 years, cholesterol climbing after a medication change, ferritin dropping post-surgery. Patients find patterns their doctors miss because doctors see snapshots.

**Trade-offs**
Requires robust lab name normalization (same test different labs call it different things). Reference ranges vary by lab. Unit conversion needed for international users (Lanae is US, less urgent).

**Adaptability to LanaeHealth**
`lab_results` has 52 rows for Lanae. Already on our Records page but as a list. Enhancement: per-marker sparkline component using Recharts (remember: useRef width, not ResponsiveContainer per our rules). Patient-baseline z-score badge. No new tables.

---

## 3. Doctor Prep Checklist (5 stars)

**What it is**
Pre-visit view specific to an upcoming appointment: top symptom changes since last visit, active medications needing refill, labs ordered but not drawn, questions the patient flagged, items from last visit marked "follow up". Presented as a one-page PDF or screen-ready mode for the waiting room. Providers get a mini version if the patient shares a link.

**Why it works**
15-minute visits demand compressed communication. Patients forget what to say in-office. Pre-visit prep externalizes the working memory problem. Users say it's the single feature that changed their care experience.

**Trade-offs**
Risk of over-engineering. Must produce a 3-bullet version ("top 3") not a 10-page dump. Cognitive load must go DOWN not up.

**Adaptability to LanaeHealth**
We have `/doctor` page already with post-visit subroute. Pre-visit is the natural extension. Sources: recent symptoms from `daily_logs`, recent labs from `lab_results`, active issues from `active_problems`, upcoming appointment from `appointments`. Assemble via Claude with static/dynamic boundary. Top-3 mode plus full export. Screenshot mode for showing a phone screen to a clinician.

---

## 4. Condition Network / Relationship View (4 stars)

**What it is**
A visual graph of how the user's diagnoses relate. Nodes are conditions (POTS, endo, hypothyroid). Edges indicate known associations (POTS + EDS + MCAS triad, endo + adenomyosis, thyroid + autoimmune cluster). Clicking an edge reveals evidence summary and linked research. Optional "suspected" nodes for conditions being worked up.

**Why it works**
Women with complex chronic illness commonly have 3 to 6 interconnected diagnoses and no one doctor to explain the web. The graph view externalizes what specialists do not assemble. It also validates patient experience ("you are not making up that these things are connected").

**Trade-offs**
Overload risk (one reviewer complained of "spider web" with 8 diagnoses). Evidence strength matters - must cite, not assert. Never say "X causes Y" without qualifier.

**Adaptability to LanaeHealth**
We have `active_problems` and `gene_disease_network` tables. A graph visualization at `/patterns` or `/intelligence` using Claude-generated edges with citations. Default collapse of weak edges. Hierarchical not spider. Lanae's 6 problems make this high-signal, not overwhelming. Show evidence tier (established, suggested, exploratory).

---

## 5. Family History Tree (4 stars)

**What it is**
A visual pedigree (3 generations) where users add relatives and tag them with conditions. Auto-generates "what you should ask about" for upcoming specialist visits (cardio cares about heart conditions, OB/GYN cares about breast/ovarian cancers). Flags hereditary risk patterns.

**Why it works**
Family history is the single most overlooked data point in outpatient care. Providers ask once at intake and never update. A living tree means it grows as the patient learns more from relatives. Risk scoring gives clinicians an actionable summary.

**Trade-offs**
Data entry burden upfront. Patient may not know relative's conditions. Mitigate with partial/unknown tags and "ask your mom" reminders.

**Adaptability to LanaeHealth**
We do not have this. New table `family_history` needed (relative, relation, conditions[], age_at_death, notes). New page route or section under `/profile`. Simple SVG tree. One-time setup, low ongoing edit load. Priority for Lanae: her mother's history of migraine + her POTS is 5-star relevant.

---

## 6. Voice Symptom Capture (4 stars)

**What it is**
Tap a mic button on the log screen, speak a symptom description, system transcribes and structures it. Extracts: symptom name, severity if mentioned, time context, body location. User confirms structure before save. Works while walking, driving, mid-flare.

**Why it works**
Typing while fatigued or in pain is friction users will not overcome. Voice adds 80% more logging on flare days according to Guava reviews. Especially valuable for POTS (can't stand up to type), endo (pain makes typing painful), migraine (screen light aversion).

**Trade-offs**
Transcription errors on medical vocabulary. Need whisper model tuned for medical terms or manual edit UX. Privacy: audio must not be stored beyond transcription.

**Adaptability to LanaeHealth**
We have no voice capture today. New mic button on `/log`. Use Web Speech API for browser transcription, Claude for structuring. No audio storage. New lib module `src/lib/api/voice-log.ts`. No new table (writes to existing `symptoms` or `daily_logs` text fields).

---

## 7. Second Opinion PDF Assembly (4 stars)

**What it is**
One click generates a PDF packet for a new provider: medical history summary, active problem list, recent labs, imaging reports, medication list, current symptoms, patient's own questions. Formatted in medical-standard layout (SOAP-ish). Optional transcript of last 3 visits.

**Why it works**
Patients seeking second opinions spend 4 to 8 hours assembling records. Clinicians receiving unorganized record dumps spend 20+ minutes filtering. A standardized packet respects both sides. Users cite this as a premium feature worth paying for.

**Trade-offs**
Medical-legal risk if summary is wrong. Human review before send should be enforced. Every claim in the summary must cite its source (which visit, which lab, which imaging).

**Adaptability to LanaeHealth**
We have `/doctor` and `/records`. Add "Export for New Provider" button. Uses existing data via `src/lib/context/assembler.ts` with a specialized system prompt. PDF generation via react-pdf or html-to-pdf. Cite every claim. Pre-generation preview required.

---

## 8. Insurance Denial Tracker (3 stars)

**What it is**
Log a denied claim. System captures: what was denied, date, denial reason, carrier. Generates appeal letter template based on medical necessity from user's own records. Tracks the 30/60/180 day deadlines. Reminds ahead of each.

**Why it works**
Denied claims are common in chronic illness (MRIs, specialist referrals, off-label meds). Patients miss appeal deadlines by not tracking. Templated letters with evidence reduce appeal friction from 4 hours to 30 minutes.

**Trade-offs**
US-centric (insurance varies wildly). Denial reasons must be encoded. Not all carriers accept digital appeals.

**Adaptability to LanaeHealth**
Lanae has MRI Brain scheduled Apr 2027 which is prior-auth risk. Worth building but not top-3 today. Deferred.

---

## 9. Upload and Parse Medical Records (3 stars)

**What it is**
Drag-drop any medical PDF, image, or lab screenshot. System OCRs, extracts structured data, populates the record. Handles lab reports, pathology, operative notes, imaging reads. Shows what it extracted for user review before save.

**Why it works**
Manual data entry is the #1 drop-off reason. Parsing lowers the activation barrier to "just give it everything you have".

**Trade-offs**
Parsing fails 30-50% of the time on old PDFs, handwriting, non-standard formats. Must have graceful manual fallback.

**Adaptability to LanaeHealth**
Partially exists via CCD parser in `scripts/parse-ccd-import.mjs`. Not yet in UI for arbitrary uploads. Lanae is mostly covered via myAH import. Lower priority.

---

## 10. HIPAA BAA Privacy Posture (3 stars)

**What it is**
Public commitment to BAAs with vendors, clear data handling docs, ability to export all data at any time, deletion on request. Specifically named in user reviews as a reason to trust.

**Why it works**
Medical data sensitivity means privacy is the ticket to the game, not a feature. Users specifically choose apps with BAA commitments.

**Trade-offs**
Operational burden. Requires vendor audits, DPA review, policy pages.

**Adaptability to LanaeHealth**
Lanae's data lives in her Supabase. We should document this posture clearly on a `/privacy` page. Not a new feature, a docs item. 3 stars because foundational but not differentiating for us alone.

---

## Impact ranking summary (1 to 5)

| Pattern | Stars |
|---|---|
| Multi-Specialist Unified Timeline | 5 |
| Multi-Year Lab Trend Visualization | 5 |
| Doctor Prep Checklist (pre-visit) | 5 |
| Condition Network / Relationship View | 4 |
| Family History Tree | 4 |
| Voice Symptom Capture | 4 |
| Second Opinion PDF Assembly | 4 |
| Insurance Denial Tracker | 3 |
| Upload and Parse Medical Records | 3 |
| HIPAA BAA Privacy Posture | 3 |
