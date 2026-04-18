/**
 * Wrong-modality flag.
 *
 * Cross-references active CIE hypotheses against `imaging_studies` to
 * flag cases where imaging WAS done but the modality used is known to
 * be insufficient / incorrect for the condition being evaluated.
 *
 * Example: chiari_malformation gets a CT Head, which shows nothing
 * because CT cannot measure tonsillar descent. The patient, family,
 * and downstream specialists then act on "CT negative" without
 * realizing the right test (MRI sagittal T1/T2) was never ordered.
 *
 * Rules are deliberately conservative; we only flag a mismatch when
 * (a) a hypothesis matches a keyword in the condition map AND
 * (b) the modality used is in that condition's reject_modalities list AND
 * (c) the preferred modality is NOT present on any other imaging row.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface WrongModalityFlag {
  hypothesis: string;           // the hypothesis whose workup is compromised
  modalityUsed: string;         // e.g. "CT"
  bodyPart: string;             // "Head", "Brain"
  studyDate: string;            // ISO date of the inadequate study
  preferredModality: string;    // "MRI sagittal T1/T2"
  rationale: string;            // why the used modality is insufficient
  imagingStudyId: string;       // citation
}

interface ImagingRow {
  id: string;
  study_date: string;
  modality: string;
  body_part: string;
}

interface ConditionRule {
  /** Regex that matches hypothesis names in the KB tracker. */
  hypothesisPattern: RegExp;
  /** Body parts this rule applies to. */
  bodyParts: RegExp;
  /** Modalities we consider inadequate when combined with the above. */
  rejectModalities: RegExp;
  /** Modality name to recommend in the flag. */
  preferredModality: string;
  /** One-sentence rationale the doctor can read cold. */
  rationale: string;
  /** Regex matching any imaging row whose presence SATISFIES the workup,
   *  so we suppress the flag once the right study has been done. */
  satisfyingModality: RegExp;
}

const RULES: ConditionRule[] = [
  {
    hypothesisPattern: /chiari|craniocervical|tonsillar/i,
    bodyParts: /head|brain|skull|cervic/i,
    rejectModalities: /^ct\b|computed tomography/i,
    preferredModality: "MRI Brain with sagittal T1/T2 + cervical spine",
    rationale:
      "Chiari assessment requires millimeter measurement of cerebellar tonsillar descent below the foramen magnum. CT cannot reliably show soft-tissue descent; MRI sagittal T1/T2 sequences are the accepted modality (and add C-spine for atlantoaxial stability).",
    satisfyingModality: /\bmri\b|magnetic resonance/i,
  },
  {
    hypothesisPattern: /endometri|pelvic_inflammatory/i,
    bodyParts: /pelvis|pelvic|abdom|uter|ovari/i,
    rejectModalities: /^ct\b|computed tomography|^xr|x[- ]?ray/i,
    preferredModality: "Transvaginal ultrasound with endometriosis protocol (or pelvic MRI)",
    rationale:
      "Endometriosis detection requires a dedicated TVUS protocol or pelvic MRI to identify deep infiltrating disease and endometriomas. CT and plain films miss these lesions and reassure falsely.",
    satisfyingModality: /transvaginal|\btvus\b|pelvic\s*(mri|ultrasound)/i,
  },
  {
    hypothesisPattern: /thyroid|hashimoto|hypothyroid|hyperthyroid/i,
    bodyParts: /thyroid|neck/i,
    rejectModalities: /^ct\b|^xr|x[- ]?ray/i,
    preferredModality: "Thyroid ultrasound + TSH/FT4/TPO labs",
    rationale:
      "Thyroid pathology is a soft-tissue and biochemical diagnosis. CT adds radiation with minimal yield; the workup is ultrasound plus TSH, free T4, and TPO antibodies.",
    satisfyingModality: /thyroid\s+ultrasound|thyroid\s+us/i,
  },
  {
    hypothesisPattern: /pituitary|adenoma|prolactinoma/i,
    bodyParts: /head|brain|pituitary|sella/i,
    rejectModalities: /^ct\b/i,
    preferredModality: "Pituitary MRI with gadolinium (dynamic protocol)",
    rationale:
      "Microadenomas (<10mm) are often CT-negative; dynamic contrast-enhanced pituitary MRI is the standard workup.",
    satisfyingModality: /pituitary\s*mri|sella\s*mri|mri.*gadolin/i,
  },
];

