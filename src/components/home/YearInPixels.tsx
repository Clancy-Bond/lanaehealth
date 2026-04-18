/**
 * Year-in-Pixels
 *
 * Daylio's signature visualization. One pixel per calendar day for the
 * last 365 days, colored by overall_pain score (0 = sage, 10 = blush).
 * Laid out GitHub-contribution-graph style: 7-row grid (rows = days
 * of week, columns = weeks).
 *
 * Server component. Pre-fetched data from page.tsx.
 */

import { format, subDays, startOfWeek, addDays } from "date-fns";

interface PainDay {
  date: string;
  overall_pain: number | null;
}

interface Props {
  /** Last 365 days of daily_logs with pain score. */
  days: PainDay[];
  /** Today's ISO date; all dates in `days` should be <= this. */
  today: string;
}

function colorForPain(pain: number | null): string {
  if (pain === null || pain === undefined || !Number.isFinite(pain)) {
    return "var(--border-light)";
  }
  if (pain <= 1) return "#7CA391";
  if (pain <= 3) return "#A4C3B5";
  if (pain <= 5) return "#E8D5C4";
  if (pain <= 7) return "#D4A0A0";
  return "#B87A7A";
}

export function YearInPixels({ days, today }: Props) {
  const todayDate = new Date(today + "T00:00:00");
  const start = subDays(todayDate, 364);

  // Grid origin = Sunday before `start`. We fill blank cells at the head
  // so the first real day aligns with its weekday row.
  const gridOrigin = startOfWeek(start, { weekStartsOn: 0 });
  const totalWeeks = 53;
  const cells: Array<{ iso: string; pain: number | null; isBeforeWindow: boolean; isFuture: boolean } | null> = [];

  const map = new Map<string, number | null>();
  for (const d of days) {
    map.set(d.date, d.overall_pain);
  }

  for (let w = 0; w < totalWeeks; w++) {
    for (let d = 0; d < 7; d++) {
      const cellDate = addDays(gridOrigin, w * 7 + d);
      const iso = format(cellDate, "yyyy-MM-dd");
      const isBefore = cellDate < start;
      const isFuture = cellDate > todayDate;
      if (isBefore || isFuture) {
        cells.push({ iso, pain: null, isBeforeWindow: isBefore, isFuture });
      } else {
        cells.push({ iso, pain: map.get(iso) ?? null, isBeforeWindow: false, isFuture: false });
      }
    }
  }

  // Month labels: mark the column where each month starts.
  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  for (let w = 0; w < totalWeeks; w++) {
    const cellDate = addDays(gridOrigin, w * 7);
    const m = cellDate.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col: w, label: format(cellDate, "MMM") });
      lastMonth = m;
    }
  }

  const loggedCount = days.filter((d) => d.overall_pain !== null).length;

  return (
    <div style={{ padding: "0 16px" }}>
      <div
        style={{
          padding: "14px 16px",
          borderRadius: 14,
          background: "var(--bg-card)",
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Year in pixels
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Last 365 days of pain scores. Sage = low pain. Blush = high.
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            <span className="tabular">{loggedCount}</span> days logged
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${totalWeeks}, 1fr)`,
            gridAutoRows: "minmax(0, 1fr)",
            gap: 2,
            position: "relative",
          }}
        >
          {/* Month labels row */}
          {monthLabels.map((m) => (
            <span
              key={`m-${m.col}`}
              style={{
                gridColumn: m.col + 1,
                gridRow: 1,
                fontSize: 8,
                color: "var(--text-muted)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                pointerEvents: "none",
                position: "absolute",
                transform: `translateY(-14px)`,
                left: `calc((100% / ${totalWeeks}) * ${m.col})`,
              }}
            >
              {m.label}
            </span>
          ))}
          {/* Cells */}
          {cells.map((c, i) => {
            if (!c) return null;
            const fill = c.isBeforeWindow || c.isFuture ? "transparent" : colorForPain(c.pain);
            const tooltip =
              c.pain !== null
                ? `${format(new Date(c.iso + "T00:00:00"), "EEE MMM d")}: pain ${c.pain}/10`
                : !c.isBeforeWindow && !c.isFuture
                  ? `${format(new Date(c.iso + "T00:00:00"), "EEE MMM d")}: no log`
                  : "";
            return (
              <a
                key={`${i}-${c.iso}`}
                href={c.isBeforeWindow || c.isFuture ? undefined : `/log?date=${c.iso}`}
                title={tooltip}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: 2,
                  background: fill,
                  outline:
                    c.iso === today ? "1.5px solid var(--text-primary)" : "none",
                  textDecoration: "none",
                  display: "block",
                  minHeight: 6,
                }}
              />
            );
          })}
        </div>
        {/* Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          <span style={{ fontWeight: 600 }}>Low pain</span>
          {[0, 2, 4, 6, 8].map((v) => (
            <span
              key={v}
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: colorForPain(v),
                display: "inline-block",
              }}
            />
          ))}
          <span style={{ fontWeight: 600 }}>High pain</span>
        </div>
      </div>
    </div>
  );
}
