# Competitor-Informed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement each feature's detailed sub-plan after MVP decisions are made below.

**Goal:** Convert fresh competitor research (Bearable, Oura, Natural Cycles, MyNetDiary mirrors captured 2026-04-17) into a sequenced implementation plan for LanaeHealth, reusing and reprioritizing Wave 2 features.

**Architecture:** This is a STRATEGIC plan that sits upstream of Wave 2. It picks the 5 highest-leverage features to ship first (MVP-0), identifies 2 gaps Wave 2 missed, and sequences the rest. Each picked feature links to its TDD-granular sub-plan (to be written after decisions).

**Tech Stack:** Next.js 14 App Router, Supabase Postgres + pgvector, Vercel, Claude Sonnet 4.6, existing three-layer context engine.

---

## Research Source Material

Located at `~/competitor-research/` (outside repo, not committed):

- `bearable/` — 305 MB, 729 HTML pages. Biggest takeaway: content moat (729 condition-specific SEO pages, comparison pages, user story pages).
- `ouraring/` — 53 MB, 36 HTML pages. Biggest takeaway: product-prestige moat (science-and-research page, medical-advisory-board page, minimal-but-authoritative product pages per condition).
- `naturalcycles/` — 5.4 MB, 6 HTML pages (SPA — visible DOM requires Playwright for full capture). Biggest takeaway from product knowledge: BBT+ algorithm explainability ("why is today green/red?").
- `mynetdiary/` — 249 MB, 1,659 HTML pages. Biggest takeaway: database-depth moat (food detail pages, recipes, nutrition education library).

---

## The 3-Moat Framing (key strategic insight)

The four competitors pursue three distinct moats:

| Moat | Example | Defensibility | Fit for LanaeHealth |
|------|---------|--------------|---------------------|
| **Product-prestige** | Oura | Hardware + science + brand | Partial — we can match science/credibility, not hardware |
| **Content-marketing** | Bearable, MyNetDiary | 1000+ SEO pages | Yes — AI can generate, but risks low-quality content |
| **Algorithmic-authority** | Natural Cycles (BBT) | Patented algorithm + FDA clearance | **Best fit** — our Clinical Intelligence Engine is the algorithm |

**DECISION POINT 1 (Clancy, please weigh in):** Does LanaeHealth lead with *algorithmic-authority* (Clinical Intelligence Engine reasoning as the wedge) and supplement with science-credibility surfaces (Oura pattern)? Or also invest in content-marketing at launch?

My recommendation: lead with algorithmic-authority. Content can come later via AI generation. Hardware we never pursue.

---

## MVP-0: The 5-Feature First Wave

Pick these 5 to ship FIRST. All already scoped in Wave 2; this re-sequences by leverage.

### Feature 1: Readiness Morning Signal + Contributor Waterfall (Wave 2 F8)

**Why first:** Oura's single most iconic UI surface. Copies directly. You already have Oura data in `oura_daily` (1,187 days). No new data collection required — pure computation + UI.

**What we saw in Oura mirror:**
- `ouraring/ouraring.com/how-it-works.html` frames Readiness as "the one number that tells you if your body is ready for today"
- Contributors (HRV, RHR, temp, sleep debt) are visible on the dashboard as a stack of bars

**MVP scope:**
- Single "Morning Signal" card on Home (`src/app/page.tsx`)
- Shows Readiness number + 4 top contributors with direction arrows
- Tap to expand into full Contributor Waterfall view at `src/app/intelligence/readiness/page.tsx`
- Migration: `023_readiness_signals.sql`

**DECISION POINT 2:** Is this Readiness calculation LanaeHealth's OWN (using all data: Oura + myAH + labs) or just a pass-through of Oura's Readiness?

My rec: ours. Differentiates us from Oura. CIE can explain *why* the number moved.

**Sub-plan:** Will be written at `docs/plans/2026-04-18-readiness-morning-signal-plan.md` after DECISION POINT 2.

---

### Feature 2: PRN Post-Dose Efficacy Polling (Wave 2 F7)

