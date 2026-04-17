/**
 * Insight Narrator
 *
 * Converts correlation_results rows into short, plain-English sentences
 * that a patient can read at a glance. Two modes:
 *
 *   1. narrateInsightLocal()  - deterministic template, no API call.
 *                               Used for tests and as an offline fallback.
 *   2. narrateInsightClaude() - routed through the three-layer assembler,
 *                               honoring the static/dynamic boundary.
 *                               Cached system prompt first (tone, rules),
 *                               dynamic factor data last.
 *
 * Hard rules enforced by both paths:
 *   - Never state causation ("X causes Y"). Use "tends to", "appears to", "is linked".
 *   - Always include the sample size clause when available.
 *   - Append a confidence qualifier suited to the tier.
 *   - No em dashes (per repo-wide rule).
 */

import type { CorrelationResult } from "@/components/patterns/PatternsClient";

// ── Types ──────────────────────────────────────────────────────────

export type LagBucket = "same day" | "next day" | "2 day lag" | "3+ day lag";

export type ConfidenceTier = "strong" | "moderate" | "suggestive";

export interface InsightNarration {
  sentence: string;
  lagBucket: LagBucket | null;
  confidenceTier: ConfidenceTier;
  rValueLabel: string;
  freshnessLabel: string;
  isStale: boolean;
}

// ── Constants ──────────────────────────────────────────────────────

const STALE_AFTER_DAYS = 30;

// ── Pure helpers ───────────────────────────────────────────────────

/**
 * Bucket raw lag_days into a display label. Null means "no lag info".
 */
export function lagBucketFor(lagDays: number | null): LagBucket | null {
  if (lagDays === null || lagDays === undefined) return null;
  if (lagDays <= 0) return "same day";
  if (lagDays === 1) return "next day";
  if (lagDays === 2) return "2 day lag";
  return "3+ day lag";
}

/**
 * Format an r-value for display. Returns "r = 0.54" or "r = -0.38".
 * Null coefficient returns an empty string so callers can skip rendering.
 */
export function formatRValue(coefficient: number | null): string {
  if (coefficient === null || coefficient === undefined) return "";
  const rounded = Math.round(coefficient * 100) / 100;
  const sign = rounded >= 0 ? "" : "-";
  const abs = Math.abs(rounded).toFixed(2);
  return `r = ${sign}${abs}`;
}

/**
 * Normalize a confidence_level string to our tier set, defaulting to
 * "suggestive" for unknown values so cards always render.
 */
export function normalizeTier(input: string | null | undefined): ConfidenceTier {
  if (input === "strong" || input === "moderate" || input === "suggestive") {
    return input;
  }
  return "suggestive";
}

/**
 * Freshness label for the computed_at timestamp. Uses a conservative
 * 30-day staleness threshold so we never describe patterns that may
 * have drifted. Returns both the human label and the stale flag.
 */
export function freshnessFor(computedAt: string | null | undefined): {
  label: string;
  isStale: boolean;
} {
  if (!computedAt) return { label: "freshness unknown", isStale: true };
  const ts = new Date(computedAt).getTime();
  if (!Number.isFinite(ts)) return { label: "freshness unknown", isStale: true };
  const ageMs = Date.now() - ts;
  const ageDays = Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
  const iso = computedAt.slice(0, 10);
  return {
    label: `based on data through ${iso}`,
    isStale: ageDays > STALE_AFTER_DAYS,
  };
}

/**
 * Tail phrase for each confidence tier. Never causal.
 */
function confidenceTail(tier: ConfidenceTier): string {
  switch (tier) {
    case "strong":
      return "This is a strong pattern in your data, not evidence of a direct link.";
    case "moderate":
      return "This is a moderate signal worth watching.";
    case "suggestive":
      return "This is an early signal that needs more observation.";
  }
}

/**
 * Humanize a factor label like "resting_hr" or "overall_pain" for prose.
 * Keeps short tokens as-is when they read naturally.
 */
