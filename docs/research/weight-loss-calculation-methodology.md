# Weight Loss Plan Calculation Methodology

Cited methodology backing `src/lib/calories/weight-plan.ts` and the
`/v2/calories/plan` UI. Every formula and clamp is anchored to a
peer-reviewed or guideline source.

## 1. Resting metabolic rate (BMR)

We use the Mifflin-St Jeor equation. The Academy of Nutrition and
Dietetics Evidence Analysis Library identifies it as the most accurate
predictive equation for resting metabolic rate in non-obese and obese
adults compared to indirect calorimetry, with closer agreement than
Harris-Benedict, Owen, or WHO/FAO/UNU formulas.

Formula (Mifflin et al., 1990):

```
Male:    BMR = 10 * weight_kg + 6.25 * height_cm - 5 * age_y + 5
Female:  BMR = 10 * weight_kg + 6.25 * height_cm - 5 * age_y - 161
```

Sources:
- Frankenfield D, Roth-Yousey L, Compher C. "Comparison of predictive
  equations for resting metabolic rate in healthy nonobese and obese
  adults: a systematic review." J Am Diet Assoc. 2005 May;105(5):775-89.
  https://pubmed.ncbi.nlm.nih.gov/15883556/
- Academy of Nutrition and Dietetics Evidence Analysis Library: Adult
  Weight Management - Determination of Resting Metabolic Rate.
  https://www.andeal.org/template.cfm?template=guide_summary&key=621
- Medscape Reference: Mifflin-St Jeor Equation.
  https://reference.medscape.com/calculator/846/mifflin-st-jeor-equation

Rationale for picking Mifflin over Harris-Benedict: the original
Harris-Benedict formula was developed in 1919 from a cohort of 239
mostly young, lean adults and overestimates BMR by 5 to 15 percent in
modern populations. Mifflin-St Jeor was validated against indirect
calorimetry in 498 adults across normal-weight and obese subgroups in
the early 1990s and remains the recommended equation in clinical
nutrition guidelines.

For non-binary inputs we default to the female equation. Female BMR
is approximately 166 kcal lower than male BMR for the same age,
height, and weight, so defaulting to female yields a conservative
(lower) maintenance estimate. A higher estimate could push a deficit
target into unsafe territory.

## 2. Total daily energy expenditure (TDEE)

TDEE = BMR multiplied by an activity multiplier:

| Level         | Multiplier | Description                                  |
| ------------- | ---------- | -------------------------------------------- |
| Sedentary     | 1.2        | Desk job, little or no exercise              |
| Light         | 1.375      | Light exercise 1 to 3 days per week          |
| Moderate      | 1.55       | Moderate exercise 3 to 5 days per week       |
| Active        | 1.725      | Hard exercise 6 to 7 days per week           |
| Very active   | 1.9        | Very hard exercise plus physical job         |

These multipliers originate from Katch-McArdle's "Exercise Physiology"
textbook (8th ed., Lippincott Williams and Wilkins, 2014) and have
been adopted by ACE, NASM, and ACSM as the default activity tiers in
TDEE estimation. They are the same values used by the ATHLEAN-X TDEE
calculator and the SteelFit USA / PT Pioneer reference materials.

Sources:
- Katch VL, McArdle WD, Katch FI. "Essentials of Exercise Physiology"
  4th edition. Lippincott Williams and Wilkins, 2011, ch. 8.
- ATHLEAN-X TDEE Calculator (uses identical multipliers).
  https://learn.athleanx.com/calculators/tdee-calculator
- PT Pioneer TDEE methodology.
  https://www.ptpioneer.com/personal-training/certifications/study/tdee/

## 3. Safe deficit and weekly rate

US dietary guidance (CDC, NHLBI, NIH) recommends 0.5 to 1.0 kg per
week (1 to 2 lb per week) as the safe sustainable rate of weight
loss. Faster losses risk lean mass, micronutrient gaps, gallstones,
and rebound. We additionally clamp to 1 percent of body weight per
week as an upper limit, consistent with athlete cutting guidance from
ISSN.

Calorie equivalent: 1 kg of body fat is approximately 7700 kcal
(7.7 kcal per gram, accounting for fat-cell water). 1 lb is
approximately 3500 kcal. We use 7700 kcal per kg in the weekly rate
to daily deficit conversion.

Daily deficit floor: target calories must not drop below 1200 for
females or 1500 for males. The CDC and AHA flag those as the lower
boundary at which adequate micronutrient intake from food alone
becomes unreliable. If the user's chosen rate would push target below
that floor, we clamp the rate down and emit a warning.

Sources:
- CDC: Steps for Losing Weight (1 to 2 lb per week guidance).
  https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html
