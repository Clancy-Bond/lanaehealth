"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  PIXEL_METRICS,
  colorForDay,
  borderForPhase,
  groupByMonthWeek,
  ariaLabelForDay,
  EMPTY_FILL,
  type PixelDay,
  type PixelMetric,
} from "@/lib/patterns/pixel-data";

/**
 * YearInPixels -- 365-cell calendar heatmap.
 *
 * Layout: month-by-week columns. Each column is one calendar month, each
 * row within the column is a week (Monday-start). 7 cells per week row,
 * padded with null placeholders to keep rows aligned.
 *
 * The selected metric paints the cell fill. Cycle phase paints the cell
 * border (1-2px) so the two overlays coexist without competing.
 *
 * Non-shaming rule: empty cells are a neutral light background, not the
 * "bad" color. A missing log is a lack of data, not a bad day.
 *
 * Recharts is NOT used here. Per CLAUDE.md rule this is hand-rolled CSS
 * grid so no SSR width-measurement hazard exists.
 */

export interface YearInPixelsProps {
  /** Pre-shaped days. Consumers call buildPixelDays() on the server. */
  days: PixelDay[];
  /** Initial metric. Defaults to "mood" for the cycle-mood narrative. */
  defaultMetric?: PixelMetric;
  /** Optional "today" override for deterministic screenshots. */
  today?: Date;
}

const CELL_SIZE = 12; // px, keeps a ~365-cell grid compact on mobile
const CELL_GAP = 2;

