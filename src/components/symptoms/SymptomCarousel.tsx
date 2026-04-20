"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { DEFAULT_PILLS } from "@/lib/symptoms/types";
import type { Severity, Symptom, SymptomCategory } from "@/lib/types";

/**
 * Bearable-style symptom carousel with per-entry timestamps.
 *
 * This is the new primary entry point for /log. Each pill represents a
 * category + default symptom. Tapping a pill opens a compact severity
 * selector; choosing a severity POSTs to /api/symptoms/quick-log which
 * saves a symptom row with the exact current timestamp. The existing
 * DailyStoryClient still lives below the carousel so power users keep
 * the multi-section check-in.
 *
 * Granularity contract: every write goes through /api/symptoms/quick-log,
 * which inserts into the `symptoms` table. That table's `logged_at`
 * column defaults to `now()` (see migration 001), giving us minute-grain
 * precision without any bucketing.
 */

interface SymptomCarouselProps {
  initialSymptoms: Symptom[];
}

type Draft =
  | { kind: "idle" }
  | { kind: "open"; pillId: string; symptom: string; category: SymptomCategory };

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function severityColor(sev: Severity | null): string {
  switch (sev) {
    case "severe":
      return "var(--pain-severe)";
    case "moderate":
      return "var(--pain-moderate)";
    case "mild":
      return "var(--pain-mild)";
    default:
      return "var(--text-muted)";
  }
}

export default function SymptomCarousel({ initialSymptoms }: SymptomCarouselProps) {
  const [entries, setEntries] = useState<Symptom[]>(initialSymptoms);
  const [draft, setDraft] = useState<Draft>({ kind: "idle" });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [announce, setAnnounce] = useState<string>("");
  const [, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const byLabel = new Map<string, Symptom[]>();
    for (const s of entries) {
      const k = s.symptom.toLowerCase();
      const arr = byLabel.get(k) ?? [];
      arr.push(s);
      byLabel.set(k, arr);
    }
    return byLabel;
  }, [entries]);

  const handleLog = async (
    pill: { symptom: string; category: SymptomCategory },
    severity: Severity,
  ) => {
    setSavingId(`${pill.symptom}-${severity}`);
    const body = new URLSearchParams({
      symptom: pill.symptom,
      category: pill.category,
      severity,
    });
    try {
      const res = await fetch("/api/symptoms/quick-log", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (res.ok) {
        const now = new Date();
        const optimistic: Symptom = {
          id: `tmp-${now.getTime()}`,
          log_id: "tmp",
          category: pill.category,
          symptom: pill.symptom,
          severity,
          logged_at: now.toISOString(),
        };
        setEntries((prev) => [...prev, optimistic]);
        setDraft({ kind: "idle" });
        setAnnounce(
          `${pill.symptom} logged at ${severity}, ${now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`,
        );
        startTransition(() => {
          // Server component refetch happens via router.refresh on nav.
        });
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section
      aria-label="Quick symptom carousel"
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "0.5rem",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-lg)",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            How are you right now?
          </h2>
          <p
            style={{
              margin: "0.125rem 0 0",
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
            }}
          >
            Each tap saves an entry with the exact time.
          </p>
        </div>
        <Link
          href="/log/quick"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--accent-sage)",
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Ten-second mode
        </Link>
      </header>

      <div
        role="list"
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.25rem",
          scrollSnapType: "x mandatory",
        }}
      >
        {DEFAULT_PILLS.map((p) => {
          const todays = grouped.get(p.symptom.toLowerCase()) ?? [];
          const hasAny = todays.length > 0;
          const open = draft.kind === "open" && draft.pillId === p.id;
          const topSev: Severity | null =
            todays.find((t) => t.severity === "severe")?.severity ??
            todays.find((t) => t.severity === "moderate")?.severity ??
            todays[0]?.severity ??
            null;

          return (
            <div
              key={p.id}
              role="listitem"
              style={{
                scrollSnapAlign: "start",
                flex: "0 0 auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                minWidth: open ? 220 : 108,
                padding: "0.625rem 0.75rem",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${
                  hasAny ? "var(--accent-blush)" : "rgba(107,144,128,0.2)"
                }`,
                background: hasAny ? "var(--accent-blush-muted)" : "var(--bg-input)",
                transition: "min-width var(--duration-fast) var(--ease-standard)",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setDraft(
                    open
                      ? { kind: "idle" }
                      : {
                          kind: "open",
                          pillId: p.id,
                          symptom: p.symptom,
                          category: p.category,
                        },
                  )
                }
                aria-expanded={open}
                style={{
                  minHeight: 44,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  color: "var(--text-primary)",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 20 }} aria-hidden>
                  {p.icon}
                </span>
                <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                  {p.symptom}
                </span>
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                  }}
                >
                  {hasAny
                    ? `${todays.length}× today`
                    : "Tap to log"}
                  {topSev && hasAny ? (
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: severityColor(topSev),
                        marginLeft: 6,
                        verticalAlign: "middle",
                      }}
                    />
                  ) : null}
                </span>
              </button>

              {open && (
                <div
                  role="group"
                  aria-label={`Log ${p.symptom}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "0.5rem 0 0",
                    borderTop: "1px solid rgba(107,144,128,0.18)",
                  }}
                >
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["mild", "moderate", "severe"] as Severity[]).map((s) => {
                      const saving = savingId === `${p.symptom}-${s}`;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleLog(p, s)}
                          disabled={saving}
                          style={{
                            flex: 1,
                            minHeight: 40,
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid",
                            borderColor:
                              s === "severe"
                                ? "var(--pain-severe)"
                                : s === "moderate"
                                  ? "var(--pain-moderate)"
                                  : "var(--pain-mild)",
                            background: "var(--bg-card)",
                            color: "var(--text-primary)",
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            textTransform: "capitalize",
                            cursor: saving ? "wait" : "pointer",
                          }}
                        >
                          {saving ? "..." : s}
                        </button>
                      );
                    })}
                  </div>
                  {todays.length > 0 && (
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      {todays.slice(-3).map((t) => (
                        <li
                          key={t.id}
                          style={{
                            fontSize: "var(--text-xs)",
                            color: "var(--text-secondary)",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span style={{ textTransform: "capitalize" }}>
                            {t.severity ?? "logged"}
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>
                            {timeLabel(t.logged_at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {entries.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          Nothing logged yet today. Tap a pill when something shows up. A
          quiet day is still a day.
        </p>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
          }}
        >
          {entries.length} entr{entries.length === 1 ? "y" : "ies"} saved today, each
          stamped with the exact time.
        </p>
      )}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          left: -9999,
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        {announce}
      </div>
    </section>
  );
}
