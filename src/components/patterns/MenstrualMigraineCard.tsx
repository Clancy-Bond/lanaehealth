/**
 * MenstrualMigraineCard
 *
 * Surfaces the menstrual-migraine correlation stats on the Patterns page.
 * Shows the share of attacks in the IHS A1.1.1 perimenstrual window, the
 * odds ratio vs a uniform null, a one-sided binomial p-value, and a
 * cycle-phase heatmap of attack counts.
 *
 * Non-diagnostic language throughout. When the menstrual share crosses
 * the threshold, we surface "pattern consistent with menstrual migraine"
 * with a gentle note about discussing cycle-aware treatment with a
 * clinician. We never say "you have menstrual migraine".
 *
 * Source: docs/plans/2026-04-17-wave-2b-briefs.md (Brief B2)
 * IHS criterion: ICHD-3 A1.1.1 (pure menstrual migraine without aura)
 */

"use client";

import { useMemo } from "react";
import type { HeadacheAttack } from "@/lib/api/headache";
import type { NcImported } from "@/lib/types";
import {
  computeMenstrualMigraineStats,
  MENSTRUAL_PATTERN_THRESHOLD,
  MIN_ATTACKS_FOR_STATS,
  PERIMENSTRUAL_WINDOW_DAYS,
  AVERAGE_CYCLE_LENGTH,
  type MenstrualMigraineStats,
  type PhaseHeatmap,
} from "@/lib/intelligence/menstrual-migraine";

interface MenstrualMigraineCardProps {
  attacks: Array<Pick<HeadacheAttack, "id" | "started_at" | "cycle_phase">>;
  ncRows?: NcImported[];
}

const PHASE_COLORS: Record<keyof PhaseHeatmap, { bg: string; label: string }> = {
  menstrual: { bg: "var(--phase-menstrual, #D4A0A0)", label: "Menstrual" },
  follicular: { bg: "var(--phase-follicular, #E8C9A0)", label: "Follicular" },
  ovulatory: { bg: "var(--phase-ovulatory, #A0C4D4)", label: "Ovulatory" },
  luteal: { bg: "var(--phase-luteal, #B8A0D4)", label: "Luteal" },
  unknown: { bg: "var(--bg-elevated, #F5F5F0)", label: "No phase" },
};