**Why second:** Bearable's single best logging insight. Directly addresses Lanae's use case (PRN meds for flares, migraines, orthostatic events). Turns passive logging into active clinical data.

**What we saw in Bearable mirror:**
- Not explicit in crawled HTML, but Bearable's product is the reference
- Bearable's article `best-science-backed-coping-strategies-for-anxiety` shows their content angle — evidence-based content attached to features

**MVP scope:**
- When user logs a PRN med (e.g. Ketorolac for migraine), schedule a push notification at +2hr and +4hr: "How's the [migraine] now?"
- 3-tap response: Much better / Same / Worse
- Migration: `022_prn_dose_events.sql`
- Integration point: existing `log/` route + notification queue

**DECISION POINT 3:** Push notifications infrastructure — we have this? If not, fallback to in-app card on next open?

My rec: in-app card fallback for MVP. Add push in next iteration.

---

### Feature 3: Algorithm Explainability Surface — "Why is this a [red/yellow/green] day?" (GAP — NOT in Wave 2)

**Why third:** This is the gap Natural Cycles reveals. Their SPA shell doesn't reveal UI details, but the product pattern is: every red/green day includes a "why" explanation. LanaeHealth's Clinical Intelligence Engine has the REASONING — but no UX surface exposes it.

**What we learned from mirrors:**
- Natural Cycles index.html is a JS shell but their core UX pattern is algorithm transparency
- Oura's `science-and-research.html` signals credibility but doesn't explain *today's number*
- Gap for us: turn CIE internal reasoning into visible "because" strings

**MVP scope:**
- New component: `src/components/intelligence/WhySurface.tsx`
- Takes a signal (e.g. "today's Readiness is 62") and renders the 3 top contributor reasons with source attribution
- Reuses existing CIE output (no new data required)
- Appears on home card (tap a chevron), on Readiness detail, on cycle prediction

**DECISION POINT 4:** Is CIE reasoning structured enough to pull the top 3 reasons deterministically, or do we need a new summarization pass?

My rec: check `src/lib/context/` — if CIE output has structured `evidence` fields, we're fine. If it's freeform prose, add a JSON schema output for "because" reasons.

**Sub-plan:** Depends on DECISION POINT 4 answer.

---

### Feature 4: Condition-Specific Anchor Pages (GAP — partially in Wave 2)

**Why fourth:** Oura has top-nav anchors for Sleep, Heart, Activity, Stress, Women's Health. Each is a content-rich page explaining "what we track, why it matters, what the science says." Bearable has the same pattern for ADHD, BPD, depression, chronic-illness, chronic-pain.

**LanaeHealth currently has:** topic tabs inside the app, no anchor pages.

**What we saw in mirrors:**
- Oura: `ouraring/ouraring.com/sleep-and-rest.html`, `heart-health.html`, `stress.html`, `womens-health.html`, `activity-and-movement.html` — each a product-quality explainer
- Bearable: `adhd-symptom-tracker`, `chronic-illness-symptom-tracker-app`, `bpd-app-borderline-personality-disorder`, `depression-tracker`, `chronic-pain-app-journal`

**MVP scope (start narrow):**
- Build ONE anchor page: `/topics/orthostatic` at `src/app/topics/orthostatic/page.tsx`
- Structure: what we track, why it matters for Lanae, the science, link into her data
- Reuse if successful: `/topics/cycle`, `/topics/migraine`, `/topics/nutrition`

**DECISION POINT 5:** These pages serve two audiences — Lanae (reminder of what she tracks) and future public (SEO/credibility). Build for which?

My rec: build for Lanae first. The structure is reusable for public launch.

---

### Feature 5: Verified-Source Badge on Food Search (Wave 2 F12)

**Why fifth:** Cheap, high-signal feature. MyNetDiary's food database has 1000s of entries — and they surface a verified badge on curated items. LanaeHealth already has MyNetDiary import; add the badge UI.

**What we saw in MyNetDiary mirror:**
- `mynetdiary/www.mynetdiary.com/adhelp_finding_foods.html` — their help doc on food sources
- 1,659 HTML pages dominated by food detail + recipe + nutrition education

