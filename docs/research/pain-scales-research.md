# Pain Scales Research - clinical validation summary

Compiled 2026-04-24 for Lanae's v2 pain logger. All scales below are
free to implement (no licensing fee). Citations point to the original
or canonical validation paper.

## 1. Numeric Rating Scale (NRS) 0-10
- 11-point integer scale, "no pain" to "worst imaginable".
- Validation: Hjermstad et al. 2011 (J Pain Symptom Manage); Hawker
  et al. 2011 (Arthritis Care Res 63:S240) "Measures of adult pain".
- Use case: universal default. Screens well in primary care
  (Krebs 2007, J Gen Intern Med). Quick (under 5 seconds).
- Cutpoints (Serlin 1995, Pain): 1-3 mild, 4-6 moderate, 7-10 severe.
- Limitation: single-dimension intensity only. No location/quality.

## 2. Visual Analog Scale (VAS)
- 100mm line; respondent marks position. Researcher measures mm.
- Validation: Wewers & Lowe 1990 (Res Nurs Health).
- Use case: research-grade granularity. Poor for touch UIs because
  the precision is illusory and harder to compare across days.
- We will NOT implement VAS in mobile UI; it is the wrong primitive
  for thumb input.

## 3. Wong-Baker FACES Pain Rating Scale
- 6 faces from no pain (smiling) to worst pain (crying), scored 0-10
  in steps of 2.
- Validation: Wong & Baker 1988; Garra et al. 2010 (Acad Emerg Med)
  shows good convergent validity with NRS in adults.
- Use case: when verbal/numeric communication is hard. Useful for
  POTS brain fog, migraine episodes, low energy_mode days.
- Free for clinical/educational use per Wong-Baker FACES Foundation.

## 4. McGill Pain Questionnaire (MPQ) - sensory descriptors
- Original (Melzack 1975, Pain) has 78 descriptors across sensory,
  affective, evaluative dimensions. Short-Form-MPQ-2 (Dworkin 2009)
  has 22 items.
- We use the SENSORY DESCRIPTOR vocabulary only as a chip set:
  sharp, dull, throbbing, burning, aching, stabbing, shooting,
  cramping, pressure, tingling, numb. Captures pain QUALITY without
  forcing the full instrument.
- Free to implement; descriptors are vocabulary, not the scored
  instrument.

## 5. Brief Pain Inventory (BPI)
- 9-item short form. Pain intensity (worst, least, average, now) +
  7 interference items (general activity, mood, walking, work,
  relations, sleep, enjoyment of life).
- Validation: Cleeland & Ryan 1994 (Ann Acad Med Singap).
- Use case: gold standard for chronic pain interference. Heavy.
- We use a SUBSET (the PEG abstraction below) for daily logging.

## 6. PEG Scale (3-item)
- Pain intensity, interference with Enjoyment of life, interference
  with General activity. Each 0-10. Score = average.
- Validation: Krebs et al. 2009 (J Gen Intern Med 24:733-738).
  Strong construct validity (rho 0.60-0.95 vs BPI). VA/HHS adopted.
- Use case: PERFECT for our drill-down. Captures function, not just
  intensity. Three quick sliders.

## 7. DN4 Neuropathic Pain Questionnaire
- 10 items (7 self-report symptoms + 3 exam findings). Score >= 4/10
  suggests neuropathic component.
- Validation: Bouhassira et al. 2005 (Pain).
- Use case: nerve pain screen. Lanae has not flagged a neuropathic
  pattern; we DEFER this and surface it only if she logs burning,
  shooting, or tingling repeatedly.

## 8. Pain Catastrophizing Scale (PCS)
- 13 items measuring rumination, magnification, helplessness.
- Validation: Sullivan 1995 (Psychol Assess).
- Use case: psychological dimension. Out of scope for daily logging
  given the non-shaming voice rule. Not implemented now.

## Migraine-specific
### MIDAS (Migraine Disability Assessment)
- 5 questions over a 3-month window. Days missed from work/school,
  days at half-productivity, days missed from chores, etc.
- Validation: Stewart et al. 1999, 2001 (Neurology, Pain).
- Use case: monthly/quarterly disability snapshot. Out of scope for
  per-episode logging. We capture a SINGLE-day proxy as part of
  drill-down ("Could you function normally?").

### HIT-6 (Headache Impact Test)
- 6 questions over a 4-week window. Free to use.
- Validation: Kosinski et al. 2003 (Qual Life Res).
- Use case: better fit than MIDAS for in-the-moment logging because
  question 1 is "When you have headaches, how often is the pain
  severe?" which works as a single check at log time.

## POTS-specific
### COMPASS-31 - Pain dimension
- Composite Autonomic Symptom Score, 31 items across 6 domains.
- Validation: Sletten et al. 2012 (Mayo Clin Proc).
- Use case: full instrument is annual, not daily. We borrow the
  ORTHOSTATIC INTOLERANCE micro-question ("Did you feel
  light-headed or dizzy on standing?") for days when Lanae logs an
  orthostatic episode.

## Implementation decisions for v2/log/pain
1. Default = NRS 0-10. Quick path under 5 seconds.
2. Toggle to FACES for low-capacity days.
3. Optional drill-down:
   - Location chips (head, chest, abdomen, pelvis, back, limbs).
   - Quality chips (MPQ sensory descriptors).
   - PEG-style 3 sliders (pain, enjoyment, activity).
4. Conditional smart prompts based on health_profile diagnoses:
   - If "migraine" or "vestibular migraine" in diagnoses AND user
     selects head pain or throbbing/pulsating: show single HIT-6 Q1
     (severity) + functional check.
   - If "orthostatic intolerance" or "POTS" AND user logs light-
     headedness OR pain on a day with a known syncope/presyncope:
     show COMPASS-31 orthostatic micro-question.
5. Persistence: writes overall_pain to daily_logs (legacy
   compatible) AND, when drill-down is used, inserts a row in
   pain_points with quality, body_region, and a new "context_json"
   payload for PEG/HIT-6/COMPASS dimensions.

## Rationale for not adding tables
- pain_points already has body_region, intensity, pain_type,
  duration_minutes. Adding a JSON column for multi-dimensional
  context is additive and zero-risk (existing rows still readable).
- daily_logs.overall_pain remains the canonical 0-10 daily score.
- This keeps legacy reports and exports working.
