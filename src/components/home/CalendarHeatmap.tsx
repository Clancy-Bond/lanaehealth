"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  subMonths,
  addMonths,
  isSameDay,
  isAfter,
} from "date-fns";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Activity,
  Heart,
  Droplets,
  ExternalLink,
} from "lucide-react";

interface DailyLogEntry {
  date: string;
  overall_pain: number | null;
}

interface CycleEntry {
  date: string;
  menstruation: boolean;
}

interface OuraEntry {
  date: string;
  sleep_score: number | null;
  hrv_avg: number | null;
  resting_hr: number | null;
}

interface CalendarHeatmapProps {
  dailyLogs: DailyLogEntry[];
  cycleEntries: CycleEntry[];
  ouraEntries?: OuraEntry[];
  initialMonth: string; // "YYYY-MM" format
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Return background color based on pain level for a given day.
 */
function getPainColor(pain: number | null): string {
  if (pain === null) return "var(--bg-elevated)";
  if (pain <= 2) return "rgba(107, 144, 128, 0.3)"; // sage - good
  if (pain <= 5) return "rgba(232, 168, 73, 0.35)"; // amber - moderate
  if (pain <= 8) return "rgba(212, 160, 160, 0.45)"; // rose - rough
  return "rgba(220, 38, 38, 0.35)"; // dark rose - severe
}

function getPainLabel(pain: number | null): string {
  if (pain === null) return "No data";
  if (pain <= 2) return "Good day";
  if (pain <= 5) return "Moderate";
  if (pain <= 8) return "Rough";
  return "Severe";
}

export function CalendarHeatmap({
  dailyLogs,
  cycleEntries,
  ouraEntries = [],
  initialMonth,
}: CalendarHeatmapProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const [year, month] = initialMonth.split("-").map(Number);
    return new Date(year, month - 1, 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [detailHeight, setDetailHeight] = useState(0);

  // Measure detail panel content height for smooth animation
  useEffect(() => {
    if (detailRef.current) {
      setDetailHeight(detailRef.current.scrollHeight);
    }
  }, [selectedDay]);

  // Build lookup maps for quick access
  const logsByDate = useMemo(() => {
    const map = new Map<string, DailyLogEntry>();
    for (const log of dailyLogs) {
      map.set(log.date, log);
    }
    return map;
  }, [dailyLogs]);

  const cycleByDate = useMemo(() => {
    const map = new Map<string, CycleEntry>();
    for (const entry of cycleEntries) {
      map.set(entry.date, entry);
    }
    return map;
  }, [cycleEntries]);

  const ouraByDate = useMemo(() => {
    const map = new Map<string, OuraEntry>();
    for (const entry of ouraEntries) {
      map.set(entry.date, entry);
    }
    return map;
  }, [ouraEntries]);

  // Generate days for the current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart); // 0 = Sunday

  const today = new Date();

  // Navigation
  const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => {
    const next = addMonths(currentMonth, 1);
    if (!isAfter(startOfMonth(next), startOfMonth(today))) {
      setCurrentMonth(next);
    }
  };
  const canGoNext = !isAfter(
    startOfMonth(addMonths(currentMonth, 1)),
    startOfMonth(today)
  );

  // Detail panel data
  const selectedLog = selectedDay ? logsByDate.get(selectedDay) : null;
  const selectedCycle = selectedDay ? cycleByDate.get(selectedDay) : null;
  const selectedOura = selectedDay ? ouraByDate.get(selectedDay) : null;

  return (
    <div style={{ padding: "0 16px" }}>
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 16,
          border: "1px solid var(--border-light)",
          boxShadow: "var(--shadow-sm)",
          padding: 16,
        }}
      >
        {/* Month navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <button
            onClick={goToPrevMonth}
            aria-label="Previous month"
            className="touch-target"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: 4,
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <button
            onClick={goToNextMonth}
            disabled={!canGoNext}
            aria-label="Next month"
            className="touch-target"
            style={{
              background: "none",
              border: "none",
              cursor: canGoNext ? "pointer" : "default",
              color: canGoNext
                ? "var(--text-secondary)"
                : "var(--border-light)",
              padding: 4,
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day of week headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
            marginBottom: 6,
          }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--text-muted)",
                lineHeight: 1,
                paddingBottom: 4,
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
          }}
        >
          {/* Empty cells for offset */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} style={{ width: 40, height: 40 }} />
          ))}

          {/* Day cells */}
          {daysInMonth.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const log = logsByDate.get(dateStr);
            const cycle = cycleByDate.get(dateStr);
            const pain = log?.overall_pain ?? null;
            const hasPeriod = cycle?.menstruation === true;
            const isToday = isSameDay(day, today);
            const isFuture = isAfter(day, today);
            const isSelected = selectedDay === dateStr;

            return (
              <button
                key={dateStr}
                onClick={() => {
                  if (!isFuture) {
                    setSelectedDay(isSelected ? null : dateStr);
                  }
                }}
                disabled={isFuture}
                aria-label={`${format(day, "MMM d")}${pain !== null ? `, pain ${pain}/10` : ""}${hasPeriod ? ", period" : ""}`}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  maxWidth: 40,
                  maxHeight: 40,
                  borderRadius: 8,
                  border: isSelected
                    ? "2px solid var(--accent-sage)"
                    : isToday
                      ? "2px solid var(--border)"
                      : "1px solid transparent",
                  background: isFuture
                    ? "transparent"
                    : getPainColor(pain),
                  cursor: isFuture ? "default" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  padding: 0,
                  opacity: isFuture ? 0.3 : 1,
                  position: "relative",
                  margin: "0 auto",
                  transition: "border-color 150ms ease",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday
                      ? "var(--accent-sage)"
                      : "var(--text-primary)",
                    lineHeight: 1,
                  }}
                >
                  {format(day, "d")}
                </span>
                {hasPeriod && (
                  <span
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--phase-menstrual)",
                      position: "absolute",
                      bottom: 3,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Slide-down detail panel for selected day */}
        <div
          style={{
            overflow: "hidden",
            transition: "max-height 250ms ease, opacity 200ms ease",
            maxHeight: selectedDay ? detailHeight + 16 : 0,
            opacity: selectedDay ? 1 : 0,
          }}
        >
          <div
            ref={detailRef}
            style={{
              marginTop: 12,
              padding: "14px 14px 12px",
              background: "var(--bg-elevated)",
              borderRadius: 12,
              border: "1px solid var(--border-light)",
            }}
          >
            {selectedDay && (
              <>
                {/* Date header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      fontSize: 14,
                    }}
                  >
                    {format(new Date(selectedDay + "T12:00:00"), "EEEE, MMM d")}
                  </span>
                  {selectedCycle?.menstruation && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--phase-menstrual)",
                        background: "rgba(232, 80, 106, 0.12)",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      <Droplets size={12} />
                      Period
                    </span>
                  )}
                </div>

                {/* Pain level */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: getPainColor(selectedLog?.overall_pain ?? null),
                      border: "1px solid var(--border-light)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {selectedLog?.overall_pain !== null &&
                    selectedLog?.overall_pain !== undefined
                      ? `Pain ${selectedLog.overall_pain}/10 - ${getPainLabel(selectedLog.overall_pain)}`
                      : "Pain not logged"}
                  </span>
                </div>

                {/* Oura metrics row */}
                {selectedOura &&
                  (selectedOura.sleep_score !== null ||
                    selectedOura.hrv_avg !== null ||
                    selectedOura.resting_hr !== null) && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    {selectedOura.sleep_score !== null && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                          padding: "8px 4px",
                          background: "var(--bg-card)",
                          borderRadius: 8,
                        }}
                      >
                        <Moon
                          size={14}
                          style={{ color: "var(--accent-sage)" }}
                        />
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {selectedOura.sleep_score}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                          }}
                        >
                          Sleep
                        </span>
                      </div>
                    )}
                    {selectedOura.hrv_avg !== null && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                          padding: "8px 4px",
                          background: "var(--bg-card)",
                          borderRadius: 8,
                        }}
                      >
                        <Activity
                          size={14}
                          style={{ color: "var(--accent-sage)" }}
                        />
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {Math.round(selectedOura.hrv_avg)}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                          }}
                        >
                          HRV
                        </span>
                      </div>
                    )}
                    {selectedOura.resting_hr !== null && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 2,
                          padding: "8px 4px",
                          background: "var(--bg-card)",
                          borderRadius: 8,
                        }}
                      >
                        <Heart
                          size={14}
                          style={{ color: "var(--accent-sage)" }}
                        />
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {Math.round(selectedOura.resting_hr)}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                          }}
                        >
                          Resting HR
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* No Oura data message */}
                {(!selectedOura ||
                  (selectedOura.sleep_score === null &&
                    selectedOura.hrv_avg === null &&
                    selectedOura.resting_hr === null)) && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      marginBottom: 10,
                    }}
                  >
                    No Oura data for this day
                  </div>
                )}

                {/* View full log link */}
                <Link
                  href={`/log?date=${selectedDay}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--accent-sage)",
                    textDecoration: "none",
                  }}
                >
                  View full log
                  <ExternalLink size={12} />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          {[
            { label: "Good", color: "rgba(107, 144, 128, 0.3)" },
            { label: "Moderate", color: "rgba(232, 168, 73, 0.35)" },
            { label: "Rough", color: "rgba(212, 160, 160, 0.45)" },
            { label: "Severe", color: "rgba(220, 38, 38, 0.35)" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: item.color,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "var(--phase-menstrual)",
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: "var(--text-muted)",
              }}
            >
              Period
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