**MVP scope:**
- Modify `src/components/food/FoodSearchResult.tsx` (or equivalent) to show "Verified by MyNetDiary" badge when source matches
- No migration needed
- Trivial — ships in a day

---

## Wave 2 Features to DEFER (not MVP-0)

These are still good, but lower leverage given research findings:

- B1 Multi-signal cycle engine — keep for Wave 2.1, depends on more Natural Cycles data research
- C1/C2 Micronutrient tracking — keep for Wave 2.1, less competitive urgency
- F1-F3 Daylio-inspired polish — defer
- D1-D6 Doctor-visit-prep — valuable but not differentiating yet

---

## Gaps Wave 2 Missed (surfaced by new research)

Only TWO real gaps, both small:

1. **Algorithm explainability** (Feature 3 above) — NEW, worth building.
2. **Condition anchor pages** (Feature 4 above) — partially covered by existing topic tabs but not as SEO-ready surfaces.

Wave 2 is otherwise comprehensive. The fresh mirrors *validate* the Wave 2 picks rather than expanding them.

---

## Sequencing (2-week MVP-0 sprint)

Assuming 1 dev (me + Claude pairing):

| Day | Feature | Files touched | Gate |
|-----|---------|--------------|------|
| 1 | DECISION POINTS 1-5 resolved, sub-plans written | `docs/plans/` | Clancy sign-off |
| 2-4 | F1 Readiness Morning Signal | `src/app/page.tsx`, `src/app/intelligence/readiness/`, migration 023 | Card renders on home with test data |
| 5-6 | F3 Algorithm Explainability component | `src/components/intelligence/WhySurface.tsx` | Reuses CIE output |
| 7-8 | F2 PRN Efficacy Polling | `src/app/log/`, migration 022 | Log med → card appears at +2hr |
| 9-10 | F4 Orthostatic anchor page | `src/app/topics/orthostatic/page.tsx` | Production-quality page |
| 11 | F5 Verified-source badge | food search component | Badge visible |
| 12-14 | QA + deploy + writeup | — | Live on lanaehealth.vercel.app |

---

## Decision Points Summary

Before I write sub-plans, I need Clancy's call on five things:

1. **Moat strategy:** Algorithmic-authority lead, or multi-moat? (my rec: algorithmic lead)
2. **Readiness calculation:** LanaeHealth-native or Oura pass-through? (my rec: native)
3. **PRN notification infra:** Push notifs or in-app fallback for MVP? (my rec: in-app)
4. **CIE reasoning structure:** Does it already output structured "because" fields? (requires code check)
5. **Anchor pages audience:** Lanae-first or public-first? (my rec: Lanae-first, structure reusable)

Once decided, I'll write TDD-style sub-plans for each of F1-F5, one per file.

---

## Not Planned Here (explicit YAGNI)

- Content marketing ramp (1000+ SEO pages) — only pursue after product is loved
- Competitor comparison pages (Bearable's "vs Daylio" pattern) — wait for public launch
- i18n / multi-language — wait for international demand
- Hardware (Oura's moat) — never
- Public community / user story pages — wait for public launch
- Replaying existing Wave 2 features already shipped — don't redo

---

## Open Questions for Follow-Up Sessions

- Should the mirrors (`~/competitor-research/`) be checked into a separate private research repo for durability, or kept local?
- Is Playwright-based re-capture of Natural Cycles' SPA worth doing (for deeper algorithm-explainability research)?
- Should we write a skill for "competitor-research-capture" so this runs monthly via scheduled task?

---

## References

- Master plan: `docs/plans/2026-04-15-master-plan-universal-health-platform.md`
- Wave 2 plan: `docs/plans/2026-04-16-competitive-wave-2-plan.md`
- Clinical Intelligence Engine design: `docs/plans/2026-04-15-clinical-intelligence-engine-design.md`
- Feature specs (all trackers): `docs/plans/2026-04-15-feature-specs-all-trackers.md`