export function YearInPixels({
  days,
  defaultMetric = "mood",
  today,
}: YearInPixelsProps) {
  const [metric, setMetric] = useState<PixelMetric>(defaultMetric);
  const [showPhase, setShowPhase] = useState(true);
  const [hovered, setHovered] = useState<PixelDay | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const columns = useMemo(() => groupByMonthWeek(days), [days]);
  const todayIso = useMemo(() => {
    const t = today ?? new Date();
    return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
  }, [today]);

  // Scroll the latest month into view on first paint so the user lands on
  // the most recent data rather than the oldest.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [columns.length]);

  if (days.length === 0) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h2 style={titleStyle()}>Your year at a glance</h2>
        <div className="empty-state" style={{ marginTop: 12 }}>
          <p className="empty-state__title">Not enough data yet</p>
          <p className="empty-state__hint">
            Once you log mood, pain, or sleep for a few weeks, this grid will
            light up. Gaps stay blank (no pressure).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <PixelCellStyles />
      <div style={headerRowStyle()}>
        <div>
          <h2 style={titleStyle()}>Your year at a glance</h2>
          <p style={subtitleStyle()}>
            Each square is one day. Pick a metric. Blank squares are days with
            no log.
          </p>
        </div>
        <label style={metricLabelStyle()}>
          <span className="sr-only">Metric</span>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as PixelMetric)}
            style={selectStyle()}
            aria-label="Year-in-Pixels metric"
          >
            {PIXEL_METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={showPhase}
            onChange={(e) => setShowPhase(e.target.checked)}
            aria-label="Show cycle phase border"
          />
          Cycle phase border
        </label>
      </div>

      <div
        ref={scrollRef}
        className="hide-scrollbar"
        style={{
          marginTop: 16,
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: 8,
        }}
      >
        <div
          role="grid"
          aria-label={`Year-in-Pixels, ${metric}`}
          style={{ display: "flex", gap: 6 }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              role="row"
              style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
            >
              <span style={monthLabelStyle()}>{col.label}</span>
              <div
                style={{
                  display: "grid",
                  gridTemplateRows: `repeat(${col.weeks.length}, ${CELL_SIZE}px)`,
                  gap: CELL_GAP,
                }}
              >
                {col.weeks.map((week, wi) => (
                  <div
                    key={wi}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(7, ${CELL_SIZE}px)`,
                      gap: CELL_GAP,
                    }}
                  >
                    {week.map((day, di) => (
                      <PixelCell
                        key={di}
                        day={day}
                        metric={metric}
                        showPhase={showPhase}
                        isToday={day ? day.date === todayIso : false}
                        onHover={setHovered}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Legend metric={metric} showPhase={showPhase} />

      {hovered && (
        <div role="status" aria-live="polite" style={tooltipStyle()}>
          {ariaLabelForDay(hovered, metric)}
        </div>
      )}
    </div>
  );
}

// ── Cell ───────────────────────────────────────────────────────────────
interface PixelCellProps {
  day: PixelDay | null;
  metric: PixelMetric;
  showPhase: boolean;
  isToday: boolean;
  onHover: (d: PixelDay | null) => void;
}

function PixelCell({ day, metric, showPhase, isToday, onHover }: PixelCellProps) {
  if (!day) {
    return (
      <div
        aria-hidden
        style={{
          width: CELL_SIZE,
          height: CELL_SIZE,
          borderRadius: 2,
          background: "transparent",
        }}
      />
    );
  }

  const fill = colorForDay(day, metric);
  const phaseColor = showPhase ? borderForPhase(day.cyclePhase) : null;

  const borderColor = isToday
    ? "var(--text-primary)"
    : phaseColor ?? "transparent";
  const borderWidth = isToday ? 1.5 : phaseColor ? 1.5 : 0;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={ariaLabelForDay(day, metric)}
      className="pixel-cell"
      onMouseEnter={() => onHover(day)}
      onFocus={() => onHover(day)}
      onMouseLeave={() => onHover(null)}
      onBlur={() => onHover(null)}
      style={{
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderRadius: 2,
        background: fill,
        border: `${borderWidth}px solid ${borderColor}`,
        padding: 0,
        cursor: "pointer",
      }}
    />
  );
}

/**
 * Scoped focus-visible ring for the 365 cells. Defined as a sibling
 * <style> rather than touching globals.css (per design-decisions.md
 * subagent rule 17). Uses sage at 2px outline + 2px offset per Rule 10.
 */
function PixelCellStyles() {
  return (
    <style>{`
      .pixel-cell {
        outline: none;
      }
      .pixel-cell:focus-visible {
        outline: 2px solid var(--accent-sage);
        outline-offset: 2px;
        position: relative;
        z-index: 1;
      }
    `}</style>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────
function Legend({ metric, showPhase }: { metric: PixelMetric; showPhase: boolean }) {
  const metricSwatches = getLegendSwatches(metric);

  return (
    <div style={legendWrapStyle()}>
      <div style={legendSectionStyle()}>
        <span style={legendLabelStyle()}>{metricLabelCopy(metric)}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {metricSwatches.map((sw, i) => (
            <span
              key={i}
              title={sw.label}
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                background: sw.color,
                display: "inline-block",
              }}
            />
          ))}
        </div>
        <span style={legendEndLabelStyle()}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 2,
              background: EMPTY_FILL,
              display: "inline-block",
              border: "1px dashed var(--border)",
              marginRight: 4,
              verticalAlign: "middle",
            }}
          />
          no log
        </span>
      </div>

      {showPhase && (
        <div style={legendSectionStyle()}>
          <span style={legendLabelStyle()}>Cycle phase (border)</span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(
              [
                { label: "Menstrual", color: "var(--phase-menstrual)" },
                { label: "Follicular", color: "var(--phase-follicular)" },
                { label: "Ovulatory", color: "var(--phase-ovulatory)" },
                { label: "Luteal", color: "var(--phase-luteal)" },
              ] as const
            ).map((item) => (
              <span
                key={item.label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "var(--text-xs)",
                  color: "var(--text-secondary)",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: "var(--bg-elevated)",
                    border: `1.5px solid ${item.color}`,
                    display: "inline-block",
                  }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getLegendSwatches(metric: PixelMetric): Array<{ color: string; label: string }> {
  if (metric === "pain") {
    return [
      { color: "var(--pain-none)", label: "0" },
      { color: "var(--pain-low)", label: "1 to 2" },
      { color: "var(--pain-mild)", label: "3 to 4" },
      { color: "var(--pain-moderate)", label: "5 to 6" },
      { color: "var(--pain-severe)", label: "7 to 8" },
      { color: "var(--pain-extreme)", label: "9 to 10" },
    ];
  }
  return [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    color: `color-mix(in srgb, var(--accent-sage) ${Math.round(t * 100)}%, var(--accent-blush))`,
    label: "",
  }));
}

function metricLabelCopy(metric: PixelMetric): string {
  if (metric === "mood") return "Low to great";
  if (metric === "pain") return "No pain to severe";
  if (metric === "fatigue") return "Easy to heavy";
  if (metric === "sleep") return "Poor to strong";
  if (metric === "flow") return "None to heavy";
  if (metric === "hrv") return "Low to high";
  return "";
}

// ── Styles ─────────────────────────────────────────────────────────────
function titleStyle(): React.CSSProperties {
  return {
    fontSize: "var(--text-lg)",
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: 0,
    letterSpacing: "-0.01em",
  };
}

function subtitleStyle(): React.CSSProperties {
  return {
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
    margin: "2px 0 0 0",
  };
}

function headerRowStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  };
}

function metricLabelStyle(): React.CSSProperties {
  return { display: "inline-flex", alignItems: "center" };
}

function selectStyle(): React.CSSProperties {
  return {
    background: "var(--bg-input)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    fontSize: "var(--text-sm)",
    padding: "6px 10px",
    borderRadius: "var(--radius-sm)",
    minHeight: 36,
  };
}

function monthLabelStyle(): React.CSSProperties {
  return {
    fontSize: "var(--text-xs)",
    color: "var(--text-muted)",
    marginBottom: 4,
    fontWeight: 500,
    letterSpacing: "0.02em",
  };
}

function legendWrapStyle(): React.CSSProperties {
  return {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    borderTop: "1px solid var(--border-light)",
    paddingTop: 12,
  };
}

function legendSectionStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  };
}

function legendLabelStyle(): React.CSSProperties {
  return {
    fontSize: "var(--text-xs)",
    color: "var(--text-secondary)",
    fontWeight: 500,
  };
}

function legendEndLabelStyle(): React.CSSProperties {
  return {
    fontSize: "var(--text-xs)",
    color: "var(--text-muted)",
    display: "inline-flex",
    alignItems: "center",
    marginLeft: 8,
  };
}

function tooltipStyle(): React.CSSProperties {
  return {
    marginTop: 10,
    fontSize: "var(--text-sm)",
    color: "var(--text-secondary)",
    minHeight: 20,
  };
}
