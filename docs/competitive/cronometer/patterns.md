# Cronometer -- Patterns

UX + algorithmic patterns extracted from observation, ranked by Lanae impact (1-5 stars). Each pattern has What / Why / Trade-offs / Adaptability.

---

## Pattern 1: Nutrient Intake x Lab Result Cross-Reference Alerting

Lanae impact: 5/5 stars

**What it is**
When a lab marker trends low (example: ferritin, vitamin D, TSH-linked selenium/iodine, B12) AND the corresponding dietary intake over the trailing 7-30 days is also below target, surface a unified alert: "Your ferritin is low (last lab 18 ng/mL) AND your 7-day iron intake averages 10 mg/day, below your 18 mg target. Consider iron-rich meals." Cronometer users explicitly wish for this (quote 25 in user-reviews.md). No major app actually ships it.

**Why it works**
- Single actionable insight instead of two separate dashboards the user must mentally merge.
- Chronic illness users already connect these dots in their heads, so the app builds trust by validating clinical reasoning.
- Directly usable in doctor prep: "My ferritin is low, my intake is low, can we rule out diet first before iron infusions?"

**Trade-offs**
- Requires clinician-curated mapping of nutrient -> relevant lab markers (iron -> ferritin, hemoglobin, iron, TIBC).
- Requires defined targets per nutrient per user (Cronometer solves this with custom targets, MFP does not).
- Requires confidence bands, since food DB intake estimates are not gospel.

**Adaptability to LanaeHealth**
Very high. We already have `lab_results` (52 tests), `food_entries` (5,781 meals), and `food_nutrient_cache`. We need:
- A mapping table: nutrient -> lab marker(s) -> direction (low/high is bad)
- A rolling-window intake calculator from food_entries joined to food_nutrient_cache
- An alert renderer on the Log page and Doctor page
- All additive. Food_entries and lab_results stay read-only.

---

## Pattern 2: 82-Nutrient Micronutrient Tracking with Custom Targets per User

Lanae impact: 5/5 stars

**What it is**
Instead of only calories + macros + ~15 micros (MFP), track 82 nutrients including all essential amino acids, all B vitamins, fat-soluble vitamins A/D/E/K, minerals (Fe, Zn, Cu, Se, I, Mg, Mn, Ca, K), omega-3 (EPA/DHA/ALA), omega-6, fiber subtypes, water. Let the user override RDA to clinical target per nutrient (example: iron 27 mg/day instead of default 18 mg/day because of endo heavy bleeding).

**Why it works**
- Chronic illness nutrition deficits are micronutrient-driven, not macro-driven.
- Doctors prescribe specific targets (example: vitamin D 2000 IU/day), app must accept those overrides.
- A single number for the day ("iron: 12/27 mg, 44% of target") is instantly comprehensible.

**Trade-offs**
- Not every food in our DB has all 82 nutrients populated. USDA Foundation Foods do, but restaurant items have gaps.
- Visualization must not overwhelm (see pattern 6 below on hierarchy).
- Data infrastructure is nontrivial: per-food nutrient vector, per-user target vector, rolling aggregate per day.

**Adaptability to LanaeHealth**
High. We already have `food_nutrient_cache` with iron/vitamin C/calcium/fiber/calories. Expanding to 25-30 clinically relevant nutrients (not all 82) hits 90% of the value at a fraction of the complexity. Targets stored in new `user_nutrient_targets` table.

---

## Pattern 3: Oracle-Style "What to Eat Next" Gap Filler

Lanae impact: 4/5 stars

**What it is**
At any point in the day, given current intake and target vector, the Oracle ranks foods by "most efficient at filling your remaining gaps" (optimization: max nutrient-density per calorie for the nutrients you are still below target on). Suggests 3-5 concrete foods. Cronometer users rave about this (quotes 3.1-3.3).