- NHLBI / NIH: Aim for a Healthy Weight (energy deficit guidance).
  https://www.nhlbi.nih.gov/health/heart-healthy-living/healthy-weight
- Hall KD. "What is the required energy deficit per unit weight loss?"
  Int J Obes. 2008;32(3):573-576. PMID: 17848938.
- Wishnofsky M. "Caloric equivalents of gained or lost weight."
  Am J Clin Nutr. 1958;6(5):542-546 (the 3500 kcal per lb origin).
- NutritionFacts.org review of the 3500 kcal per lb rule.
  https://nutritionfacts.org/blog/the-new-rule-for-calories-per-pound-of-weight-loss/

## 4. Macronutrient targets

We follow the International Society of Sports Nutrition (ISSN)
position stand for energy-restricted phases:

- Protein: 1.6 to 2.2 grams per kg body weight per day. We use 1.8 g/kg
  as the default for a moderate deficit, scaling to 2.0 g/kg if the
  weekly rate is at the aggressive end of the safe range.
- Fat: 0.8 to 1.0 g/kg per day, with a floor of 20 percent of total
  calories to protect hormone synthesis and fat-soluble vitamin
  absorption. We use 0.9 g/kg.
- Carbohydrate: the remainder of the calorie target, with a soft floor
  of 100 g per day to support brain glucose needs and exercise output.

Sources:
- Jager R et al. "International Society of Sports Nutrition Position
  Stand: protein and exercise." J Int Soc Sports Nutr. 2017;14:20.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/
- Campbell B et al. "International Society of Sports Nutrition position
  stand: protein and exercise." J Int Soc Sports Nutr. 2007;4:8.
  https://pmc.ncbi.nlm.nih.gov/articles/PMC2117006/
- Helms ER, Aragon AA, Fitschen PJ. "Evidence-based recommendations for
  natural bodybuilding contest preparation: nutrition and supplementation."
  J Int Soc Sports Nutr. 2014;11:20.

## 5. Adaptive thermogenesis

Sustained energy deficits cause measured RMR to drop 5 to 15 percent
below what predictive equations estimate. This is "adaptive
thermogenesis," driven by reduced T3 and T4, lower sympathetic tone,
and improved mitochondrial efficiency. It is one of the dominant
reasons weight-loss plateaus occur after 8 to 12 weeks of continuous
deficit.

Mitigations the calculator recommends in copy:
1. Plan a 7 to 14 day "diet break" at maintenance every 8 to 12 weeks.
2. Keep protein at the upper end of the range (1.8 to 2.2 g/kg) since
   protein partially counteracts adaptive thermogenesis.
3. Recompute the plan every 4 to 6 weeks against current bodyweight,
   not the starting weight.

Sources:
- Tremblay A et al. "Early adaptive thermogenesis is a determinant of
  weight loss after bariatric surgery." Metabolism. 2013;62(11):
  1574-1582. https://pmc.ncbi.nlm.nih.gov/articles/PMC7484122/
- Westerterp-Plantenga MS et al. "High protein diets may counteract
  adaptive thermogenesis during weight maintenance after weight loss."
  https://nutrition.org/high-protein-diets-may-counteract-adaptive-thermogenesis-during-weight-maintenance-after-weight-loss/
- Trexler ET, Smith-Ryan AE, Norton LE. "Metabolic adaptation to
  weight loss: implications for the athlete." J Int Soc Sports Nutr.
  2014;11:7.

## 6. Condition-aware adjustments (Lanae-specific)

The calculator surfaces these only when the relevant condition is
present in `active_problems` or `health_profile.diagnoses`:

- POTS / orthostatic intolerance: add 500 to 2000 mg sodium daily on
  top of the standard 2300 mg target. Do not aim for low sodium even
  during weight loss. (Source: Levine BD et al. "The increasing
  awareness of postural orthostatic tachycardia syndrome (POTS)."
  Cleve Clin J Med. 2010;77(7):492-501. Also Vanderbilt Autonomic
  Dysfunction Center patient guidance, 3 to 10 g sodium per day.)

- Migraine: avoid sustained deficits below TDEE minus 500. Larger
  deficits trigger ketogenic / hypoglycemic episodes that are a known
  migraine prodrome. Recommend frequent small meals over IF.

- Cycle / endometriosis with heavy menstrual bleeding: add ~40 mg
  iron-loss buffer per cycle and emphasize iron-rich protein sources
  (red meat, dark poultry, organ meats) over plant-only sources during
  deficit phases. Do not exceed a 500 kcal daily deficit during the
  luteal-to-menstrual transition (premenstrual fatigue is amplified
  in deficit).

These are surfaced as informational chips, not hard clamps; the user's
clinician makes the final call.
