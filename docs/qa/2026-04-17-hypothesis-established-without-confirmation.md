# Hypothesis Doctor was scoring ESTABLISHED without confirmatory evidence

**Date filed:** 2026-04-17
**Severity:** high - clinical reasoning bug
**Status:** FIXED on `feat/session-3-applied-migrations` (cherry-picked from `feat/competitive-wave-2d`)
**Commits:**
- `31f0765` fix(cie): prevent ESTABLISHED without confirmatory evidence
- `3403f9b` fix(cie): make hypothesis-doctor examples consistent with new rules
- `fc76fc4` fix(cie): make parseEvidenceItems tolerant of fences, bullets, prose

## The bug

The Hypothesis Doctor persona scored `endometriosis_pelvic_inflammatory_complex` at 93/100 ESTABLISHED based on ICD-10 code N92.0 in the patient's active_problems. N92.0 is a **menstrual-disorder symptom code** (menorrhagia with regular cycle), not the endometriosis diagnosis code (which is N80.x). The hypothesis landed in the doctor brief as a confirmed diagnosis when it is in fact unverified.

The Challenger persona caught it verbatim in an earlier run:

> "N92.0 is a symptom code, not a pathological diagnosis. Endometriosis requires histological confirmation (laparoscopy) or at minimum transvaginal ultrasound/MRI showing endometriomas or deep infiltrating lesions. Neither is documented anywhere in the dataset. The 'pelvic inflammatory complex' framing adds further unverified diagnostic weight. This hypothesis is being treated as ESTABLISHED on the basis of a symptom ICD code and clinical suspicion. That is a category error."

## Why it happened

The hypothesis-doctor system prompt said:
- "`meets_criteria_rule`: true if this finding meets established diagnostic criteria (e.g., ATA guidelines, tilt table criteria)"
- "`is_anchored`: true only if this is a CONFIRMED diagnosis (not suspected)"

But the only example showed TSH 6.2 being flagged `meets_criteria_rule: true`. TSH 6.2 is above reference but below the ATA criterion for overt hypothyroidism (>10 + TPO antibodies). The example contradicted the rule and let Claude treat any ICD code as criterion-meeting evidence.

The scoring function `computeHypothesisScore` also had no floor or cap tied to confirmation. A dense cluster of high-weight symptom-level items could freely cross 80/100 into ESTABLISHED, with nothing objective backing it.

## The fix (two layers)

### 1. Prompt contract - `src/lib/intelligence/personas/hypothesis-doctor.ts`

Added two explicit sections to the system prompt:

- **CODE SEMANTICS**: teach the LLM that SYMPTOM codes (R-codes, N92.x, R10, etc.) are supporting evidence at most, never confirmation. DIAGNOSIS codes (N80.x endometriosis, E06.x thyroiditis, I48 AF, G43.x migraine) encode confirmed pathology. The N92.0 vs N80.x distinction is called out as the worked example.
- **CONFIDENCE CAPS WITHOUT CONFIRMATORY TESTING**: a hypothesis cannot exceed PROBABLE (70) without imaging, histology, criterion-level labs, or a real DIAGNOSIS ICD code in `confirmed_diagnoses`. `meets_criteria_rule=true` is only allowed when the evidence item itself represents one of those.

The inline examples were rewritten so they match the rule: TSH 6.2 now shows `meets_criteria_rule=false, is_anchored=false`; the affirmative example is a biopsy-confirmed endometriosis finding showing both fields `true`.

### 2. Deterministic gate - `src/lib/intelligence/types.ts`

Added `UNCONFIRMED_HYPOTHESIS_SCORE_CAP = 70`. `computeHypothesisScore` now caps the final normalized score at 70 when NO supporting evidence has *both* `meets_criteria_rule=true` AND `is_anchored=true`. ESTABLISHED (>=80) is physically unreachable without an objective confirmatory item, regardless of how many symptoms the LLM piles on.

This gate is independent of the prompt - if a future model ignores the CODE SEMANTICS instructions and claims everything meets criteria, the cap still holds.

### 3. Parser tolerance - same file as (1)

`parseEvidenceItems` now strips ```` ``` ```` code fences, leading bullets (`-`, `*`, `1.`), and inline prose before attempting `JSON.parse`. This prevented a failure mode where Claude occasionally wrapped the EVIDENCE_ITEMS block in markdown fencing, making every line fail to parse and the tracker land empty.

## Tests

`src/lib/__tests__/intelligence-types.test.ts` gained two new cases:
- `caps score at PROBABLE ceiling without confirmatory evidence`
- `allows ESTABLISHED when meets_criteria_rule AND is_anchored are true`

Three existing relative-ordering tests (FDR bonus, criteria bonus, more-evidence-scores-higher) had to switch to `confirmed()` evidence helpers because the cap collapsed both sides of the comparison to 70 under the default `meets_criteria_rule=false, is_anchored=false`. The updated assertions still verify the same directional behavior - just above the cap.

All 21 tests pass.

## How to verify in production

1. Run `POST /api/intelligence/analyze {"mode":"doctor_prep","reason":"ICD fix verify","target_appointment":"<upcoming appt>"}`.
2. Fetch the hypothesis_tracker KB doc.
3. Expected: `endometriosis_pelvic_inflammatory_complex` (or equivalent) is scored at or below 70 (PROBABLE) rather than 93 (ESTABLISHED), because no TVUS / MRI / laparoscopy / N80.x code exists in Lanae's dataset yet.
4. The brief's Working Hypotheses section should show PROBABLE for endometriosis, with Outstanding Tests surfacing TVUS with endometriosis protocol as the next-best uncertainty-reducer.

The Challenger's earlier complaint about this specific category error should disappear from the next run's `## Challenger Assessment > CHALLENGES` section.

## Follow-up ideas

- Drive the prompt from the same constants that the score cap uses (a single `CONFIRMATION_RULE` literal), so prompt and code can't drift.
- Parse the ICD code pattern directly out of `active_problems.problem` text and auto-tag `meets_criteria_rule` / `is_anchored` server-side, so we don't rely on Claude making the call.
- Extend the cap to require MULTIPLE confirmatory items for ESTABLISHED (currently one is enough once you're past the gate), mirroring Austin diagnostic convention of requiring two independent confirmatory tests.
