"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Check,
  AlertCircle,
  Heart,
  Timer,
} from "lucide-react";

type Phase = "setup" | "resting" | "standing" | "done";

interface Reading {
  minute: 0 | 1 | 3 | 5 | 10;
  hr: number | null;
  systolic: number | null;
  diastolic: number | null;
}

const CHECKPOINTS: Array<0 | 1 | 3 | 5 | 10> = [0, 1, 3, 5, 10];

export function OrthostaticForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [elapsed, setElapsed] = useState(0); // seconds since standing
  const [readings, setReadings] = useState<Reading[]>(
    CHECKPOINTS.map((m) => ({ minute: m, hr: null, systolic: null, diastolic: null }))
  );
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");
  const [hydrationMl, setHydrationMl] = useState<number | "">("");
  const [caffeineMg, setCaffeineMg] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tickRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== "standing") return;

    startTimeRef.current = Date.now();
    tickRef.current = window.setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [phase]);

  const setReading = (minute: Reading["minute"], field: keyof Reading, val: number | null) => {
    setReadings((prev) =>
      prev.map((r) => (r.minute === minute ? { ...r, [field]: val } : r))
    );
  };

  const resting = readings.find((r) => r.minute === 0);
  const peakStanding = Math.max(
    ...readings.filter((r) => r.minute > 0 && r.hr !== null).map((r) => r.hr as number),
    0
  );
  const rise = resting?.hr && peakStanding > 0 ? peakStanding - resting.hr : null;
  const potsPositive = rise !== null && rise >= 30;

  const handleSave = async () => {
    if (!resting?.hr) {
      setError("Resting HR is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        test_date: new Date().toISOString().slice(0, 10),
        resting_hr_bpm: resting.hr,
        resting_bp_systolic: resting.systolic,
        resting_bp_diastolic: resting.diastolic,
        standing_hr_1min: readings.find((r) => r.minute === 1)?.hr ?? null,
        standing_hr_3min: readings.find((r) => r.minute === 3)?.hr ?? null,
        standing_hr_5min: readings.find((r) => r.minute === 5)?.hr ?? null,
        standing_hr_10min: readings.find((r) => r.minute === 10)?.hr ?? null,
        standing_bp_systolic_10min: readings.find((r) => r.minute === 10)?.systolic ?? null,
        standing_bp_diastolic_10min: readings.find((r) => r.minute === 10)?.diastolic ?? null,
        symptoms_experienced: symptoms.trim() || null,
        notes: notes.trim() || null,
        hydration_ml: hydrationMl === "" ? null : Number(hydrationMl),
        caffeine_mg: caffeineMg === "" ? null : Number(caffeineMg),
      };

      const res = await fetch("/api/orthostatic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Save failed (${res.status})`);
      }

      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const nextCheckpoint = CHECKPOINTS.filter((m) => m > 0).find(
    (m) => elapsed < m * 60
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--accent-sage)",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </Link>
        <h1
          style={{
            flex: 1,
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-primary)",
            textAlign: "center",
          }}
        >
          Orthostatic test
        </h1>
        <span style={{ width: 50 }} />
      </header>

      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "20px 16px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {phase === "setup" && (
          <section
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              border: "1px solid var(--border-light)",
              padding: "16px 20px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Before starting
            </h2>
            <ul
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
                paddingLeft: 18,
                margin: "8px 0 16px",
              }}
            >
              <li>Sit or lie down for at least 5 minutes before starting.</li>
              <li>Have a manual HR method ready (wrist pulse, Apple Watch, Oura live).</li>
              <li>Stand still - no marching in place, no leaning on anything.</li>
              <li>Tests count toward POTS criteria if HR rises ≥30 bpm sustained.</li>
            </ul>
            <button
              onClick={() => setPhase("resting")}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid var(--accent-sage)",
                background: "var(--accent-sage)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              I&apos;m resting now →
            </button>
          </section>
        )}

        {phase === "resting" && (
          <section
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              border: "1px solid var(--border-light)",
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Heart size={18} style={{ color: "var(--accent-blush)" }} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Resting measurements
              </h2>
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                margin: "4px 0 14px",
              }}
            >
              Measure while still lying down or seated.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10,
              }}
            >
              <NumberField
                label="HR (bpm)"
                value={resting?.hr}
                onChange={(v) => setReading(0, "hr", v)}
                placeholder="48"
              />
              <NumberField
                label="SBP"
                value={resting?.systolic ?? null}
                onChange={(v) => setReading(0, "systolic", v)}
                placeholder="112"
              />
              <NumberField
                label="DBP"
                value={resting?.diastolic ?? null}
                onChange={(v) => setReading(0, "diastolic", v)}
                placeholder="72"
              />
            </div>
            <button
              disabled={!resting?.hr}
              onClick={() => {
                setElapsed(0);
                setPhase("standing");
              }}
              style={{
                width: "100%",
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid var(--accent-sage)",
                background: resting?.hr ? "var(--accent-sage)" : "var(--bg-elevated)",
                color: resting?.hr ? "#fff" : "var(--text-muted)",
                fontSize: 14,
                fontWeight: 600,
                cursor: resting?.hr ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Play size={16} />
              Stand up now (start 10-min timer)
            </button>
          </section>
        )}

        {phase === "standing" && (
          <section
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              border: "1px solid var(--border-light)",
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Timer size={18} style={{ color: "var(--accent-sage)" }} />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Standing - {fmtTime(elapsed)}
              </h2>
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                margin: "4px 0 12px",
              }}
            >
              {nextCheckpoint
                ? `Next reading due at ${nextCheckpoint} min (in ${fmtTime(nextCheckpoint * 60 - elapsed)}).`
                : "All checkpoints reached. You can stop standing."}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr 1fr",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                MIN
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                HR
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                SBP/DBP (10 min)
              </span>
              {[1, 3, 5, 10].map((m) => {
                const r = readings.find((r) => r.minute === m);
                const isActive = elapsed >= m * 60 && (!nextCheckpoint || m <= nextCheckpoint);
                return (
                  <MinuteRow
                    key={m}
                    minute={m as 1 | 3 | 5 | 10}
                    hr={r?.hr}
                    sbp={m === 10 ? r?.systolic ?? null : undefined}
                    dbp={m === 10 ? r?.diastolic ?? null : undefined}
                    active={isActive}
                    onHr={(v) => setReading(m as 1 | 3 | 5 | 10, "hr", v)}
                    onSbp={(v) => setReading(m as 1 | 3 | 5 | 10, "systolic", v)}
                    onDbp={(v) => setReading(m as 1 | 3 | 5 | 10, "diastolic", v)}
                  />
                );
              })}
            </div>

            {rise !== null && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: potsPositive
                    ? "rgba(220, 38, 38, 0.10)"
                    : "rgba(107, 144, 128, 0.10)",
                  color: potsPositive ? "#DC2626" : "var(--accent-sage)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Peak rise: +{rise} bpm{" "}
                {potsPositive ? "(meets POTS criteria)" : "(below 30 threshold)"}
              </div>
            )}

            <button
              onClick={() => setPhase("done")}
              style={{
                width: "100%",
                marginTop: 14,
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid var(--accent-sage)",
                background: "var(--accent-sage)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Done standing →
            </button>
          </section>
        )}

        {phase === "done" && (
          <section
            style={{
              background: "var(--bg-card)",
              borderRadius: 16,
              border: "1px solid var(--border-light)",
              padding: "16px 20px",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Context (optional)
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                margin: "4px 0 14px",
              }}
            >
              These help distinguish volume-loss vs autonomic causes.
            </p>

            <div
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <TextField
                label="Symptoms during standing"
                value={symptoms}
                onChange={setSymptoms}
                placeholder="dizzy at 3 min, lightheaded at 7 min, palpitations..."
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <NumberField
                  label="Hydration (ml, prior 2h)"
                  value={hydrationMl === "" ? null : hydrationMl}
                  onChange={(v) => setHydrationMl(v ?? "")}
                  placeholder="0"
                />
                <NumberField
                  label="Caffeine (mg, prior 2h)"
                  value={caffeineMg === "" ? null : caffeineMg}
                  onChange={(v) => setCaffeineMg(v ?? "")}
                  placeholder="0"
                />
              </div>
              <TextField
                label="Notes"
                value={notes}
                onChange={setNotes}
                placeholder="anything relevant (recent meds, poor sleep, period, etc.)"
              />
            </div>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 6,
                  color: "#DC2626",
                  fontSize: 13,
                  alignItems: "center",
                }}
              >
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: "100%",
                marginTop: 16,
                padding: "12px 16px",
                borderRadius: 10,
                border: "1px solid var(--accent-sage)",
                background: "var(--accent-sage)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Check size={16} />
              {saving ? "Saving..." : "Save test"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        style={{
          padding: "10px 12px",
          fontSize: 14,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-input)",
          color: "var(--text-primary)",
          fontFamily: "inherit",
          minWidth: 0,
        }}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          fontSize: 14,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg-input)",
          color: "var(--text-primary)",
          fontFamily: "inherit",
        }}
      />
    </label>
  );
}

