# Comprehensive Body Metrics: Validated Formulas + Sources

User direction (2026-04-24): "every weight metric that you can, and that's out there and studied."

This doc is the citation backstop for `src/lib/calories/body-metrics.ts`. Every
formula below is implemented in code; every threshold the UI shows comes from
the source listed here. No em-dashes anywhere by house style.

## Body composition

### BMI (Body Mass Index)

Formula: `BMI = weight_kg / (height_m)^2`

WHO categories (adults):
- Underweight: < 18.5
- Normal: 18.5 to 24.9
- Overweight: 25.0 to 29.9
- Obese class I: 30.0 to 34.9
- Obese class II: 35.0 to 39.9
- Obese class III: >= 40.0

Source: World Health Organization, "Obesity: preventing and managing the
global epidemic," WHO Technical Report Series 894 (2000).

Limitations: BMI does not distinguish lean mass from fat mass. Athletes with
high muscle mass are routinely flagged "overweight" or "obese" with low body
fat. People with sarcopenia can fall in "normal" range with unhealthy body
composition. Prentice and Jebb, "Beyond body mass index," Obesity Reviews
2:141-147 (2001) document the misclassification problem in detail.

### Body fat percentage

Multiple validated methods exist; we surface the two that fit a phone-based
log: the US Navy circumference formula and BIA-input passthrough (when the
user has scale data).

US Navy circumference formula (Hodgdon and Beckett, 1984):

Women:
```
%fat = 163.205 * log10(waist + hip - neck) - 97.684 * log10(height) - 78.387
```

Men:
```
%fat = 86.010 * log10(abdomen - neck) - 70.041 * log10(height) + 36.76
```

All measurements in cm. The constants are from the Navy's original
publication: Hodgdon, J.A., Beckett, M.B. (1984), "Prediction of percent body
fat for U.S. Navy men from body circumferences and height," Naval Health
Research Center Report 84-11.

Validation note: Navy formula is within roughly 3 percentage points of DEXA
for most adults but tends to under-estimate fat in lean athletes and
over-estimate in older sedentary populations. DEXA remains the gold standard
when available; we prefer DEXA-confirmed values when the user enters one.

