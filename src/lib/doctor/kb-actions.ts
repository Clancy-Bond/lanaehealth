/**
 * KB Actions Loader
 *
 * Reads the `next_best_actions` KB document from the Clinical Intelligence
 * Engine and parses the markdown into structured action records the doctor
 * brief can render.
 *
 * Markdown shape (from next-best-action.ts):
 *   ## ACTIONS:
 *
 *   **1. Title** | Affects: h1, h2 | Potential swing: ... | Difficulty: X | Urgency: Y
 *   > Rationale: ...
 *
 *   ---
 *   **2. ...
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ActionUrgency = "URGENT" | "Urgent" | "Routine" | "Low priority" | "Unknown";
export type ActionDifficulty = "Low" | "Medium" | "High" | "Unknown";

export interface KBAction {
  rank: number;
  title: string;
  affects: string[];              // hypothesis names it shifts
  potentialSwing: string;         // raw swing text e.g. "chiari +/-35 pts"
  difficulty: ActionDifficulty;
  urgency: ActionUrgency;
  rationale: string;
}

export interface KBActionsPayload {
  actions: KBAction[];
  generatedAt: string | null;
  stale: boolean;
}

const STALE_AFTER_DAYS = 7;

function normalizeUrgency(raw: string): ActionUrgency {
  const t = raw.replace(/\*+/g, "").trim().toLowerCase();
  if (t.includes("urgent!") || t === "urgent") return "Urgent";
  if (t.includes("urgent")) return "Urgent";
  if (t.includes("routine")) return "Routine";
  if (t.includes("low")) return "Low priority";
  return "Unknown";
}

function normalizeDifficulty(raw: string): ActionDifficulty {
  const t = raw.replace(/\*+/g, "").trim().toLowerCase();
  if (t.includes("low")) return "Low";
  if (t.includes("med")) return "Medium";
  if (t.includes("high")) return "High";
  return "Unknown";
}

function parseActionHeading(line: string, rank: number): KBAction | null {
  // Expected shape:
  //   **N. Title** | Affects: a, b | Potential swing: ... | Difficulty: Low | Urgency: URGENT
  // Strip the leading "**N." and the trailing closing "**" before the first pipe.
  const match = line.match(/^\*\*\d+\.\s*(.+?)\*\*\s*\|(.*)$/);
  if (!match) return null;

  const title = match[1].trim();
  const metaPart = match[2];

  const pipes = metaPart.split("|").map((p) => p.trim());
  const meta: Record<string, string> = {};
  for (const p of pipes) {
    const colon = p.indexOf(":");
    if (colon === -1) continue;
    const key = p.slice(0, colon).trim().toLowerCase().replace(/\*/g, "");
    const val = p.slice(colon + 1).trim();
    meta[key] = val;
  }

  const affectsStr = meta["affects"] ?? "";
  const affects = affectsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    rank,
    title,
    affects,
    potentialSwing: meta["potential swing"] ?? "",
    difficulty: normalizeDifficulty(meta["difficulty"] ?? ""),
    urgency: normalizeUrgency(meta["urgency"] ?? ""),
    rationale: "",
  };
}

export function parseActions(markdown: string): KBAction[] {
  if (!markdown || !markdown.trim()) return [];

  // Split into action blocks by the '---' separators.
  const blocks = markdown.split(/^---+$/m);
  const out: KBAction[] = [];
  let rankCounter = 0;

  for (const block of blocks) {
    // Find the heading line like **N. Title** | ...
    const lines = block.split("\n").map((l) => l);
    const headingIndex = lines.findIndex((l) => /^\*\*\d+\./.test(l.trim()));
    if (headingIndex === -1) continue;

    rankCounter += 1;
    const parsed = parseActionHeading(lines[headingIndex].trim(), rankCounter);
    if (!parsed) continue;

    // Rationale: following lines starting with ">"
    const rationaleLines: string[] = [];
    for (let i = headingIndex + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith(">")) {
        rationaleLines.push(t.replace(/^>\s*Rationale:\s*/i, "").replace(/^>\s*/, ""));
      } else if (rationaleLines.length > 0 && t.length === 0) {
        // blank line allowed mid-rationale
        rationaleLines.push("");
      } else if (rationaleLines.length > 0 && t.length > 0 && !t.startsWith("**")) {
        // continuation without bullet marker
        rationaleLines.push(t);
      }
    }
    parsed.rationale = rationaleLines.join(" ").replace(/\s+/g, " ").trim();
    out.push(parsed);
  }

  return out;
}

export async function loadKBActions(
  sb: SupabaseClient
): Promise<KBActionsPayload | null> {
  try {
    const { data, error } = await sb
      .from("clinical_knowledge_base")
      .select("content, generated_at")
      .eq("document_id", "next_best_actions")
      .maybeSingle();

    if (error || !data) return null;

    const stale = data.generated_at
      ? (Date.now() - new Date(data.generated_at as string).getTime()) /
          (1000 * 60 * 60 * 24) >
        STALE_AFTER_DAYS
      : true;

    return {
      actions: parseActions(data.content as string),
      generatedAt: data.generated_at as string | null,
      stale,
    };
  } catch {
    return null;
  }
}
