/**
 * Outstanding Tests
 *
 * For each active hypothesis, derive the tests that SHOULD have been ordered
 * but do not yet appear in lab_results. The brief surfaces these as
 * "Outstanding Workup" so the doctor can order them today.
 *
 * Matching is name-based with regex patterns because lab_results.test_name
 * is free-form (from different labs and imports).
 */

import type { DoctorPageData } from "@/app/doctor/page";
import type { SpecialistView } from "./specialist-config";

export interface OutstandingTest {
  testName: string;
  clarifies: string;         // which hypothesis this resolves
  rationale: string;
  pattern: RegExp;           // regex to detect whether it's been drawn
  relevantTo: SpecialistView[];
  urgency: "high" | "medium" | "low";
}

const CANDIDATES: OutstandingTest[] = [
  {
    testName: "Free T4",
    clarifies: "Subclinical hypothyroidism (TSH 5.1 on 4/9)",
    rationale:
      "TSH alone cannot distinguish transient elevation from Hashimoto's. Free T4 + TPO antibodies in the same draw resolves both questions.",
    pattern: /\bfree[\s_-]*t4\b|^t4\s*free/i,
    relevantTo: ["pcp"],
    urgency: "medium",
  },
  {
    testName: "TPO antibodies (anti-thyroid)",
    clarifies: "Subclinical hypothyroidism (TSH 5.1)",
    rationale:
      "Positive TPO with elevated TSH confirms Hashimoto's. Negative TPO suggests transient thyroiditis and changes management.",
    pattern: /\btpo\b|thyroid\s*perox|thyroglobulin/i,
    relevantTo: ["pcp"],
    urgency: "medium",
  },
  {
    testName: "ApoB",
    clarifies: "Dyslipidemia (cholesterol 286)",
    rationale:
      "ApoB is a stronger cardiovascular risk marker than LDL-C alone, especially in young patients with metabolic signals.",
    pattern: /\bapob\b|apo[\s_-]*b\b|apolipoprotein\s*b/i,
    relevantTo: ["pcp", "cardiology"],
    urgency: "low",
  },
  {
    testName: "Lp(a) lipoprotein",
    clarifies: "Dyslipidemia genetic risk",
    rationale:
      "One-time genetic CV risk assessment; not inheritance-tested separately. Elevated Lp(a) changes lifetime risk stratification.",
    pattern: /\blp\s*\(?a\)?\b|lipoprotein\s*a/i,
    relevantTo: ["pcp", "cardiology"],
    urgency: "low",
  },
  {
    testName: "Serum tryptase (fasting)",
    clarifies: "Mast Cell Activation Syndrome (MCAS)",
    rationale:
      "Baseline tryptase >11.4 ng/mL or a 20% + 2 ng/mL rise during flare supports MCAS diagnosis. Currently in-progress per timeline.",
    pattern: /\btryptase\b/i,
    relevantTo: ["pcp"],
    urgency: "high",
  },
  {
    testName: "24h urine N-methylhistamine",
    clarifies: "MCAS (histamine metabolism)",
    rationale:
      "Second-line mast-cell marker; supports MCAS diagnosis alongside tryptase. Collected at home, processed by specialty labs.",
    pattern: /n[\s-]*methyl[\s-]*histamine|methylhistamine/i,
    relevantTo: ["pcp"],
    urgency: "medium",
  },
  {
    testName: "Complement C3 / C4",
    clarifies: "MCAS vs autoimmune / complement deficiency",
    rationale:
      "Low C4 alongside recurrent allergic reactions suggests complement consumption; differentiates MCAS from hereditary angioedema.",
    pattern: /\bc3\b|\bc4\b|complement/i,
    relevantTo: ["pcp"],
    urgency: "medium",
  },
  {
    testName: "Urinalysis + urine culture",
    clarifies: "Bladder dysfunction (recurrent UTI-like symptoms)",
    rationale:
      "Rules out active infection. If negative despite symptoms, points toward interstitial cystitis or pelvic-floor etiology.",
    pattern: /urinalysis|\bua\b|urine\s+culture/i,
    relevantTo: ["pcp", "obgyn"],
    urgency: "medium",
  },
  {
    testName: "Post-void residual (PVR) ultrasound",
    clarifies: "Bladder dysfunction (incomplete emptying)",
    rationale:
      "Patient reports having to 'find the stream' and push. Elevated PVR changes workup direction toward pelvic floor or neurogenic cause.",
    pattern: /post[\s-]*void|\bpvr\b/i,
    relevantTo: ["obgyn"],
    urgency: "medium",
  },
  {
    testName: "ANA with reflex ENA",
    clarifies: "Autoimmune connective tissue / overlap with EDS",
    rationale:
      "Joint hypermobility + fatigue + multi-system symptoms warrants an autoimmune screen before attributing everything to EDS.",
    pattern: /\bana\b|antinuclear|\bena\b/i,
    relevantTo: ["pcp"],
    urgency: "low",
  },
  {
    testName: "Beighton score (hypermobility)",
    clarifies: "Ehlers-Danlos Syndrome",
    rationale:
      "Self-assessable 9-point scale. Score ≥5 supports hypermobile EDS clinical criteria. Takes 5 minutes; should be documented if suspected.",
    pattern: /beighton/i,
    relevantTo: ["pcp"],
    urgency: "low",
  },
  {
    testName: "Vitamin B12 + folate",
    clarifies: "Fatigue workup (addressable causes)",
    rationale:
      "Iron has been addressed. B12 / folate deficiency presents with overlapping fatigue and mood symptoms and is cheap to rule out.",
    pattern: /\bb12\b|cobalamin|\bfolate\b|folic\s*acid/i,
    relevantTo: ["pcp"],
    urgency: "low",
  },
  {
    testName: "Transvaginal ultrasound (TVUS) with endometriosis protocol",
    clarifies: "Suspected endometriosis",
    rationale:
      "Can identify deep infiltrating endometriosis and endometriomas without surgery. Should be ordered before laparoscopy.",
    pattern: /transvaginal|\btvus\b|endo(metrios)?\s*protocol|pelvic\s*ultrasound/i,
    relevantTo: ["obgyn"],
    urgency: "high",
  },
];

