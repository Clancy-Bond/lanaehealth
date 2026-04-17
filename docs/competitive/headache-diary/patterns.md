# Headache Diary -- Patterns & Best-Of Analysis

Compares Migraine Buddy (MB), N=1 Headache Tracker (N1), Migraine Monitor (MM). Each pattern includes best implementer + Lanae impact rating.

---

## 1. One-tap during-attack logging ("record attack" mode)

**Lanae impact: 5/5 stars**
**Best of: Migraine Buddy**

### What it is
A persistent top-of-screen button or watch complication that, when tapped, immediately timestamps an attack start. The app enters a minimal-input mode showing only pain level slider, location tap, and "stop attack" at the end. Full trigger + medication detail is deferred to post-attack.

### Why it works
Migraine sufferers can barely look at a screen during severe attacks (photophobia, phonophobia, cognitive fog). The fewer taps + the less visual complexity, the more likely data gets captured. MB's attack auto-timer means patients don't need to remember the start time. N=1 requires full entry post-hoc and loses timing accuracy. MM requires 7+ taps per log.

### Trade-offs
- Risk of incomplete data if user forgets to "stop" attack
- Requires careful UX design to avoid accidental taps
- Background timer drains battery marginally

### Adaptability to LanaeHealth
High. Fits our existing Log page nerve center at src/app/log/. The "during flare" UX already exists in intent via Bearable's approach. Extend with:
- Dedicated /log/headache/active route with attack state
- 44px minimum touch targets (our rule)
- Optimistic UI write to new headache_attacks table
- Timestamp + basic pain level + location, all else deferred

---

## 2. Validated clinical scales (HIT-6, MIDAS)

**Lanae impact: 5/5 stars**
**Best of: Migraine Monitor**

### What it is
HIT-6 (Headache Impact Test, 6 items, 36-78 range, thresholds at 49/55/59) and MIDAS (Migraine Disability Assessment, 5 items + 2 context, grades I-IV) are both IHS-validated instruments for headache impact. MM implements both by default. MB has them paywalled. N=1 does not implement.

### Why it works
Neurologists recognize these instruments by name. A patient walking into neurology with a HIT-6 score of 64 gets taken more seriously than one saying "it's a lot". Our clinical-scales.ts already implements PHQ-9 and GAD-7 with the same pattern.

### Trade-offs
- Recall bias on MIDAS (asks about last 3 months)
- Both scales require monthly re-scoring to detect change
- Patients with chronic daily headache may "floor" the scale

### Adaptability to LanaeHealth
Very high. Extend src/lib/clinical-scales.ts with HIT6 and MIDAS cases. Reuse ClinicalScaleType + ScaleSeverity types. Add to types.ts. Surface on /log or dedicated /log/headache route. Critical for neurology referral prep given Lanae's Apr 2027 MRI.

---

## 3. Menstrual migraine detection (cycle-phase correlation)

**Lanae impact: 5/5 stars**
**Best of: NONE (all three apps fail)**

### What it is
ICHD-3 defines menstrual migraine as migraine without aura occurring on days -2 to +3 of menstruation in at least 2 of 3 consecutive cycles. Pure menstrual migraine occurs ONLY in this window. Menstrually-related migraine occurs in this window AND at other times.

### Why it works
60% of female migraineurs report menstrual triggers. Estradiol withdrawal is the best-supported mechanism. Identifying the pattern unlocks prophylaxis options (frovatriptan mini-prophylaxis, perimenstrual estradiol supplementation, continuous OCP for cycle suppression). This is a DIAGNOSTIC feature, not just tracking.

### Trade-offs
- Requires reliable cycle dates (we have nc_imported from Natural Cycles)
- Classification requires 3 months of data
- Distinguishing pure vs related requires longitudinal tracking

### Adaptability to LanaeHealth
Ideal fit. We have cycle_entries + nc_imported (1,490 days through 2026). Cross-reference new headache_attacks table against cycle phase. Implement as a correlation in src/lib/intelligence/ (e.g., menstrual-migraine-classifier.ts). Output: pure / related / non-menstrual with statistical confidence. Surface in Patterns page + Doctor Mode export.