**Why it works**
- Removes the cognitive load of "what should I eat tonight to hit my iron target?"
- Particularly useful for someone with limited energy (Lanae's fatigue), since decision-making is expensive.
- Feels magical the first time it works.

**Trade-offs**
- Needs full nutrient data per food.
- Suggestions can be generic if we don't also filter by user's dietary preferences (no dairy, low FODMAP).
- Can become gamification-adjacent; we'd want to keep it suggestive, not nagging.

**Adaptability to LanaeHealth**
Medium-high. We need the nutrient-dense catalog and the optimization. Can be phase 2 after pattern 1 ships. Could add endo-friendly filter using our existing food-classification tags.

---

## Pattern 4: Transparent Nutrition Score with Breakdown

Lanae impact: 4/5 stars

**What it is**
Single daily score (0-100) but with a drill-down: show which nutrients contributed + or -, which are above/below target, how the score was computed. Cronometer users complain Nutrition Score is opaque (quote 22). LanaeHealth's version is transparent and explainable.

**Why it works**
- Single number = glance-able at a glance.
- Drill-down = clinically defensible.
- Fits our stated value of explainable AI / explainable scoring.

**Trade-offs**
- Score is subjective. Weighting matters (iron gap at 40% vs vitamin K at 20% is a design choice).
- Must document the formula publicly so users and clinicians trust it.

**Adaptability to LanaeHealth**
Medium. Needs the nutrient target system first. Score becomes a derived view.

---

## Pattern 5: Diet Protocol Presets (Anti-Inflammatory, Endo, Low-Histamine)

Lanae impact: 5/5 stars

**What it is**
Cronometer ships keto, carnivore, DASH, Mediterranean presets. Users explicitly wish for AIP, endo, and anti-inflammatory presets (quotes 21, 26). Cronometer has not shipped this in 3+ years. We can.

**Why it works**
- Endo-friendly means higher iron/omega-3/fiber targets, lower dairy/soy/high-FODMAP thresholds.
- Anti-inflammatory protocol means omega-3:omega-6 ratio target, polyphenol emphasis.
- One-tap activation applies the target bundle.

**Trade-offs**
- Need clinical review of the preset values. Cannot ship without vetting.
- User may want to override individual values within a preset (allow per-nutrient override on top).

**Adaptability to LanaeHealth**
High. We already have endometriosis mode (migration 011). Add an anti-inflammatory protocol layer that tunes nutrient targets.

---

## Pattern 6: Hierarchy of Nutrient Display (Priority Nutrients First)

Lanae impact: 3/5 stars

**What it is**
Most users do not want to see 82 numbers. Cronometer lets you set "priority nutrients" that always appear first, collapses the rest. For Lanae, priority would be: iron, ferritin-supportive (vitamin C for absorption), vitamin D, selenium, iodine, omega-3, fiber, calories. Everything else collapsed.

**Why it works**
- Respects cognitive budget.
- Makes the power visible without overwhelming.
- Default-good behavior: new users see 8 nutrients, power users can expand to all.

**Trade-offs**
- "Priority" is patient-specific. Must be per-user configurable.
- Default priority list could be auto-suggested based on diagnoses in health_profile.

**Adaptability to LanaeHealth**
Medium. Fits nicely with our Warm Modern design and Log page layout.

---

## Pattern 7: Biometric + Fasting + CGM Integration

Lanae impact: 3/5 stars

**What it is**
Cronometer syncs Oura, Apple Health, CGM (Dexcom, Abbott). Users log fasting windows. All shown alongside food in one dashboard. Correlation of weight-trend with intake is automatic.

**Why it works**
- Food in, movement out, stress modifiers: full picture.
- For Lanae: Oura HRV + sleep + food = see which meals kill sleep.

**Trade-offs**
- CGM is not on Lanae's roadmap (no continuous glucose monitoring).
- Oura + Apple Health already exist in LanaeHealth.

**Adaptability to LanaeHealth**
Already done mostly. CGM is out of scope for now.

---

## Pattern 8: Recipe Builder with Nutrient Calc

Lanae impact: 2/5 stars

**What it is**
User enters ingredients + quantities, Cronometer computes full nutrient profile for that custom recipe, saves as a reusable meal.

**Why it works**
- People cook, not just assemble food items.
- Once a recipe is saved, future logging is one tap.

**Trade-offs**
- Requires UI for ingredient entry and portion math.
- Low urgency for Lanae since myNetDiary already handles this.

**Adaptability to LanaeHealth**
Low priority. Could be phase 3 or 4.

---

## Pattern 9: PDF Nutrient Report Export (Doctor-Facing)

Lanae impact: 4/5 stars

**What it is**
One-tap PDF export of weekly/monthly nutrient summary, formatted for dietitians and doctors.

**Why it works**
- Lanae's PCP, endo, and cardiology would all benefit.
- Clinical legitimacy: the report looks like a chart review, not a wellness app screenshot.

**Trade-offs**
- PDF generation infra needed.
- Cronometer users complain their export looks ugly. We can beat them on visuals.

**Adaptability to LanaeHealth**
Medium. Our Doctor page is already meant for this. Adding a nutrient section to that export is an extension, not a new feature class.

---

## Pattern 10: Ad-Free, Aggressive Upsell-Free Tier

Lanae impact: N/A (business model decision, not patient feature)

**What it is**
Cronometer users hate the ads and paywall pressure. LanaeHealth is single-patient, no monetization, so this is a "we already win here" axis.

**Adaptability to LanaeHealth**
Already solved. Noted only to document we did not miss it.

---

## Ranking summary

| Rank | Pattern | Stars |
|------|---------|-------|
| 1 | Nutrient x Lab Cross-Reference | 5 |
| 2 | 82-Nutrient (or 25-nutrient) Tracking + Custom Targets | 5 |
| 3 | Endo / Anti-Inflammatory Diet Preset | 5 |
| 4 | Oracle Gap Filler | 4 |
| 5 | Transparent Nutrition Score | 4 |
| 6 | PDF Nutrient Report Export | 4 |
| 7 | Priority Nutrient Hierarchy | 3 |
| 8 | Biometric + CGM Integration | 3 |
| 9 | Recipe Builder | 2 |
| 10 | Ad-Free (already solved) | N/A |

Top 3 chosen for plan.md: patterns 1, 2, and 5 (cross-reference, expanded nutrient tracking + custom targets, endo preset). Rationale in plan.md.