export function findOutstanding(
  data: DoctorPageData,
  view: SpecialistView = "pcp"
): OutstandingTest[] {
  // Derive which hypotheses are active for this patient so we don't surface
  // tests for conditions that aren't in play.
  const suspected = (data.suspectedConditions ?? [])
    .map((c) => c.toLowerCase())
    .join(" ");
  const problems = (data.activeProblems ?? [])
    .map((p) => `${p.problem} ${p.latestData ?? ""}`.toLowerCase())
    .join(" ");
  const haystack = `${suspected} ${problems}`;

  const isActive: Record<OutstandingTest["testName"], boolean> = {
    "Free T4": /tsh|thyroid|hypothy/.test(haystack),
    "TPO antibodies (anti-thyroid)": /tsh|thyroid|hypothy/.test(haystack),
    ApoB: /cholesterol|lipid|dyslipid/.test(haystack),
    "Lp(a) lipoprotein": /cholesterol|lipid|dyslipid/.test(haystack),
    "Serum tryptase (fasting)": /mcas|mast\s*cell|histamin/.test(haystack),
    "24h urine N-methylhistamine": /mcas|mast\s*cell|histamin/.test(haystack),
    "Complement C3 / C4": /mcas|mast\s*cell|angioedema/.test(haystack),
    "Urinalysis + urine culture": /uti|urinary|bladder/.test(haystack),
    "Post-void residual (PVR) ultrasound": /bladder|urinary|voiding/.test(haystack),
    "ANA with reflex ENA": /eds|autoimmune|hypermobile/.test(haystack),
    "Beighton score (hypermobility)": /eds|hypermobile|connective/.test(haystack),
    "Vitamin B12 + folate": /fatigue|anemia|iron|ferritin/.test(haystack),
    "Transvaginal ultrasound (TVUS) with endometriosis protocol":
      /endomet|dysmenorrh/.test(haystack),
  };

  // Fallback: if we can't detect activity from text, keep TSH-related tests
  // when TSH is in lab_results and elevated.
  const tshLab = data.allLabs?.find((l) => /\btsh\b/i.test(l.test_name ?? ""));
  if (tshLab && tshLab.value !== null && tshLab.value > 4.0) {
    isActive["Free T4"] = true;
    isActive["TPO antibodies (anti-thyroid)"] = true;
  }
  const cholLab = data.allLabs?.find((l) => /cholesterol/i.test(l.test_name ?? ""));
  if (cholLab && cholLab.value !== null && cholLab.value > 240) {
    isActive["ApoB"] = true;
  }

  const drawn = (data.allLabs ?? []).map((l) => l.test_name ?? "");

  return CANDIDATES.filter((c) => {
    if (!isActive[c.testName]) return false;
    const alreadyDrawn = drawn.some((name) => c.pattern.test(name));
    if (alreadyDrawn) return false;
    return c.relevantTo.includes(view);
  });
}

export function sortByUrgency(tests: OutstandingTest[]): OutstandingTest[] {
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return [...tests].sort((a, b) => rank[a.urgency] - rank[b.urgency]);
}