function humanize(factor: string): string {
  return factor
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Build the sample-size clause. Returns "" when sample_size is null so
 * we don't render "based on null days" anywhere.
 */
function sampleClause(sampleSize: number | null): string {
  if (sampleSize === null || sampleSize === undefined || sampleSize <= 0) {
    return "";
  }
  return ` based on ${sampleSize} days of data`;
}

/**
 * Cycle phase clause. Many correlations only hold in a specific phase,
 * and that context changes how Lanae reads the finding.
 */
function cycleClause(cyclePhase: string | null | undefined): string {
  if (!cyclePhase) return "";
  return ` during your ${cyclePhase.toLowerCase()} phase`;
}

// ── Deterministic template (used for tests + fallback) ─────────────

/**
 * Build a sentence using only local string templates. No Claude call.
 * Shapes:
 *   - positive with lag:  "When A runs higher, B tends to run higher <lag>, based on N days."
 *   - inverse:            "Days with more A tend to have less B, based on N days."
 *   - suggestive:         "There may be a link between A and B in your data, though it needs more observation."
 */
export function narrateInsightLocal(
  row: Pick<
    CorrelationResult,
    | "factor_a"
    | "factor_b"
    | "coefficient"
    | "sample_size"
    | "lag_days"
    | "confidence_level"
    | "cycle_phase"
    | "computed_at"
    | "effect_description"
  >,
): InsightNarration {
  const tier = normalizeTier(row.confidence_level);
  const lagBucket = lagBucketFor(row.lag_days);
  const rLabel = formatRValue(row.coefficient);
  const freshness = freshnessFor(row.computed_at);
  const a = humanize(row.factor_a);
  const b = humanize(row.factor_b);
  const phase = cycleClause(row.cycle_phase);
  const sample = sampleClause(row.sample_size);
  const tail = confidenceTail(tier);

  const lagPhrase =
    lagBucket === null
      ? ""
      : lagBucket === "same day"
        ? " on the same day"
        : lagBucket === "next day"
          ? " the next day"
          : lagBucket === "2 day lag"
            ? " about 2 days later"
            : " about 3 or more days later";

  const isInverse =
    typeof row.coefficient === "number" && row.coefficient < 0;

  let body: string;
  if (tier === "suggestive") {
    body = `There may be a link between ${a} and ${b}${phase} in your data${sample}.`;
  } else if (isInverse) {
    body = `Days with more ${a}${phase} tend to have less ${b}${lagPhrase}${sample}.`;
  } else {
    body = `When ${a} runs higher${phase}, ${b} tends to run higher too${lagPhrase}${sample}.`;
  }

  // Compose final sentence. No em dashes.
  const sentence = `${body} ${tail}`.replace(/\s+/g, " ").trim();

  return {
    sentence,
    lagBucket,
    confidenceTier: tier,
    rValueLabel: rLabel,
    freshnessLabel: freshness.label,
    isStale: freshness.isStale,
  };
}

// ── Claude-routed narrator (runs server-side, honors boundary) ─────

/**
 * System prompt for the narrator persona. Cached because it never
 * changes between calls; only the dynamic factor details vary. This
 * is the STATIC half of the static/dynamic boundary.
 */
const NARRATOR_STATIC_RULES = `You narrate correlation findings for a chronic illness patient reading her own data.

HARD RULES:
- Never use the word "cause", "causes", or "because". Prefer "tends to", "is linked with", "appears to".
- Never use em dashes. Use commas, periods, or the word "and".
- Second person when addressing the patient ("your morning pulse").
- One sentence, under 30 words.
- End with a neutral confidence qualifier matched to the tier.
- Never speculate about mechanisms the data does not show.
- Plain language. Optional numbers on tap, not in the sentence.

OUTPUT SHAPE:
A single sentence. No preamble, no lists, no headings.`;

/**
 * Assemble the user message with dynamic details. This is the DYNAMIC
 * half of the boundary: factor names, coefficient, sample size, etc.
 * Computed afresh per call so the cached static half stays stable.
 */
function buildNarratorUserMessage(
  row: Pick<
    CorrelationResult,
    | "factor_a"
    | "factor_b"
    | "coefficient"
    | "sample_size"
    | "lag_days"
    | "confidence_level"
    | "cycle_phase"
  >,
): string {
  const tier = normalizeTier(row.confidence_level);
  const lag = lagBucketFor(row.lag_days);
  const r = formatRValue(row.coefficient);
  const phase = row.cycle_phase ? row.cycle_phase.toLowerCase() : null;

  const lines: string[] = [];
  lines.push(`Factor A: ${row.factor_a}`);
  lines.push(`Factor B: ${row.factor_b}`);
  if (r) lines.push(`Correlation: ${r}`);
  if (row.sample_size !== null && row.sample_size !== undefined) {
    lines.push(`Sample size: ${row.sample_size} days`);
  }
  if (lag) lines.push(`Lag: ${lag}`);
  if (phase) lines.push(`Cycle phase: ${phase}`);
  lines.push(`Confidence tier: ${tier}`);
  lines.push("");
  lines.push(
    "Write a single plain-English sentence describing this finding for the patient. Follow the rules above.",
  );

  return lines.join("\n");
}

/**
 * Full narrator pass that routes through the context assembler so that
 * the patient's permanent core is available to the model (in case the
 * wording needs to mention a known condition). The static rules are
 * prepended; the assembler's dynamic context is appended after the
 * boundary marker.
 *
 * NOTE: This function only runs on the server. The `/patterns` page
 * renders pre-computed narrations from the local template today; the
 * Claude path is available for the future caching layer.
 */
export async function narrateInsightClaude(
  row: CorrelationResult,
): Promise<InsightNarration> {
  // Local narration is our baseline return shape regardless of whether
  // the Claude call succeeds; we overwrite .sentence if the API returns.
  const base = narrateInsightLocal(row);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return base;

  try {
    // Dynamic import so tests that don't need the SDK don't pay for it.
    const AnthropicMod = await import("@anthropic-ai/sdk");
    const Anthropic = AnthropicMod.default;
    type AnthropicType = typeof AnthropicMod.default extends new (...args: unknown[]) => infer R
      ? R
      : never;
    type SystemParam = Parameters<AnthropicType["messages"]["create"]>[0]["system"];
    const { assembleDynamicContext, splitSystemPromptForCaching } = await import(
      "@/lib/context/assembler"
    );
    const { logCacheMetrics } = await import("@/lib/ai/cache-metrics");

    const query = `Narrate the correlation between ${row.factor_a} and ${row.factor_b}.`;
    // Keep context lean: the narrator only needs the permanent core,
    // not 15K tokens of knowledge base or retrieval.
    const { context } = await assembleDynamicContext(query, {
      skipKnowledgeBase: true,
      skipRetrieval: true,
    });

    // Static/Dynamic boundary: narrator rules first (cached), then the
    // assembled patient context, then the user's per-row payload.
    const systemPrompt = `${NARRATOR_STATIC_RULES}

__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__

${context}`;

    // Opt into Anthropic prompt caching on the STATIC narrator rules.
    const cachedSystem = splitSystemPromptForCaching(systemPrompt);

    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 160,
      system: cachedSystem as unknown as SystemParam,
      messages: [{ role: "user", content: buildNarratorUserMessage(row) }],
    });
    logCacheMetrics(resp, "narrator");

    const textBlock = resp.content.find((b) => b.type === "text");
    const sentence =
      textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

    if (sentence.length === 0) return base;

    // Defensive scrub: strip em dashes if the model slipped one in,
    // enforcing the repo-wide rule.
    const scrubbed = sentence.replace(/[\u2014\u2013]/g, ", ");

    return { ...base, sentence: scrubbed };
  } catch {
    // Any failure falls back to the deterministic local template so the
    // UI never breaks on a Claude outage.
    return base;
  }
}