ACE healthy ranges (American Council on Exercise, https://www.acefitness.org):
- Essential fat: women 10-13%, men 2-5%
- Athletes: women 14-20%, men 6-13%
- Fitness: women 21-24%, men 14-17%
- Acceptable: women 25-31%, men 18-24%
- Obese: women >= 32%, men >= 25%

### Lean body mass / fat-free mass

Formula: `LBM_kg = weight_kg * (1 - body_fat_pct / 100)`

This is by definition once body fat is known. Reference: Heymsfield et al.,
"Human Body Composition," Human Kinetics, 2nd ed. (2005), Ch. 1.

### Waist circumference

WHO/NIH cardiovascular risk thresholds (sex-specific, Caucasian populations):
- Women: increased risk >= 80 cm (31.5 in), substantially increased >= 88 cm (34.6 in)
- Men: increased risk >= 94 cm (37 in), substantially increased >= 102 cm (40.2 in)

Source: WHO Expert Consultation, "Waist circumference and waist-hip ratio,"
report of a WHO expert consultation, Geneva, 8-11 December 2008. Also:
NIH Clinical Guidelines on the Identification, Evaluation, and Treatment of
Overweight and Obesity in Adults (1998).

### Hip circumference

Captured for the WHR computation. No standalone risk threshold.

### Waist-to-hip ratio (WHR)

Formula: `WHR = waist_cm / hip_cm`

WHO cutoffs for substantially increased risk:
- Women: > 0.85
- Men: > 0.90

Source: WHO Expert Consultation, 2008 (same as waist circumference). The
INTERHEART study (Yusuf et al., Lancet 2005;366:1640-9) found WHR a stronger
predictor of myocardial infarction risk than BMI across 27,000 participants
in 52 countries, which is why we surface it prominently.

### Waist-to-height ratio (WHtR)

Formula: `WHtR = waist_cm / height_cm`

Categories (Ashwell and Hsieh, 2005; also Browning et al. 2010 meta-analysis):
- < 0.40: take care, may indicate underweight
- 0.40 to 0.49: healthy
- 0.50 to 0.59: increased risk; "consider action"
- >= 0.60: substantially increased risk; "take action"

Source: Ashwell, M., Hsieh, S.D. "Six reasons why the body mass index should
be replaced with waist-to-height ratio," International Journal of Food
Sciences and Nutrition 56(5):303-7 (2005). Browning, L.M. et al., "A
systematic review of waist-to-height ratio as a screening tool for the
prediction of cardiovascular disease and diabetes," Nutrition Research
Reviews 23:247-269 (2010) confirmed WHtR outperforms BMI and waist
circumference for predicting cardiometabolic outcomes. The simple "keep
your waist to less than half your height" rule is the lay summary.

### Visceral fat

Best estimated by DEXA or CT; BIA scales (e.g., Withings, Renpho) provide a
visceral-fat-rating index that is roughly comparable to MRI volumetric
measurements but device-specific. We accept user-entered DEXA or BIA values
without recomputation; we do not estimate from circumferences.

### Bone density / BMD T-score

T-score categories (WHO):
- Normal: T-score >= -1.0
- Osteopenia: -2.5 < T-score < -1.0
- Osteoporosis: T-score <= -2.5

Source: World Health Organization, "Assessment of fracture risk and its
application to screening for postmenopausal osteoporosis," WHO Technical
Report Series 843 (1994). Captured as user-entered DEXA values; no
estimation from anthropometry.

### Muscle mass

We compute via LBM (above) when body fat is known. Specific
appendicular skeletal muscle index (ASMI) requires DEXA segmental analysis
and is captured as a user-entered value.

## Cardiovascular

### Resting heart rate

Validated thresholds (American Heart Association):
- Adult normal: 60-100 bpm
- Athlete: 40-60 bpm
- Bradycardia: < 60 (asymptomatic in trained adults is normal)
- Tachycardia: > 100

For Lanae specifically, POTS context matters: standing HR rise of >= 30 bpm
within 10 minutes of standing (>= 40 in adolescents) is a POTS criterion.
Source: Sheldon, R.S. et al., "2015 Heart Rhythm Society Expert Consensus
Statement on the Diagnosis and Treatment of Postural Tachycardia Syndrome..."
Heart Rhythm 12(6):e41-63.

### HRV (heart rate variability)

Already provided by Oura via daily summary. No separate computation here.

### Blood pressure

We already capture systolic and diastolic via the BP log. We add two derived
metrics:

Mean Arterial Pressure (MAP):
```
MAP = diastolic + (systolic - diastolic) / 3
```
Reference range: 70-100 mmHg. Source: Sesso, H.D. et al., "Systolic and
diastolic blood pressure, pulse pressure, and mean arterial pressure as
predictors of cardiovascular disease risk in men," Hypertension 36:801-7
(2000).

Pulse pressure:
```
PP = systolic - diastolic
```
Normal: 30-40 mmHg. PP > 60 in older adults predicts cardiovascular events
independent of mean BP. Source: Franklin, S.S. et al., "Is pulse pressure
useful in predicting risk for coronary heart disease? The Framingham Heart
Study," Circulation 100:354-60 (1999).

### VO2 max estimate

Multiple equations exist; for a phone-only log without a treadmill protocol,
we capture user-entered values from devices that estimate it (Oura, Apple
Watch, Garmin) rather than computing from RHR alone (the resting heart rate
estimation has high error). Source: Astrand-Ryhming nomogram (Astrand and
Ryhming, J Appl Physiol 1954) is the underlying basis for most consumer-
device estimates.

## Metabolic

### BMR (Basal Metabolic Rate)

Mifflin-St Jeor equation (preferred per Academy of Nutrition and Dietetics):

Women:
```
BMR = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
```

Men:
```
BMR = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
```

Source: Mifflin, M.D. et al., "A new predictive equation for resting energy
expenditure in healthy individuals," American Journal of Clinical Nutrition
51:241-7 (1990). Position paper: Frankenfield, D. et al., "Comparison of
predictive equations for resting metabolic rate in healthy nonobese and
obese adults: a systematic review," Journal of the American Dietetic
Association 105(5):775-89 (2005), which concluded Mifflin-St Jeor is the
most accurate of the BMR equations.

### RMR (Resting Metabolic Rate)

In practice indistinguishable from BMR for non-medical use; we report the
Mifflin-St Jeor value as both. RMR is technically slightly higher (about 5%)
because it does not require the strict overnight fast and 12-hour pre-test
quiet that true BMR measurement requires.

### TDEE (Total Daily Energy Expenditure)

```
TDEE = BMR * activity_factor
```

Activity factors (Harris-Benedict tradition, applied to Mifflin-St Jeor):
- Sedentary (little or no exercise): 1.2
- Lightly active (light exercise 1-3 days/week): 1.375
- Moderately active (3-5 days/week): 1.55
- Very active (6-7 days/week): 1.725
- Extra active (athletes): 1.9

Source: Harris, J.A., Benedict, F.G. "A Biometric Study of Basal
Metabolism in Man," Carnegie Institution of Washington Publication 279
(1919). Activity factors confirmed in McArdle, Katch, and Katch, "Exercise
Physiology" 8th ed., Lippincott Williams and Wilkins (2014).

### Fasting glucose

Reference ranges (American Diabetes Association):
- Normal: < 100 mg/dL
- Prediabetes: 100 to 125 mg/dL
- Diabetes: >= 126 mg/dL (confirmed on two tests)

Source: American Diabetes Association, "2. Classification and Diagnosis of
Diabetes: Standards of Medical Care in Diabetes-2024," Diabetes Care
47(Supplement_1):S20-S42.

### HbA1c (glycated hemoglobin)

Reference ranges (ADA):
- Normal: < 5.7%
- Prediabetes: 5.7 to 6.4%
- Diabetes: >= 6.5%

Source: ADA Standards of Medical Care 2024 (same as fasting glucose).

### HOMA-IR (insulin resistance)

```
HOMA-IR = (fasting_insulin_uIU_per_mL * fasting_glucose_mg_per_dL) / 405
```

Reference ranges (Matthews 1985 + later validation):
- Insulin sensitive: < 1.0
- Early insulin resistance: 1.0 to 1.9
- Significant insulin resistance: 2.0 to 2.9
- Severe insulin resistance: >= 3.0

Source: Matthews, D.R. et al., "Homeostasis model assessment: insulin
resistance and beta-cell function from fasting plasma glucose and insulin
concentrations in man," Diabetologia 28:412-9 (1985). Validation across
ethnic groups: Wallace, T.M., Levy, J.C., Matthews, D.R. "Use and abuse of
HOMA modeling," Diabetes Care 27(6):1487-95 (2004).

### Cholesterol panel

ATP III / 2018 ACC/AHA cholesterol guidelines reference ranges:
- Total cholesterol: desirable < 200 mg/dL, borderline 200-239, high >= 240
- LDL: optimal < 100, near-optimal 100-129, borderline 130-159, high 160-189, very high >= 190
- HDL: low < 40 (men) or < 50 (women), high (protective) >= 60
- Triglycerides: normal < 150, borderline 150-199, high 200-499, very high >= 500
- Non-HDL: optimal < 130, near-optimal 130-159, borderline 160-189, high 190-219, very high >= 220

Source: Grundy, S.M. et al., "2018 AHA/ACC/AACVPR/AAPA/ABC/ACPM/ADA/AGS/
APhA/ASPC/NLA/PCNA Guideline on the Management of Blood Cholesterol,"
Journal of the American College of Cardiology 73(24):e285-e350 (2019).

## Other

### Hydration

Urine color scale (Armstrong, 1994): 1-3 well hydrated, 4-6 mild dehydration,
7-8 dehydrated. Source: Armstrong, L.E. et al., "Urinary indices of hydration
status," International Journal of Sport Nutrition 4(3):265-79 (1994).

Daily intake heuristic (US National Academies, 2005): adequate intake (AI)
of total water 2.7 L/day for women, 3.7 L/day for men, including water from
food (about 20% of total). Source: Institute of Medicine (2005), "Dietary
Reference Intakes for Water, Potassium, Sodium, Chloride, and Sulfate."

### Sleep duration and quality

Already provided by Oura. No separate computation.

### Step count and active minutes

Already provided by Oura. CDC recommends 150 minutes moderate-intensity
aerobic activity per week. Source: U.S. Department of Health and Human
Services, "Physical Activity Guidelines for Americans," 2nd ed. (2018).

### Stress markers

Cortisol is laboratory-measured (we read from `lab_results` if present, no
estimation). Oura provides an HRV-derived stress score we surface as-is.

## Computation summary

The functions in `src/lib/calories/body-metrics.ts` are pure: they accept
numeric inputs in canonical units (kg for weight, cm for length, mg/dL for
glucose, mmHg for BP) and return numeric values plus a categorical band
when the metric has accepted thresholds. Test cases at
`src/lib/calories/__tests__/body-metrics.test.ts` cover at least one case
per band and edge cases at the threshold boundaries.

All categorical strings use NC voice: explanatory, no shame, plain English.
Categories surfaced to the UI are the WHO/AHA/ADA strings above; each one
also has a one-sentence "what this means" copy attached at the call site,
not in this file.