function MinuteRow({
  minute,
  hr,
  sbp,
  dbp,
  active,
  onHr,
  onSbp,
  onDbp,
}: {
  minute: 1 | 3 | 5 | 10;
  hr: number | null | undefined;
  sbp: number | null | undefined;
  dbp: number | null | undefined;
  active: boolean;
  onHr: (v: number | null) => void;
  onSbp: (v: number | null) => void;
  onDbp: (v: number | null) => void;
}) {
  return (
    <>
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: active ? "var(--text-primary)" : "var(--text-muted)",
          padding: "10px 0",
        }}
      >
        {minute} min
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={hr ?? ""}
        onChange={(e) => onHr(e.target.value === "" ? null : Number(e.target.value))}
        placeholder="HR"
        style={{
          padding: "10px 12px",
          fontSize: 14,
          borderRadius: 8,
          border: `1px solid ${active ? "var(--accent-sage)" : "var(--border)"}`,
          background: "var(--bg-input)",
          fontFamily: "inherit",
          minWidth: 0,
        }}
      />
      {minute === 10 ? (
        <div style={{ display: "flex", gap: 4 }}>
          <input
            type="number"
            inputMode="numeric"
            value={sbp ?? ""}
            onChange={(e) => onSbp(e.target.value === "" ? null : Number(e.target.value))}
            placeholder="SBP"
            style={{
              padding: "10px 8px",
              fontSize: 13,
              borderRadius: 8,
              border: `1px solid ${active ? "var(--accent-sage)" : "var(--border)"}`,
              background: "var(--bg-input)",
              fontFamily: "inherit",
              width: "50%",
              minWidth: 0,
            }}
          />
          <input
            type="number"
            inputMode="numeric"
            value={dbp ?? ""}
            onChange={(e) => onDbp(e.target.value === "" ? null : Number(e.target.value))}
            placeholder="DBP"
            style={{
              padding: "10px 8px",
              fontSize: 13,
              borderRadius: 8,
              border: `1px solid ${active ? "var(--accent-sage)" : "var(--border)"}`,
              background: "var(--bg-input)",
              fontFamily: "inherit",
              width: "50%",
              minWidth: 0,
            }}
          />
        </div>
      ) : (
        <span />
      )}
    </>
  );
}
