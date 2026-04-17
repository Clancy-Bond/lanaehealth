/**
 * KB Hypothesis Loader
 *
 * Reads the Clinical Intelligence Engine's `hypothesis_tracker` document
 * from `clinical_knowledge_base` and parses the markdown into structured
 * records the doctor brief can render.
 *
 * This module replaces the deterministic heuristics in
 * `src/lib/doctor/hypotheses.ts` as the *primary* source for the brief.
 * Heuristics remain the fallback when the KB is empty or stale.
 *
 * Expected markdown shape produced by hypothesis-doctor:
 *   # Active Hypothesis Tracker
 *   Updated: YYYY-MM-DD
 *
 *   ## Name -- Score: 72/100 (PROBABLE) [RISING]
 *
 *   ### Supporting Evidence
 *   - finding (source_table, source_date, weight: X)
 *   ...
 *   ### Contradicting Evidence
 *   ...
 *   ### What Would Change This
 *   ...
 *   ### Alternative Explanations
 *   ...
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type KBConfidenceCategory =
  | "ESTABLISHED"
  | "PROBABLE"
  | "POSSIBLE"
  | "SPECULATIVE"
  | "INSUFFICIENT";

export type HypothesisDirection = "rising" | "stable" | "falling";

export interface KBHypothesis {
  name: string;
  score: number | null;              // 0-100 from tracker
  confidence: KBConfidenceCategory;
  direction: HypothesisDirection;
  supporting: string[];
  contradicting: string[];
  whatWouldChange: string[];
  alternatives: string[];
}

export interface KBHypothesisPayload {
  hypotheses: KBHypothesis[];
  generatedAt: string | null;
  stale: boolean;                    // true when KB doc is older than 7 days
  documentId: string;
  sourcePersona: string;
}

const STALE_AFTER_DAYS = 7;

function categoryFromString(raw: string): KBConfidenceCategory {
  const up = raw.toUpperCase().trim();
  if (up.startsWith("ESTABLISH")) return "ESTABLISHED";
  if (up.startsWith("PROBAB")) return "PROBABLE";
  if (up.startsWith("POSSIB")) return "POSSIBLE";
  if (up.startsWith("SPECULA")) return "SPECULATIVE";
  return "INSUFFICIENT";
}

function parseHeading(heading: string): {
  name: string;
  score: number | null;
  confidence: KBConfidenceCategory;
  direction: HypothesisDirection;
} {
  // Shape: "## <name> -- Score: <n>/100 (<CATEGORY>)[ [RISING|FALLING]]"
  // Stripped of leading "## " before we get here.
  let rest = heading.trim();
  let direction: HypothesisDirection = "stable";
  if (/\[RISING\]/i.test(rest)) {
    direction = "rising";
    rest = rest.replace(/\[RISING\]/i, "").trim();
  } else if (/\[FALLING\]/i.test(rest)) {
    direction = "falling";
    rest = rest.replace(/\[FALLING\]/i, "").trim();
  }

  let confidence: KBConfidenceCategory = "INSUFFICIENT";
  const confMatch = rest.match(/\(([A-Za-z]+)\)\s*$/);
  if (confMatch) {
    confidence = categoryFromString(confMatch[1]);
    rest = rest.replace(confMatch[0], "").trim();
  }

  let score: number | null = null;
  const scoreMatch = rest.match(/Score:\s*(\d+)\s*\/\s*100/i);
  if (scoreMatch) {
    score = Number(scoreMatch[1]);
    rest = rest.replace(/--?\s*Score:\s*\d+\s*\/\s*100/i, "").trim();
  }

  return { name: rest.replace(/^--\s*/, "").trim(), score, confidence, direction };
}

function parseBulletSection(lines: string[], heading: RegExp): string[] {
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^###\s+/.test(line)) {
      inSection = heading.test(line);
      continue;
    }
    if (!inSection) continue;
    const m = line.match(/^\s*-\s+(.*\S)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

/**
 * Parse the hypothesis_tracker markdown into structured records.
 * Returns an empty array on parsing failure.
 */
export function parseHypothesisTracker(markdown: string): KBHypothesis[] {
  if (!markdown || !markdown.trim()) return [];

  // Split into hypothesis blocks by '## ' headings, skipping the main '# ' title.
  const blocks = markdown.split(/^##\s+/m).slice(1);
  const out: KBHypothesis[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const headingLine = lines[0];
    const bodyLines = lines.slice(1);

    try {
      const { name, score, confidence, direction } = parseHeading(headingLine);
      if (!name) continue;

      // Only real hypotheses have a "Score: N/100 (CATEGORY)" stanza. This
      // filters out trailing meta sections the synthesizer appends, like
      // "## Challenger Assessment" and "## Synthesis Summary".
      if (score === null) continue;

      out.push({
        name,
        score,
        confidence,
        direction,
        supporting: parseBulletSection(bodyLines, /supporting\s+evidence/i),
        contradicting: parseBulletSection(bodyLines, /contradicting\s+evidence/i),
        whatWouldChange: parseBulletSection(bodyLines, /what\s+would\s+change/i),
        alternatives: parseBulletSection(bodyLines, /alternative\s+explanations/i),
      });
    } catch {
      // Skip malformed blocks rather than crash the brief
      continue;
    }
  }

  return out;
}

export async function loadKBHypotheses(
  sb: SupabaseClient
): Promise<KBHypothesisPayload | null> {
  try {
    const { data, error } = await sb
      .from("clinical_knowledge_base")
      .select("document_id, content, generated_at, generated_by")
      .eq("document_id", "hypothesis_tracker")
      .maybeSingle();

    if (error || !data) return null;

    const generatedAt = data.generated_at as string | null;
    const stale = generatedAt
      ? (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60 * 24) >
        STALE_AFTER_DAYS
      : true;

    const hypotheses = parseHypothesisTracker(data.content as string);

    return {
      hypotheses,
      generatedAt,
      stale,
      documentId: (data.document_id as string) ?? "hypothesis_tracker",
      sourcePersona: (data.generated_by as string) ?? "hypothesis_doctor",
    };
  } catch {
    return null;
  }
}
