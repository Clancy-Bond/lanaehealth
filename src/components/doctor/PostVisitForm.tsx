"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { Appointment } from "@/lib/types";

interface PostVisitFormProps {
  appointment: Appointment;
}

export function PostVisitForm({ appointment }: PostVisitFormProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(appointment.notes ?? "");
  const [actionItems, setActionItems] = useState(appointment.action_items ?? "");
  const [followUpDate, setFollowUpDate] = useState(appointment.follow_up_date ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.trim() || null,
          action_items: actionItems.trim() || null,
          follow_up_date: followUpDate || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(j.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => router.push("/"), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

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
          justifyContent: "space-between",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--accent-sage)",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={20} />
          <span>Back</span>
        </Link>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>
          Post-visit capture
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid var(--accent-sage)",
            background: saved ? "var(--accent-sage-muted)" : "var(--accent-sage)",
            color: saved ? "var(--accent-sage)" : "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saved ? <Check size={16} /> : null}
          {saved ? "Saved" : saving ? "Saving..." : "Save"}
        </button>
      </header>

      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <section
          style={{
            background: "var(--bg-card)",
            borderRadius: 12,
            padding: "14px 16px",
            border: "1px solid var(--border-light)",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            {appointment.specialty ?? "Appointment"}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {format(new Date(appointment.date + "T00:00:00"), "EEEE, MMM d, yyyy")}
            {appointment.doctor_name ? ` — ${appointment.doctor_name}` : ""}
            {appointment.clinic ? ` @ ${appointment.clinic}` : ""}
          </p>
          {appointment.reason && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              Reason: {appointment.reason}
            </p>
          )}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
            NOTES FROM VISIT
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="What did the doctor say? Symptoms discussed, observations, tests ordered, next steps..."
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: 14,
              lineHeight: 1.5,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
            ACTION ITEMS (one per line)
          </label>
          <textarea
            value={actionItems}
            onChange={(e) => setActionItems(e.target.value)}
            rows={5}
            placeholder="- Refer to OB/GYN for TVUS&#10;- Start low-dose birth control trial&#10;- Retest TSH in 6 weeks"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: 14,
              lineHeight: 1.5,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
            FOLLOW-UP DATE (optional)
          </label>
          <input
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
        </div>

        {error && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              color: "#DC2626",
              fontSize: 13,
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
