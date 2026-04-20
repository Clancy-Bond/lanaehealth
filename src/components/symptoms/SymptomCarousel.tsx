"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { DEFAULT_PILLS } from "@/lib/symptoms/types";
import type { Severity, Symptom, SymptomCategory } from "@/lib/types";

/**
 * Bearable-style symptom carousel with per-entry timestamps.
 *
 * Layout: a 4-column grid of compact tiles on mobile, expanding to more
 * columns on wider screens via auto-fill. Tapping a tile opens an
 * inline severity row directly below it; choosing a severity POSTs to
 * /api/symptoms/quick-log which saves a symptoms row with the exact
 * current timestamp. The existing DailyStoryClient still lives below
 * the carousel so power users keep the multi-section check-in.
 *
 * Granularity contract: every write goes through /api/symptoms/quick-log,
 * which inserts into the `symptoms` table. That table's `logged_at`
 * column defaults to `now()`, giving us minute-grain precision without
 * any bucketing.
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

  const openPill = draft.kind === "open"
    ? DEFAULT_PILLS.find((p) => p.id === draft.pillId)
    : null;
  const openPillTodays = openPill
    ? grouped.get(openPill.symptom.toLowerCase()) ?? []
    : [];

  return (
    <section
      aria-label="Quick symptom log"
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--text-lg)",
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.2,
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
            Tap a tile. Exact time is saved.
          </p>
        </div>
        <Link
          href="/log/quick"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--accent-sage)",
            textDecoration: "none",
            whiteSpace: "nowrap",
            padding: "0.25rem 0.5rem",
            borderRadius: "var(--radius-full)",
            border: "1px solid rgba(107,144,128,0.2)",
          }}
        >
          10s mode
        </Link>
      </header>

      <div
        role="group"
        aria-label="Symptom tiles"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
          gap: "0.5rem",
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
            <button
              key={p.id}
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
              aria-pressed={open}
              aria-label={
                hasAny
                  ? `${p.symptom}, ${todays.length} today. Tap to log another.`
                  : `${p.symptom}. Tap to log.`
              }
              style={{
                position: "relative",
                minHeight: 72,
                padding: "0.5rem 0.25rem",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${
                  open
                    ? "var(--accent-sage)"
                    : hasAny
                      ? "var(--accent-blush)"
                      : "rgba(107,144,128,0.18)"
                }`,
                background: open
                  ? "var(--accent-sage-muted)"
                  : hasAny
                    ? "var(--accent-blush-muted)"
                    : "var(--bg-input)",
                color: "var(--text-primary)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
                {p.icon}
              </span>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  lineHeight: 1.15,
                }}
              >
                {p.symptom}
              </span>
              {hasAny && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--accent-blush)",
                  }}
                >
                  {topSev && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: severityColor(topSev),
                      }}
                    />
                  )}
                  {todays.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {openPill && (
        <div
          role="group"
          aria-label={`Log ${openPill.symptom}`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            padding: "0.75rem",
            borderRadius: "var(--radius-md)",
            background: "var(--bg-input)",
            border: "1px solid var(--accent-sage)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              <span aria-hidden style={{ marginRight: 6 }}>
                {openPill.icon}
              </span>
              {openPill.symptom}
            </span>
            <button
              type="button"
              onClick={() => setDraft({ kind: "idle" })}
              aria-label="Close"
              style={{
                background: "transparent",
                border: 0,
                color: "var(--text-muted)",
                fontSize: "var(--text-xs)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              Close
            </button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["mild", "moderate", "severe"] as Severity[]).map((s) => {
              const saving = savingId === `${openPill.symptom}-${s}`;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleLog(openPill, s)}
                  disabled={saving}
                  style={{
                    flex: 1,
                    minHeight: 44,
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
                    fontSize: "var(--text-sm)",
                    fontWeight: 600,
                    textTransform: "capitalize",
                    cursor: saving ? "wait" : "pointer",
                  }}
                >
                  {saving ? "Saving..." : s}
                </button>
              );
            })}
          </div>
          {openPillTodays.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {openPillTodays.slice(-3).map((t) => (
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

      {entries.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-xs)",
            color: "var(--text-muted)",
          }}
        >
          Nothing logged yet today. A quiet day is still a day.
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