---

## 4. Medication overuse headache warning

**Lanae impact: 4/5 stars**
**Best of: Migraine Monitor (native), Migraine Buddy (premium)**

### What it is
ICHD-3 thresholds: Triptans or opioids or ergots or combination analgesics on >= 10 days/month for >3 months, OR simple analgesics on >= 15 days/month, indicates medication overuse headache (MOH). The app tracks medication type + frequency + warns when approaching threshold.

### Why it works
Lanae is 24F with chronic headaches post-concussion. If she starts self-medicating with OTC (acetaminophen, ibuprofen) she could enter rebound-headache territory quickly. Most patients don't know this threshold exists.

### Trade-offs
- Requires medication category classification (triptan vs NSAID vs opioid)
- Monthly count must reset correctly (rolling 30 days more accurate than calendar month)
- Warnings must be non-alarming to avoid under-reporting

### Adaptability to LanaeHealth
Build as src/lib/intelligence/medication-overuse.ts. Requires medication_log or existing medication_adherence domain. Classification table of medication_class with ICHD-3 thresholds. Warn via Doctor Mode card when approaching threshold.

---

## 5. Aura tracking (visual, sensory, speech, motor)

**Lanae impact: 4/5 stars**
**Best of: Migraine Monitor (ICHD-3 aligned)**

### What it is
Pre-attack aura categorized per ICHD-3: visual (scintillating scotoma, fortification spectra, hemianopia), sensory (paresthesias, numbness), speech/language (dysphasia), motor (hemiparesis -- rare). Each with duration (typical 5-60 min).

### Why it works
Aura presence is diagnostic (migraine with vs without aura). It also informs treatment choice (triptans contraindicated during hemiplegic aura).

### Trade-offs
- Many patients don't know what aura is
- Requires plain-language descriptions + visual examples
- Duration recall is imperfect

### Adaptability to LanaeHealth
Add aura_symptoms field to headache_attacks table (JSONB array). UI as checkboxes grouped by category with plain-language label + clinical label on tap. Fits our voice rule (plain language, clinical on tap).

---

## 6. Personalized trigger confidence (not generic trigger list)

**Lanae impact: 4/5 stars**
**Best of: N=1 Headache Tracker**

### What it is
Rather than a fixed trigger checklist (red wine, chocolate, MSG), the app learns each patient's actual triggers from their data. Output: "Red wine is a trigger for you, confidence 85%, based on 47 exposures." N=1 uses conditional logit regression. Protective factors are also identified.

### Why it works
Generic trigger lists are noisy. Many patients track chocolate religiously because they "heard" it was a trigger, when their actual trigger is sleep deprivation. Personalized analysis stops self-blame.

### Trade-offs
- Requires 60-90 days of data minimum
- Confounding variables (e.g., period week has both chocolate cravings AND migraines)
- Requires consistent exposure logging

### Adaptability to LanaeHealth
We already have correlation_results table + Spearman/FDR pipeline. Extend with headache-specific correlations: food_entries x headache_attacks (next-day impact), sleep x headache, cycle phase x headache, weather x headache. Surface in Patterns page.

---

## 7. Head-specific pain location (beyond 4-zone)

**Lanae impact: 4/5 stars**
**Best of: Migraine Buddy**

### What it is
Rather than generic "head" as one zone, the map breaks down into: frontal (forehead L/R/center), temporal (temple L/R), orbital (behind eye L/R), parietal (top of head), occipital (back of head), vertex, C-spine (cervicogenic). Different locations suggest different diagnoses (cluster = orbital/temporal unilateral, tension = bilateral frontal/occipital, migraine = unilateral temporal most common).

### Why it works
Location alone is a diagnostic clue. Cluster headache is often misdiagnosed; if an app consistently maps pain to the orbital region + autonomic symptoms, the doctor sees a pattern they might have missed.

