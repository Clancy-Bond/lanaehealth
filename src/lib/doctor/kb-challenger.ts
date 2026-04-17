/**
 * KB Challenger Loader
 *
 * Extracts the Challenger persona's anti-anchoring assessment from the
 * hypothesis_tracker KB document. Four subsections:
 *
 *   ### CHALLENGES       -- "ATTACK on #N: <hypothesis>" bullets
 *   ### STAGNATION       -- hypotheses that haven't moved
 *   ### ECHO_CHECK       -- places the analyst/doctor anchored
 *   ### MISSING_DIAGNOSES -- diagnoses not tracked yet
 *
 * These get rendered in the doctor brief so the doctor sees the
 * opposition case alongside the working hypotheses. North-star reason:
 * prevents anchoring on the first plausible diagnosis.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ChallengerAttack {
  targetHypothesis: string | null;   // e.g. "endometriosis_pelvic_inflammatory_complex"
  targetScore: number | null;
  targetConfidence: string | null;   // ESTABLISHED / PROBABLE / ...
  body: string;                      // plain-text attack content
}

export interface ChallengerPayload {
  challenges: ChallengerAttack[];
  stagnation: string[];              // bullets as-is
  echoCheck: string[];               // bullets as-is
  missingDiagnoses: string[];        // bullets as-is
  generatedAt: string | null;
  stale: boolean;
}

const STALE_AFTER_DAYS = 7;

function extractSection(markdown: string, heading: string): string {
  // Match a "### HEADING" line, return the text until the next `###` or `---` separator.
  const re = new RegExp(
    `###\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n###\\s+|\\n---\\s*\\n|$)`,
    "i",
  );
  const m = markdown.match(re);
  return m ? m[1].trim() : "";
}

function parseBulletList(section: string): string[] {
  if (!section) return [];
  const out: string[] = [];
  const lines = section.split("\n");
  let current: string[] = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*-\s+/.test(line)) {
      if (current.length > 0) out.push(current.join(" ").replace(/\s+/g, " ").trim());
      current = [line.replace(/^\s*-\s+/, "")];
    } else if (line.trim().length > 0 && current.length > 0) {
      current.push(line.trim());
    }
  }
  if (current.length > 0) out.push(current.join(" ").replace(/\s+/g, " ").trim());
  return out;
}

function parseChallenges(section: string): ChallengerAttack[] {
  const bullets = parseBulletList(section);
  return bullets.map((b): ChallengerAttack => {
    // Expected shape: **[ATTACK on #N: name, Score 93/100 ESTABLISHED]** body...
    const headerMatch = b.match(
      /\*\*\s*\[ATTACK\s+on\s+#\d+:\s*([^,\]]+?)(?:,\s*Score\s+(\d+)\s*\/\s*100\s*([A-Z]+))?\s*\]\*\*\s*(.*)/i,
    );
    if (!headerMatch) return { targetHypothesis: null, targetScore: null, targetConfidence: null, body: b };
    const [, hypothesis, score, confidence, body] = headerMatch;
    return {
      targetHypothesis: hypothesis.trim(),
      targetScore: score ? Number(score) : null,
      targetConfidence: confidence ? confidence.toUpperCase() : null,
      body: body.trim(),
    };
  });
}

export function parseChallenger(markdown: string): Omit<ChallengerPayload, "generatedAt" | "stale"> {
  // Isolate the "## Challenger Assessment" block first so we don't match
  // per-hypothesis "### Supporting Evidence" sections by accident.
  const startIdx = markdown.indexOf("## Challenger Assessment");
  const stopIdx = markdown.indexOf("## Synthesis", startIdx === -1 ? 0 : startIdx);
  const block =
    startIdx === -1
      ? ""
      : markdown.slice(startIdx, stopIdx > startIdx ? stopIdx : undefined);

  return {
    challenges: parseChallenges(extractSection(block, "CHALLENGES")),
    stagnation: parseBulletList(extractSection(block, "STAGNATION")),
    echoCheck: parseBulletList(extractSection(block, "ECHO_CHECK")),
    missingDiagnoses: parseBulletList(extractSection(block, "MISSING_DIAGNOSES")),
  };
}

export async function loadKBChallenger(
  sb: SupabaseClient,
): Promise<ChallengerPayload | null> {
  try {
    const { data, error } = await sb
      .from("clinical_knowledge_base")
      .select("content, generated_at")
      .eq("document_id", "hypothesis_tracker")
      .maybeSingle();

    if (error || !data) return null;

    const generatedAt = (data.generated_at as string | null) ?? null;
    const stale = generatedAt
      ? (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60 * 24) >
        STALE_AFTER_DAYS
      : true;

    const parsed = parseChallenger(data.content as string);
    return { ...parsed, generatedAt, stale };
  } catch {
    return null;
  }
}
