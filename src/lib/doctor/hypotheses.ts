/**
 * Hypothesis generation for the doctor brief.
 *
 * Two sources:
 *   1. Intelligence engine's hypothesis_tracker KB document (authoritative)
 *   2. Heuristic fallback based on DoctorPageData (always works)
 *
 * Each hypothesis includes a "single test that would most reduce uncertainty,"
 * which is the heart of the brief: it turns the doctor's time from discovery
 * into a decision.
 */

import type { DoctorPageData } from "@/app/doctor/page";
import type { SpecialistView } from "./specialist-config";

export type ConfidenceLevel = "low" | "moderate" | "high";

export interface Hypothesis {
  name: string;
  confidence: ConfidenceLevel;
  supporting: string[];       // bullet points of supporting evidence
  nextTest: string;            // single test that would most reduce uncertainty
  nextTestRationale: string;   // why this test, not another
  relevantTo: SpecialistView[]; // which specialists should see this
}

function hasTestResult(data: DoctorPageData, pattern: RegExp): boolean {
  return data.allLabs.some((l) => pattern.test(l.test_name));
}

function latestLab(data: DoctorPageData, pattern: RegExp) {
  const matches = data.allLabs.filter((l) => pattern.test(l.test_name));
  return matches.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

/**
 * Deterministic hypothesis generation.
 * Always produces output; safe to call at render time.
 */
export function generateHypotheses(data: DoctorPageData): Hypothesis[] {
  const out: Hypothesis[] = [];

  const hasEndo = data.suspectedConditions.some((c) =>
    /endometrios/i.test(c)
  );
  const hasPots = data.suspectedConditions.some((c) => /POTS/i.test(c));

  // -- POTS hypothesis --
  const restingHr = data.latestVitals.restingHr;
  const hrv = data.latestVitals.hrvAvg;

  // Count positive orthostatic tests (≥30 bpm rise sustained)
  const orthoTests = data.orthostaticTests ?? [];
  const positiveTests = orthoTests.filter(
    (t) => t.peak_rise_bpm !== null && t.peak_rise_bpm >= 30
  );
  const hasPositiveOrthoHistory = positiveTests.length >= 3;
  const hasAnyOrthoTest = orthoTests.length > 0;

  if (
    hasPots ||
    hasAnyOrthoTest ||
    (restingHr !== null && restingHr < 60 && hrv !== null && hrv < 40)
  ) {
    const supporting: string[] = [];
    if (restingHr !== null)
      supporting.push(`Resting HR ${restingHr} bpm (Oura ${data.latestVitals.date ?? "recent"})`);
    if (hrv !== null) supporting.push(`HRV ${Math.round(hrv)}ms average (low)`);

    if (positiveTests.length > 0) {
      const mostRecent = positiveTests[0];
      supporting.push(
        `${positiveTests.length} of ${orthoTests.length} orthostatic tests positive (latest peak rise +${mostRecent.peak_rise_bpm} bpm on ${mostRecent.test_date})`
      );
    } else if (hasAnyOrthoTest) {
      supporting.push(
        `${orthoTests.length} orthostatic test(s) logged; none meeting ≥30 bpm criterion`
      );
    } else {
      supporting.push("Reported standing tachycardia; history suggestive");
    }

    // Confidence upgrades with repeated positive tests
    const confidence: ConfidenceLevel = hasPositiveOrthoHistory
      ? "high"
      : positiveTests.length >= 1
      ? "moderate"
      : "moderate";

    const nextTest = hasPositiveOrthoHistory
      ? "Autonomic function panel + tilt-table (for formal diagnosis)"
      : positiveTests.length >= 1
      ? `Log ${3 - positiveTests.length} more positive active-stand test${
          3 - positiveTests.length === 1 ? "" : "s"
        } on separate days to meet POTS criteria`
      : "10-minute active stand test (≥3 positive tests on separate days = POTS)";

    const nextTestRationale = hasPositiveOrthoHistory
      ? "Three or more positive home tests already meet Consortium POTS criteria. Cardiology should confirm with formal tilt + autonomic panel."
      : positiveTests.length >= 1
      ? "Single positive test is suggestive but not diagnostic. POTS criteria require sustained ≥30 bpm rise on 3+ days."
      : "A ≥30 bpm rise on standing within 10 min confirms POTS criteria. Cheaper and faster than tilt-table.";

    out.push({
      name: "Postural Orthostatic Tachycardia Syndrome (POTS)",
      confidence,
      supporting,
      nextTest,
      nextTestRationale,
      relevantTo: ["pcp", "cardiology"],
    });
  }

  // -- Endometriosis hypothesis --
  if (
    hasEndo ||
    (data.cycleStatus.pain && /severe|8|9|10/.test(data.cycleStatus.pain ?? "")) ||
    (data.cycleStatus.clots && /yes|heavy|large/i.test(data.cycleStatus.clots ?? ""))
  ) {
    const supporting: string[] = [];
    if (data.cycleStatus.pain)
      supporting.push(`Dysmenorrhea: ${data.cycleStatus.pain}`);
    if (data.cycleStatus.flow)
      supporting.push(`Flow: ${data.cycleStatus.flow}`);
    if (data.cycleStatus.padChangesHeavyDay)
      supporting.push(`Heaviest day pad changes: ${data.cycleStatus.padChangesHeavyDay}`);
    if (data.cycleStatus.clots)
      supporting.push(`Clots: ${data.cycleStatus.clots}`);

    out.push({
      name: "Endometriosis",
      confidence: "moderate",
      supporting,
      nextTest: "Transvaginal ultrasound (TVUS) with endometriosis protocol",
      nextTestRationale:
        "TVUS can identify deep infiltrating endometriosis and endometriomas without surgery. Laparoscopy is the gold standard but reserve for non-diagnostic TVUS.",
      relevantTo: ["pcp", "obgyn"],
    });
  }

  // -- Thyroid hypothesis --
  const tsh = latestLab(data, /\btsh\b/i);
  if (tsh && tsh.value !== null && tsh.value > 4.0) {
    out.push({
      name: `Subclinical hypothyroidism (TSH ${tsh.value} ${tsh.unit ?? ""})`,
      confidence: tsh.value > 10 ? "high" : "moderate",
      supporting: [
        `TSH ${tsh.value} ${tsh.unit ?? ""} on ${tsh.date}`,
        "Check for thyroid antibodies and free T4 to classify",
      ],
      nextTest: "Repeat TSH + free T4 + TPO antibodies in 6-8 weeks",
      nextTestRationale:
        "Single TSH elevation can be transient. A repeat panel with free T4 and TPO antibodies differentiates transient elevation from Hashimoto's.",
      relevantTo: ["pcp"],
    });
  }

  // -- Dyslipidemia hypothesis --
  const chol = latestLab(data, /cholesterol|ldl/i);
  if (chol && chol.value !== null && chol.value > 240) {
    out.push({
      name: `Dyslipidemia (total cholesterol ${chol.value} ${chol.unit ?? ""})`,
      confidence: "moderate",
      supporting: [
        `${chol.test_name} ${chol.value} ${chol.unit ?? ""} on ${chol.date}`,
        `${data.patient.age}F; atypical for this age group`,
      ],
      nextTest: "Fasting lipid panel + ApoB + Lp(a)",
      nextTestRationale:
        "ApoB is a better cardiovascular risk marker than LDL-C alone. Lp(a) is a one-time genetic risk assessment.",
      relevantTo: ["pcp", "cardiology"],
    });
  }

  // Sort: high confidence first, then by evidence count
  out.sort((a, b) => {
    const conf = { high: 0, moderate: 1, low: 2 } as const;
    if (conf[a.confidence] !== conf[b.confidence])
      return conf[a.confidence] - conf[b.confidence];
    return b.supporting.length - a.supporting.length;
  });

  return out;
}

export function filterForSpecialist(
  hs: Hypothesis[],
  view: SpecialistView
): Hypothesis[] {
  return hs.filter((h) => h.relevantTo.includes(view));
}
