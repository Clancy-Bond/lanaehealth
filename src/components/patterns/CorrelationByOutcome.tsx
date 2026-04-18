"use client";

// ---------------------------------------------------------------------------
// CorrelationByOutcome
//
// An outcome-centric view of the correlation_results table, inspired by
// Bearable's "Effect on {outcome}" card. Groups factor-pairs so that a single
// card answers one question: "What drives my {outcome}?"
//
// This complements CorrelationCards.tsx (pair-per-row) rather than replacing
// it. The pair view is honest about statistical independence; the outcome
// view is the friendlier at-a-glance scan for someone standing in a doctor's
// office asking "what's making me flare?"
//
// Design choices:
//   - Outcome is picked from a curated whitelist (OUTCOME_CONFIG below)
//     because not every factor_b in the DB is a user-facing outcome
//     (some are covariates). The whitelist also carries directionality
//     (lower = better vs higher = better).
//   - Bars are sage (improves) or blush (worsens) matching LanaeHealth's
//     warm modern palette, NOT Bearable's red/green.
//   - Ranked by |effect_size| descending so the biggest lever is always
//     at top.
//   - Only "moderate" or "strong" confidence rows shown by default.
//     Suggestive rows hidden behind a toggle so the at-a-glance card
//     does not mislead.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import type { CorrelationResult } from "./PatternsClient";

// --- Outcome config --------------------------------------------------------

/**
 * Whitelist of outcomes that deserve their own "Effect on ___" card,
 * with the direction that means "better" for the patient. Edit this to
 * add/remove outcomes as the correlation engine grows.
 *
 * aliases = the many strings the engine emits that mean this outcome
 * (matched case-insensitively, substring-aware on the factor_b field).
 */
export interface OutcomeConfig {
  key: string;
  label: string;
  aliases: string[];
  /** 'lower' means lower value = better health (pain, fatigue). */
  betterDirection: "lower" | "higher";
  /** Short description shown under the card title. */
  hint?: string;
}

// LEARNING MODE CONTRIBUTION POINT (OUTCOME LIST)
// ----------------------------------------------------
// These are my proposed outcomes for Lanae. Each entry shapes how
// correlations get grouped and labeled. The `aliases` list must match
// how the correlation-engine writes factor_b. Add/remove/rename based
// on what Lanae actually asks about at appointments.
//
// Edit below; the component will pick up your changes on save.
export const OUTCOME_CONFIG: OutcomeConfig[] = [
  {
    key: "orthostatic_delta",
    label: "Orthostatic delta",
    aliases: ["orthostatic", "standing_hr_delta", "postural_tachy"],
    betterDirection: "lower",
    hint: "Standing pulse minus supine pulse. Lower is better for POTS.",
  },
  {
    key: "migraine_severity",
    label: "Migraine severity",
    aliases: ["migraine", "headache_severity", "headache"],
    betterDirection: "lower",
    hint: "Peak headache intensity on the day.",
  },
  {
    key: "fatigue",
    label: "Fatigue",
    aliases: ["fatigue", "energy_level", "tiredness"],
    betterDirection: "lower",
    hint: "Daily fatigue rating (0 lowest, 10 most fatigued).",
  },
  {
    key: "overall_pain",
    label: "Overall pain",
    aliases: ["overall_pain", "pain", "pain_score"],
    betterDirection: "lower",
    hint: "Highest pain score logged that day.",
  },
  {
    key: "sleep_quality",
    label: "Sleep quality",
    aliases: ["sleep_quality", "sleep_score", "readiness"],
    betterDirection: "higher",
    hint: "Oura sleep score + subjective sleep rating.",
  },
];

// --- Types ----------------------------------------------------------------

interface Props {
  correlations: CorrelationResult[];
  /** Override the default outcome list for tests/experiments. */
  outcomes?: OutcomeConfig[];
}

interface RankedFactor {
  id: string;
  factorLabel: string;
  effectSize: number;
  direction: "improves" | "worsens";
  description: string | null;
  sampleSize: number | null;
  confidence: CorrelationResult["confidence_level"];
  lagDays: number | null;
}

// --- Palette (from CLAUDE.md Warm Modern spec) -----------------------------

const SAGE = "#6B9080"; // improves
const SAGE_BG = "rgba(107, 144, 128, 0.14)";
const BLUSH = "#D4A0A0"; // worsens
const BLUSH_BG = "rgba(212, 160, 160, 0.18)";

// --- Helpers --------------------------------------------------------------

function matchesOutcome(factorB: string, outcome: OutcomeConfig): boolean {
  const haystack = factorB.toLowerCase();
  return outcome.aliases.some((a) => haystack.includes(a.toLowerCase()));
}

/**
 * Convert a raw correlation row into a direction-aware ranked factor.
 *
 * Direction logic: for an outcome where lower = better (pain), a
 * POSITIVE correlation with a factor means the factor WORSENS the
 * outcome. For sleep_quality where higher = better, a positive
 * correlation is an IMPROVER.
 */
