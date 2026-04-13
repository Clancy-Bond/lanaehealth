"use client";

import { useMemo } from "react";
import type { NcImported, CycleEntry } from "@/lib/types";

interface CycleOverviewProps {
  ncData: NcImported[];
  cycleEntries: CycleEntry[];
}

interface CycleInfo {
  cycleNumber: number;
  startDate: string;
  endDate: string;
  length: number;
  periodLength: number;
  phases: PhaseSegment[];
}

interface PhaseSegment {
  phase: string;
  startDay: number;
  endDay: number;
  color: string;
}

const PHASE_COLORS: Record<string, string> = {
  menstrual: "var(--phase-menstrual)",
  follicular: "var(--phase-follicular)",
  ovulatory: "var(--phase-ovulatory)",
  luteal: "var(--phase-luteal)",
};

function computeCycleStats(ncData: NcImported[], cycleEntries: CycleEntry[]) {
  // Group NC data by cycle number
  const cycleMap = new Map<number, NcImported[]>();
  for (const entry of ncData) {
    if (entry.cycle_number !== null) {
      const existing = cycleMap.get(entry.cycle_number) || [];
      existing.push(entry);
      cycleMap.set(entry.cycle_number, existing);
    }
  }

  // Also look at cycle_entries for menstruation data
  const menstruationDates = new Set<string>();
  for (const ce of cycleEntries) {
    if (ce.menstruation) menstruationDates.add(ce.date);
  }
  for (const nc of ncData) {
    if (nc.menstruation && nc.menstruation.toLowerCase() !== "no" && nc.menstruation !== "") {
      menstruationDates.add(nc.date);
    }
  }

  // Build cycle info from NC data
  const cycles: CycleInfo[] = [];
  const cycleNumbers = Array.from(cycleMap.keys()).sort((a, b) => a - b);

  for (const num of cycleNumbers) {
    const entries = cycleMap.get(num)!;
    const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) continue;

    const startDate = sorted[0].date;
    const endDate = sorted[sorted.length - 1].date;
    const length = sorted.length;

    // Count period days (menstruation days in this cycle)
    let periodLength = 0;
    for (const e of sorted) {
      if (
        menstruationDates.has(e.date) ||
        (e.menstruation && e.menstruation.toLowerCase() !== "no" && e.menstruation !== "")
      ) {
        periodLength++;
      }
    }

    // Build phase segments
    const phases: PhaseSegment[] = [];
    let currentPhase: string | null = null;
    let phaseStart = 1;

    for (const e of sorted) {
      const day = e.cycle_day ?? 0;
      let phase: string;
      if (day <= 5) phase = "menstrual";
      else if (day <= 13) phase = "follicular";
      else if (day <= 16) phase = "ovulatory";
      else phase = "luteal";

      if (phase !== currentPhase) {
        if (currentPhase !== null) {
          phases.push({
            phase: currentPhase,
            startDay: phaseStart,
            endDay: day - 1,
            color: PHASE_COLORS[currentPhase] || "var(--text-muted)",
          });
        }
        currentPhase = phase;
        phaseStart = day;
      }
    }
    // Close last phase
    if (currentPhase !== null) {
      phases.push({
        phase: currentPhase,
        startDay: phaseStart,
        endDay: length,
        color: PHASE_COLORS[currentPhase] || "var(--text-muted)",
      });
    }

    cycles.push({
      cycleNumber: num,
      startDate,
      endDate,
      length,
      periodLength,
      phases,
    });
  }

  return cycles;
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function CycleOverview({ ncData, cycleEntries }: CycleOverviewProps) {
  const cycles = useMemo(
    () => computeCycleStats(ncData, cycleEntries),
    [ncData, cycleEntries]
  );

  // Compute aggregate stats
  const stats = useMemo(() => {
    if (cycles.length === 0) {
      return {
        avgLength: null,
        avgPeriod: null,
        regularity: null,
        totalCycles: 0,
      };
    }

    const lengths = cycles.map((c) => c.length).filter((l) => l >= 21 && l <= 45);
    const periodLengths = cycles.map((c) => c.periodLength).filter((l) => l > 0);

    const avgLength =
      lengths.length > 0
        ? lengths.reduce((a, b) => a + b, 0) / lengths.length
        : null;

    const avgPeriod =
      periodLengths.length > 0
        ? periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length
        : null;

    // Regularity: based on standard deviation of cycle lengths
    let regularity: number | null = null;
    if (lengths.length >= 2 && avgLength !== null) {
      const variance =
        lengths.reduce((sum, l) => sum + (l - avgLength) ** 2, 0) /
        lengths.length;
      const stdDev = Math.sqrt(variance);
      // Convert to 0-100 score: lower std dev = higher regularity
      // stdDev of 0 = 100%, stdDev of 7+ = 0%
      regularity = Math.max(0, Math.round(100 - (stdDev / 7) * 100));
    }

    return {
      avgLength,
      avgPeriod,
      regularity,
      totalCycles: cycles.length,
    };
  }, [cycles]);

  // Get last 6 cycles for timeline
  const recentCycles = useMemo(
    () => cycles.slice(-6),
    [cycles]
  );

  const maxCycleLength = useMemo(
    () => Math.max(...recentCycles.map((c) => c.length), 35),
    [recentCycles]
  );

  if (cycles.length === 0) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          No cycle data available
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 14px 0",
        }}
      >
        Cycle Overview
      </h2>

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <StatCard
          label="Avg Cycle"
          value={stats.avgLength !== null ? `${Math.round(stats.avgLength)}d` : "--"}
          sublabel="days"
        />
        <StatCard
          label="Avg Period"
          value={stats.avgPeriod !== null ? `${Math.round(stats.avgPeriod)}d` : "--"}
          sublabel="days"
        />
        <StatCard
          label="Regularity"
          value={stats.regularity !== null ? `${stats.regularity}%` : "--"}
          sublabel={
            stats.regularity !== null
              ? stats.regularity >= 80
                ? "Regular"
                : stats.regularity >= 50
                  ? "Somewhat regular"
                  : "Irregular"
              : ""
          }
        />
        <StatCard
          label="Tracked"
          value={String(stats.totalCycles)}
          sublabel="total cycles"
        />
      </div>

      {/* Phase Timeline */}
      {recentCycles.length > 0 && (
        <div>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-secondary)",
              margin: "0 0 10px 0",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Recent Cycles
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {recentCycles.map((cycle) => (
              <div key={cycle.cycleNumber}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      minWidth: 20,
                    }}
                  >
                    #{cycle.cycleNumber}
                  </span>
                  {/* Phase bar */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      height: 14,
                      borderRadius: 7,
                      overflow: "hidden",
                      width: `${(cycle.length / maxCycleLength) * 100}%`,
                    }}
                  >
                    {cycle.phases.map((seg, i) => {
                      const segLen = seg.endDay - seg.startDay + 1;
                      const pct = (segLen / cycle.length) * 100;
                      return (
                        <div
                          key={i}
                          style={{
                            width: `${pct}%`,
                            background: seg.color,
                            opacity: 0.7,
                          }}
                          title={`${seg.phase}: days ${seg.startDay}-${seg.endDay}`}
                        />
                      );
                    })}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      minWidth: 24,
                      textAlign: "right",
                    }}
                  >
                    {cycle.length}d
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    paddingLeft: 28,
                  }}
                >
                  {formatShortDate(cycle.startDate)} - {formatShortDate(cycle.endDate)}
                </div>
              </div>
            ))}
          </div>

          {/* Phase legend */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 14,
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            {Object.entries(PHASE_COLORS).map(([phase, color]) => (
              <span key={phase} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span
                  style={{
                    width: 10,
                    height: 6,
                    borderRadius: 2,
                    background: color,
                    opacity: 0.7,
                  }}
                />
                {phase.charAt(0).toUpperCase() + phase.slice(1)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--text-muted)",
          marginBottom: 4,
          textTransform: "uppercase",
          letterSpacing: 0.3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sublabel && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 2,
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}