/** A satisfying study is one that has already been PERFORMED (study_date
 *  on or before today) AND matches BOTH the preferred-modality pattern AND
 *  the relevant body-part pattern. Requiring both prevents a Breast MRI
 *  from silencing a Chiari flag just because both are "MRI." A future-
 *  scheduled study does not answer the question yet. */
function hasSatisfyingPastStudy(
  studies: ImagingRow[],
  modalityPattern: RegExp,
  bodyPartPattern: RegExp,
): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return studies.some((s) => {
    if (s.study_date > today) return false;
    return modalityPattern.test(s.modality) && bodyPartPattern.test(s.body_part);
  });
}

/** Extract hypothesis names from the KB tracker markdown.
 *  Each hypothesis has a "## <name> -- Score: N/100 (CATEGORY)" header.
 *  This is a lightweight in-lib scan so the caller can invoke us without
 *  having to resolve the kb-hypotheses loader first (keeps this usable
 *  inside the same Promise.all pass as the other analytics). */
async function fetchHypothesisNames(sb: SupabaseClient): Promise<string[]> {
  try {
    const { data } = await sb
      .from("clinical_knowledge_base")
      .select("content")
      .eq("document_id", "hypothesis_tracker")
      .maybeSingle();
    const content = (data?.content as string | undefined) ?? "";
    if (!content) return [];
    const names: string[] = [];
    for (const line of content.split("\n")) {
      const m = line.match(/^##\s+([^\s][^\n]*?)\s+(?:--|—)?\s*Score:/i);
      if (m) names.push(m[1].trim());
    }
    return names;
  } catch {
    return [];
  }
}

export async function computeWrongModalityFlags(
  sb: SupabaseClient,
  hypothesisNames?: string[],
): Promise<WrongModalityFlag[]> {
  const names =
    hypothesisNames && hypothesisNames.length > 0
      ? hypothesisNames
      : await fetchHypothesisNames(sb);
  if (names.length === 0) return [];

  try {
    const { data } = await sb
      .from("imaging_studies")
      .select("id, study_date, modality, body_part")
      .order("study_date", { ascending: false })
      .limit(30);

    const studies = (data ?? []) as ImagingRow[];
    if (studies.length === 0) return [];

    const flags: WrongModalityFlag[] = [];

    for (const rule of RULES) {
      // Does any active hypothesis match this rule?
      const matchingHypothesis = names.find((h) =>
        rule.hypothesisPattern.test(h),
      );
      if (!matchingHypothesis) continue;

      // Is the preferred modality already satisfied by a PAST study ON
      // THE SAME BODY PART? Future-scheduled studies and same-modality-
      // different-body-part studies do not count.
      if (
        hasSatisfyingPastStudy(studies, rule.satisfyingModality, rule.bodyParts)
      ) continue;

      // Find an inadequate study that was performed on the relevant body part.
      const inadequate = studies.find(
        (s) =>
          rule.bodyParts.test(s.body_part) && rule.rejectModalities.test(s.modality),
      );
      if (!inadequate) continue;

      flags.push({
        hypothesis: matchingHypothesis,
        modalityUsed: inadequate.modality,
        bodyPart: inadequate.body_part,
        studyDate: inadequate.study_date,
        preferredModality: rule.preferredModality,
        rationale: rule.rationale,
        imagingStudyId: inadequate.id,
      });
    }

    return flags;
  } catch {
    return [];
  }
}