export function MenstrualMigraineCard({
  attacks,
  ncRows,
}: MenstrualMigraineCardProps) {
  const stats = useMemo<MenstrualMigraineStats>(
    () => computeMenstrualMigraineStats(attacks, { ncRows }),
    [attacks, ncRows]
  );

  // Empty state: not enough data.
  if (!stats.sufficientData) {
    return (
      <div
        className="card"
        style={{
          padding: "16px 18px",
          borderRadius: "var(--radius-lg, 16px)",
          background: "var(--bg-card, #FFFFFF)",
          border: "1px solid var(--border-subtle, rgba(0,0,0,0.06))",
        }}
      >
        <CardHeader />
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary, #6B7280)",
            margin: "8px 0 0 0",
            lineHeight: 1.5,
          }}
        >
          We need at least {MIN_ATTACKS_FOR_STATS} logged attacks with cycle
          context before we can look for a menstrual pattern. You have{" "}
          {stats.totalAttacks} so far. More data will sharpen this over time.
        </p>
      </div>
    );
  }

  const pctDisplay = Math.round(stats.pct * 100);
  const thresholdDisplay = Math.round(MENSTRUAL_PATTERN_THRESHOLD * 100);
  const nullPctDisplay = Math.round(
    (PERIMENSTRUAL_WINDOW_DAYS / AVERAGE_CYCLE_LENGTH) * 100
  );

  return (
    <div
      className="card"
      style={{
        padding: "16px 18px",
        borderRadius: "var(--radius-lg, 16px)",
        background: "var(--bg-card, #FFFFFF)",
        border: stats.patternFlag
          ? "1px solid var(--accent-blush, #D4A0A0)"
          : "1px solid var(--border-subtle, rgba(0,0,0,0.06))",
      }}
    >
      <CardHeader flagged={stats.patternFlag} />

      {/* Headline stat */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          margin: "12px 0 6px 0",
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "var(--text-primary, #1A1A2E)",
            lineHeight: 1,
          }}
        >
          {pctDisplay}%
        </span>
        <span
          style={{
            fontSize: 13,
            color: "var(--text-secondary, #6B7280)",
          }}
        >
          of attacks ({stats.menstrualAttacks} of{" "}
          {stats.menstrualAttacks + stats.nonMenstrualAttacks}) fell in the
          perimenstrual window
        </span>
      </div>

      {/* Pattern flag banner */}
      {stats.patternFlag && (
        <div
          style={{
            padding: "10px 12px",
            margin: "10px 0",
            borderRadius: "var(--radius-md, 12px)",
            background: "rgba(212, 160, 160, 0.12)",
            border: "1px solid rgba(212, 160, 160, 0.24)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-primary, #1A1A2E)",
              marginBottom: 4,
            }}
          >
            Pattern consistent with menstrual migraine
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-secondary, #6B7280)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Your attacks cluster near menstruation more than {thresholdDisplay}%
            of the time. This is a pattern worth sharing with your neurologist
            or gynecologist. Cycle-aware prevention options exist.
          </p>
        </div>
      )}

      {/* Window description */}
      <p
        style={{
          fontSize: 12,
          color: "var(--text-muted, #94A3B8)",
          margin: "6px 0 14px 0",
          lineHeight: 1.5,
        }}
      >
        {stats.windowDescription} If attacks were evenly distributed, we would
        expect about {nullPctDisplay}% to fall here by chance.
      </p>

      {/* Phase heatmap */}
      <PhaseHeatmapBar heatmap={stats.phaseHeatmap} />

      {/* Statistical detail */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginTop: 12,
          fontSize: 11,
          color: "var(--text-muted, #94A3B8)",
        }}
      >
        {stats.oddsRatio !== null && (
          <span>
            Odds ratio:{" "}
            <strong style={{ color: "var(--text-secondary, #6B7280)" }}>
              {stats.oddsRatio.toFixed(2)}x
            </strong>
          </span>
        )}
        {stats.p !== null && (
          <span>
            p-value:{" "}
            <strong style={{ color: "var(--text-secondary, #6B7280)" }}>
              {formatPValue(stats.p)}
            </strong>
          </span>
        )}
        <span>Total attacks: {stats.totalAttacks}</span>
        {stats.unknownAttacks > 0 && (
          <span>
            Without cycle context: {stats.unknownAttacks}
          </span>
        )}
      </div>
    </div>
  );
}

function CardHeader({ flagged = false }: { flagged?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-primary, #1A1A2E)",
          margin: 0,
        }}
      >
        Headaches and your cycle
      </h3>
      {flagged && (
        <span
          aria-hidden
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 8,
            background: "rgba(212, 160, 160, 0.16)",
            color: "var(--accent-blush, #D4A0A0)",
          }}
        >
          Pattern flagged
        </span>
      )}
    </div>
  );
}

function PhaseHeatmapBar({ heatmap }: { heatmap: PhaseHeatmap }) {
  const order: Array<keyof PhaseHeatmap> = [
    "menstrual",
    "follicular",
    "ovulatory",
    "luteal",
    "unknown",
  ];
  const total = order.reduce((sum, k) => sum + heatmap[k], 0);
  if (total === 0) return null;

  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-secondary, #6B7280)",
          marginBottom: 6,
        }}
      >
        Attacks by cycle phase
      </div>
      <div
        style={{
          display: "flex",
          height: 28,
          borderRadius: "var(--radius-sm, 8px)",
          overflow: "hidden",
          border: "1px solid var(--border-subtle, rgba(0,0,0,0.06))",
        }}
      >
        {order.map((phase) => {
          const count = heatmap[phase];
          const share = total === 0 ? 0 : count / total;
          if (share === 0) return null;
          return (
            <div
              key={phase}
              title={`${PHASE_COLORS[phase].label}: ${count} ${count === 1 ? "attack" : "attacks"}`}
              style={{
                flex: share,
                background: PHASE_COLORS[phase].bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-primary, #1A1A2E)",
              }}
            >
              {count}
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 6,
          fontSize: 11,
          color: "var(--text-muted, #94A3B8)",
        }}
      >
        {order.map((phase) =>
          heatmap[phase] === 0 ? null : (
            <span
              key={phase}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: PHASE_COLORS[phase].bg,
                  display: "inline-block",
                }}
              />
              {PHASE_COLORS[phase].label}
            </span>
          )
        )}
      </div>
    </div>
  );
}

function formatPValue(p: number): string {
  if (p < 0.001) return "< 0.001";
  if (p < 0.01) return p.toFixed(3);
  return p.toFixed(2);
}
