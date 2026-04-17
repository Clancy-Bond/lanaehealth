/**
 * Specialist Configuration
 *
 * Defines which data buckets each specialist sees at the top of their brief,
 * and which data buckets can be de-emphasized or hidden entirely.
 *
 * The scoring model: every section of the brief maps to one of 8 "buckets."
 * Each specialist assigns a weight from -1 (hide) to 3 (top of brief) to
 * each bucket. The doctor brief renders sections in descending weight order.
 *
 * This is clinical judgment. A cardiologist doesn't care about flow volume;
 * an OB/GYN rarely needs the detailed HRV time-series. Getting these weights
 * right is what makes the brief feel like it was prepared *for* them.
 */

export type SpecialistView = "pcp" | "obgyn" | "cardiology";

export type DataBucket =
  | "activeProblems"        // Active unresolved issues (always top-ish)
  | "vitals"                // HRV, resting HR, SpO2, sleep, temp, readiness
  | "labs"                  // Lab panels, trends, abnormals
  | "cycle"                 // Menstrual, flow, pain, cycle phase
  | "orthostatic"           // Standing pulse, POTS signs
  | "imaging"               // CT, XR, MRI
  | "correlations"          // Pattern discoveries
  | "medications";          // Meds + supplements + adherence

export interface SpecialistConfig {
  label: string;             // Display name, e.g. "OB/GYN brief"
  subtitle: string;          // Short description shown under toggle
  bucketWeights: Record<DataBucket, number>;  // -1 (hide) to 3 (top)
  openingLine: string;       // First sentence of the brief, e.g. "24F with endometriosis..."
}

// ────────────────────────────────────────────────────────────────
// TODO (LEARNING MODE CONTRIBUTION):
// Adjust the weights below based on what you think each specialist
// actually cares about. These are the defaults I'd ship; override
// them if your clinical priors differ. Higher number = higher
// in the brief. -1 hides the section entirely.
//
// Lanae's context:
// - PCP (Dr. ___ on Apr 13 already done): whole-picture
// - OB/GYN (Apr 30): suspected endometriosis, cycle pain, heavy flow
// - Cardiology (Aug 17): POTS workup, standing pulse 106, low HRV
// ────────────────────────────────────────────────────────────────

export const SPECIALIST_CONFIG: Record<SpecialistView, SpecialistConfig> = {
  pcp: {
    label: "PCP / Internal Medicine",
    subtitle: "Whole-picture brief",
    openingLine:
      "24-year-old female with multi-system complaints under active workup.",
    bucketWeights: {
      activeProblems: 3,
      labs: 3,
      vitals: 2,
      medications: 2,
      orthostatic: 1,
      correlations: 1,
      imaging: 1,
      cycle: 0,
    },
  },

  obgyn: {
    label: "OB/GYN",
    subtitle: "Cycle, pain, reproductive",
    openingLine:
      "24F presenting for suspected endometriosis workup; heavy flow, dysmenorrhea, cycle pain.",
    bucketWeights: {
      cycle: 3,
      activeProblems: 3,
      labs: 1,               // de-emphasize non-reproductive labs
      correlations: 2,       // pain-cycle correlations are gold
      medications: 1,
      vitals: 0,
      orthostatic: -1,       // hide
      imaging: 0,
    },
  },

  cardiology: {
    label: "Cardiology",
    subtitle: "HRV, orthostatic, syncope",
    openingLine:
      "24F with suspected POTS: standing HR 106 (+58 from resting 48), persistent low HRV.",
    bucketWeights: {
      orthostatic: 3,
      vitals: 3,
      activeProblems: 2,
      correlations: 2,
      labs: 1,               // only CV-relevant labs via separate filter
      medications: 1,
      imaging: 0,
      cycle: -1,             // hide
    },
  },
};

/**
 * Return ordered list of buckets for a specialist, highest weight first,
 * excluding hidden (-1) buckets.
 */
export function orderedBuckets(view: SpecialistView): DataBucket[] {
  const weights = SPECIALIST_CONFIG[view].bucketWeights;
  return (Object.keys(weights) as DataBucket[])
    .filter((b) => weights[b] >= 0)
    .sort((a, b) => weights[b] - weights[a]);
}

/**
 * Whether a bucket should be visible for a specialist view.
 */
export function bucketVisible(
  view: SpecialistView,
  bucket: DataBucket
): boolean {
  return SPECIALIST_CONFIG[view].bucketWeights[bucket] >= 0;
}
