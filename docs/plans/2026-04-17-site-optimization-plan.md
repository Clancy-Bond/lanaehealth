# Site Optimization Plan — Competitor-Informed

**Status:** active, 2026-04-17
**Goal:** Synthesize findings from 13 mirrored + 8 web-recon'd competitors into a prioritized roadmap for LanaeHealth.
**Principle:** pull-add-rebrand. Use what competitors already calculate, add our clinical-intelligence layer, brand as ours.

## 1. Competitive Landscape Matrix

### Wearable-first
| App | Signature | Pricing |
|-----|-----------|---------|
| **Oura** | Readiness (7-8 contributors), menstrual-cycle updates, proprietary weights | Ring + $6/mo |
| **Whoop** | Recovery 70/20/10 (HRV/RHR/Sleep), published formula | Band + $30/mo |
| **Fitbit (Google)** | Daily Readiness, weak PCOS/irregular cycle support | Device |

### Women's Health / Cycle
| App | Signature | Unique Gap |
|-----|-----------|------------|
| **Flo** | 420M users, PCOS support, partner sharing, "100+ doctors validated" | Pregnancy mode, perimenopause |
| **Clue** | 100+ trackables, Oxford/Berkeley/MIT research partnerships, Oura/Whoop/Fitbit integration | GDPR-strict Berlin data |
| **Natural Cycles** | FDA-cleared contraception via BBT algorithm | Strongest algorithmic moat |
| **Stardust** | Lunar/astrological + explicit hormone-level tracking (E/P/T), 4.5/5 privacy score | Niche brand, strongest privacy |

