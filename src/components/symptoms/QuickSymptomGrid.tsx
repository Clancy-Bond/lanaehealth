"use client";

import { useState } from "react";
import Link from "next/link";
import { DEFAULT_PILLS } from "@/lib/symptoms/types";
import type { Severity } from "@/lib/types";

/**
 * QuickSymptomGrid: the ten-second log surface used at /log/quick.
 *
 * Shows an emoji grid and a sticky severity selector. Tap a symptom
 * -> POST /api/symptoms/quick-log with severity + timestamp. Works
 * without JS because every pill is inside its own <form>, and severity
 * is a hidden input that the client component updates as state.
 */
export default function QuickSymptomGrid() {
  const [severity, setSeverity] = useState<Severity>("moderate");
  const [justLogged, setJustLogged] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleLog = async (
    symptom: string,
    category: string,
    icon: string,
  ) => {
    setSaving(true);
    try {
      const body = new URLSearchParams({
        symptom,
        category,
        severity,
      });
      const res = await fetch("/api/symptoms/quick-log", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (res.ok) {
        const time = new Date().toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
        setJustLogged(`${icon} ${symptom} at ${time}`);
        setTimeout(() => setJustLogged(null), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        maxWidth: 640,
        marginInline: "auto",
        padding: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
        }}
      >
        <h1
          style={{
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Ten-second log
        </h1>
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            margin: 0,
          }}
        >
          Tap a tile. Pick severity above the grid. Exact time is saved.
        </p>
      </div>

      <fieldset
        style={{
          border: 0,
          padding: 0,
          margin: 0,
          display: "flex",
          gap: "0.5rem",
          justifyContent: "stretch",
        }}
      >
        <legend style={{ position: "absolute", left: -9999 }}>Severity</legend>
        {(["mild", "moderate", "severe"] as Severity[]).map((s) => {
          const selected = severity === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              aria-pressed={selected}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: "var(--radius-md)",
                border: `1px solid ${
                  selected
                    ? "var(--accent-sage)"
                    : "rgba(107,144,128,0.2)"
                }`,
                background: selected
                  ? "var(--accent-sage-muted)"
                  : "var(--bg-card)",
                color: selected
                  ? "var(--accent-sage)"
                  : "var(--text-secondary)",
                fontSize: "var(--text-sm)",
                fontWeight: 600,
                textTransform: "capitalize",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          );
        })}
      </fieldset>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: "0.625rem",
        }}
      >
        {DEFAULT_PILLS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleLog(p.symptom, p.category, p.icon)}
            disabled={saving}
            style={{
              minHeight: 96,
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(107,144,128,0.18)",
              background: "var(--bg-card)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              cursor: saving ? "wait" : "pointer",
              padding: "0.5rem",
              boxShadow: "var(--shadow-sm)",
            }}
            aria-label={`Log ${p.symptom} at ${severity} severity`}
          >
            <span aria-hidden style={{ fontSize: 28 }}>
              {p.icon}
            </span>
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-primary)",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {p.symptom}
            </span>
          </button>
        ))}
      </div>

      <div
        style={{
          minHeight: 40,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
        aria-live="polite"
      >
        {justLogged ? (
          <span
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--accent-sage)",
              fontWeight: 600,
            }}
          >
            Logged {justLogged}.
          </span>
        ) : (
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-muted)",
            }}
          >
            Tap as many as you need. Each one saves with the exact timestamp.
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginTop: "0.25rem",
        }}
      >
        <Link
          href="/log"
          style={{
            flex: 1,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(107,144,128,0.25)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Full log
        </Link>
        <Link
          href="/"
          style={{
            flex: 1,
            minHeight: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-md)",
            background: "var(--accent-sage)",
            color: "#fff",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Done
        </Link>
      </div>
    </div>
  );
}
