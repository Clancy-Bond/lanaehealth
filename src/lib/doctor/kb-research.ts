/**
 * KB Research Context Loader
 *
 * Parses the Research Librarian persona's study cards out of the
 * `research_context` document. Each card has structured fields:
 *
 *   **STUDY:** "<title>"
 *   **TYPE:** <type>
 *   **SAMPLE:** n=<sample>
 *   **JOURNAL:** <journal>
 *   **EVIDENCE_GRADE:** A | B | C | D | E | F
 *   **RELEVANCE:** <text>
 *   **HYPOTHESIS_IMPACT:** <text, often long>
 *
 * Cards are delimited by `---`. The top of the document also sometimes
 * carries QUESTION headings and GUIDELINE_ALERTS blocks we ignore for
 * the brief (doctor wants concise cards, not process notes).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type EvidenceGrade = "A" | "B" | "C" | "D" | "E" | "F" | "Unknown";

export interface ResearchStudy {
  title: string;
  type: string;                  // Systematic Review | RCT | Cohort | Meta-analysis | ...
  sample: string;
  journal: string;
  evidenceGrade: EvidenceGrade;
  relevance: string;
  impact: string;                // shortened HYPOTHESIS_IMPACT summary
  supports: "for" | "against" | "neutral";  // inferred from impact text
  question: string | null;       // the QUESTION heading this card lived under
}

export interface ResearchPayload {
  studies: ResearchStudy[];
  generatedAt: string | null;
  stale: boolean;
}

const STALE_AFTER_DAYS = 7;

function normalizeGrade(raw: string): EvidenceGrade {
  const t = raw.trim().toUpperCase();
  if (["A", "B", "C", "D", "E", "F"].includes(t)) return t as EvidenceGrade;
  return "Unknown";
}

function pickField(block: string, field: string): string {
  const re = new RegExp(`\\*\\*\\s*${field}\\s*:\\*\\*\\s*(.+?)(?=\\n\\*\\*|\\n---|\\n\\n|$)`, "is");
  const m = block.match(re);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function inferSupports(impact: string): "for" | "against" | "neutral" {
  const lower = impact.toLowerCase();
  if (/^contradicts|does not\s+support|against|opposes/i.test(lower)) return "against";
  if (/^supports|confirms|validates|reinforces/i.test(lower)) return "for";
  return "neutral";
}

function shortenImpact(impact: string, maxChars = 320): string {
  if (impact.length <= maxChars) return impact;
  return impact.slice(0, maxChars).trim() + "...";
}

export function parseStudies(markdown: string): ResearchStudy[] {
  if (!markdown) return [];

  // Track QUESTION headings so we can attribute each card to a question.
  // Each card begins with "**STUDY:**". Split on `---` first, then scan blocks.
  const blocks = markdown.split(/^---+\s*$/m);

  let currentQuestion: string | null = null;
  const out: ResearchStudy[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    // Update current question if the block is a QUESTION heading
    const qMatch = block.match(/^##\s+QUESTION[^\n]*:\s*(.+?)\s*$/m);
    if (qMatch) {
      currentQuestion = qMatch[1].trim();
    }

    if (!/\*\*STUDY:\*\*/i.test(block)) continue;

    const title = pickField(block, "STUDY").replace(/^"|"$/g, "");
    if (!title) continue;

    const type = pickField(block, "TYPE");
    const sample = pickField(block, "SAMPLE");
    const journal = pickField(block, "JOURNAL");
    const gradeRaw = pickField(block, "EVIDENCE_GRADE");
    const relevance = pickField(block, "RELEVANCE");
    const impact = pickField(block, "HYPOTHESIS_IMPACT");

    out.push({
      title,
      type,
      sample,
      journal,
      evidenceGrade: normalizeGrade(gradeRaw),
      relevance,
      impact: shortenImpact(impact),
      supports: inferSupports(impact),
      question: currentQuestion,
    });
  }

  return out;
}

export async function loadKBResearch(
  sb: SupabaseClient,
): Promise<ResearchPayload | null> {
  try {
    const { data, error } = await sb
      .from("clinical_knowledge_base")
      .select("content, generated_at")
      .eq("document_id", "research_context")
      .maybeSingle();

    if (error || !data) return null;

    const generatedAt = (data.generated_at as string | null) ?? null;
    const stale = generatedAt
      ? (Date.now() - new Date(generatedAt).getTime()) / (1000 * 60 * 60 * 24) >
        STALE_AFTER_DAYS
      : true;

    return {
      studies: parseStudies(data.content as string),
      generatedAt,
      stale,
    };
  } catch {
    return null;
  }
}