### Nutrition
| App | Signature | Gotcha |
|-----|-----------|--------|
| **MyFitnessPal** | 14M food DB, acquired Cal AI 2026, voice+ChatGPT integration | Barcode + AI scan PAYWALLED 2025-26 |
| **Lose It!** | "Snap It" AI photo, $39.99/yr (cheapest), Fitbit/Apple Health/Garmin sync | Snap It premium-only |
| **Cronometer** | 84 micronutrients (vs MFP's 14), ±3.5% accuracy, curated DB (photo-verified adds) | Clinical gold standard |
| **MyNetDiary** | Calorie tracking + massive content library (1,659 SEO pages) | Already pulled via USDA |
| **Noom** | Psychology + human coaching | $149-349/mo |

### Chronic Illness / Symptom
| App | Signature | Note |
|-----|-----------|------|
| **Bearable** | 729-page content moat, condition comparison pages, user stories | Strongest SEO play |
| **CareClinic** | Symptom tracking, care plan | Small HTML footprint |
| **Flaredown** | SPA-only, thin public surface | Weather + food correlations |
| **Daylio** | 2-tap mood log, Year-in-Pixels, local-first privacy (zero server) | Minimalist gold |

### Specialist
| App | Signature | Note |
|-----|-----------|------|
| **Migraine Buddy** | Largest migraine-specific tracker | 308MB of public site content |
| **N1-Headache** | "Scientifically discover factors", B2B clinical partnerships | Research-grade framing |

### PHR / Medical Records
| App | Signature | Note |
|-----|-----------|------|
| **Guava Health** | 50K+ US provider integration (MyChart/Cerner), AI doctor-note summary, wallet Emergency Card, DICOM support | Chronic-illness PHR |

## 2. LanaeHealth Competitive Position

### Current strengths (competitive or better)

| Capability | LanaeHealth | Best competitor |
|------------|-------------|-----------------|
| AI reasoning engine | 6-persona CIE, formal evidence scoring | None have this |
| Medical research APIs | 34 free APIs (PubMed, ClinicalTrials, ChEMBL) | None surface this |
| Oura contributor passthrough | Done 2026-04-17 | Oura only |
| PACS/DICOM viewer | Integrated at /imaging | Guava has upload only |
| myAH portal scraping | Working ingest | None |
| Topic anchor pages (4) | Orthostatic, migraine, cycle, nutrition | Bearable has condition pages |
| Condition-aware reasoning overlay | readiness-context.ts | None |
| POTS-specific diagnostic tracking | Orthostatic page with 3x14d rule | None |

### Gaps vs. best-in-class

| Gap | Leader | Size of fix |
|-----|--------|-------------|
| AI food photo logging | MyFitnessPal (Cal AI), Lose It (Snap It) | Small — `/api/food/identify` route exists, just not wired in |
| Year-in-Pixels visualization | Daylio | Small — extend CalendarHeatmap to 12-month |
| Emergency Card (wallet PDF) | Guava | Small — generate from health_profile |
| Explicit hormone-level tracking (E/P/T) | Stardust | Medium — schema add |
| 84-micronutrient depth | Cronometer | Medium — Wave 2 C1 already scoped |
| Research partnership badging | Clue (Oxford/Berkeley/MIT) | Small — surface existing PMC citations |
| Provider integration (MyChart/Cerner) | Guava | Large — 3rd-party partnership |
| FDA clearance for cycle algorithm | Natural Cycles | Multi-year |
| AI doctor-note summarization | Guava | Medium — we have Claude API, add a route |
| Wearable aggregation (Oura+Whoop+Fitbit) | Clue | Medium — new integrations |

## 3. Prioritized Roadmap

### Quick wins (ship this week)

**QW-1. AI food photo logging** &middot; `/api/food/identify` already exists. Wire it into `FoodSearchAutocomplete` as a camera icon. Closes the MFP/Lose It gap for free (both paywalled theirs in 2026). ~1 day.

**QW-2. Year-in-Pixels** &middot; Daylio signature. Existing `CalendarHeatmap` handles one month; extend to 365-day pixel grid with pain/mood per day. Same data, different layout. Visible long-term progress. ~1 day.

**QW-3. Emergency Card (wallet)** &middot; Generate an HTML/PDF wallet card from `health_profile` with active conditions, meds, allergies, POTS note ("standing pulse 106, orthostatic responder"), emergency contacts, blood type. Print-ready. Match Guava's move exactly. ~1 day.

**QW-4. Research-citations surface** &middot; The `readiness-context.ts` copy already cites 3 PMC papers. Add a "Based on clinical research" badge with expanding citations list to all topic pages. Strengthens the "scientifically discover factors" framing that N1-Headache and Clue both lean on. ~2 hours.

**QW-5. Cycle day + phase on ALL topic pages** &middot; Every topic page should show current cycle day in a corner banner so Lanae sees the cycle context wherever she is. Uses existing `getCurrentCycleDay`. ~1 hour.

### Medium-term (next sprint)

**M-1. AI doctor-note summarization** &middot; Upload a PDF/photo of a doctor's note, return structured summary (diagnosis, new meds, follow-up date, key findings). Uses Claude API. Matches Guava's move.

**M-2. Hormone tracking schema** &middot; New table `hormone_levels` for E/P/T lab values + optional self-reported peak symptoms. Matches Stardust's specificity. Small schema add, big specialist-positioning signal.

**M-3. Expanded micronutrients (Wave 2 C1)** &middot; 25 nutrient targets up from current handful. Closes Cronometer gap. Already scoped.

**M-4. Wearable aggregation dashboard** &middot; Even stub pages for Whoop import and Fitbit import (CSV for now, OAuth later). Clue's "we integrate all wearables" positioning.

**M-5. Import enhancement: Apple Health XML** &middot; Already in existing plan. Completes the "one place for all your data" pitch.

### Long-term (strategic)

**L-1. MyChart / Cerner integration (Smart-on-FHIR)** &middot; Biggest competitive moat. Guava proves it's possible. Requires Smart-on-FHIR OAuth + CCDA parsing. Our `src/lib/importers/` already has CCDA bones.

**L-2. Research-partnership play** &middot; Pitch one US university program (Oxford/MIT/Berkeley angle) — "Use LanaeHealth data for POTS longitudinal study, IRB-approved." Clue's moat is built on this.

**L-3. FDA clearance for cycle prediction** &middot; Natural Cycles' moat. Multi-year, heavy regulatory. Defer until commercial launch.

**L-4. Community / user stories** &middot; Bearable's `flarey-adhd` / `colleen-bipolar` pattern. Wait for public launch.

**L-5. Clinical-grade algorithm research** &middot; CIE can emit FHIR-structured alerts. Pitch to clinician dashboards (Elation, Athena).

## 4. Anti-patterns to avoid

Surfaced from the same research:

- **Don't paywall core functionality.** MFP/Lose It tanked their NPS by moving barcode + AI scan to Premium in 2025-26. LanaeHealth keeps USDA search, barcode, and future AI photo ALL FREE.
- **Don't reinvent Oura/Whoop's Readiness.** Already learned this lesson 2026-04-17 (commit `a02e1ff`). Applies to Clue's cycle predictions too — use theirs or integrate theirs.
- **Don't claim diagnosis.** Orthostatic page deliberately says "builds toward the threshold your clinician uses" not "you have POTS." Keep that voice.
- **Don't over-index on AI photo over database.** Cal AI and Snap It fail in poor lighting. A USDA-backed search still wins for accuracy.

## 5. Metrics & decision gates

For each shipped feature, track:

- Daily active surface (does Lanae actually use it?)
- Follow-through rate for "needs attention" surfaces (PRN poll response rate, log streak)
- Time-to-value from app open

Gate for L-tier work: one M-tier feature must demonstrate >50% weekly engagement before committing a month to an L-tier.

## 6. What we're explicitly NOT building

- **Social features** (follows, likes, comments). Not our wedge.
- **Coach marketplace** (Noom model). Not a solo-dev-appropriate surface area.
- **Device manufacturing** (Oura/Whoop). Never. Use their data.
- **Broad public launch before POTS-vertical product-market fit.** Lanae is the design partner. Don't chase mass market prematurely.

## 7. Research source material

Competitor mirrors at `~/competitor-research/`:

| Site | HTML pages | Size | Note |
|------|-----------|------|------|
| abraham.com | 20 | 12 MB | Non-health test mirror |
| bearable | 729 | 305 MB | Content moat proof |
| ouraring | 36 | 53 MB | Product pages |
| naturalcycles | 6 | 5 MB | SPA |
| mynetdiary | 1,659 | 249 MB | Content library |
| flaredown | 3 | 1 MB | SPA |
| careclinic | ~14 | 35 MB | SPA |
| cronometer | 172 | 98 MB | Rich marketing |
| myfitnesspal | 17 | 181 MB | SPA with media |
| migrainebuddy | 19 | 308 MB | SPA with media |
| clue | 6 | 84 MB | SPA |
| whoop | 133 | 37 MB | Rich marketing |
| guava | 5 | 21 MB | SPA |

Web recon (WebFetch) archived inline above for:
Flo, Fitbit, Stardust, Noom, Daylio, N1-Headache (Humn, LoseIt blocked).

## 8. Decision log (pinned)

- **2026-04-17 architecture correction** &middot; When a competitor's API returns a pre-calculated number we want (Oura readiness, USDA calories, Natural Cycles predictions), USE THEIRS. Don't rebuild. Our value is the intelligence layer ON TOP. Codified in `docs/intelligence/readiness-formula.md`.

- **2026-04-17 topic-page template** &middot; All `/topics/*` pages follow: breadcrumb, hero + explainer, primary progress card, latest snapshot, trend viz, explainer, CTA. Locked in orthostatic, extended to migraine/cycle/nutrition same day.
