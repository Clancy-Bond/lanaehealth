# What We Learned From 15 Health-Tracking Apps

**One-page synthesis of competitive research.** For the full per-app research, see each folder under `docs/competitive/<app>/`.

---

## The 6 patterns that matter most for Lanae

### 1. Correlation over counting
Bearable wins because it surfaces "stress correlates with headaches at r=0.65, lag 1 day." MFP and Cronometer lose because they stop at intake. **Our move:** Plain-English insight cards (`src/components/patterns/InsightCard.tsx`) narrate `correlation_results` with r-value + lag + confidence tier badges.

### 2. Non-shaming voice wins adoption
Every chronic-illness review mentions streak guilt as the #1 reason to quit. Bearable, Finch, and Flaredown all excluded streaks deliberately. Daylio's empty calendar cells are neutral, not shameful. **Our move:** Voice rule in CLAUDE.md, `scripts/check-voice.mjs` enforcement, deleted StreakBadge + DailyLogClient.

### 3. Doctor-prep is unmet demand
Guava Health and CareClinic both score highest on "helped me prepare for appointments." Most apps fail at the PDF-export step. **Our move:** `/doctor/cycle-report` + cover-page-first clinical PDF + `/doctor/care-card` QR share + pre-visit prep sheet per specialty.

### 4. Multi-signal beats single-signal for irregular cases
Natural Cycles' FDA algorithm is BBT-only, which fails for POTS/chronic illness (sleep disruption corrupts temp). Our multi-signal engine fuses BBT + HRV + RHR + LH per Scherwitzl 2015 plus Oura integration. **Our move:** `src/lib/intelligence/cycle-engine/` replicates NC's algorithm with our extensions.

### 5. Condition-aware presets
Cronometer has no endo or POTS preset — users beg for it in reviews. MyNetDiary has diabetes + PCOS + thyroid, still no endo. **Our move:** `ENDO_ANTI_INFLAMMATORY_PRESET` + `POTS_PRESET` in `src/lib/nutrition/diet-presets.ts` with cited clinical rationale per nutrient.

### 6. Crossreferences unlock real insight
Nobody ships "nutrient intake x lab results" alerts. Cronometer users explicitly wish for it. Lanae's ferritin + iron intake + TSH + selenium + vitamin D profile is the canonical use case. **Our move:** In-code seed `nutrient-lab-map.ts` + actionable alerts card.

---

## Rejected patterns (studied, declined)

- **Streak mechanics** (every app): violates non-shaming rule
- **Diet culture prescriptions** (Flo, 2021 keto-for-PCOS lawsuit): AI coach explicitly never prescribes diets
- **Retroactive phase re-coloring** (NC): breaks user trust; our cycle engine is write-forward-only
- **Shame-adjacent cycle alerts** (Flo late-period): disabled by default; opt-in only, informational framing
- **Paywalls mid-logging** (MFP, CareClinic): never
- **Apple-Health-style iOS-only gating** (HealthKit integration): out of scope for web-first app
- **Heteronormative partner defaults** (NC Pal): skipped

---

## Algorithms worth citing

- **Cover line + biphasic shift:** Scherwitzl 2015, FDA DEN170052
- **Six-day fertile window:** Scherwitzl 2017
- **HIT-6 headache impact:** Kosinski et al 2003, Quality of Life Research
- **MIDAS disability:** Stewart et al 2001, Cephalalgia
- **ICHD-3 aura criteria:** International Headache Society 2018
- **POTS sodium protocol:** Vanderbilt Autonomic Dysfunction Center
- **Endo iron/D/selenium/omega-3:** ACOG, Endocrine Society 2011, Mier-Cabrera 2009, Missmer 2010
- **Open-Meteo barometric pressure:** free, no auth, free-tier sufficient for personal use

---

## What we beat or tied the apps on

| Capability | Best competitor | LanaeHealth status |
|---|---|---|
| Correlation algorithm | Bearable | **Beat**: we have r-value + lag + p-value + FDR correction |
| Cycle prediction | Natural Cycles | **Tie then beat**: same algorithm, plus Oura HRV/RHR fusion |
| Nutrient tracking | Cronometer | **Tie**: 25 nutrients, added endo + POTS presets they lack |
| Symptom tracking | Bearable | **Tie**: custom trackables, head zone map for migraines |
| Doctor-report PDF | CareClinic | **Beat**: cover-page-first, specialty-aware, QR care card |
| Data export | Clue | **Beat**: full ZIP with README for portability |
| Privacy posture | Clue | **Tie**: allow_claude_context gate in assembler.ts |
| Chronic illness UX | Bearable + Finch | **Tie**: non-shaming voice, rest day, energy modes |
| Headache-specific | Migraine Buddy | **Tie**: 10-zone map, HIT-6, MIDAS, aura, cycle-migraine correlation |

---

## Where we still lag

- **Voice symptom capture for flare days** (Guava advantage — we have zero)
- **Family history tree** (Guava) — `gene_disease_network` table exists, no UI yet
- **Photo food logging** (MyNetDiary) — not built
- **iOS app with HealthKit** — out of scope by design (web-first)

---

## The unlock: our data

Every app is limited by its own silo. LanaeHealth has:
- 1,490 days of Natural Cycles BBT + cycle data
- 1,187 days of Oura sleep + HRV + RHR + temp
- 5,781 MyNetDiary meals
- 52 lab test results
- CCD imports (1,490 days)
- 2 imaging studies with DICOM viewer

The competitive insight isn't any single feature. It's that we can JOIN these. Every correlation card, every cycle prediction, every nutrient-lab alert leverages the full longitudinal record Lanae already has. No other app can do that because they don't have the data.
