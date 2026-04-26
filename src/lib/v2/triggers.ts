/**
 * Bearable-pattern factor / trigger ranker.
 *
 * Pattern source: bearable.app - "Discover what's affecting how you
 * feel" factor explorer. Bearable picks a single outcome (pain,
 * sleep, mood, energy) and shows the factors that move it most.
 * Ours mirrors the surfacing - an outcome chip set, then a ranked
 * list - but reuses the existing `correlation_results` table so we
 * never recompute or duplicate stats.
 *
 * This module is the pure shaping layer. The DB read lives in the
 * page; this file just receives rows and produces a sorted, deduped,
 * humanized set of `RankedFactor` cards. Pure so it can be unit
 * tested without supabase.
 *
 * Voice rules honored:
 *   - never causal; we say "appears to" / "tends to" via the impact
 *     phrase, never "X causes Y".
 *   - sample size is always carried so the page can show "N days".
 *   - confidence tier sorts ahead of raw effect, mirroring the
 *     insight-narrator tier ordering.
 *   - no em dashes anywhere.
 */

export type ConfidenceTier = 'suggestive' | 'moderate' | 'strong'

/**
 * Minimal DB row shape. Mirrors the columns we actually consume so
 * the test fixture can stay small without dragging in the full
 * CorrelationResult type from a 'use client' module.
 */
export interface FactorRow {
  id: string
  factor_a: string
  factor_b: string
  correlation_type: string
  coefficient: number | null
  effect_size: number | null
  confidence_level: ConfidenceTier
  sample_size: number | null
  computed_at: string
}

/** Output card the page renders. */
export interface RankedFactor {
  id: string
  /** Humanized factor_a (the lever the user has agency over). */
  factor: string
  /** Humanized factor_b (the outcome that responds). */
  outcome: string
  /** One-line plain-English impact phrase. */
  impact: string
  confidence: ConfidenceTier
  sampleSize: number
  computedAt: string
}

const TIER_RANK: Record<ConfidenceTier, number> = {
  strong: 3,
  moderate: 2,
  suggestive: 1,
}

/**
 * Bearable-style "outcomes" the user can pivot the explorer around.
 * Each entry is the canonical token we look for in `factor_b`. The
 * page renders the chip set; this list defines the contract.
 */
export const OUTCOME_CHIPS: ReadonlyArray<{ key: string; label: string; tokens: string[] }> = [
  { key: 'pain', label: 'Pain', tokens: ['pain', 'headache', 'migraine', 'flare'] },
  { key: 'sleep_quality', label: 'Sleep quality', tokens: ['sleep_quality', 'sleep', 'recovery'] },
  { key: 'mood', label: 'Mood', tokens: ['mood'] },
  { key: 'energy', label: 'Energy', tokens: ['energy', 'fatigue'] },
]

export type OutcomeKey = (typeof OUTCOME_CHIPS)[number]['key']

/** Replace underscores with spaces; lowercase for prose. */
export function humanize(token: string): string {
  return token.replace(/_/g, ' ').trim().toLowerCase()
}

/**
 * Build the one-line "impact" phrase. Some outcomes invert (a
 * negative correlation with sleep_quality means sleep gets worse,
 * not better). We special-case sleep_quality because that is the
 * outcome where the "lower = bad" reading flips the user-facing
 * sentence.
 */
function impactPhrase(row: FactorRow): string {
  const factor = humanize(row.factor_a)
  const outcome = humanize(row.factor_b)
  const coef = row.coefficient ?? 0
  const direction = coef >= 0 ? 'higher' : 'lower'

  // Sleep quality reads inverted: "runs lower" reads as "worse sleep".
  if (row.factor_b === 'sleep_quality' || row.factor_b === 'sleep') {
    const verb = coef >= 0 ? 'runs higher' : 'runs lower'
    return `${humanize(row.factor_b)} ${verb}`
  }

  return `${factor} appears to track ${direction} ${outcome}`
}

/**
 * Rank, dedupe, and shape correlation rows for the factor explorer.
 *
 * Ordering rule:
 *   1. confidence tier (strong > moderate > suggestive)
 *   2. absolute coefficient (or effect_size for non-Pearson rows)
 *   3. larger sample size wins ties
 *
 * Dedupe rule: keep the first row for each (factor_a, factor_b)
 * pair after sorting, so the strongest reading wins.
 */
export function rankAndShape(rows: ReadonlyArray<FactorRow>): RankedFactor[] {
  if (rows.length === 0) return []

  const sorted = [...rows].sort((a, b) => {
    const tierDiff = TIER_RANK[b.confidence_level] - TIER_RANK[a.confidence_level]
    if (tierDiff !== 0) return tierDiff
    const aMag = Math.abs(a.coefficient ?? a.effect_size ?? 0)
    const bMag = Math.abs(b.coefficient ?? b.effect_size ?? 0)
    if (bMag !== aMag) return bMag - aMag
    return (b.sample_size ?? 0) - (a.sample_size ?? 0)
  })

  const seen = new Set<string>()
  const out: RankedFactor[] = []
  for (const row of sorted) {
    const key = `${row.factor_a}::${row.factor_b}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: row.id,
      factor: humanize(row.factor_a),
      outcome: humanize(row.factor_b),
      impact: impactPhrase(row),
      confidence: row.confidence_level,
      sampleSize: row.sample_size ?? 0,
      computedAt: row.computed_at,
    })
  }
  return out
}

/**
 * Filter to rows whose factor_b matches one of the outcome's tokens.
 * Case-insensitive substring match so "pain" catches "back_pain" and
 * "pain_intensity" alike.
 */
export function filterByOutcome(
  rows: ReadonlyArray<FactorRow>,
  outcomeKey: OutcomeKey,
): FactorRow[] {
  const chip = OUTCOME_CHIPS.find((c) => c.key === outcomeKey)
  if (!chip) return [...rows]
  const tokens = chip.tokens.map((t) => t.toLowerCase())
  return rows.filter((r) => {
    const b = (r.factor_b ?? '').toLowerCase()
    return tokens.some((tok) => b.includes(tok))
  })
}