// ── Rollup for page consumption ────────────────────────────────────

/**
 * Convenience helper: sort correlations so the most trustworthy show
 * first, then narrate each with the local template. The /patterns
 * page uses this synchronously so the SSR render has sentences ready.
 */
export function narrateTopInsights(
  rows: CorrelationResult[],
  limit: number = 5,
): Array<CorrelationResult & { narration: InsightNarration }> {
  const tierRank: Record<ConfidenceTier, number> = {
    strong: 3,
    moderate: 2,
    suggestive: 1,
  };

  const scored = rows
    .filter((r) => r && (r.factor_a || r.factor_b))
    .map((r) => {
      const tier = normalizeTier(r.confidence_level);
      const abs = typeof r.coefficient === "number" ? Math.abs(r.coefficient) : 0;
      return { r, score: tierRank[tier] * 10 + abs };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ r }) => ({
    ...r,
    narration: narrateInsightLocal(r),
  }));
}

/**
 * Minimum rows with at least moderate confidence needed before we
 * render the card section at all. Below this, we show an empty state
 * so suggestive-only noise doesn't mislead the reader.
 */
export const MIN_INSIGHTS_FOR_DISPLAY = 3;

/**
 * Decide whether the section should render. Counts moderate + strong
 * rows; suggestive alone is not enough to clear the bar.
 */
export function hasEnoughConfidentInsights(
  rows: CorrelationResult[],
  min: number = MIN_INSIGHTS_FOR_DISPLAY,
): boolean {
  const confident = rows.filter((r) => {
    const tier = normalizeTier(r.confidence_level);
    return tier === "moderate" || tier === "strong";
  }).length;
  return confident >= min;
}