### Trade-offs
- SVG/design complexity
- Must remain touch-friendly (44px targets on small regions is hard)

### Adaptability to LanaeHealth
Extend AnatomicalBodyMap.tsx with a zoomed head view activated when user selects "head" region. SVG paths per zone. Store location in headache_attacks.pain_locations as string[] from enum.

---

## 8. Pain quality multi-select (throbbing, stabbing, pressure, burning)

**Lanae impact: 3/5 stars**
**Best of: Migraine Buddy**

### What it is
Pain quality chips: throbbing/pulsating (migraine-typical), pressing/tightening (tension-type), stabbing/electric (neuralgiform), piercing/boring (cluster), squeezing (cervicogenic). Multi-select allowed.

### Why it works
Quality is diagnostic per ICHD-3. Throbbing + unilateral = migraine likely. Tightening + bilateral = tension-type likely.

### Trade-offs
- Patients may not articulate quality precisely
- Quality varies across attacks, making single-select wrong

### Adaptability to LanaeHealth
Already have PainType enum in types.ts (aching, cramping, sharp, burning, pressure, throbbing, stabbing, radiating). Extend with "pulsating" (distinguishing from throbbing for neuro accuracy) if needed. Reuse existing pattern from BodyPainMap.tsx pain type chips.

---

## 9. Time-of-day and duration patterns

**Lanae impact: 3/5 stars**
**Best of: Migraine Buddy (auto-timed)**

### What it is
Time of onset (morning / midday / evening / night / woke with it) + duration (< 4 hr / 4-72 hr = migraine / >72 hr = status migrainosus / cluster pattern circadian). Auto-captured when using attack mode.

### Why it works
Morning awakening headaches may be sleep-apnea related. Evening onset + alcohol correlation. Cluster has circadian clustering (same time of day across weeks).

### Trade-offs
- Duration unreliable if user forgets to "stop" the attack
- Time of onset is recall-bias heavy post-hoc

### Adaptability to LanaeHealth
Auto-capture start timestamp on attack mode entry. Capture end on attack stop or at user prompt next day. Compute duration server-side.

---

## 10. Neurologist-ready PDF export

**Lanae impact: 4/5 stars**
**Best of: Migraine Buddy (if paid), Migraine Monitor (free but ugly)**

### What it is
Structured PDF with: attack frequency by month, HIT-6 / MIDAS scores with trend, medication log + overuse flag, triggers with confidence, cycle correlation, sample attack detail pages.

### Why it works
Neurologist appointments are 15-20 minutes. A 1-page summary plus 5-page appendix saves the patient from narrating chaos. Our Doctor Mode already produces structured output.

### Trade-offs
- PDF generation adds dependency (pdfkit, react-pdf, etc.)
- Formatting must be clinic-appropriate

### Adaptability to LanaeHealth
Extend Doctor Mode / Records page with headache-specific section. Reuse existing structured clinical report output. Output: HTML first (print-friendly), PDF later.

---

## Patterns IGNORED (conflict with LanaeHealth rules)

- **Streak counters** (some premium tiers use "X days logged in a row"): conflicts with no-guilt rule from design-decisions.md
- **Push notifications "you haven't logged today"**: conflicts with no-guilt rule
- **Gamified badges for attack-free days**: potentially toxic for chronic sufferers
- **Social sharing of attack data**: privacy concern for a medical condition

---

## Summary: Best of each app

| Feature | Best app | Available to Lanae |
|---|---|---|
| During-attack logging | Migraine Buddy | Yes |
| HIT-6 / MIDAS | Migraine Monitor | Yes |
| Personalized trigger stats | N=1 | We already do this |
| Medication overuse warning | Migraine Monitor | Yes |
| Aura tracking detail | Migraine Monitor | Yes |
| Head zone detail | Migraine Buddy | Yes |
| Neuro PDF export | Migraine Buddy | We already do this via Doctor Mode |
| Cycle-migraine correlation | NONE | Our unique advantage |