function rankFactor(
  corr: CorrelationResult,
  outcome: OutcomeConfig,
): RankedFactor | null {
  const coeff = corr.coefficient;
  const effect = corr.effect_size;
  if (coeff === null && effect === null) return null;
  const magnitude = Math.abs(effect ?? coeff ?? 0);
  if (magnitude === 0) return null;

  const coeffSign = Math.sign(coeff ?? effect ?? 0);
  const worsensWhenPositive = outcome.betterDirection === "lower";
  const direction: "improves" | "worsens" =
    coeffSign >= 0
      ? worsensWhenPositive
        ? "worsens"
        : "improves"
      : worsensWhenPositive
        ? "improves"
        : "worsens";

  return {
    id: corr.id,
    factorLabel: corr.factor_a,
    effectSize: magnitude,
    direction,
    description: corr.effect_description,
    sampleSize: corr.sample_size,
    confidence: corr.confidence_level,
    lagDays: corr.lag_days,
  };
}

function humanizeLabel(raw: string): string {
  // snake_case -> Title Case, strip wrapping quotes
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/['"]/g, "");
}

// --- Component ------------------------------------------------------------

export function CorrelationByOutcome({
  correlations,
  outcomes = OUTCOME_CONFIG,
}: Props) {
  const [showSuggestive, setShowSuggestive] = useState(false);

  // Group factors per outcome
  const grouped = useMemo(() => {
    return outcomes
      .map((outcome) => {
        const matching = correlations
          .filter(
            (c) =>
              matchesOutcome(c.factor_b, outcome) ||
              matchesOutcome(c.factor_a, outcome),
          )
          .map((c) => {
            // If the outcome is on factor_a side, swap for consistent framing
            const oriented =
              matchesOutcome(c.factor_a, outcome) &&
              !matchesOutcome(c.factor_b, outcome)
                ? { ...c, factor_a: c.factor_b, factor_b: c.factor_a }
                : c;
            return rankFactor(oriented, outcome);
          })
          .filter((r): r is RankedFactor => r !== null)
          .filter((r) => showSuggestive || r.confidence !== "suggestive")
          .sort((a, b) => b.effectSize - a.effectSize)
          .slice(0, 8);
        return { outcome, factors: matching };
      })
      .filter((g) => g.factors.length > 0);
  }, [correlations, outcomes, showSuggestive]);

  if (grouped.length === 0) {
    return (
      <EmptyState
        icon={<span style={{ fontSize: 28 }}>&#x1F3AF;</span>}
        title="No outcome-level patterns yet"
        subtitle="Once the correlation engine finds moderate-or-stronger factors for pain, fatigue, migraines, orthostatic delta, or sleep, they'll group here."
      />
    );
  }

  const maxMagnitude = Math.max(
    ...grouped.flatMap((g) => g.factors.map((f) => f.effectSize)),
    0.01,
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header + filter toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          What&apos;s driving your outcomes
        </h2>
        <label
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showSuggestive}
            onChange={(e) => setShowSuggestive(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          Include suggestive (lower confidence)
        </label>
      </div>

      {grouped.map(({ outcome, factors }) => (
        <OutcomeCard
          key={outcome.key}
          outcome={outcome}
          factors={factors}
          maxMagnitude={maxMagnitude}
        />
      ))}
    </div>
  );
}

// --- Single-outcome card --------------------------------------------------

function OutcomeCard({
  outcome,
  factors,
  maxMagnitude,
}: {
  outcome: OutcomeConfig;
  factors: RankedFactor[];
  maxMagnitude: number;
}) {
  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      {/* Card header */}
      <div style={{ marginBottom: 14 }}>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Effect on {outcome.label}
        </h3>
        {outcome.hint && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              margin: "2px 0 0 0",
              lineHeight: 1.4,
            }}
          >
            {outcome.hint}
          </p>
        )}
      </div>

      {/* Factor rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {factors.map((f) => (
          <FactorRow key={f.id} factor={f} maxMagnitude={maxMagnitude} />
        ))}
      </div>
    </div>
  );
}

// --- Single factor row ----------------------------------------------------

function FactorRow({
  factor,
  maxMagnitude,
}: {
  factor: RankedFactor;
  maxMagnitude: number;
}) {
  const color = factor.direction === "improves" ? SAGE : BLUSH;
  const bg = factor.direction === "improves" ? SAGE_BG : BLUSH_BG;
  const widthPct = Math.max(
    6,
    Math.min(100, (factor.effectSize / maxMagnitude) * 100),
  );
  const signedLabel =
    factor.direction === "improves" ? "improves" : "worsens";
  const magnitudePct = Math.round(factor.effectSize * 100);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 72px",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Label + bar */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-primary)",
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={humanizeLabel(factor.factorLabel)}
        >
          {humanizeLabel(factor.factorLabel)}
          {factor.lagDays && factor.lagDays > 0 ? (
            <span
              style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 6 }}
            >
              ({factor.lagDays}d lag)
            </span>
          ) : null}
        </div>
        <div
          style={{
            height: 8,
            background: bg,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${widthPct}%`,
              height: "100%",
              background: color,
              borderRadius: 4,
              transition: "width 300ms ease",
            }}
          />
        </div>
      </div>

      {/* Magnitude + direction */}
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color }}>
          {factor.direction === "improves" ? "-" : "+"}
          {magnitudePct}%
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {signedLabel}
          {factor.sampleSize ? ` · n=${factor.sampleSize}` : ""}
        </div>
      </div>
    </div>
  );
}
